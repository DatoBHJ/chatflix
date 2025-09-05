import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // 커스텀 도메인이 설정된 경우 우선 사용, 없으면 기본 Supabase URL 사용
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_CUSTOM_DOMAIN || process.env.NEXT_PUBLIC_SUPABASE_URL!
  
  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
} 