/**
 * 解析 Nest RAG 接口 `POST /api/rag/chat` 返回的 SSE：
 * 每帧 `data: <JSON>\n\n`，JSON 含 type: meta | token | reasoning | done | error | …
 */

export type RagMetaHit = {
  chunkId: string
  documentId: string
  chunkIndex: number
  score: number
  /** `rag_documents.filename`，缺失时与后端一致回退为 documentId */
  documentName?: string
  /** 检索片段正文；用于前端流式输出与 chunk 的词汇/字符重叠匹配 */
  content?: string
}

export type RagSseMetaEvent = {
  type: 'meta'
  filterDocumentId: string | null
  /** 限定检索时的文档展示名（filename，无则 id）；未限定时为 null */
  filterDocumentName?: string | null
  dimensions: number
  totalChunksCompared: number
  hitCount: number
  hits: RagMetaHit[]
}

export type RagSseParsed =
  | RagSseMetaEvent
  | { type: 'token'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: string; [k: string]: unknown }

function extractDataLines(block: string): string[] {
  const out: string[] = []
  const normalized = block.replace(/\r\n/g, '\n')
  for (const line of normalized.split('\n')) {
    const t = line.trim()
    if (!t) continue
    if (t.startsWith('data:')) {
      out.push(t.replace(/^data:\s?/, '').trim())
    }
  }
  return out
}

/** 从单次 SSE 块中解析 JSON 行（允许多行 data:） */
export function parseSseDataPayloads(buffer: string): {
  payloads: string[]
  /** 未形成完整 \n\n 的尾部，需与下次 decode 拼接 */
  rest: string
} {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const rest = parts.pop() ?? ''
  const payloads: string[] = []
  for (const block of parts) {
    for (const line of extractDataLines(block)) {
      if (line) payloads.push(line)
    }
  }
  return { payloads, rest }
}

export async function consumeRagChatSse(
  body: ReadableStream<Uint8Array> | null,
  handlers: {
    onEvent?: (ev: RagSseParsed) => void
  },
): Promise<void> {
  if (!body) {
    throw new Error('响应无 body')
  }
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let carry = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      carry += decoder.decode(value, { stream: true })
      const { payloads, rest } = parseSseDataPayloads(carry)
      carry = rest
      for (const raw of payloads) {
        try {
          const ev = JSON.parse(raw) as RagSseParsed
          handlers.onEvent?.(ev)
        } catch {
          // 忽略无法解析的片段
        }
      }
    }
    if (carry.trim()) {
      const { payloads } = parseSseDataPayloads(carry + '\n\n')
      for (const raw of payloads) {
        try {
          const ev = JSON.parse(raw) as RagSseParsed
          handlers.onEvent?.(ev)
        } catch {
          /* empty */
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
