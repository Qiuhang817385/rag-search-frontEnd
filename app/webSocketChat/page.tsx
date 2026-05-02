'use client'

import { useEffect, useState } from 'react'
import { Button, Switch } from 'antd'
import { useWebSocket } from '@/hooks/useWebSocket'

// 自动重连
// 心跳
// 消息队列
// 连接状态提示

export default function WebSocketChatPage() {
  const [heartbeatEnabled, setHeartbeatEnabled] = useState(false)
  const { send, state, disconnect } = useWebSocket({
    url: 'ws://localhost:3025/ws',
    heartbeatMessage: { type: 'ping' },
    // 最多只重连 5 次
    reconnectMaxRetries: 5,
    // 重连基础延迟 1 秒
    reconnectBaseDelay: 1000,
    // 最大消息队列长度 1000
    maxQueueSize: 1000,
    // ACK 超时时间 5 秒
    ackTimeout: 5000,
    heartbeatInterval: heartbeatEnabled ? 3000 : 0,
  })

  return (
    <main className="p-6">
      <h1 className="text-lg font-medium">WebSocket Chat</h1>
      <Button
        type="primary"
        onClick={() => {
          disconnect()
        }}
      >
        断开连接
      </Button>
      开启心跳:{' '}
      <Switch checked={heartbeatEnabled} onChange={setHeartbeatEnabled} />
      <Button
        type="primary"
        onClick={() => {
          send({
            type: 'message',
            message: 'hello',
            timestamp: Date.now(),
            userId: '123',
            userName: '张三',
            userAvatar: 'https://joeschmoe.io/api/v1/random',
            userEmail: 'zhangsan@example.com',
            userPhone: '13800138000',
            userAddress: '北京市海淀区',
          })
        }}
      >
        发送消息
      </Button>
    </main>
  )
}
