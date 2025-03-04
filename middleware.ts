import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { redis } from '@/lib/ratelimit'
import { Ratelimit } from '@upstash/ratelimit'
import { MODEL_CONFIGS } from '@/lib/models/config'

type Duration = `${number} ms` | `${number} s` | `${number} m` | `${number} h` | `${number} d`;

// Helper function to parse window string into Duration format
function parseWindow(window: string): Duration {
  // Expected format: "60 m" or similar
  const [value, unit] = window.split(' ');
  return `${value} ${unit}` as Duration;
}

// Create a new ratelimiter, that allows 10 requests per 10 seconds for general routes
const globalRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s' as Duration),
  analytics: true,
  prefix: 'global_ratelimit',
})

// Create model-specific rate limiters
const modelRateLimiters = MODEL_CONFIGS.reduce((acc, model) => {
  acc[model.id] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      model.rateLimit.requests,
      parseWindow(model.rateLimit.window)
    ),
    analytics: true,
    prefix: `ratelimit:model:${model.id}`,
  })
  return acc
}, {} as { [key: string]: Ratelimit })

export async function middleware(request: NextRequest) {
  // Skip rate limiting for static files and images
  if (request.nextUrl.pathname.match(/\.(js|css|ico|png|jpg|jpeg|svg|gif)$/)) {
    return await updateSession(request)
  }

  // Get IP or a unique identifier
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
             request.headers.get('x-real-ip') ?? 
             '127.0.0.1'

  let rateLimitResult;

  // Apply model-specific rate limit for chat API requests
  if (request.nextUrl.pathname.startsWith('/api/chat')) {
    try {
      const body = await request.clone().json()
      const modelId = body.model
      
      if (modelId && modelRateLimiters[modelId]) {
        const identifier = `${ip}:${modelId}`
        rateLimitResult = await modelRateLimiters[modelId].limit(identifier)
      } else {
        rateLimitResult = await globalRatelimit.limit(`${ip}:${request.nextUrl.pathname}`)
      }
    } catch (error) {
      // If we can't parse the body or find the model, use global rate limit
      rateLimitResult = await globalRatelimit.limit(`${ip}:${request.nextUrl.pathname}`)
    }
  } else {
    // Use global rate limit for all other routes
    rateLimitResult = await globalRatelimit.limit(`${ip}:${request.nextUrl.pathname}`)
  }

  const { success, limit, remaining, reset } = rateLimitResult

  if (!success) {
    // If it's an API request, return JSON response
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          limit,
          remaining: 0,
          reset: new Date(reset).toISOString(),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(reset).toISOString(),
          },
        }
      )
    }

    // For regular pages, redirect to rate limit page with information
    const params = new URLSearchParams({
      limit: limit.toString(),
      reset: new Date(reset).toISOString(),
    })
    return NextResponse.redirect(new URL(`/rate-limit?${params.toString()}`, request.url))
  }

  // Add rate limit headers to all responses
  const response = await updateSession(request)
  response.headers.set('X-RateLimit-Limit', limit.toString())
  response.headers.set('X-RateLimit-Remaining', remaining.toString())
  response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString())

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}