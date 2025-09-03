import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  
  console.log('OAuth callback received:', { 
    code: code ? 'present' : 'missing', 
    error, 
    errorDescription,
    origin,
    searchParams: Object.fromEntries(searchParams.entries())
  })
  
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get('next') ?? '/'
  if (!next.startsWith('/')) {
    // if "next" is not a relative URL, use the default
    next = '/'
  }

  // Handle OAuth error responses
  if (error) {
    console.error('OAuth error:', { error, errorDescription })
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`
    )
  }
  
  if (code) {
    try {
      const supabase = await createClient()
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      console.log('Code exchange result:', { 
        success: !exchangeError, 
        error: exchangeError?.message,
        userId: data?.user?.id
      })
      
      if (!exchangeError) {
        console.log('OAuth login successful, redirecting to:', next)
        const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
        const isLocalEnv = process.env.NODE_ENV === 'development'
        if (isLocalEnv) {
          // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
          return NextResponse.redirect(`${origin}${next}`)
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`)
        } else {
          return NextResponse.redirect(`${origin}${next}`)
        }
      } else {
        console.error('Code exchange failed:', exchangeError)
      }
    } catch (error) {
      console.error('Unexpected error during code exchange:', error)
    }
  } else {
    console.error('No authorization code received')
  }
  
  // Fallback: send the user back to login with a generic message
  console.log('Redirecting to login due to OAuth error')
  return NextResponse.redirect(`${origin}/login?message=Authentication%20error`)
} 