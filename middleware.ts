import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { redis, getLevelRateLimiter } from '@/lib/ratelimit'
import { Ratelimit } from '@upstash/ratelimit'
import { getModelById } from '@/lib/models/config'
import { createServerClient } from '@supabase/ssr'

// Create a new ratelimiter, that allows 10 requests per 10 seconds for general routes
const globalRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
  prefix: 'global_ratelimit',
})

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

  // Try to get the user ID for subscription checking
  let userId: string | undefined;
  try {
    // Create a Supabase client for the middleware
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // We don't need to set cookies in this context
          },
        },
      }
    )
    
    // Get the user
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  } catch (error) {
    console.error('Error getting user in middleware:', error)
    // Continue without user ID if there's an error
  }

  let rateLimitResult;

  // Apply level-based rate limit for chat API requests
  if (request.nextUrl.pathname.startsWith('/api/chat')) {
    try {
      const body = await request.clone().json()
      const modelId = body.model
      
      if (modelId) {
        const modelConfig = getModelById(modelId);
        if (modelConfig) {
          const level = modelConfig.rateLimit.level;
          // Pass the userId to getLevelRateLimiter and await the result
          const levelRateLimiter = await getLevelRateLimiter(level, userId);
          const identifier = `${ip}:${level}`;
          rateLimitResult = await levelRateLimiter.limit(identifier);
        } else {
          rateLimitResult = await globalRatelimit.limit(`${ip}:${request.nextUrl.pathname}`);
        }
      } else {
        rateLimitResult = await globalRatelimit.limit(`${ip}:${request.nextUrl.pathname}`);
      }
    } catch (error) {
      console.error('Error in rate limiting middleware:', error);
      // If we can't parse the body or find the model, use global rate limit
      rateLimitResult = await globalRatelimit.limit(`${ip}:${request.nextUrl.pathname}`);
    }
  } else {
    // Use global rate limit for all other routes
    rateLimitResult = await globalRatelimit.limit(`${ip}:${request.nextUrl.pathname}`);
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