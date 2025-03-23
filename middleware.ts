import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { getLevelRateLimiter, createRateLimitKey } from '@/lib/ratelimit'
import { getModelById } from '@/lib/models/config'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Skip rate limiting for static files and images
  if (request.nextUrl.pathname.match(/\.(js|css|ico|png|jpg|jpeg|svg|gif)$/)) {
    return await updateSession(request)
  }

  // Skip rate limiting for the chat API - it's already handled in the route handler
  // But still update the session to maintain authentication state
  if (request.nextUrl.pathname.startsWith('/api/chat')) {
    const response = await updateSession(request);
    return response;
  }

  // Try to get the user ID for subscription and rate limiting
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

  // If no userId is found, we can't apply rate limiting properly
  // Just proceed with the request
  if (!userId) {
    return await updateSession(request)
  }

  let rateLimitResult;

  // Apply level-based rate limit for chat API requests
  if (request.nextUrl.pathname.startsWith('/api/chat')) {
    try {
      // More robust JSON parsing that won't crash the middleware
      const text = await request.clone().text();
      let body;
      try {
        body = JSON.parse(text);
      } catch (jsonError) {
        console.error('[DEBUG-RATELIMIT-MIDDLEWARE] Failed to parse JSON:', jsonError);
        // Skip rate limiting if we can't parse the request body
        return await updateSession(request);
      }
      
      const modelId = body.model;
      
      console.log(`[DEBUG-RATELIMIT-MIDDLEWARE] Processing request for user ${userId}, model ${modelId}`);
      
      if (modelId) {
        const modelConfig = getModelById(modelId);
        if (modelConfig) {
          const level = modelConfig.rateLimit.level;
          // Pass the userId to getLevelRateLimiter and await the result
          console.log(`[DEBUG-RATELIMIT-MIDDLEWARE] Using level ${level} for model ${modelId}`);
          const levelRateLimiter = await getLevelRateLimiter(level, userId);
          rateLimitResult = await levelRateLimiter.limit(createRateLimitKey(userId, level));
          console.log(`[DEBUG-RATELIMIT-MIDDLEWARE] Rate limit result:`, {
            success: rateLimitResult.success,
            remaining: rateLimitResult.remaining,
            limit: rateLimitResult.limit,
            reset: new Date(rateLimitResult.reset).toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error in rate limiting middleware:', error);
      // If we can't parse the body or find the model, just continue without rate limiting
      return await updateSession(request)
    }
  }

  if (rateLimitResult && !rateLimitResult.success) {
    const { limit, reset } = rateLimitResult

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
    try {
      // Try to extract additional information for the rate limit page
      let modelId = '';
      let level = '';
      
      if (request.nextUrl.pathname.startsWith('/api/chat')) {
        const body = await request.clone().json();
        modelId = body.model || '';
        
        if (modelId) {
          const modelConfig = getModelById(modelId);
          if (modelConfig) {
            level = modelConfig.rateLimit.level;
          }
        }
      }
      
      const params = new URLSearchParams({
        limit: limit.toString(),
        reset: new Date(reset).toISOString(),
      });
      
      // Add optional parameters if available
      if (modelId) params.append('model', modelId);
      if (level) params.append('level', level);
      
      return NextResponse.redirect(new URL(`/rate-limit?${params.toString()}`, request.url));
    } catch (error) {
      // If there's an error parsing the body, just redirect with basic info
      const params = new URLSearchParams({
        limit: limit.toString(),
        reset: new Date(reset).toISOString(),
      });
      
      return NextResponse.redirect(new URL(`/rate-limit?${params.toString()}`, request.url));
    }
  }

  // Add rate limit headers to all responses if we have rate limit results
  const response = await updateSession(request)
  
  if (rateLimitResult) {
    const { limit, remaining, reset } = rateLimitResult
    response.headers.set('X-RateLimit-Limit', limit.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString())
  }

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