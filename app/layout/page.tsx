'use client'

import {
  Button,
  Col,
  ConfigProvider,
  Row,
  Select,
  Space,
  theme as antdTheme,
} from 'antd'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { logout } from '../actions/auth'
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
  return <div>{children}</div>
}
