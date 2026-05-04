/**
 * 与 Nest 一致：`main.ts` 中 `setGlobalPrefix('api')`。
 * 仅含 URL 拼接，无 `next/headers`，可在 Client / Server 任意处引用。
 */
export const BACKEND_API_PREFIX = '/api'

/** 浏览器经 Next BFF 转发到 Nest 的前缀（见 `app/api/nest/[...path]/route.ts`） */
export const NEST_BFF_PREFIX = '/api/nest'

export function getBackendOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ??
    'http://localhost:3025'
  )
}

/** 拼 Nest 完整 URL（直连后端，多用于 Server Action 登录等） */
export function backendUrl(pathname: string): string {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${getBackendOrigin()}${p}`
}

/**
 * 将 `/api/...` 转为同域 BFF 路径，便于浏览器携带 Next 域下的 `session_id` Cookie。
 * @example nestBffPath('/api/rag/search') → '/api/nest/rag/search'
 */
export function nestBffPath(fullApiPath: string): string {
  const normalized = fullApiPath.replace(/^\//, '')
  const rest = normalized.toLowerCase().startsWith('api/')
    ? normalized.slice(4)
    : normalized
  return `${NEST_BFF_PREFIX}/${rest}`
}

export const authApiPaths = {
  login: `${BACKEND_API_PREFIX}/auth/login`,
  logout: `${BACKEND_API_PREFIX}/auth/logout`,
  register: `${BACKEND_API_PREFIX}/auth/register`,
  me: `${BACKEND_API_PREFIX}/auth/me`,
} as const
