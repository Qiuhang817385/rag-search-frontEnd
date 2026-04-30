'use client'

import { Sender, Think, XProvider } from '@ant-design/x'
import { Alert, Button, Card, Input, Space, Tag, Typography } from 'antd'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import { postRagChatStream } from '@/lib/rag-api'
import {
  consumeRagChatSse,
  type RagSseMetaEvent,
  type RagSseParsed,
} from '@/lib/rag-sse-parse'
import { matchCitationsToAnswer } from '@/lib/rag-citation-match'
import { countTokens } from '@/lib/rag-tokens'

const { Text } = Typography

const mdComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>
  ),
  ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-zinc-900/90 p-3 text-sm text-zinc-100 [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    if (className?.includes('language-')) {
      return <code className={className}>{children}</code>
    }
    return (
      <code className="rounded bg-zinc-200 px-1 font-mono text-[0.9em] dark:bg-zinc-700">
        {children}
      </code>
    )
  },
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-lg font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-2 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-blue-600 underline hover:text-blue-500 dark:text-blue-400"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-4 border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400">
      {children}
    </blockquote>
  ),
}

export default function RagChatPanel() {
  const [senderValue, setSenderValue] = useState('')
  const [documentIdFilter, setDocumentIdFilter] = useState('')
  const [lastQuestion, setLastQuestion] = useState('')
  const [answerMd, setAnswerMd] = useState('')
  const [reasoningMd, setReasoningMd] = useState('')
  /** 推理阶段是否结束（首个正文 token / done / error） */
  const [reasoningComplete, setReasoningComplete] = useState(true)
  /** Think 展开：推理结束后自动折叠，用户仍可手动展开 */
  const [thinkExpanded, setThinkExpanded] = useState(true)
  const [meta, setMeta] = useState<RagSseMetaEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const submitSeqRef = useRef(0)

  const handleEvent = useCallback((ev: RagSseParsed) => {
    if (!ev || typeof ev !== 'object' || !('type' in ev)) return
    const t = ev.type
    if (t === 'meta') {
      setMeta(ev as RagSseMetaEvent)
      return
    }
    if (t === 'token' && typeof (ev as { text?: string }).text === 'string') {
      setAnswerMd((prev) => prev + (ev as { text: string }).text)
      setReasoningComplete(true)
      setThinkExpanded(false)
      return
    }
    if (
      t === 'reasoning' &&
      typeof (ev as { text?: string }).text === 'string'
    ) {
      setReasoningMd((prev) => prev + (ev as { text: string }).text)
      return
    }
    if (t === 'done') {
      setReasoningComplete(true)
      setThinkExpanded(false)
      setLoading(false)
      return
    }
    if (t === 'error') {
      const msg =
        typeof (ev as { message?: string }).message === 'string'
          ? (ev as { message: string }).message
          : '流式错误'
      setError(msg)
      setReasoningComplete(true)
      setThinkExpanded(false)
      setLoading(false)
    }
  }, [])

  const onSubmit = useCallback(
    async (message: string) => {
      const q = message.trim()
      if (!q) return

      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      const submitId = ++submitSeqRef.current

      const doc = documentIdFilter.trim()

      setLastQuestion(q)
      setAnswerMd('')
      setReasoningMd('')
      setReasoningComplete(false)
      setThinkExpanded(true)
      setMeta(null)
      setError(null)
      setLoading(true)
      setSenderValue('')

      try {
        const res = await postRagChatStream(
          {
            message: q,
            topK: 5,
            ...(doc ? { documentId: doc } : {}),
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

        await consumeRagChatSse(res.body, {
          onEvent: handleEvent,
        })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          return
        }
        setError(e instanceof Error ? e.message : '请求失败')
        setThinkExpanded(false)
      } finally {
        setLoading(false)
        if (submitId === submitSeqRef.current) {
          setReasoningComplete(true)
        }
      }
    },
    [documentIdFilter, handleEvent],
  )

  const metaSummary =
    meta &&
    [
      meta.filterDocumentId && meta.filterDocumentName
        ? `限定文档 ${meta.filterDocumentName}`
        : null,
      `检索维度 ${meta.dimensions} · 比对块 ${meta.totalChunksCompared} · 命中 ${meta.hitCount}`,
    ]
      .filter(Boolean)
      .join(' · ')

  const answerTokenCount = useMemo(() => countTokens(answerMd), [answerMd])
  const reasoningTokenCount = useMemo(
    () => countTokens(reasoningMd),
    [reasoningMd],
  )

  const citationMatches = useMemo(
    () => matchCitationsToAnswer(answerMd, meta?.hits ?? []),
    [answerMd, meta?.hits],
  )

  return (
    <XProvider>
      <Typography.Title level={4} className="mb-3!">
        RAG 对话（SSE）
      </Typography.Title>
      <Text type="secondary" className="mb-4 block text-sm">
        POST /api/rag/chat · @ant-design/x Sender · ReadableStream 解析 SSE ·
        react-markdown 增量渲染
      </Text>

      <Space orientation="vertical" size="middle" className="w-full">
        <Space wrap align="center" className="w-full">
          <Text type="secondary" className="text-xs">
            限定文档（可选）
          </Text>
          <Input
            placeholder="documentId，留空则全库检索"
            value={documentIdFilter}
            onChange={(e) => setDocumentIdFilter(e.target.value)}
            style={{ maxWidth: 360 }}
            allowClear
            className="font-mono text-sm"
          />
        </Space>

        {lastQuestion && (
          <Card size="small" title="你的问题">
            <Text>{lastQuestion}</Text>
          </Card>
        )}

        {error && (
          <Alert type="error" message={error} showIcon className="w-full" />
        )}

        {(answerMd || reasoningMd || loading) && (
          <Card
            size="small"
            title="模型回复"
            extra={
              <Space size={4} wrap className="items-center">
                <Text type="secondary" className="text-xs">
                  token:
                </Text>
                {reasoningMd ? (
                  <Tag className="m-0">推理 {reasoningTokenCount}</Tag>
                ) : null}
                <Tag color="blue" className="m-0">
                  正文 {answerTokenCount}
                </Tag>
                {reasoningMd && (answerMd || loading) ? (
                  <Tag className="m-0">
                    合计 {reasoningTokenCount + answerTokenCount}
                  </Tag>
                ) : null}
              </Space>
            }
          >
            {meta ? (
              <Text type="secondary" className="mb-2 block text-xs">
                {metaSummary ?? ''}
              </Text>
            ) : null}

            {reasoningMd || (!reasoningComplete && loading) ? (
              <Think
                className="mb-3"
                title={`推理过程 · token: ${reasoningTokenCount}`}
                loading={!reasoningComplete && loading}
                expanded={thinkExpanded}
                onExpand={setThinkExpanded}
              >
                {reasoningMd ? (
                  <div className="max-h-40 overflow-auto text-xs text-zinc-600 dark:text-zinc-400 [&_.mb-2]:mb-1">
                    <ReactMarkdown components={mdComponents}>
                      {reasoningMd}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <Text type="secondary" className="text-xs">
                    等待推理内容…
                  </Text>
                )}
              </Think>
            ) : null}

            {meta && meta.hits.length > 0 ? (
              <div className="mb-3">
                <Text type="secondary" className="mb-1.5 block text-xs">
                  引用来源（与已生成正文做 trigram 重叠匹配；若模型写出「片段
                  n」等哨兵也会点亮）
                </Text>
                <Space wrap size="small">
                  {meta.hits.map((h, idx) => {
                    const m = citationMatches.get(h.chunkId)
                    const active = m?.active ?? false
                    const tip = m
                      ? `重叠 ${(m.overlapScore * 100).toFixed(1)}%${m.fromSentinel ? ' · 哨兵' : ''}`
                      : ''
                    return (
                      <Button
                        key={h.chunkId}
                        size="small"
                        type={active ? 'primary' : 'default'}
                        title={tip}
                      >
                        [{idx + 1}]{' '}
                        {h.documentName ? `${h.documentName} · ` : null}
                        <Typography.Text copyable className="text-xs">
                          {h.documentId}
                        </Typography.Text>
                        {' · '}#{h.chunkIndex} · sim {h.score.toFixed(3)}
                      </Button>
                    )
                  })}
                </Space>
              </div>
            ) : meta && meta.hits.length === 0 ? (
              <Text type="secondary" className="mb-3 block text-xs">
                本轮检索无命中片段
              </Text>
            ) : null}

            <div className="max-w-none text-zinc-900 dark:text-zinc-100">
              {answerMd ? (
                <ReactMarkdown components={mdComponents}>
                  {answerMd}
                </ReactMarkdown>
              ) : loading ? (
                <Text type="secondary">等待正文 token…</Text>
              ) : null}
            </div>
          </Card>
        )}

        <div className="rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
          <Sender
            value={senderValue}
            onChange={(v) => setSenderValue(v)}
            onSubmit={onSubmit}
            loading={loading}
            placeholder="输入问题，Enter 发送（Shift+Enter 换行）"
            submitType="enter"
            autoSize={{ minRows: 2, maxRows: 8 }}
          />
        </div>
      </Space>
    </XProvider>
  )
}
