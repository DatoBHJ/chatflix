import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'

interface AdminGuardProps {
  children: React.ReactNode
}

export default async function AdminGuard({ children }: AdminGuardProps) {
  const adminAccess = await isAdmin()
  
  if (!adminAccess) {
    redirect('/login?message=Admin access required')
  }

  return <>{children}</>
} 