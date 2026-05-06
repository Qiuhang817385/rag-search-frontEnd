import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { postChatStream } from '@/lib/chat-api'
import { buildPayloadMessages, fileToBase64 } from '@/utils'
import { immer } from 'zustand/middleware/immer'
import {
  consumeRagChatSse,
  type RagSseMetaEvent,
  type RagSseParsed,
} from '@/lib/rag-sse-parse'
// {
//   "chat_session_id": "91d11f33-b8e8-43a0-b6cc-d98d35e1b1ec",
//   "message_id": 24,
//   "fallback_to_resume": true
// }

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string // 纯文本时用 content
  imageUrl?: string // 多模态时可选
  imageBase64?: string // 本地选择图片后的 base64 预览
  think?: string // 推理阶段的内容
  reasoningComplete?: boolean
  thinkExpanded?: boolean
  meta?: RagSseMetaEvent | null
}

interface ChatState {
  sessionId: string
  messages: Message[]
  systemPrompt: string // 固定人设，持久保留
  isLoading: boolean
  // abortRef: RefObject<AbortController | null>;
  abortController: AbortController | null
  error: string | null
  // action
  loadHistoryFromServer: (sessionId: string) => Promise<void>
  stopGeneration: () => void
  setSystemPrompt: (prompt: string) => void

  // 处理消息
  sendMessage: (content: string, image?: File) => Promise<void>
  handleEvent: (ev: RagSseParsed) => void
  consumeChatSse: (body: ReadableStream<Uint8Array> | null) => Promise<void>
  // 处理消息

  setReasoningComplete: (index: number, reasoningComplete: boolean) => void
  setThinkExpanded: (index: number, thinkExpanded: boolean) => void
  clearSession: () => void
}

const MAX_RECENT_ROUNDS = 10 // 发送给后端的最近轮数（每轮 user+assistant）

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    sessionId: uuidv4(),
    messages: [],
    systemPrompt: '你是一个有帮助的助手',
    isLoading: false,
    abortController: null,
    error: null,
    // action
    loadHistoryFromServer: async (sessionId) => {
      set((state) => {
        state.isLoading = true
      })
      try {
        const res = await fetch(`/api/chat/history/${sessionId}`)
        const data = await res.json()
        set((state) => {
          state.sessionId = sessionId
          state.messages = data.messages || []
          state.systemPrompt = data.systemPrompt || state.systemPrompt
          state.isLoading = false
        })
      } catch (err) {
        set((state) => {
          state.isLoading = false
        })
      }
    },
    stopGeneration: () => {
      const { abortController } = get()
      if (abortController) {
        abortController.abort()
      }
    },
    setSystemPrompt: (prompt) =>
      set((state) => {
        state.systemPrompt = prompt
      }),

    // 处理消息-------------------------------------------------------
    /** 仅更新「当前轮」最后一条 assistant；占位须在 consume 前由 sendMessage 推入 */
    handleEvent: (ev: RagSseParsed) => {
      const { setReasoningComplete, setThinkExpanded } = get()
      const msgs = get().messages
      const assistantIndex = msgs.length - 1
      if (assistantIndex < 0) return
      if (msgs[assistantIndex].role !== 'assistant') return

      if (!ev || typeof ev !== 'object' || !('type' in ev)) return
      const t = ev.type
      if (t === 'meta') {
        set((state) => {
          const msg = state.messages[assistantIndex]
          msg.meta = ev as RagSseMetaEvent
        })
        return
      }
      if (t === 'token' && typeof (ev as { text?: string }).text === 'string') {
        // setAnswerMd((prev) => prev + (ev as { text: string }).text)
        set((state) => {
          const msg = state.messages[assistantIndex]
          msg.content += (ev as { text: string }).text
        })

        setReasoningComplete(assistantIndex, true)
        setThinkExpanded(assistantIndex, false)
        return
      }
      if (
        t === 'reasoning' &&
        typeof (ev as { text?: string }).text === 'string'
      ) {
        // setReasoningMd((prev) => prev + (ev as { text: string }).text)
        set((state) => {
          const msg = state.messages[assistantIndex]
          msg.think += (ev as { text: string }).text
        })
        return
      }
      if (t === 'done') {
        set((state) => {
          state.isLoading = false
        })
        setThinkExpanded(assistantIndex, false)
        setReasoningComplete(assistantIndex, true)
        return
      }
      if (t === 'error') {
        const msg =
          typeof (ev as { message?: string }).message === 'string'
            ? (ev as { message: string }).message
            : '流式错误'
        setThinkExpanded(assistantIndex, false)
        setReasoningComplete(assistantIndex, true)
        set((state) => {
          state.error = msg
          state.isLoading = false
        })
      }
    },
    consumeChatSse: async (body: ReadableStream<Uint8Array> | null) => {
      const { handleEvent } = get()
      await consumeRagChatSse(body, { onEvent: handleEvent })
    },
    sendMessage: async (content, image) => {
      const {
        sessionId,
        systemPrompt,
        abortController: oldController,
        consumeChatSse,
      } = get()

      if (oldController) {
        oldController.abort()
      }

      const ac = new AbortController()

      set((state) => {
        state.abortController = ac
        state.error = null
      })

      const userMsg: Message = { role: 'user', content }

      if (image) {
        userMsg.imageBase64 = await fileToBase64(image)
      }

      // 立即添加用户消息到本地
      set((state) => {
        state.messages.push(userMsg)
        state.isLoading = true
      })

      const updatedMessages = get().messages

      const payloadMessages = buildPayloadMessages(
        // 注意，在 rolePlay 和 rag 中，systemPrompt 是固定的，不需要在 payloadMessages 中添加
        systemPrompt,
        updatedMessages,
        MAX_RECENT_ROUNDS,
      )

      try {
        const res = await postChatStream(
          {
            sessionId,
            chatType: 'roleplay',
            userMessage: content,
            history: payloadMessages,
          },
          { signal: ac.signal },
        )

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          const m = errBody?.message
          const msg = Array.isArray(m)
            ? m.join(', ')
            : typeof m === 'string'
              ? m
              : `HTTP ${res.status}`
          throw new Error(msg)
        }

        set((state) => {
          state.messages.push({
            role: 'assistant',
            content: '',
            think: '',
            reasoningComplete: false,
            thinkExpanded: true,
            meta: null,
          })
        })

        await consumeChatSse(res.body)

        // console.log('res', res)

        // const data = await res.json()

        // console.log('data', data)

        // const assistantMsg: Message = { role: 'assistant', content: data.reply }
        // set((state) => {
        //   state.messages.push(assistantMsg)
        //   state.isLoading = false
        // })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          set((state) => {
            state.error = err instanceof Error ? err.message : '请求失败'
          })
        }
      } finally {
        set((state) => {
          state.isLoading = false
          state.abortController = null
        })
      }
    },
    // 处理消息-------------------------------------------------------
    setReasoningComplete: (index, reasoningComplete) =>
      set((state) => {
        state.messages[index].reasoningComplete = reasoningComplete
      }),
    setThinkExpanded: (index, thinkExpanded) =>
      set((state) => {
        state.messages[index].thinkExpanded = thinkExpanded
      }),

    clearSession: () =>
      set((state) => {
        state.sessionId = uuidv4()
        state.messages = []
        state.isLoading = false
      }),
  })),
)
