import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

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
  <title>Chatflix - Under Maintenance</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      font-weight: 300;
    }
    p {
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Chatflix</h1>
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
    
    // 🚀 웹훅 경로는 유지보수 모드에서도 접근 가능
    if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
      return NextResponse.next();
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

  // 🚀 웹훅 경로는 인증 및 기타 체크 제외
  if (request.nextUrl.pathname.startsWith('/api/webhooks/')) {
    console.log('🎯 Webhook request detected, bypassing middleware checks');
    return NextResponse.next();
  }

  // Skip processing for static files and images
  if (request.nextUrl.pathname.match(/\.(js|css|ico|png|jpg|jpeg|svg|gif)$/)) {
    return await updateSession(request)
  }

  // Admin route protection (both pages and API)
  if (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/api/admin')) {
    try {
      // Import supabase here to avoid loading it on every request
      const { createServerClient } = await import('@supabase/ssr')
      
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll().map(cookie => ({
                name: cookie.name,
                value: cookie.value
              }))
            },
            setAll() {
              // No-op in middleware
            }
          }
        }
      )

      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        // Redirect to login for admin routes
        return NextResponse.redirect(new URL('/login', request.url))
      }

      // Check if user is admin
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .single()

      if (!profile?.is_admin) {
        // Redirect to home if not admin
        return NextResponse.redirect(new URL('/', request.url))
      }

      // Continue to admin route
      return await updateSession(request)
    } catch (error) {
      console.error('Error in admin route protection:', error)
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Default: update session for all other requests
  return await updateSession(request)
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