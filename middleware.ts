import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { getRateLimiter, createRateLimitKey } from '@/lib/ratelimit'
import { getModelById } from '@/lib/models/config'
import { createServerClient } from '@supabase/ssr'

// 프로덕션 환경 체크 함수
const isProduction = process.env.NODE_ENV === 'production';
// 유지보수 모드 체크 (환경 변수로 제어 가능)
const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';

// 유지보수 모드 HTML
const maintenanceHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chatflix - Maintenance</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background-color: #0a0a0a;
      color: #ffffff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      font-weight: 700;
    }
    p {
      font-size: 1.25rem;
      opacity: 0.8;
    }
    .logo {
      margin-bottom: 2rem;
      font-size: 2rem;
      font-weight: 800;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">CHATFLIX</div>
    <h1>Chatflix will be back</h1>
    <p>We're currently performing maintenance to improve your experience.</p>
    <p>Please check back soon.</p>
  </div>
</body>
</html>
`;

export async function middleware(request: NextRequest) {
  // 유지보수 모드가 활성화된 경우 처리
  if (isMaintenanceMode || (isProduction && process.env.FORCE_MAINTENANCE === 'true')) {
    // 정적 리소스는 그대로 처리
    if (request.nextUrl.pathname.match(/\.(js|css|ico|png|jpg|jpeg|svg|gif|webp)$/) ||
        request.nextUrl.pathname.startsWith('/_next/') ||
        request.nextUrl.pathname === '/favicon.ico') {
      return await updateSession(request);
    }
    
    // 관리자 경로는 예외 처리 - 관리자는 유지보수 모드에서도 접근 가능
    if (request.nextUrl.pathname.startsWith('/admin')) {
      return await updateSession(request);
    }
    
    // API 요청에 대해서는 JSON 응답 반환
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({
          error: 'Service unavailable',
          message: 'Chatflix is currently under maintenance. Please try again later.'
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '3600',
          },
        }
      );
    }
    
    // 그 외의 모든 요청에 대해 유지보수 페이지 반환
    return new NextResponse(maintenanceHTML, {
      status: 503, // Service Unavailable
      headers: {
        'Content-Type': 'text/html',
        'Retry-After': '3600', // 1시간 후 재시도 (초 단위)
      },
    });
  }

  // Skip rate limiting for static files and images
  if (request.nextUrl.pathname.match(/\.(js|css|ico|png|jpg|jpeg|svg|gif)$/)) {
    return await updateSession(request)
  }

  // Skip for /api/chat/demo - 데모 API는 인증 없이 접근 가능하도록 함
  if (request.nextUrl.pathname === '/api/chat/demo') {
    return NextResponse.next();
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
          
          // Get hourly and daily rate limiters
          console.log(`[DEBUG-RATELIMIT-MIDDLEWARE] Using level ${level} for model ${modelId}`);
          const rateLimiters = await getRateLimiter(modelId, userId);
          
          // Check if the user is subscribed
          let isSubscribed = false;
          try {
            const { supabase } = await import('@/lib/supabase');
            const { data, error } = await supabase.rpc('check_user_subscription', { user_id: userId });
            isSubscribed = data || false;
          } catch (error) {
            console.error('[DEBUG-RATELIMIT-MIDDLEWARE] Error checking subscription:', error);
          }
          
          // Check hourly limit
          const hourlyKey = createRateLimitKey(userId, level, 'hourly', isSubscribed);
          const hourlyResult = await rateLimiters.hourly.limit(hourlyKey);
          
          // Log hourly result
          console.log(`[DEBUG-RATELIMIT-MIDDLEWARE] Hourly rate limit result:`, {
            success: hourlyResult.success,
            remaining: hourlyResult.remaining,
            limit: hourlyResult.limit,
            reset: new Date(hourlyResult.reset).toISOString()
          });
          
          // Return hourly limit exceeded response if needed
          if (!hourlyResult.success) {
            return handleRateLimitExceeded(request, hourlyResult, level, modelId, 'hourly');
          }
          
          // Check daily limit
          const dailyKey = createRateLimitKey(userId, level, 'daily', isSubscribed);
          const dailyResult = await rateLimiters.daily.limit(dailyKey);
          
          // Log daily result
          console.log(`[DEBUG-RATELIMIT-MIDDLEWARE] Daily rate limit result:`, {
            success: dailyResult.success,
            remaining: dailyResult.remaining,
            limit: dailyResult.limit,
            reset: new Date(dailyResult.reset).toISOString()
          });
          
          // Return daily limit exceeded response if needed
          if (!dailyResult.success) {
            return handleRateLimitExceeded(request, dailyResult, level, modelId, 'daily');
          }
          
          // Store the results for adding headers later
          rateLimitResult = hourlyResult; // We'll use hourly for headers
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
    return redirectToRateLimitPage(request, rateLimitResult, null, null);
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

// Helper function to handle rate limit exceeded response
function handleRateLimitExceeded(
  request: NextRequest, 
  result: { limit: number, reset: number, success: boolean },
  level: string,
  modelId: string,
  type: 'hourly' | 'daily' = 'hourly'
) {
  // If it's an API request, return JSON response
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        limit: result.limit,
        remaining: 0,
        reset: new Date(result.reset).toISOString(),
        type: type
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(result.reset).toISOString(),
          'X-RateLimit-Type': type
        },
      }
    )
  }
  
  // For regular pages, redirect to rate limit page
  return redirectToRateLimitPage(request, result, level, modelId, type);
}

// Helper function to redirect to rate limit page
function redirectToRateLimitPage(
  request: NextRequest, 
  result: { limit: number, reset: number, success: boolean },
  level: string | null,
  modelId: string | null,
  type: 'hourly' | 'daily' = 'hourly'
) {
  const params = new URLSearchParams({
    limit: result.limit.toString(),
    reset: new Date(result.reset).toISOString(),
    type: type
  });
  
  // Add optional parameters if available
  if (modelId) params.append('model', modelId);
  if (level) params.append('level', level);
  
  return NextResponse.redirect(new URL(`/rate-limit?${params.toString()}`, request.url));
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