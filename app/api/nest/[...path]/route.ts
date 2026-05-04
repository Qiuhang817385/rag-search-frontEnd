import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { backendUrl } from '@/lib/backend-url'

export const runtime = 'nodejs'

async function forward(
  request: NextRequest,
  segments: string[],
): Promise<Response> {
  if (!segments.length) {
    return NextResponse.json({ message: '缺少路径' }, { status: 400 })
  }

  const url = new URL(request.url)
  const backendPath = `/api/${segments.join('/')}${url.search}`
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  const incoming = new Headers()
  const ct = request.headers.get('content-type')
  if (ct) incoming.set('content-type', ct)
  const accept = request.headers.get('accept')
  if (accept) incoming.set('accept', accept)
  if (sessionId) incoming.set('cookie', `session_id=${sessionId}`)

  const method = request.method
  const hasBody = !['GET', 'HEAD'].includes(method)

  const init: RequestInit & { duplex?: 'half' } = hasBody
    ? {
        method,
        headers: incoming,
        body: request.body,
        duplex: 'half',
      }
    : { method, headers: incoming }

  const backendRes = await fetch(backendUrl(backendPath), init)

  if (backendRes.status === 401) {
    cookieStore.delete('session_id')
  }

  const out = new NextResponse(backendRes.body, {
    status: backendRes.status,
    statusText: backendRes.statusText,
  })
  const pass = ['content-type', 'cache-control', 'connection']
  for (const h of pass) {
    const v = backendRes.headers.get(h)
    if (v) out.headers.set(h, v)
  }
  return out
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params
  return forward(request, path)
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params
  return forward(request, path)
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params
  return forward(request, path)
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params
  return forward(request, path)
}
