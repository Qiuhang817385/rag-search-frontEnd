/**
 * 与 Nest 后端约定：`main.ts` 里 `setGlobalPrefix('api')`，故业务路径均以 `/api` 开头。
 * 环境变量：`NEXT_PUBLIC_API_URL` = 仅 origin（无末尾 `/`），例如 `http://localhost:3025`
 */

/** 全局 REST 前缀（勿含尾部斜杠） */
export const BACKEND_API_PREFIX = '/api'

/** 各模块路径（pathname，不含 origin） */
export const ragEndpoints = {
  /** POST body: { text: string, filename?: string } → 切片 + embedding 入库 */
  documentsIngest: `${BACKEND_API_PREFIX}/documents/ingest`,
  /** POST body: { text: string } → { embedding, dimensions, model } */
  embedding: `${BACKEND_API_PREFIX}/embedding`,
  /** POST body: { query, topK?, documentId? } → 向量检索 top 相似块 */
  ragSearch: `${BACKEND_API_PREFIX}/rag/search`,
  /** POST SSE：`text/event-stream`，body `{ message, topK?, documentId? }` */
  ragChatStream: `${BACKEND_API_PREFIX}/rag/chat`,
} as const

export function getBackendOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ??
    'http://localhost:3025'
  )
}

/** 拼完整请求 URL */
export function backendUrl(pathname: string): string {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${getBackendOrigin()}${p}`
}

/** 文档入库请求体（与 `back_end` IngestRequestDto 一致） */
export type IngestRequestBody = {
  text: string
  filename?: string
}

export async function postDocumentsIngest(
  body: IngestRequestBody,
): Promise<Response> {
  return fetch(backendUrl(ragEndpoints.documentsIngest), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export type RagSearchRequestBody = {
  query: string
  topK?: number
  documentId?: string
}

export async function postRagSearch(
  body: RagSearchRequestBody,
): Promise<Response> {
  return fetch(backendUrl(ragEndpoints.ragSearch), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export type RagChatRequestBody = {
  message: string
  topK?: number
  documentId?: string
}

/** RAG 对话流（SSE），需自行解析 response.body ReadableStream；可传 signal 中止 */
export function postRagChatStream(
  body: RagChatRequestBody,
  init?: RequestInit,
): Promise<Response> {
  return fetch(backendUrl(ragEndpoints.ragChatStream), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    body: JSON.stringify(body),
    ...init,
  })
}
