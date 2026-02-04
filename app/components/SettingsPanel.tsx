'use client'

import { useRouter } from 'next/navigation'
import { AccountDialog, fetchUserName, updateUserName } from './AccountDialog'
import { ContactUsDialog } from './ContactUsDialog'
import { BackgroundSettingsModal } from './BackgroundSettingsModal'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { checkSubscriptionClient, clearClientSubscriptionCache } from '@/lib/subscription-client'
import { clearAllSubscriptionCache } from '@/lib/utils'
import { SquarePencil } from 'react-ios-icons'
import { createClient } from '@/utils/supabase/client'
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage'
import { useBackgroundImageBrightness } from '@/app/hooks/useBackgroundImageBrightness'
import { handleDeleteAllChats as deleteAllChatsUtility } from '@/app/lib/chatUtils'
import { 
  User, 
  CreditCard, 
  LifeBuoy, 
  ChevronRight, 
  ChevronLeft,
  LogOut, 
  Mail, 
  Smartphone,
  Trash2,
  Info,
  Database,
  Camera,
  AlertTriangle,
  X,
  Layout
} from 'lucide-react'
import Image from 'next/image'
import ReactDOM from 'react-dom'
import { getAdaptiveGlassStyleBlur, getIconClassName } from '@/app/lib/adaptiveGlassStyle'

// --- iOS 스타일 서브 컴포넌트 ---

const IOSGroup = ({ children, title }: { children: React.ReactNode; title?: string }) => (
  <div className="mb-7 last:mb-0">
    {title && (
      <div className="px-4 mb-1.5 text-[13px] font-normal uppercase tracking-tight text-white/40">
        {title}
      </div>
    )}
    <div 
      className="overflow-hidden rounded-[12px]"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
      }}
    >
      <div className="divide-y divide-white/5">
        {children}
      </div>
    </div>
  </div>
)

const IOSRow = ({ 
  icon: Icon, 
  label, 
  value, 
  onClick, 
  color = 'bg-gray-500', 
  showChevron = true,
  isDanger = false,
  customIcon
}: { 
  icon?: any; 
  label: string; 
  value?: string; 
  onClick?: (e: React.MouseEvent) => void;
  color?: string;
  showChevron?: boolean;
  isDanger?: boolean;
  customIcon?: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 py-3 active:bg-white/10 transition-colors text-left"
  >
    <div className="flex items-center gap-3">
      <div className={`w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0 ${isDanger ? 'bg-red-500' : color}`}>
        {customIcon ? customIcon : <Icon size={18} className="text-white" />}
      </div>
      <span className={`text-[17px] leading-tight font-normal ${isDanger ? 'text-red-400' : 'text-white'}`}>
        {label}
      </span>
    </div>
    <div className="flex items-center gap-2">
      {value && <span className="text-[17px] text-white/40">{value}</span>}
      {showChevron && <ChevronRight size={18} className="text-white/15" />}
    </div>
  </button>
)

// --- 메인 SettingsPanel 컴포넌트 ---

export interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  user?: any
  handleDeleteAllChats?: () => Promise<void>
}

export function SettingsPanel({ isOpen, onClose, user, handleDeleteAllChats: providedHandleDeleteAllChats }: SettingsPanelProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const isAnonymousUser = !user || user?.isAnonymous || user?.id === 'anonymous'

  const [panelElements, setPanelElements] = useState({ background: false, content: false })
  const [currentView, setCurrentView] = useState<'main' | 'account' | 'subscription'>('main')

  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null)
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true)
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)
  const [isContactUsDialogOpen, setIsContactUsDialogOpen] = useState(false)
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false)

  const [userName, setUserName] = useState('')
  const [isUserNameLoading, setIsUserNameLoading] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [isUpdatingName, setIsUpdatingName] = useState(false)

  // 프로필 이미지 및 계정 삭제 관련 상태 추가
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { currentBackground, backgroundType, backgroundId, refreshBackground } = useBackgroundImage(user?.id, { refreshOnMount: true, preload: true, useSupabase: false })
  const { isVeryDark, isVeryBright } = useBackgroundImageBrightness(currentBackground)

  const overlayColor = useMemo(() => {
    if (isVeryDark) return 'rgba(255, 255, 255, 0.1)'
    if (isVeryBright) return 'rgba(0, 0, 0, 0.15)'
    return undefined
  }, [isVeryDark, isVeryBright])

  useEffect(() => {
    // 로그아웃 중이면 실행하지 않음
    if (isLoggingOut) return
    
    if (user && !isAnonymousUser) {
      fetchUserName(user.id, supabase).then(name => {
        if (!isLoggingOut) {
          setUserName(name)
          setIsUserNameLoading(false)
        }
      }).catch(() => {
        if (!isLoggingOut) {
          setIsUserNameLoading(false)
        }
      })
      fetchProfileImage(user.id)
    } else {
      setUserName(isAnonymousUser ? 'Guest' : 'Account')
      setIsUserNameLoading(false)
    }
  }, [user, isAnonymousUser, supabase, isLoggingOut])

  const fetchProfileImage = async (userId: string) => {
    // 로그아웃 중이면 실행하지 않음
    if (isLoggingOut) return
    
    try {
      const { data: profileData } = await supabase.storage.from('profile-pics').list(`${userId}`)
      if (profileData && profileData.length > 0 && !isLoggingOut) {
        const { data } = supabase.storage.from('profile-pics').getPublicUrl(`${userId}/${profileData[0].name}`)
        setProfileImage(data.publicUrl)
      }
    } catch (error) {
      // 로그아웃 중이면 에러를 무시
      if (!isLoggingOut) {
        console.error('Error fetching profile image:', error)
      }
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setIsUploading(true)
    try {
      const timestamp = Date.now()
      const fileName = `profile_${timestamp}.${file.name.split('.').pop()}`
      const filePath = `${user.id}/${fileName}`
      
      const { data: existingFiles } = await supabase.storage.from('profile-pics').list(`${user.id}`)
      if (existingFiles && existingFiles.length > 0) {
        await supabase.storage.from('profile-pics').remove(existingFiles.map(f => `${user.id}/${f.name}`))
      }

      await supabase.storage.from('profile-pics').upload(filePath, file)
      const { data } = supabase.storage.from('profile-pics').getPublicUrl(filePath)
      setProfileImage(data.publicUrl)
    } catch (error) {
      alert('Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== `delete ${user.email}`) {
      alert('Please enter the confirmation text correctly.')
      return
    }
    if (!deleteReason) {
      alert('Please select a reason.')
      return
    }
    setIsDeletingAccount(true)
    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason }),
      })
      if (response.ok) {
        alert('Account deleted successfully.')
        router.push('/login')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete account')
      }
    } catch (error) {
      alert('An error occurred')
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const handleDeleteAll = useCallback(async () => {
    if (providedHandleDeleteAllChats) {
      await providedHandleDeleteAllChats()
    } else {
      await deleteAllChatsUtility({ user, router, supabase })
    }
  }, [providedHandleDeleteAllChats, user, router, supabase])

  useEffect(() => {
    if (isOpen) {
      // 애니메이션 없이 즉시 표시
      setPanelElements({ background: true, content: true });
    } else {
      // Close animation sequence
      setPanelElements({ background: false, content: false });
      setCurrentView('main');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
      window.addEventListener('keydown', onKey)
      return () => {
        document.body.style.overflow = originalOverflow
        window.removeEventListener('keydown', onKey)
      }
    }
  }, [isOpen, onClose])

  const checkSubscriptionStatus = useCallback(async (forceCheck = false) => {
    // 로그아웃 중이면 실행하지 않음
    if (isLoggingOut) return
    
    if (!user?.id || isAnonymousUser) {
      setIsSubscribed(false)
      setIsSubscriptionLoading(false)
      return
    }
    try {
      const has = await checkSubscriptionClient(forceCheck)
      if (!isLoggingOut) {
        setIsSubscribed(has)
      }
    } catch (error) {
      if (!isLoggingOut) {
        console.error(error)
        setIsSubscribed(false)
      }
    } finally {
      if (!isLoggingOut) {
        setIsSubscriptionLoading(false)
      }
    }
  }, [user?.id, isAnonymousUser, isLoggingOut])

  useEffect(() => {
    if (isSubscribed === null) checkSubscriptionStatus()
  }, [checkSubscriptionStatus, isSubscribed])

  const startEditingName = () => {
    setEditingName(userName)
    setIsEditingName(true)
  }

  const saveEditingName = async () => {
    if (!user || isAnonymousUser || editingName.trim() === userName.trim()) {
      setIsEditingName(false)
      return
    }
    setIsUpdatingName(true)
    try {
      await updateUserName(user.id, editingName.trim(), supabase)
      setUserName(editingName.trim())
      setIsEditingName(false)
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    } finally {
      setIsUpdatingName(false)
    }
  }

  const handleManageSubscription = async () => {
    if (!user?.id || isAnonymousUser) return;
    
    setIsLoadingPortal(true);
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get portal URL');
      }

      const data = await response.json();
      if (data.portalUrl) {
        window.open(data.portalUrl, '_blank');
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      console.error('Error getting customer portal URL:', error);
      alert('Unable to open subscription management page. Please try again later.');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleUpgradeToPro = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    if (!user.id || !user.email) {
      alert('Your account information is incomplete. Please log out and sign in again.');
      return;
    }
    
    setIsLoadingPortal(true);
    try {
      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: user.user_metadata?.full_name || user.email.split('@')[0]
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }
      
      if (data.checkout && data.checkout.url) {
        window.location.href = data.checkout.url;
      } else {
        throw new Error('Invalid checkout response');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to create checkout session. Please try again.');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEditingName()
    else if (e.key === 'Escape') setIsEditingName(false)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-80 text-white pointer-events-auto">
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat w-full" 
          style={{ 
            backgroundImage: currentBackground ? `url("${currentBackground.replace(/"/g, '\\"')}")` : undefined,
            zIndex: 0 
          }} 
        />
        <div className="fixed inset-0 w-full" style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', backgroundColor: overlayColor || 'rgba(0,0,0,0.2)', zIndex: 0.5 }} />
        <div className="absolute inset-0 z-10" onClick={onClose} />
        
        <div className="relative h-full w-full flex flex-col transform-gpu" style={{ zIndex: 20 }}>
          
          {/* Header - Navigation Buttons */}
          <div className="absolute top-3 left-0 right-0 flex items-center justify-center px-3 z-30 h-10">
            {/* Back Button - Left (서브뷰에서만 표시) */}
            {currentView !== 'main' && (
              <button
                onClick={() => setCurrentView('main')}
                className="absolute left-3 rounded-full p-2 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                style={{
                  ...getAdaptiveGlassStyleBlur(),
                  color: 'rgba(255, 255, 255)',
                }}
                aria-label="Back to Settings"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Close Button - Right (메인에서만 표시, 서브뷰에서는 숨김) */}
            {currentView === 'main' && (
              <button
                onClick={onClose}
                className="absolute right-3 rounded-full p-2 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                style={{
                  ...getAdaptiveGlassStyleBlur(),
                  color: 'rgba(255, 255, 255)',
                }}
                aria-label="Close Settings"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-32 pb-20">
            <div className="max-w-lg mx-auto">
              
              {/* --- MAIN VIEW --- */}
              {currentView === 'main' && (
                <>
                  <h1 className="text-[34px] font-bold text-white px-2 mb-5">Settings</h1>
                  
                  {/* Profile Group */}
                  <div className="mb-7">
                    <div className="overflow-hidden rounded-[12px]" style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}>
                      <button onClick={() => setCurrentView('account')} className="w-full flex items-center justify-between px-4 py-4 active:bg-white/10 transition-colors text-left">
                        <div className="flex items-center gap-4">
                          <div className="w-[60px] h-[60px] rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-semibold overflow-hidden relative">
                            {profileImage ? (
                              <Image src={profileImage} alt={userName} fill className="object-cover" />
                            ) : (
                              userName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[20px] font-normal text-white">{userName}</span>
                            <span className="text-[13px] text-white/40 leading-tight mt-0.5">Personal Information, Data & Safety</span>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-white/15" />
                      </button>
                    </div>
                  </div>

                  <IOSGroup>
                    <IOSRow icon={CreditCard} label="Subscription" value={isSubscribed ? 'Pro' : 'Free'} color="bg-orange-500" onClick={() => setCurrentView('subscription')} />
                    <IOSRow icon={Layout} label="Background" color="bg-violet-500" onClick={() => setIsBackgroundModalOpen(true)} />
                    {/* <IOSRow icon={Info} label="About Chatflix" color="bg-gray-400" onClick={() => router.push('/about')} /> */}
                  </IOSGroup>

                  <IOSGroup>
                    <IOSRow icon={Mail} label="Contact Us" color="bg-blue-400" onClick={() => setIsContactUsDialogOpen(true)} />
                  </IOSGroup>

                  <IOSGroup title="About">
                    <button 
                      onClick={() => router.push('/pwa-guide')}
                      className="w-full px-4 py-3 flex items-center justify-between active:bg-white/10 transition-colors text-left"
                    >
                      <span className="text-[17px] text-white font-normal">Install as app (PWA)</span>
                      <ChevronRight size={18} className="text-white/15" />
                    </button>
                    <button 
                      onClick={() => router.push('/privacy')}
                      className="w-full px-4 py-3 flex items-center justify-between active:bg-white/10 transition-colors text-left border-t border-white/5"
                    >
                      <span className="text-[17px] text-white font-normal">Privacy & Terms</span>
                      <ChevronRight size={18} className="text-white/15" />
                    </button>
                    <div className="px-4 py-3 flex items-center justify-between border-t border-white/5">
                      <span className="text-[17px] text-white">Software Version</span>
                      <span className="text-[17px] text-white/30">0.3.0</span>
                    </div>
                  </IOSGroup>
                </>
              )}

              {/* --- ACCOUNT VIEW --- */}
              {currentView === 'account' && (
                <div className="flex flex-col">
                  {/* Large Avatar Section */}
                  <div className="mb-10 flex flex-col items-center w-full">
                    <div 
                      className="w-32 h-32 rounded-full bg-[#9daedb] flex items-center justify-center text-white text-5xl font-semibold overflow-hidden relative shadow-2xl"
                    >
                      {profileImage ? (
                        <Image src={profileImage} alt={userName} fill className="object-cover" />
                      ) : (
                        <span className="tracking-tighter">{userName.slice(0, 2).toUpperCase()}</span>
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        if (isAnonymousUser) {
                          router.push('/login')
                        } else {
                          fileInputRef.current?.click()
                        }
                      }}
                      className="mt-4 px-3 py-1.5 bg-white/10 rounded-full text-[#007AFF] font-medium text-[15px] active:opacity-50 transition-opacity"
                    >
                      {isAnonymousUser ? 'Sign In to Change' : 'Change'}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                  </div>

                  {/* Information Groups */}
                  <IOSGroup>
                    <div className="px-4 py-3.5 flex items-center justify-between">
                      <span className="text-[17px] text-white">Name</span>
                      {isEditingName ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={saveEditingName}
                          onKeyDown={handleNameKeyDown}
                          disabled={isUpdatingName}
                          className="text-right bg-transparent text-[17px] text-white focus:outline-none w-1/2 border-b border-blue-500"
                          autoFocus
                        />
                      ) : (
                        <button 
                          onClick={() => {
                            if (isAnonymousUser) {
                              router.push('/login')
                            } else {
                              startEditingName()
                            }
                          }} 
                          className="text-[17px] text-white/40 active:opacity-50 transition-opacity flex items-center gap-2"
                        >
                          {userName}
                          <SquarePencil className="w-[18px] h-[18px] text-[#007AFF]" />
                        </button>
                      )}
                    </div>
                    <div className="px-4 py-3.5 flex items-center justify-between">
                      <span className="text-[17px] text-white">Email</span>
                      <span className="text-[17px] text-white/40 truncate max-w-[200px]">
                        {isAnonymousUser ? 'Not signed in' : user?.email}
                      </span>
                    </div>
                  </IOSGroup>

                  <IOSGroup title="Data & Security">
                    <IOSRow 
                      icon={Trash2} 
                      label="Delete All Chats" 
                      isDanger={true} 
                      onClick={() => {
                        if (isAnonymousUser) {
                          router.push('/login')
                        } else {
                          handleDeleteAll()
                        }
                      }} 
                    />
                    {!isAnonymousUser && (
                      <IOSRow icon={AlertTriangle} label="Delete Account" isDanger={true} onClick={() => setShowDeleteAccountConfirm(true)} />
                    )}
                  </IOSGroup>

                  <IOSGroup>
                    <IOSRow 
                      icon={isAnonymousUser ? User : LogOut} 
                      label={isAnonymousUser ? "Sign In" : "Log Out"} 
                      color={isAnonymousUser ? "bg-blue-500" : "bg-red-500"} 
                      showChevron={false} 
                      onClick={async () => {
                        if (isAnonymousUser) {
                          router.push('/login')
                          return
                        }
                        if (isLoggingOut) return
                        
                        setIsLoggingOut(true)
                        try {
                          // Clear subscription cache before signing out
                          clearAllSubscriptionCache()
                          clearClientSubscriptionCache()
                          
                          // Sign out and redirect
                          await supabase.auth.signOut()
                          window.location.href = '/login'
                        } catch (error) {
                          console.error('Error signing out:', error)
                          setIsLoggingOut(false)
                          alert('Failed to sign out. Please try again.')
                        }
                      }}
                    />
                  </IOSGroup>
                </div>
              )}

              {/* --- SUBSCRIPTION VIEW --- */}
              {currentView === 'subscription' && (
                <>
                  <IOSGroup title="Current Plan">
                    <div className="px-4 py-8 text-center flex flex-col items-center">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isSubscribed ? 'bg-orange-500' : 'bg-gray-600'}`}>
                        <CreditCard size={32} className="text-white" />
                      </div>
                      <div className="text-[28px] font-bold text-white mb-1">{isSubscribed ? 'Pro Member' : 'Free Member'}</div>
                      <p className="text-white/40 text-[15px] max-w-[240px] mx-auto leading-snug">
                        {isSubscribed ? 'Enjoying unlimited access to all AI features and settings.' : 'Upgrade your plan to unlock more features and higher usage limits.'}
                      </p>
                    </div>
                    <IOSRow 
                      icon={CreditCard} 
                      label={isSubscribed ? 'Manage Subscription' : 'Upgrade to Pro'} 
                      color="bg-orange-500" 
                      onClick={() => isSubscribed ? handleManageSubscription() : handleUpgradeToPro()}
                      value={isLoadingPortal ? "Loading..." : undefined}
                    />
                  </IOSGroup>
                </>
              )}

            </div>
          </div>
        </div>
      </div>

      <ContactUsDialog isOpen={isContactUsDialogOpen} onClose={() => setIsContactUsDialogOpen(false)} user={user} hasBackgroundImage={true} />

      <BackgroundSettingsModal
        isOpen={isBackgroundModalOpen}
        onClose={() => setIsBackgroundModalOpen(false)}
        user={user}
        currentBackground={currentBackground}
        backgroundType={backgroundType}
        backgroundId={backgroundId}
        onBackgroundChange={() => {
          refreshBackground().then(() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('backgroundImageChanged'));
            }
          });
        }}
      />

      {/* 계정 삭제 확인 오버레이 (iOS 스타일) */}
      {showDeleteAccountConfirm && ReactDOM.createPortal(
        <div className="fixed inset-0 z-100 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowDeleteAccountConfirm(false)} />
          <div className="relative w-full max-w-sm bg-[#1c1c1e] rounded-[14px] overflow-hidden shadow-2xl border border-white/10 animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-500" size={24} />
              </div>
              <h3 className="text-[19px] font-semibold text-white mb-2">Delete Account?</h3>
              <p className="text-[15px] text-white/60 mb-6 leading-snug">
                This will permanently delete all your data. To confirm, please select a reason and type <span className="text-red-400">delete {user.email}</span>.
              </p>
              
              <select 
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm mb-3 focus:outline-none"
              >
                <option value="">Select Reason...</option>
                <option value="privacy">Privacy concerns</option>
                <option value="not_useful">No longer useful</option>
                <option value="other">Other</option>
              </select>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={`delete ${user.email}`}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm mb-6 focus:outline-none"
              />

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteAccountConfirm(false)}
                  className="flex-1 py-3 bg-white/10 rounded-lg font-semibold text-[17px] active:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount || deleteConfirmText !== `delete ${user.email}` || !deleteReason}
                  className="flex-1 py-3 bg-red-500 rounded-lg font-semibold text-[17px] active:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isDeletingAccount ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
