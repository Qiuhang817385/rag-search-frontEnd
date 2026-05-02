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

/** R2 存储相关接口 */
export const storageEndpoints = {
  docPresignUpload: `${BACKEND_API_PREFIX}/storage/doc/presign-upload`,
  docPresignDownload: `${BACKEND_API_PREFIX}/storage/doc/presign-download`,
  imagePresignUpload: `${BACKEND_API_PREFIX}/storage/image/presign-upload`,
  imagePresignDownload: `${BACKEND_API_PREFIX}/storage/image/presign-download`,
  docDelete: `${BACKEND_API_PREFIX}/storage/doc/delete`,
  imageDelete: `${BACKEND_API_PREFIX}/storage/image/delete`,
} as const

export type StorageType = 'doc' | 'image'

export type PresignUploadRequest = {
  filename: string
  contentType: string
}

export type PresignUploadResponse = {
  uploadUrl: string
  key: string
  publicUrl: string
}

export type PresignDownloadResponse = {
  downloadUrl: string
}

export type StorageDeleteRequest = {
  key: string
}

export async function getPresignedUploadUrl(
  type: StorageType,
  filename: string,
  contentType: string,
): Promise<PresignUploadResponse> {
  const endpoint = type === 'doc' ? storageEndpoints.docPresignUpload : storageEndpoints.imagePresignUpload
  const res = await fetch(backendUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType } satisfies PresignUploadRequest),
  })
  if (!res.ok) throw new Error(`获取上传链接失败: ${res.status}`)
  return res.json()
}

export async function getPresignedDownloadUrl(
  type: StorageType,
  key: string,
): Promise<string> {
  const endpoint = type === 'doc' ? storageEndpoints.docPresignDownload : storageEndpoints.imagePresignDownload
  const res = await fetch(backendUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key } satisfies StorageDeleteRequest),
  })
  if (!res.ok) throw new Error(`获取下载链接失败: ${res.status}`)
  const data = await res.json()
  return data.downloadUrl
}

export async function deleteStorageObject(
  type: StorageType,
  key: string,
): Promise<void> {
  const endpoint = type === 'doc' ? storageEndpoints.docDelete : storageEndpoints.imageDelete
  const res = await fetch(backendUrl(endpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key } satisfies StorageDeleteRequest),
  })
  if (!res.ok) throw new Error(`删除失败: ${res.status}`)
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
