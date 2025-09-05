import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 환경변수에서 관리자 정보 가져오기
const getAdminUserIds = () => {
  const ids = process.env.ADMIN_USER_IDS
  return ids ? ids.split(',').map(id => id.trim()) : []
}

const getAdminEmails = () => {
  const emails = process.env.ADMIN_EMAILS
  return emails ? emails.split(',').map(email => email.trim()) : []
}

/**
 * 사용자가 관리자인지 확인하는 함수 (서버 사이드)
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_CUSTOM_DOMAIN || process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabase = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {
            // Cookies are read-only in this context
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return false
    }

    // 사용자 ID 또는 이메일로 관리자 권한 확인
    const adminUserIds = getAdminUserIds()
    const adminEmails = getAdminEmails()
    return adminUserIds.includes(user.id) || adminEmails.includes(user.email || '')
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * 사용자가 관리자인지 확인하는 함수 (미들웨어용)
 */
export function isAdminUser(userId: string, email?: string): boolean {
  const adminUserIds = getAdminUserIds()
  const adminEmails = getAdminEmails()
  return adminUserIds.includes(userId) || Boolean(email && adminEmails.includes(email))
}

/**
 * 관리자 정보를 가져오는 함수
 */
export function getAdminInfo() {
  return {
    adminUserIds: getAdminUserIds(),
    adminEmails: getAdminEmails()
  }
} 