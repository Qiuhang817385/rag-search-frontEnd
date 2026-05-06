'use client'

import {
  Bubble,
  type BubbleItemType,
  Sender,
  Think,
  XProvider,
} from '@ant-design/x'
import { Alert, Button, Space, Tag, Typography } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { Streamdown } from 'streamdown'
import { createCodePlugin } from '@streamdown/code'
import { mermaid } from '@streamdown/mermaid'
import { math } from '@streamdown/math'
import { cjk } from '@streamdown/cjk'

import { type RagSseMetaEvent } from '@/lib/rag-sse-parse'
import { matchCitationsToAnswer } from '@/lib/rag-citation-match'
import { countTokens } from '@/lib/rag-tokens'
import { type Message, useChatStore } from '@/store/chat-store'

const { Text } = Typography

function metaSummaryFrom(meta: RagSseMetaEvent): string {
  return [
    meta.filterDocumentId && meta.filterDocumentName
      ? `限定文档 ${meta.filterDocumentName}`
      : null,
    `检索维度 ${meta.dimensions} · 比对块 ${meta.totalChunksCompared} · 命中 ${meta.hitCount}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

type RagAssistantBubbleContentProps = {
  meta: RagSseMetaEvent | null
  metaSummary: string | null
  reasoningMd: string
  reasoningComplete: boolean
  thinkExpanded: boolean
  onThinkExpand: (v: boolean) => void
  reasoningTokenCount: number
  loading: boolean
  streamdownPlugins: {
    code: ReturnType<typeof createCodePlugin>
    mermaid: typeof mermaid
    math: typeof math
    cjk: typeof cjk
  }
  citationMatches: ReturnType<typeof matchCitationsToAnswer>
  answerMd: string
}

function RagAssistantBubbleContent({
  meta,
  metaSummary,
  reasoningMd,
  reasoningComplete,
  thinkExpanded,
  onThinkExpand,
  reasoningTokenCount,
  loading,
  streamdownPlugins,
  citationMatches,
  answerMd,
}: RagAssistantBubbleContentProps) {
  return (
    <div className="max-w-none text-left">
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
          onExpand={onThinkExpand}
        >
          {reasoningMd ? (
            <div className="max-h-40 overflow-auto text-xs text-zinc-600 dark:text-zinc-400 [&_.mb-2]:mb-1">
              <Streamdown
                className="rag-streamdown rag-streamdown--compact"
                animated
                plugins={streamdownPlugins}
                isAnimating={thinkExpanded}
              >
                {reasoningMd}
              </Streamdown>
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
                  [{idx + 1}] {h.documentName ? `${h.documentName} · ` : null}
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
          <Streamdown
            className="rag-streamdown"
            animated
            plugins={streamdownPlugins}
            isAnimating={loading}
          >
            {answerMd}
          </Streamdown>
        ) : loading ? (
          <Text type="secondary">等待正文 token…</Text>
        ) : null}
      </div>
    </div>
  )
}

function userBubbleContent(msg: Message) {
  if (msg.imageBase64) {
    return (
      <div className="space-y-2 text-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={msg.imageBase64}
          alt=""
          className="max-h-48 max-w-full rounded-md border border-zinc-200 object-contain dark:border-zinc-700"
        />
        {msg.content ? (
          <div className="whitespace-pre-wrap">{msg.content}</div>
        ) : null}
      </div>
    )
  }
  return msg.content
}

export default function ChatPanel() {
  const messages = useChatStore((s) => s.messages)
  const isLoading = useChatStore((s) => s.isLoading)
  const error = useChatStore((s) => s.error)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const stopGeneration = useChatStore((s) => s.stopGeneration)
  const setThinkExpanded = useChatStore((s) => s.setThinkExpanded)

  const [senderValue, setSenderValue] = useState('')

  const onSubmit = useCallback(
    async (message: string) => {
      const q = message.trim()
      if (!q) return
      setSenderValue('')
      await sendMessage(q)
    },
    [sendMessage],
  )

  const codePlugin = useMemo(
    () =>
      createCodePlugin({
        themes: ['github-light', 'github-dark'],
      }),
    [],
  )

  const streamdownPlugins = useMemo(
    () => ({ code: codePlugin, mermaid, math, cjk }),
    [codePlugin],
  )

  const bubbleItems = useMemo((): BubbleItemType[] => {
    const rows = messages
      .map((msg, idx) => ({ msg, idx }))
      .filter(({ msg }) => msg.role !== 'system')

    return rows.map(({ msg, idx }) => {
      if (msg.role === 'user') {
        return {
          key: `user-${idx}`,
          role: 'user',
          placement: 'end',
          shape: 'round',
          variant: 'filled',
          content: userBubbleContent(msg),
        }
      }

      const streaming =
        isLoading && msg.role === 'assistant' && idx === messages.length - 1
      const answerMd = msg.content ?? ''
      const reasoningMd = msg.think ?? ''
      const meta = msg.meta ?? null
      const reasoningComplete = msg.reasoningComplete ?? true
      const thinkExpanded = msg.thinkExpanded ?? false
      const metaSummary = meta ? metaSummaryFrom(meta) : null
      const citationMatches = matchCitationsToAnswer(answerMd, meta?.hits ?? [])
      const answerTokenCount = countTokens(answerMd)
      const reasoningTokenCount = countTokens(reasoningMd)

      return {
        key: `assistant-${idx}`,
        role: 'ai',
        placement: 'start',
        variant: 'outlined' as const,
        streaming,
        content: (
          <RagAssistantBubbleContent
            meta={meta}
            metaSummary={metaSummary}
            reasoningMd={reasoningMd}
            reasoningComplete={reasoningComplete}
            thinkExpanded={thinkExpanded}
            onThinkExpand={(v) => setThinkExpanded(idx, v)}
            reasoningTokenCount={reasoningTokenCount}
            loading={streaming}
            streamdownPlugins={streamdownPlugins}
            citationMatches={citationMatches}
            answerMd={answerMd}
          />
        ),
        footer:
          reasoningMd || answerMd || streaming ? (
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
              {reasoningMd && (answerMd || streaming) ? (
                <Tag className="m-0">
                  合计 {reasoningTokenCount + answerTokenCount}
                </Tag>
              ) : null}
            </Space>
          ) : null,
      }
    })
  }, [messages, isLoading, setThinkExpanded, streamdownPlugins])

  const bubbleRole = useMemo(
    () => ({
      user: {
        placement: 'end' as const,
        shape: 'round' as const,
      },
      ai: {
        placement: 'start' as const,
        styles: {
          content: { maxWidth: 'min(100%, 56rem)' },
        },
      },
    }),
    [],
  )

  return (
    <XProvider>
      <div className="relative flex h-[calc(100vh-120px)] w-full flex-col">
        <div className="shrink-0">
          <Typography.Title level={4} className="mb-3!">
            对话（SSE）
          </Typography.Title>
          <Text type="secondary" className="mb-4 block text-sm">
            由 zustand 管理会话；POST /api/chat/stream · Sender + Bubble ·
            store.consumeChatSse 解析事件
          </Text>

          {error ? (
            <Alert
              type="error"
              message={error}
              showIcon
              className="mb-3 w-full"
            />
          ) : null}

          {isLoading ? (
            <div className="mb-3">
              <Button size="small" onClick={() => stopGeneration()}>
                停止生成
              </Button>
            </div>
          ) : null}
        </div>

        <Bubble.List
          role={bubbleRole}
          items={bubbleItems}
          autoScroll
          className="min-h-0 flex-1"
          classNames={{
            scroll:
              'min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom,0))] pr-0.5',
          }}
        />

        <div className="fixed bottom-4 left-1/2 z-10 w-[min(100%-2rem,42rem)] -translate-x-1/2 rounded-lg border border-zinc-200 bg-background p-1 shadow-[0_-4px_14px_color-mix(in_oklch,var(--foreground)_6%,transparent)] dark:border-zinc-700">
          <Sender
            value={senderValue}
            onChange={(v) => setSenderValue(v)}
            onSubmit={onSubmit}
            loading={isLoading}
            placeholder="输入问题，Enter 发送（Shift+Enter 换行）"
            submitType="enter"
            autoSize={{ minRows: 2, maxRows: 8 }}
          />
        </div>
      </div>
    </XProvider>
  )
}
