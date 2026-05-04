'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authApiPaths, backendUrl } from '@/lib/backend-url'

type AuthFormState = { error?: string }

async function applySetCookiesFromResponse(res: Response) {
  const cookieStore = await cookies()
  const setCookies = res.headers.getSetCookie?.() ?? []
  for (const c of setCookies) {
    const [nameValue, ...directives] = c.split(';')
    const eq = nameValue.indexOf('=')
    if (eq < 0) continue
    const name = nameValue.slice(0, eq).trim()
    const value = nameValue.slice(eq + 1).trim()
    if (!name) continue
    const opts: Parameters<typeof cookieStore.set>[2] = { path: '/' }

    for (const d of directives) {
      const [k, v] = d.trim().split('=')
      const key = k?.toLowerCase()
      if (key === 'httponly') opts.httpOnly = true
      if (key === 'secure') opts.secure = true
      if (key === 'samesite' && v) {
        const s = v.toLowerCase()
        if (s === 'lax' || s === 'strict' || s === 'none')
          opts.sameSite = s
      }
      if (key === 'max-age' && v) opts.maxAge = parseInt(v, 10)
    }
    cookieStore.set(name.trim(), value.trim(), opts)
  }
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const res = await fetch(backendUrl(authApiPaths.login), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    return { error: '账号或密码错误' }
  }

  await applySetCookiesFromResponse(res)
  redirect('/')
}

export async function register(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const nameRaw = formData.get('name') as string | null
  const name = nameRaw?.trim() || undefined

  const res = await fetch(backendUrl(authApiPaths.register), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })

  if (!res.ok) {
    let msg = '注册失败'
    try {
      const data = (await res.json()) as {
        message?: string | string[]
      }
      const m = data.message
      if (Array.isArray(m)) msg = m.join('；')
      else if (typeof m === 'string') msg = m
    } catch {
      /* ignore */
    }
    return { error: msg }
  }

  redirect('/login')
}

export async function logout() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  if (sessionId) {
    await fetch(backendUrl(authApiPaths.logout), {
      method: 'POST',
      headers: { Cookie: `session_id=${sessionId}` },
    })
  }

  cookieStore.delete('session_id')
  redirect('/login')
}
