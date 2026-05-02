// hooks/useWebSocket.ts
import { useRef, useEffect, useCallback, useState } from 'react'

// 消息队列项
interface QueuedMessage {
  id: string
  payload: any
  retryCount: number
  timestamp: number
}

// 配置项
interface WebSocketConfig {
  url: string
  heartbeatInterval?: number // 心跳间隔(ms)
  heartbeatMessage?: any // 心跳消息内容
  reconnectMaxRetries?: number // 最大重连次数
  reconnectBaseDelay?: number // 重连基础延迟(ms)
  maxQueueSize?: number // 最大消息队列长度
  ackTimeout?: number // ACK超时时间(ms)
}

// 连接状态
enum ConnectionState {
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed',
  RECONNECTING = 'reconnecting',
}

/** 引用稳定，避免每次 render 新对象导致 sendHeartbeat → connect → useEffect 死循环 */
const DEFAULT_HEARTBEAT_MESSAGE = { type: 'ping' }

export function useWebSocket(config: WebSocketConfig) {
  const {
    url,
    heartbeatInterval = 30000,
    heartbeatMessage = DEFAULT_HEARTBEAT_MESSAGE,
    reconnectMaxRetries = 5,
    reconnectBaseDelay = 1000,
    maxQueueSize = 1000,
    ackTimeout = 5000,
  } = config

  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<ConnectionState>(
    ConnectionState.CONNECTING,
  )
  const messageQueueRef = useRef<QueuedMessage[]>([])
  const pendingAcksRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const messageIdCounterRef = useRef(0)
  const heartbeatMessageRef = useRef(heartbeatMessage)
  heartbeatMessageRef.current = heartbeatMessage

  // 生成唯一消息ID
  const generateMessageId = () =>
    `msg_${Date.now()}_${messageIdCounterRef.current++}`

  // 发送消息（带ACK和重试）
  const send = useCallback(
    (data: any, requiresAck = true): Promise<any> => {
      return new Promise((resolve, reject) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          // 离线时加入队列
          if (messageQueueRef.current.length < maxQueueSize) {
            const queuedMsg: QueuedMessage = {
              id: generateMessageId(),
              payload: data,
              retryCount: 0,
              timestamp: Date.now(),
            }
            messageQueueRef.current.push(queuedMsg)
            reject(new Error('WebSocket not open, message queued'))
          } else {
            reject(new Error('Message queue full'))
          }
          return
        }

        const messageId = generateMessageId()
        const messageWithId = { ...data, id: messageId, timestamp: Date.now() }

        if (requiresAck) {
          // 设置ACK超时定时器
          const timeout = setTimeout(() => {
            pendingAcksRef.current.delete(messageId)
            reject(new Error(`ACK timeout for message ${messageId}`))
            // 触发重试逻辑
            retryMessage({
              id: messageId,
              payload: data,
              retryCount: 0,
              timestamp: Date.now(),
            })
          }, ackTimeout)
          pendingAcksRef.current.set(messageId, timeout)
        }

        wsRef.current.send(JSON.stringify(messageWithId))
        resolve(messageId)
      })
    },
    [maxQueueSize, ackTimeout],
  )

  // 重试消息
  const retryMessage = useCallback(
    (message: QueuedMessage) => {
      if (message.retryCount < 3) {
        setTimeout(
          () => {
            send(message.payload, true).catch(() => {
              message.retryCount++
              retryMessage(message)
            })
          },
          Math.pow(2, message.retryCount) * 1000,
        )
      }
    },
    [send],
  )

  // 发送心跳（依赖 ref，避免 heartbeatMessage 引用变化导致 connect 身份变化）
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(heartbeatMessageRef.current))
    }
  }, [])

  // 重连逻辑（指数退避）
  const reconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= reconnectMaxRetries) {
      setState(ConnectionState.CLOSED)
      return
    }

    const delay = reconnectBaseDelay * Math.pow(2, reconnectAttemptsRef.current)
    setState(ConnectionState.RECONNECTING)

    reconnectTimerRef.current = setTimeout(() => {
      connect()
      reconnectAttemptsRef.current++
    }, delay)
  }, [reconnectBaseDelay, reconnectMaxRetries])

  /** 心跳内容变化时用于重启定时器（避免父组件每次传入新对象引用却无意义重启：配合 stringify） */
  const heartbeatContentKey = JSON.stringify(heartbeatMessage)

  // 连接打开期间：心跳间隔或内容变化时清旧 interval 再起一次，无需断线重连
  useEffect(() => {
    if (state !== ConnectionState.OPEN) {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
      return
    }

    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }

    heartbeatTimerRef.current = setInterval(sendHeartbeat, heartbeatInterval)

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
    }
  }, [state, heartbeatInterval, heartbeatContentKey, sendHeartbeat])

  // 建立连接
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    console.log('wsRef.current', wsRef.current)

    const ws = new WebSocket(url)
    wsRef.current = ws
    setState(ConnectionState.CONNECTING)

    ws.onopen = () => {
      setState(ConnectionState.OPEN)
      reconnectAttemptsRef.current = 0

      // 心跳由下方 useEffect(state===OPEN, heartbeatInterval, ...) 统一调度

      // 发送队列中的消息
      const queueCopy = [...messageQueueRef.current]
      messageQueueRef.current = []
      queueCopy.forEach((msg) => send(msg.payload, true))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // 处理ACK响应
        if (data.type === 'ack' && data.ackId) {
          const timer = pendingAcksRef.current.get(data.ackId)
          if (timer) {
            clearTimeout(timer)
            pendingAcksRef.current.delete(data.ackId)
          }
          return
        }

        // 处理服务端推送
        if (data.type === 'pong') return // 心跳响应

        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('ws:message', { detail: data }))
      } catch (error) {
        console.error('Parse message error:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
      reconnect()
    }
  }, [url, send, reconnect])

  // 手动关闭连接
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setState(ConnectionState.CLOSED)
  }, [])

  const connectRef = useRef(connect)
  connectRef.current = connect

  // 只随 url 重连；不要把 connect 放进依赖数组，否则 connect 身份抖动会反复 cleanup 断开连接
  useEffect(() => {
    connectRef.current()
    return () => disconnect()
  }, [url, disconnect])

  return { send, state, disconnect }
}
