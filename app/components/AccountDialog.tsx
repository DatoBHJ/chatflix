import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

interface AccountDialogProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

export function AccountDialog({ user, isOpen, onClose }: AccountDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
      alert('Failed to sign out. Please try again.')
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return
    
    setIsDeleting(true)
    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      alert(data.message || 'Your account has been deleted.')
      router.push('/login')
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete account. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--background)] w-full max-w-[280px] mx-4">
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wider truncate">
            {user.email}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors ml-4 text-xs"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-3">
          <button
            onClick={handleSignOut}
            className="w-full h-[46px] flex items-center justify-center text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            Sign Out
          </button>
          <button
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="w-full h-[46px] flex items-center justify-center text-xs uppercase tracking-wider text-[var(--muted)] hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? '...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  )
} 