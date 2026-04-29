/**
 * Demo 固定切片参数（与后端 `rag-split.constants.ts` 保持一致）
 */
export const RAG_DEMO_CHUNK_SIZE = 1000
export const RAG_DEMO_CHUNK_OVERLAP = 150

/** 与后端入库使用同一策略：RecursiveCharacterTextSplitter */
export const RAG_DEMO_STRATEGY = 'recursive' as const
