import { NextRequest, NextResponse } from "next/server"

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
  "Access-Control-Max-Age": "86400"
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30

type RateLimitState = {
  count: number
  windowStart: number
}

const globalRateLimitStore = globalThis as typeof globalThis & {
  __apiRateLimitStore?: Map<string, RateLimitState>
}

const rateLimitStore = globalRateLimitStore.__apiRateLimitStore ?? new Map<string, RateLimitState>()
globalRateLimitStore.__apiRateLimitStore = rateLimitStore

const getClientKey = (request: NextRequest): string => {
  const userId = request.headers.get("x-user-id")?.trim()
  if (userId) return `user:${userId}`

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwardedFor) return `ip:${forwardedFor}`

  return `ip:${request.ip || "unknown"}`
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
    }

    const now = Date.now()
    const clientKey = getClientKey(request)
    const current = rateLimitStore.get(clientKey)

    if (!current || now - current.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.set(clientKey, { count: 1, windowStart: now })
    } else {
      current.count += 1
      rateLimitStore.set(clientKey, current)
    }

    const active = rateLimitStore.get(clientKey)!
    if (active.count > RATE_LIMIT_MAX_REQUESTS) {
      const retryAfterSeconds = Math.ceil((active.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            "Retry-After": String(Math.max(retryAfterSeconds, 1)),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
            "X-RateLimit-Remaining": "0"
          }
        }
      )
    }

    const remaining = Math.max(RATE_LIMIT_MAX_REQUESTS - active.count, 0)
    const response = NextResponse.next()
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value)
    }
    response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX_REQUESTS))
    response.headers.set("X-RateLimit-Remaining", String(remaining))
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"]
}
