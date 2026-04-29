'use client'

import { InfoCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import {
  Alert,
  Collapse,
  Segmented,
  Slider,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import {
  splitTextToIndexedChunks,
  type ChunkPiece,
  type LangchainSplitterStrategy,
} from '@/lib/langchain-split'
import {
  RAG_DEMO_CHUNK_OVERLAP,
  RAG_DEMO_CHUNK_SIZE,
} from '@/lib/rag-split-config'
import { countTokens } from '@/lib/rag-tokens'

const { Text } = Typography

function chunkLength(c: ChunkPiece): number {
  if (c.start >= 0 && c.end >= 0) return c.end - c.start
  return c.content.length
}

function chunkBarFractions(chunks: ChunkPiece[]): number[] {
  const total = chunks.reduce((s, c) => s + chunkLength(c), 0)
  if (!total) return chunks.map(() => 0)
  return chunks.map((c) => chunkLength(c) / total)
}

const hueForIndex = (i: number) => (i * 47) % 360

const TIP_EMPTY =
  '载入或粘贴文档后，可在此自由调整切片策略与参数做预览；后端入库参数另见上方提示。'
const BACKEND_FIXED_MESSAGE =
  `后端 POST /api/documents/ingest 已写死：RecursiveCharacterTextSplitter，` +
  `chunkSize=${RAG_DEMO_CHUNK_SIZE}，chunkOverlap=${RAG_DEMO_CHUNK_OVERLAP}。` +
  `下方预览仅供本地实验；若与后端不一致，请以接口返回的 chunkCount / splitConfig 为准。`

const TIP_SPLITTER_INTRO =
  '预览使用 @langchain/textsplitters：RecursiveCharacter 为默认层级分隔；Markdown 为 Markdown 专用分隔符序列。合并时按 chunkOverlap 重叠。'
const TIP_RECURSIVE =
  'RecursiveCharacterTextSplitter：按层级分隔符递归切分（\\n\\n → \\n → 空格 → 字符）。'
const TIP_MARKDOWN =
  'MarkdownTextSplitter：针对 Markdown 的分隔序列（标题、代码块等）。'
const TIP_CHUNK_SIZE = 'chunkSize：预览中单块最大字符长度。'
const TIP_OVERLAP =
  'chunkOverlap：预览中相邻块重叠字符数，须小于 chunkSize。'
const TIP_BAR =
  '各块长度占比：条带宽度与该块字符数占比成正比；悬停条带可看序号与 token。'
const TIP_STATS_COUNT =
  '按当前预览参数划分后的块数（可能与后端入库块数不同）。'
const TIP_STATS_CHARS = '当前编辑器内文档的总字符数。'
const TIP_STATS_TOKENS =
  '当前预览各块 token 估算之和（o200k_base），仅供参考。'
const TIP_ALIGN =
  '无法在原文中唯一对齐该块起始位置；不影响切片正文。'

export default function ChunkPreviewPanel(props: { text: string }) {
  const { text } = props
  const [strategy, setStrategy] =
    useState<LangchainSplitterStrategy>('recursive')
  const [chunkSize, setChunkSize] = useState(RAG_DEMO_CHUNK_SIZE)
  const [overlap, setOverlap] = useState(RAG_DEMO_CHUNK_OVERLAP)
  const [chunks, setChunks] = useState<ChunkPiece[]>([])
  const [splitting, setSplitting] = useState(false)
  const [splitError, setSplitError] = useState<string | null>(null)

  const overlapMax = Math.max(0, chunkSize - 1)

  useEffect(() => {
    setOverlap((o) => Math.min(o, overlapMax))
  }, [chunkSize, overlapMax])

  useEffect(() => {
    if (!text.trim()) {
      setChunks([])
      setSplitError(null)
      return
    }
    let cancelled = false
    setSplitting(true)
    setSplitError(null)
    ;(async () => {
      try {
        const out = await splitTextToIndexedChunks(
          text,
          strategy,
          chunkSize,
          overlap,
        )
        if (!cancelled) setChunks(out)
      } catch (e) {
        if (!cancelled) {
          setChunks([])
          setSplitError(e instanceof Error ? e.message : '切片计算失败')
        }
      } finally {
        if (!cancelled) setSplitting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [text, strategy, chunkSize, overlap])

  const stats = useMemo(() => {
    let tokens = 0
    for (const c of chunks) {
      tokens += countTokens(c.content)
    }
    return {
      chunkCount: chunks.length,
      totalChars: text.length,
      totalTokens: tokens,
      fractions: chunkBarFractions(chunks),
    }
  }, [chunks, text.length])

  const collapseItems = useMemo(
    () =>
      chunks.map((c, i) => {
        const len = chunkLength(c)
        const rangeOk = c.start >= 0
        return {
          key: String(c.index),
          label: (
            <Space wrap size="small">
              <Tag color="blue">#{i + 1}</Tag>
              <Text type="secondary">
                字符 {len} · tokens {countTokens(c.content)}
              </Text>
              {rangeOk ? (
                <Text type="secondary" className="font-mono text-xs">
                  [{c.start}, {c.end})
                </Text>
              ) : (
                <Tooltip title={TIP_ALIGN}>
                  <Tag color="warning" className="cursor-help">
                    原文位置未对齐
                  </Tag>
                </Tooltip>
              )}
            </Space>
          ),
          children: (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900">
              {c.content}
            </pre>
          ),
        }
      }),
    [chunks],
  )

  if (!text.trim()) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-600">
        <Tooltip title={TIP_EMPTY}>
          <span className="inline-flex cursor-help items-center gap-1.5 text-zinc-500">
            <QuestionCircleOutlined />
            <span>暂无文档，悬停查看说明</span>
          </span>
        </Tooltip>
      </div>
    )
  }

  return (
    <Space orientation="vertical" size="middle" className="w-full">
      <Alert
        type="info"
        showIcon
        message="预览可调 · 入库参数已写死"
        description={BACKEND_FIXED_MESSAGE}
      />

      {splitError && (
        <Alert
          type="error"
          message="切片失败"
          description={splitError}
          showIcon
        />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-y-2">
          <Space size="small" className="mr-2">
            <Text strong>预览切片器</Text>
            <Tooltip title={TIP_SPLITTER_INTRO}>
              <InfoCircleOutlined className="cursor-help text-zinc-400" />
            </Tooltip>
          </Space>
          <Segmented<LangchainSplitterStrategy>
            options={[
              {
                label: (
                  <Tooltip title={TIP_RECURSIVE}>
                    <span className="cursor-help">RecursiveCharacter</span>
                  </Tooltip>
                ),
                value: 'recursive',
              },
              {
                label: (
                  <Tooltip title={TIP_MARKDOWN}>
                    <span className="cursor-help">Markdown</span>
                  </Tooltip>
                ),
                value: 'markdown',
              },
            ]}
            value={strategy}
            onChange={(v) => setStrategy(v)}
          />
        </div>
        <Space wrap className="items-center">
          {splitting && <Spin size="small" />}
          <Tooltip title={TIP_STATS_COUNT}>
            <Tag className="cursor-help">预览块数 {stats.chunkCount}</Tag>
          </Tooltip>
          <Tooltip title={TIP_STATS_CHARS}>
            <Tag className="cursor-help">总字符 {stats.totalChars}</Tag>
          </Tooltip>
          <Tooltip title={TIP_STATS_TOKENS}>
            <Tag className="cursor-help">
              预览 tokens · {stats.totalTokens}
            </Tag>
          </Tooltip>
        </Space>
      </div>

      <div>
        <div className="mb-1 flex justify-between">
          <Space size="small">
            <Text type="secondary">chunkSize（预览）</Text>
            <Tooltip title={TIP_CHUNK_SIZE}>
              <QuestionCircleOutlined className="cursor-help text-zinc-400" />
            </Tooltip>
          </Space>
          <Text code>{chunkSize}</Text>
        </div>
        <Slider
          min={200}
          max={4000}
          step={50}
          value={chunkSize}
          onChange={setChunkSize}
          tooltip={{ formatter: (v) => `${v} 字符` }}
        />
      </div>

      <div>
        <div className="mb-1 flex justify-between">
          <Space size="small">
            <Text type="secondary">chunkOverlap（预览）</Text>
            <Tooltip title={TIP_OVERLAP}>
              <QuestionCircleOutlined className="cursor-help text-zinc-400" />
            </Tooltip>
          </Space>
          <Text code>{overlap}</Text>
        </div>
        <Slider
          min={0}
          max={Math.min(400, overlapMax)}
          step={10}
          value={overlap}
          onChange={setOverlap}
          tooltip={{ formatter: (v) => `${v} 字符` }}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5">
          <Text type="secondary" className="text-xs">
            长度占比
          </Text>
          <Tooltip title={TIP_BAR}>
            <InfoCircleOutlined className="cursor-help text-xs text-zinc-400" />
          </Tooltip>
        </div>
        <div className="flex h-10 w-full overflow-hidden rounded-md ring-1 ring-zinc-200 dark:ring-zinc-700">
          {chunks.map((c, i) => {
            const w = Math.max(
              stats.fractions[i] * 100,
              chunks.length > 0 ? 0.5 : 0,
            )
            return (
              <Tooltip
                key={c.index}
                title={`#${i + 1} · ${chunkLength(c)} 字符 · ${countTokens(c.content)} tokens`}
              >
                <div
                  className="h-full min-w-[2px] cursor-default transition-opacity hover:opacity-90"
                  style={{
                    width: `${w}%`,
                    backgroundColor: `hsl(${hueForIndex(i)} 55% 45%)`,
                  }}
                />
              </Tooltip>
            )
          })}
        </div>
      </div>

      <Collapse items={collapseItems} size="small" />
    </Space>
  )
}
