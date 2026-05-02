'use client'

import { Col, ConfigProvider, Row, Select, theme as antdTheme } from 'antd'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'theme'

/** 与 globals.css：`@custom-variant dark (&:where([data-theme=dark], …))` 同源 */
function readThemeIsDarkFromDom(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-theme') === 'dark'
}

/** 只在这里对「System」使用 matchMedia；写完后由 DOM 反映是否真的 dark */
function paintDocumentTheme(mode: string) {
  const root = document.documentElement
  if (mode === 'light') {
    root.setAttribute('data-theme', 'light')
    return
  }
  if (mode === 'dark') {
    root.setAttribute('data-theme', 'dark')
    return
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (prefersDark) root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [theme, setTheme] = useState<string>('system')
  /** antd 与 DOM 一致：只看 documentElement 是否为 data-theme=dark */
  const [docIsDark, setDocIsDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const initial =
      stored === 'light' || stored === 'dark' || stored === 'system'
        ? stored
        : 'system'
    paintDocumentTheme(initial)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- antd 与 data-theme 对齐
    setDocIsDark(readThemeIsDarkFromDom())
    setTheme(initial)
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      paintDocumentTheme('system')
      setDocIsDark(readThemeIsDarkFromDom())
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return (
    <ConfigProvider
      theme={{
        algorithm: docIsDark
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
      }}
    >
      <Row>
        <Col span={24}>
          <div className="flex justify-end p-2">
            <Select
              value={theme}
              style={{ minWidth: 140 }}
              onChange={(value) => {
                setTheme(value)
                localStorage.setItem(STORAGE_KEY, value)
                paintDocumentTheme(value)
                setDocIsDark(readThemeIsDarkFromDom())
              }}
              options={[
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
                { label: 'System', value: 'system' },
              ]}
            />
          </div>
        </Col>
        <Col span={24}>{children}</Col>
      </Row>
    </ConfigProvider>
  )
}
