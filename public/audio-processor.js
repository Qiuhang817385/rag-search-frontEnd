class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (input && input.length > 0) {
      const channelData = input[0]

      const int16Buffer = new Int16Array(channelData.length)

      for (let i = 0; i < channelData.length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]))
        // 有啥区别？
        // int16Buffer[i] = s < 0 ? s * 32768 : s * 32767;
        int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }

      this.port.postMessage(
        {
          audio: int16Buffer.buffer,
          // sequenceNumber: this.sequenceNumber,
        },
        [int16Buffer.buffer],
      )
    }
    return true
  }
}

registerProcessor('mic-processor', MicProcessor)
