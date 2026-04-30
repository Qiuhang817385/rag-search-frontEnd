/**
 * 流式回答阶段的「引用 grounding」启发式：
 * - 字符 trigram 覆盖率：chunk 中有多少 trigram 出现在已生成的回答中（适合中英文混合）
 * - 哨兵 token：与 prompt 一致的 `[片段 n]` / 「片段 n」——模型若复述编号则直接点亮对应条
 */

import type { RagMetaHit } from '@/lib/rag-sse-parse'

const CHUNK_TRIM = 4000

/** 覆盖率高于此值认为「正在引用该片段」（可调） */
export const CITATION_TRIGRAM_THRESHOLD = 0.06

function normalizeForTrigrams(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[`_*#[\]()]/g, '')
    .trim()
}

// 三元组。
function trigramSet(text: string): Set<string> {
  const t = normalizeForTrigrams(text)
  const set = new Set<string>()
  if (t.length < 3) {
    if (t.length > 0) set.add(t)
    return set
  }
  for (let i = 0; i + 3 <= t.length; i++) {
    set.add(t.slice(i, i + 3))
  }
  return set
}

/** chunk trigram 有多少比例出现在 answer 中（0..1） */
export function trigramCoverage(chunkText: string, answer: string): number {
  const chunk = chunkText.slice(0, CHUNK_TRIM)
  const ct = trigramSet(chunk)
  if (ct.size === 0) return 0
  const at = trigramSet(answer)
  if (at.size === 0) return 0
  let hit = 0
  for (const tri of ct) {
    if (at.has(tri)) hit++
  }
  return hit / ct.size
}

/**
 * prompt 里片段编号为 1..n（与 meta.hits 数组顺序一致，按检索得分排序）。
 */
export function sentinelHitLabelIndices(
  answer: string,
  hitCount: number,
): Set<number> {
  const out = new Set<number>()
  if (!answer.trim() || hitCount === 0) return out
  for (let label = 1; label <= hitCount; label++) {
    const patterns = [
      new RegExp(`(?:知识库)?片段\\s*${label}(?!\\d)`),
      new RegExp(`\\[\\s*片段\\s*${label}\\s*\\]`),
      new RegExp(`第\\s*${label}\\s*个片段`),
    ]
    if (patterns.some((re) => re.test(answer))) {
      out.add(label - 1)
    }
  }
  return out
}

export type CitationMatchResult = {
  /** 是否高亮该引用按钮 */
  active: boolean
  /** 0..1，展示用 */
  overlapScore: number
  /** 是否由哨兵匹配命中 */
  fromSentinel: boolean
}

export function matchCitationsToAnswer(
  answer: string,
  hits: RagMetaHit[],
  options?: { trigramThreshold?: number },
): Map<string, CitationMatchResult> {
  const threshold = options?.trigramThreshold ?? CITATION_TRIGRAM_THRESHOLD
  const sentinelIdx = sentinelHitLabelIndices(answer, hits.length)
  const out = new Map<string, CitationMatchResult>()

  hits.forEach((h, i) => {
    const content = h.content ?? ''
    const overlapScore = trigramCoverage(content, answer)
    const fromSentinel = sentinelIdx.has(i)
    const active = fromSentinel || overlapScore >= threshold
    out.set(h.chunkId, {
      active,
      overlapScore,
      fromSentinel,
    })
  })

  return out
}
