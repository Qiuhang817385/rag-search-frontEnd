/**
 * RAG / 存储等业务 API。浏览器端经 `nestBffPath` 走 Next BFF，以携带 `session_id`。
 * 环境变量：`NEXT_PUBLIC_API_URL` = Nest 的 origin（无末尾 `/`）。
 */

import {
  BACKEND_API_PREFIX,
  getBackendOrigin,
  nestBffPath,
} from '@/lib/backend-url'

export { BACKEND_API_PREFIX, getBackendOrigin, nestBffPath } from '@/lib/backend-url'

function assertClient(label: string) {
  if (typeof window === 'undefined') {
    throw new Error(
      `${label} 仅能在浏览器调用；请在 Server Action / RSC 中使用 dal.fetchAPI 或 fetchBackendRaw。`,
    )
  }
}

/** 经 BFF 转发到 Nest（自动携带 Cookie） */
function bffFetch(apiPath: string, init: RequestInit = {}): Promise<Response> {
  assertClient('bffFetch')
  return fetch(nestBffPath(apiPath), {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

/** 各模块路径（pathname，含 `/api`） */
export const ragEndpoints = {
  documentsIngest: `${BACKEND_API_PREFIX}/documents/ingest`,
  embedding: `${BACKEND_API_PREFIX}/embedding`,
  ragSearch: `${BACKEND_API_PREFIX}/rag/search`,
  ragChatStream: `${BACKEND_API_PREFIX}/rag/chat`,
} as const

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
  const endpoint =
    type === 'doc'
      ? storageEndpoints.docPresignUpload
      : storageEndpoints.imagePresignUpload
  const res = await bffFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      filename,
      contentType,
    } satisfies PresignUploadRequest),
  })
  if (!res.ok) throw new Error(`获取上传链接失败: ${res.status}`)
  return res.json()
}

export async function getPresignedDownloadUrl(
  type: StorageType,
  key: string,
): Promise<string> {
  const endpoint =
    type === 'doc'
      ? storageEndpoints.docPresignDownload
      : storageEndpoints.imagePresignDownload
  const res = await bffFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({ key } satisfies StorageDeleteRequest),
  })
  if (!res.ok) throw new Error(`获取下载链接失败: ${res.status}`)
  const data = (await res.json()) as PresignDownloadResponse
  return data.downloadUrl
}

export async function deleteStorageObject(
  type: StorageType,
  key: string,
): Promise<void> {
  const endpoint =
    type === 'doc' ? storageEndpoints.docDelete : storageEndpoints.imageDelete
  const res = await bffFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({ key } satisfies StorageDeleteRequest),
  })
  if (!res.ok) throw new Error(`删除失败: ${res.status}`)
}

export type IngestRequestBody = {
  text: string
  filename?: string
}

export async function postDocumentsIngest(
  body: IngestRequestBody,
): Promise<Response> {
  return bffFetch(ragEndpoints.documentsIngest, {
    method: 'POST',
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
  return bffFetch(ragEndpoints.ragSearch, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export type RagChatRequestBody = {
  message: string
  topK?: number
  documentId?: string
}

export function postRagChatStream(
  body: RagChatRequestBody,
  init?: RequestInit,
): Promise<Response> {
  assertClient('postRagChatStream')
  return fetch(nestBffPath(ragEndpoints.ragChatStream), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    body: JSON.stringify(body),
    credentials: 'include',
    ...init,
  })
}
