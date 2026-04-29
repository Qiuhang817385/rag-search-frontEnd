import {
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
} from '@langchain/textsplitters'
/** 与 ChunkPreviewPanel 预览 / 可选组合使用 */
export type LangchainSplitterStrategy = 'recursive' | 'markdown'

export interface ChunkPiece {
  index: number
  /** 在原文中的闭开区间；对齐失败时为 -1 */
  start: number
  end: number
  content: string
}

/**
 * 将 LangChain 输出的 chunk 按顺序映射回原文位置（与 LangChain createDocuments 类似：
 * 使用上一块起始位置之后的 indexOf）。
 */
function assignOffsets(fullText: string, parts: string[]): ChunkPiece[] {
  let prevStart = -1
  const pieces: ChunkPiece[] = []
  for (let i = 0; i < parts.length; i++) {
    const content = parts[i]
    let start = fullText.indexOf(content, prevStart + 1)
    if (start === -1) {
      start = fullText.indexOf(content)
    }
    if (start === -1) {
      pieces.push({
        index: i,
        start: -1,
        end: -1,
        content,
      })
      continue
    }
    pieces.push({
      index: i,
      start,
      end: start + content.length,
      content,
    })
    prevStart = start
  }
  return pieces
}

/**
 * LangChain `RecursiveCharacterTextSplitter` / `MarkdownTextSplitter`（Markdown 使用 markdown 专用分隔符序列）。
 * chunkOverlap 必须小于 chunkSize（库构造函数会校验）。
 */
export async function splitTextToIndexedChunks(
  fullText: string,
  strategy: LangchainSplitterStrategy,
  chunkSize: number,
  chunkOverlap: number,
): Promise<ChunkPiece[]> {
  if (!fullText.length || chunkSize <= 0) return []
  if (chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap 必须小于 chunkSize')
  }

  const splitter =
    strategy === 'markdown'
      ? new MarkdownTextSplitter({ chunkSize, chunkOverlap })
      : new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap })

  const parts = await splitter.splitText(fullText)
  return assignOffsets(fullText, parts)
}
