'use client'
import { useRef, useState, useCallback } from 'react'

type Status = 'idle' | 'recording' | 'error'
type ResultCallback = (text: string, isFinal: boolean) => void

interface Options {
  wsUrl: string
  onResult: ResultCallback
  onStatusChange?: (status: Status) => void
}

export function useSpeechInput({ wsUrl, onResult, onStatusChange }: Options) {
  const [status, setStatus] = useState<Status>('idle')
  // 创建 3 个 ref
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)

  const streamRef = useRef<MediaStream | null>(null)

  // 需要停止 4 个动作：音频处理节点、麦克风采集、AudioContext、WebSocket
  const stop = useCallback(() => {
    // 停止音频处理节点
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage('stop')
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }
    // 停止麦克风采集
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    const ctx = audioContextRef.current
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => {
        /* 已关闭或浏览器拒绝 */
      })
    }

    // 停止 AudioContext
    audioContextRef.current = null

    // 停止 WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }))
    }
    setStatus('idle')
    onStatusChange?.('idle')
  }, [onStatusChange])

  const start = useCallback(async () => {
    try {
      // 1. 获取麦克风
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // 采样率（Hz）。表示每秒从模拟信号中提取的样本点数，例如 16000（16kHz）
          sampleRate: 16000,
          channelCount: 1,
          // 回声消除。启用后，浏览器会自动消除麦克风输入中的回声，提升语音清晰度。适合在嘈杂环境中录音或通话。
          echoCancellation: true,
          // 噪声抑制。启用后，浏览器会过滤掉背景中的稳态噪声（如风扇、空调声），提升语音清晰度。适合在嘈杂环境中录音或通话。
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      // 2. 建立 WebSocket
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.binaryType = 'arraybuffer'
      ws.onopen = () => {
        // 3. 初始化 AudioContext 与 AudioWorklet
        const audioCtx = new AudioContext({ sampleRate: 16000 })
        audioContextRef.current = audioCtx

        audioCtx.audioWorklet.addModule('/audio-processor.js').then(() => {
          const source = audioCtx.createMediaStreamSource(stream)

          // 4. 创建 AudioWorkletNode,音频处理节点（采集 PCM 并发送）
          const workletNode = new AudioWorkletNode(audioCtx, 'mic-processor')
          workletNodeRef.current = workletNode

          console.log('workletNode', workletNode)

          // 收取音频数据并发送,音频处理节点（采集 PCM 并发送）
          workletNode.port.onmessage = (event: MessageEvent) => {
            // 5. 发送音频数据到 WebSocket
            if (event.data.audio && ws.readyState === WebSocket.OPEN) {
              ws.send(event.data.audio) // 发送 Int16Array buffer
            }
          }

          source.connect(workletNode)
          // workletNode 不需连接到扬声器，所以不连 destination
          setStatus('recording')
          onStatusChange?.('recording')
        })
      }

      // 6. 接收 WebSocket 消息
      ws.onmessage = (event: MessageEvent) => {
        const msg = JSON.parse(event.data as string)
        if (msg.type === 'interim' || msg.type === 'final') {
          onResult(msg.text, msg.type === 'final')
          // final 会触发 stop()；松手时已 stop 过则 AudioContext 已关闭，必须幂等避免 InvalidStateError
          if (msg.type === 'final') stop()
        }
      }

      ws.onerror = () => {
        setStatus('error')
        onStatusChange?.('error')
      }
    } catch (err) {
      setStatus('error')
      onStatusChange?.('error')
    }
  }, [wsUrl, onResult, onStatusChange, stop])

  return { status, start, stop }
}
