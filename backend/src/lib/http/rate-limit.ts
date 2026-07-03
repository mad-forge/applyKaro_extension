import type { NextRequest } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || forwardedFor
    || 'unknown';
}

export function createRateLimiter(maxRequests: number, windowMs: number) {
  const entries = new Map<string, RateLimitEntry>();

  const cleanup = (now: number) => {
    for (const [key, entry] of entries.entries()) {
      if (now > entry.resetAt) entries.delete(key);
    }
  };

  return function rateLimit(req: NextRequest): RateLimitResult {
    const now = Date.now();
    cleanup(now);

    const ip = getClientIp(req);
    const current = entries.get(ip);

    if (!current || now > current.resetAt) {
      const resetAt = now + windowMs;
      entries.set(ip, { count: 1, resetAt });
      return { allowed: true, remaining: maxRequests - 1, resetAt, limit: maxRequests };
    }

    if (current.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt: current.resetAt, limit: maxRequests };
    }

    current.count += 1;
    return {
      allowed: true,
      remaining: maxRequests - current.count,
      resetAt: current.resetAt,
      limit: maxRequests,
    };
  };
}

export function rateLimitHeaders(result: RateLimitResult) {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.allowed) {
    headers['Retry-After'] = String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)));
  }
  return headers;
}
