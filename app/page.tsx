'use client'

import { Button, Card, Col, Row, Typography } from 'antd'
import Link from 'next/link'

const { Title, Paragraph } = Typography

export default function Home() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-5xl">
        <Title level={2} className="mb-2 text-center">
          RAG 工作台
        </Title>
        <Paragraph type="secondary" className="mb-8 text-center">
          文档入库与切片预览 · 向量检索与流式对话
        </Paragraph>

        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Card title="文档入库" variant="borderless" className="h-full shadow-sm">
              <Paragraph type="secondary" className="mb-4">
                粘贴或上传 TXT / Markdown，提交后端入库；支持 LangChain
                切片预览（可与后端写死参数对照）。
              </Paragraph>
              <Link href="/rag">
                <Button type="primary" block size="large">
                  进入 /rag
                </Button>
              </Link>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="检索与对话" variant="borderless" className="h-full shadow-sm">
              <Paragraph type="secondary" className="mb-4">
                RAG 向量检索调试；基于 SSE 的对话与 Markdown 渲染、引用来源与
                token 统计。
              </Paragraph>
              <Link href="/ragSearch">
                <Button type="primary" block size="large">
                  进入 /ragSearch
                </Button>
              </Link>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  )
}
