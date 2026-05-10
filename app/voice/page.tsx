'use client'
import { useState, useCallback } from 'react'
import { useSpeechInput } from '../../hooks/useSpeechInput'

export default function VoiceInput() {
  const [finalText, setFinalText] = useState('')
  const [interimText, setInterimText] = useState('')

  const handleResult = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setFinalText((prev) => prev + text)
      setInterimText('')
    } else {
      setInterimText(text)
    }
  }, [])

  const { status, start, stop } = useSpeechInput({
    wsUrl: 'ws://localhost:3025/speech',
    onResult: handleResult,
  })

  return (
    <div className="p-4">
      <div className="border min-h-[80px] p-2 mb-4 rounded">
        <span>{finalText}</span>
        <span className="text-gray-400 italic">{interimText}</span>
      </div>
      <button
        onMouseDown={start}
        onMouseUp={stop}
        onMouseLeave={stop} // 滑动取消
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        disabled={status === 'error'}
      >
        {status === 'recording' ? '松开发送' : '按住说话'}
      </button>
    </div>
  )
}
