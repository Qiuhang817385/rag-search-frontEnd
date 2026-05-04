import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authApiPaths, backendUrl } from '@/lib/backend-url'

export { backendUrl, getBackendOrigin, authApiPaths } from '@/lib/backend-url'

/** 未登录时允许调用的后端路径（与 Nest `Public()` 一致） */
const AUTH_PUBLIC_PATHS = new Set<string>([
  authApiPaths.login,
  authApiPaths.register,
])

function isPublicAuthPath(path: string): boolean {
  const normalized = path.split('?')[0] ?? path
  return AUTH_PUBLIC_PATHS.has(normalized)
}

/**
 * 服务端代发请求到 Nest：透传 `session_id`，401 时清 Cookie 并跳转登录。
 * 仅用于 Server Components / Server Actions（不可在浏览器组件中调用）。
 */
export async function fetchAPI<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  if (!sessionId && !isPublicAuthPath(path)) {
    redirect('/login')
  }

  const res = await fetch(backendUrl(path), {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
      Cookie: sessionId ? `session_id=${sessionId}` : '',
    },
  })

  if (res.status === 401) {
    cookieStore.delete('session_id')
    redirect('/login')
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }

  return res.json() as Promise<T>
}

/** 与 `fetchAPI` 相同鉴权，返回原始 `Response`（如 SSE、非 JSON） */
export async function fetchBackendRaw(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  if (!sessionId && !isPublicAuthPath(path)) {
    redirect('/login')
  }

  const res = await fetch(backendUrl(path), {
    ...options,
    headers: {
      ...(options.headers || {}),
      Cookie: sessionId ? `session_id=${sessionId}` : '',
    },
  })

  if (res.status === 401) {
    cookieStore.delete('session_id')
    redirect('/login')
  }

  return res
}

export type CurrentUser = {
  id: string
  email: string
  name?: string | null
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return fetchAPI<CurrentUser>(authApiPaths.me)
}
