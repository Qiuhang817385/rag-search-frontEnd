import { Tiktoken } from 'js-tiktoken/lite'
import o200k_base from 'js-tiktoken/ranks/o200k_base'

let encoder: Tiktoken | null = null

function getEncoder(): Tiktoken {
  if (!encoder) {
    encoder = new Tiktoken(o200k_base)
  }
  return encoder
}

/** o200k_base，与常见 OpenAI embedding/chat 维度一致，仅供前端估算展示 */
export function countTokens(text: string): number {
  if (!text.length) return 0
  return getEncoder().encode(text).length
}
