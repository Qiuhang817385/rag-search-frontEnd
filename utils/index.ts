import { Message } from '@/store/chat-store'

// 工具函数：清除历史消息中的 think / reasoningComplete / thinkExpanded
function stripThink(messages: Message[]): Message[] {
  return messages.map((m) => {
    if (m.role === 'assistant' && m.think) {
      return {
        ...m,
        think: undefined,
        reasoningComplete: undefined,
        thinkExpanded: undefined,
      } // 去除 think / reasoningComplete / thinkExpanded
    }
    return m
  })
}

export function buildPayloadMessages(
  systemPrompt: string,
  messages: Message[],
  maxRounds: number,
): Message[] {
  const result: Message[] = []
  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt })
  }

  // 只取最近 maxRounds 轮，考虑到 user 和 assistant 成对出现
  const recentMsgs = messages.slice(-maxRounds * 2)
  // 清除 history 中的 think / reasoningComplete / thinkExpanded
  const recentMsgsWithoutThink = stripThink(recentMsgs)
  // 只保留 system 和 user 消息
  result.push(...recentMsgsWithoutThink.filter((m) => m.role !== 'system'))
  return result
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
