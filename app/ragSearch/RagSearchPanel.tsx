'use client'

import { postRagSearch } from '@/lib/rag-api'
import { Button, Input, Typography } from 'antd'
import { useCallback, useState } from 'react'

const { TextArea } = Input
const { Title, Text } = Typography

export default function RagSearchPanel() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [json, setJson] = useState('')

  const submit = useCallback(async () => {
    const q = query.trim()
    if (!q) {
      setError('请输入 query')
      return
    }
    setLoading(true)
    setError(null)
    setJson('')
    try {
      const res = await postRagSearch({ query: q, topK: 5 })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const m = data?.message
        const msg = Array.isArray(m)
          ? m.join(', ')
          : typeof m === 'string'
            ? m
            : `HTTP ${res.status}`
        throw new Error(msg)
      }
      setJson(JSON.stringify(data, null, 2))
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }, [query])

  return (
    <>
      <Title level={4} className="mb-3!">
        RAG 检索（search）
      </Title>
      <Text type="secondary" className="mb-4 block text-sm">
        POST /api/rag/search · 返回完整 chunk 内容与分数，可与对话 meta 对照
      </Text>
      <div className="flex flex-col gap-3">
        <TextArea
          rows={5}
          placeholder="输入检索问题…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="font-mono text-sm"
        />
        <Button type="primary" onClick={submit} loading={loading} block>
          搜索
        </Button>
      </div>
      {error && (
        <Text type="danger" className="mt-4 block">
          {error}
        </Text>
      )}
      {json && (
        <pre className="mt-6 max-h-[480px] overflow-auto rounded-lg bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
          {json}
        </pre>
      )}
    </>
  )
}
