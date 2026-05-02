'use client'

import { Col, Row, Typography } from 'antd'
import dynamic from 'next/dynamic'
import RagSearchPanel from './RagSearchPanel'

const { Text } = Typography

const RagChatPanel = dynamic(() => import('./RagChatPanel'), {
  ssr: false,
  loading: () => (
    <div className="py-8 text-sm text-zinc-500">加载对话组件…</div>
  ),
})

export default function RagSearchLayout() {
  return (
    <div className="px-4 py-8">
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={4}>
          <Text type="secondary">历史 TODO</Text>
        </Col>
        <Col xs={24} lg={16}>
          <RagChatPanel />
        </Col>
        <Col xs={24} lg={4}>
          <RagSearchPanel />
        </Col>
      </Row>
    </div>
  )
}
