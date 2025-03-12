import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getCustomerPortalUrl, checkSubscription } from '@/lib/polar'

interface AccountDialogProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

export function AccountDialog({ user, isOpen, onClose }: AccountDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isManagingSubscription, setIsManagingSubscription] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showDeactivationOptions, setShowDeactivationOptions] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (user && isOpen) {
      checkUserSubscription();
    }
  }, [user, isOpen]);

  // Reset all states when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setShowAdvancedSettings(false);
      setShowDeactivationOptions(false);
      setShowDeleteConfirmation(false);
      setDeleteConfirmText('');
      setDeleteReason('');
    }
  }, [isOpen]);

  const checkUserSubscription = async () => {
    if (!user) return;
    
    try {
      const hasSubscription = await checkSubscription(user.id);
      setIsSubscribed(hasSubscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsSubscribed(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    
    setIsManagingSubscription(true);
    try {
      const portalUrl = await getCustomerPortalUrl(user.id);
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Error getting customer portal URL:', error);
      alert('Failed to access subscription management. Please try again.');
    } finally {
      setIsManagingSubscription(false);
    }
  };

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
    // 확인 텍스트가 정확하지 않으면 삭제 불가
    if (deleteConfirmText !== `delete ${user.email}`) {
      alert('Please enter the confirmation text exactly as shown to proceed.');
      return;
    }
    
    // 삭제 이유를 선택하지 않으면 삭제 불가
    if (!deleteReason) {
      alert('Please select a reason for deleting your account.');
      return;
    }
    
    setIsDeleting(true)
    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: deleteReason }),
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

  // 계정 삭제 확인 화면
  if (showDeleteConfirmation) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-hidden backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowDeleteConfirmation(false)
        }}
      >
        <div className="w-full max-w-2xl bg-[var(--background)] h-full flex flex-col shadow-xl">
          <div className="pt-12 px-6 pb-6 border-b border-[var(--accent)]">
            <h2 className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider text-red-500">Permanently Delete Account</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className="mb-8 space-y-6">
                <div className="p-4 bg-red-500/10 text-red-500 text-sm">
                  <p className="font-medium mb-2">Warning: This action cannot be undone</p>
                  <p>Deleting your account will:</p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Permanently delete all your conversations</li>
                    <li>Cancel any active subscriptions</li>
                    <li>Remove all your data from our servers</li>
                    <li>Prevent you from recovering this account</li>
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                      Please select a reason for deleting your account:
                    </label>
                    <select 
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      className="w-full p-3 bg-[var(--accent)] text-sm"
                      required
                    >
                      <option value="">Select a reason...</option>
                      <option value="privacy">Privacy concerns</option>
                      <option value="not_useful">Not useful for me</option>
                      <option value="too_expensive">Too expensive</option>
                      <option value="found_alternative">Found an alternative</option>
                      <option value="temporary">Temporary break</option>
                      <option value="other">Other reason</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
                      To confirm, please type <span className="font-medium text-red-500">{`delete ${user.email}`}</span>
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full p-3 bg-[var(--accent)] text-sm"
                      placeholder="Type the confirmation text"
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmText !== `delete ${user.email}` || !deleteReason}
                  className="w-full p-4 text-xs uppercase tracking-wider text-red-500 bg-red-500/10 
                           hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete My Account'}
                </button>
                
                <button
                  onClick={() => setShowDeleteConfirmation(false)}
                  className="w-full p-4 text-xs uppercase tracking-wider bg-[var(--accent)] hover:opacity-90 transition-opacity"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 기본 계정 설정 화면
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
              
              {/* Done button */}
              <button
                onClick={onClose}
                className="w-full mt-4 p-4 text-xs uppercase tracking-wider 
                         bg-[var(--foreground)] text-[var(--background)] 
                         hover:opacity-90 transition-opacity"
              >
                Done
              </button>
              
              {/* Advanced Settings Toggle */}
              <div className="mt-16 text-center">
                <button 
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  {showAdvancedSettings ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                </button>
              </div>
              
              {/* Advanced Settings Section */}
              {showAdvancedSettings && (
                <div className="mt-4 pt-4 border-t border-[var(--accent)]">
                  <div className="space-y-4">
                    {/* 구독 관리 버튼 */}
                    {isSubscribed && (
                      <button
                        onClick={handleManageSubscription}
                        disabled={isManagingSubscription}
                        className="w-full p-3 text-xs text-[var(--muted)] bg-[var(--background)] border border-[var(--accent)] hover:bg-[var(--accent)] transition-colors"
                      >
                        {isManagingSubscription ? 'Loading...' : 'Manage Billing Settings'}
                      </button>
                    )}
                    
                    {/* Help Center */}
                    {/* <button
                      className="w-full p-3 text-xs text-[var(--muted)] bg-[var(--background)] border border-[var(--accent)] hover:bg-[var(--accent)] transition-colors"
                    >
                      Help Center
                    </button> */}
                    
                    {/* Privacy Settings */}
                    {/* <button
                      className="w-full p-3 text-xs text-[var(--muted)] bg-[var(--background)] border border-[var(--accent)] hover:bg-[var(--accent)] transition-colors"
                    >
                      Privacy Settings
                    </button> */}
                    
                    {/* 계정 삭제 버튼 */}
                    <button
                      onClick={() => setShowDeleteConfirmation(true)}
                      className="w-full p-3 text-xs text-[var(--muted)] bg-[var(--background)] border border-[var(--accent)] hover:bg-[var(--accent)] transition-colors"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 