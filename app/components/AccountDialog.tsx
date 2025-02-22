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
    <div 
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-hidden backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl bg-[var(--background)] h-full flex flex-col shadow-xl">
        {/* Fixed Header */}
        <div className="pt-12 px-6 pb-6 border-b border-[var(--accent)]">
          <h2 className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider hover:text-[var(--muted)] transition-colors">Account Settings</h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* User Info */}
            <div className="mb-8">
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)] pb-4">Account</div>
                  <div className="text-sm">{user.email}</div>
                </div>
                <div className="h-[1px] bg-[var(--accent)]" />
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Actions</div>
                  {/* <div className="text-[10px] text-[var(--muted)]">
                    Manage your account settings and data
                  </div> */}
                </div>
              </div>
            </div>

            {/* Account Actions */}
            <div className="space-y-2">
              <button
                onClick={handleSignOut}
                className="w-full p-4 text-xs uppercase tracking-wider bg-[var(--accent)] hover:opacity-90 transition-opacity"
              >
                Sign Out
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="w-full p-4 text-xs uppercase tracking-wider text-red-500 bg-red-500/10 
                         hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {isDeleting ? '...' : 'Delete Account'}
              </button>
            </div>

            {/* Done button */}
            <button
              onClick={onClose}
              className="w-full mt-8 p-4 text-xs uppercase tracking-wider 
                       bg-[var(--foreground)] text-[var(--background)] 
                       hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 