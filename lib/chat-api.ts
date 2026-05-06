/**
 * RAG / 存储等业务 API。浏览器端经 `nestBffPath` 走 Next BFF，以携带 `session_id`。
 * 环境变量：`NEXT_PUBLIC_API_URL` = Nest 的 origin（无末尾 `/`）。
 */

import {
  BACKEND_API_PREFIX,
  getBackendOrigin,
  nestBffPath,
} from '@/lib/backend-url'
import { bffFetch } from './rag-api'

type MessageDto = {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: {
    url: string
    base64?: string
  }[]
}

type ChatStreamRequest = {
  sessionId: string
  chatType: 'plain' | 'rag' | 'roleplay'
  userMessage: string
  history: MessageDto[]
}

export {
  BACKEND_API_PREFIX,
  getBackendOrigin,
  nestBffPath,
} from '@/lib/backend-url'

function assertClient(label: string) {
  if (typeof window === 'undefined') {
    throw new Error(
      `${label} 仅能在浏览器调用；请在 Server Action / RSC 中使用 dal.fetchAPI 或 fetchBackendRaw。`,
    )
  }
}

export const chatEndpoints = {
  chatStream: `${BACKEND_API_PREFIX}/chat/stream`,
} as const

export function postChatStream(
  body: ChatStreamRequest,
  init?: RequestInit,
): Promise<Response> {
  assertClient('postChatStream')
  return bffFetch(chatEndpoints.chatStream, {
    method: 'POST',
    body: JSON.stringify(body),
    ...init,
  })
}
