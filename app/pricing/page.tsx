'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { checkSubscriptionClient } from '@/lib/subscription-client'
import { clearAllSubscriptionCache } from '@/lib/utils'
import { getChatInputTranslations } from '@/app/lib/chatInputTranslations'

export default function PricingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null)
  const [isPageReady, setIsPageReady] = useState(false)
  const [showDowngradeModal, setShowDowngradeModal] = useState(false)
  const [pendingDowngrade, setPendingDowngrade] = useState(false)
  
  // Refs for optimization
  const subscriptionCheckRef = useRef<boolean>(false)
  const lastCheckTimeRef = useRef<number>(0)
  const lastCheckedUserIdRef = useRef<string | null>(null)
  const CACHE_DURATION = 5 * 60 * 1000 // 5분 캐시
  const [translations, setTranslations] = useState({
    upgrade: 'Upgrade',
    continueWithFree: 'Continue with Free',
    downgradeToFree: 'Downgrade to Free',
    confirmDowngrade: 'Confirm Downgrade',
    confirmDowngradeMessage: 'If you downgrade, you will lose unlimited access and will not be able to re-subscribe at the current price.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    processing: 'Processing...'
  })

  // Initialize translations
  useEffect(() => {
    const chatTranslations = getChatInputTranslations();
    setTranslations({
      upgrade: chatTranslations.upgrade,
      continueWithFree: 'Continue with Free',
      downgradeToFree: 'Downgrade to Free',
      confirmDowngrade: 'Confirm Downgrade',
      confirmDowngradeMessage: 'If you downgrade, you will lose unlimited access and will not be able to re-subscribe at the current price.',
      cancel: 'Cancel',
      confirm: 'Confirm',
      processing: chatTranslations.processing || 'Processing...'
    });
  }, []);

  // Optimized user and subscription check
  const checkSubscriptionStatus = useCallback(async (userId: string, forceCheck = false) => {
    if (subscriptionCheckRef.current && !forceCheck) return
    
    // Check cache
    const now = Date.now()
    const isCacheValid = now - lastCheckTimeRef.current < CACHE_DURATION
    const isSameUser = lastCheckedUserIdRef.current === userId
    
    if (!forceCheck && isCacheValid && isSameUser && isSubscribed !== null) {
      return
    }
    
    subscriptionCheckRef.current = true
    try {
      const hasSubscription = await checkSubscriptionClient()
      setIsSubscribed(hasSubscription)
      lastCheckTimeRef.current = now
      lastCheckedUserIdRef.current = userId
    } catch (error) {
      console.error('Error checking subscription:', error)
      setIsSubscribed(false)
    } finally {
      subscriptionCheckRef.current = false
    }
  }, [isSubscribed])

  // Single effect for user and subscription
  useEffect(() => {
    const initializeData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        if (user?.id) {
          await checkSubscriptionStatus(user.id)
        } else {
          setIsSubscribed(false)
        }
      } catch (error) {
        console.error('Error loading data:', error)
        setUser(null)
        setIsSubscribed(false)
      } finally {
        setIsPageReady(true)
      }
    }

    initializeData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsSubscribed(false)
        setIsPageReady(true)
      } else if (event === 'SIGNED_IN') {
        const newUser = session?.user || null
        setUser(newUser)
        if (newUser?.id) {
          await checkSubscriptionStatus(newUser.id, true) // Force check for new user
        }
        setIsPageReady(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, checkSubscriptionStatus])

  // Optimized visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id) {
        // Only refresh if cache is expired
        const now = Date.now()
        const cacheExpired = now - lastCheckTimeRef.current > CACHE_DURATION
        
        if (cacheExpired) {
          console.log('Page became visible, refreshing subscription status...')
          clearAllSubscriptionCache()
          checkSubscriptionStatus(user.id, true)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user?.id, checkSubscriptionStatus])

  const handleSubscribe = useCallback(async () => {
    if (!user) {
      router.push('/login')
      return
    }
    
    if (!user.id || !user.email) {
      alert('Your account information is incomplete. Please log out and sign in again.')
      return
    }
        
    setIsLoading(true)
    try {
      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: user.user_metadata?.full_name || user.email.split('@')[0]
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }
            
      if (data.checkout && data.checkout.url) {
        window.location.href = data.checkout.url
      } else {
        throw new Error('Invalid checkout response')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to create checkout session. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [user, router])
  
  const handleDowngrade = useCallback(() => {
    setShowDowngradeModal(true)
  }, [])

  const confirmDowngrade = useCallback(async () => {
    if (!user) return
    setPendingDowngrade(true)
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get customer portal URL')
      }

      if (data.portalUrl) {
        window.location.href = data.portalUrl
      } else {
        throw new Error('Invalid portal URL response')
      }
    } catch (error) {
      alert('Failed to access subscription management. Please try again.')
    } finally {
      setPendingDowngrade(false)
      setShowDowngradeModal(false)
    }
  }, [user])

  const handleContinueWithFree = useCallback(() => {
    router.push('/')
  }, [router])

  const handleCloseModal = useCallback(() => {
    setShowDowngradeModal(false)
  }, [])

  // Memoized subscription content renderer - no loading states
  const renderSubscriptionContent = useMemo(() => 
    (forSubscribed: boolean, content: React.ReactNode) => {
      return (isSubscribed === forSubscribed) ? content : null
    }, [isSubscribed]
  )

  // Don't render anything until page is ready
  if (!isPageReady) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-2 py-4">
      <div className="w-full max-w-md mx-auto animate-fade-in">
        {/* 카드 */}
        <div className="bg-white/90 dark:bg-black/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl p-0 shadow-2xl shadow-black/10 dark:shadow-black/60"
             style={{
               WebkitBackdropFilter: 'blur(24px)',
               backdropFilter: 'blur(24px)'
             }}>
          {/* Pro 플랜 */}
          <div className="p-0">
            {/* 드레이크 밈 */}
            <div className="flex flex-col items-center justify-center py-8">
              <div className="relative w-full aspect-square max-w-[340px] rounded-xl overflow-hidden bg-white">
                <Image
                  src="/previous/drake-meme.png"
                  alt="Drake meme"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            {/* 플랜 정보 */}
            <div className="px-8 pb-8 flex flex-col items-center">
              <span className="text-lg font-bold text-blue-500 mb-2">Pro</span>
              
              {/* Show price only if not subscribed */}
              {renderSubscriptionContent(false, (
                <>
                  <span className="text-4xl font-extrabold mb-2 tracking-tight">&#36;4</span>
                  <span className="text-xs text-[var(--muted)] mb-6">/ month</span>
                </>
              ))}
              
              <ul className="text-center text-sm text-[var(--foreground)] space-y-1 mb-8">
                <li>Access to all models</li>
                <li>Unlimited requests</li>
              </ul>
              
              {/* Subscription-dependent buttons */}
              {renderSubscriptionContent(false, (
                  <button
                    onClick={handleSubscribe}
                  disabled={isLoading}
                  className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl transition-all hover:bg-blue-600 cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    style={{ letterSpacing: '0.05em' }}
                  >
                  {isLoading ? translations.processing : translations.upgrade}
                  </button>
              ))}
              
              {renderSubscriptionContent(true, (
                <span className="inline-block mt-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-500 text-sm font-medium border border-blue-500/20">Active</span>
              ))}
            </div>
          </div>
          
          {/* Free 플랜 */}
          <div className="px-8 pb-8 pt-4 opacity-75">
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-semibold text-[var(--muted)]">Free</span>
              
              {renderSubscriptionContent(false, (
                <span className="bg-[var(--muted)]/15 px-3 py-1 rounded-full text-[var(--muted)] text-xs font-medium border border-[var(--muted)]/20">Active</span>
              ))}
            </div>
            <span className="text-2xl font-bold">&#36;0</span>
            <span className="text-xs text-[var(--muted)] ml-2">/ month</span>
            <ul className="text-xs text-[var(--muted)] space-y-1 mt-2 mb-4">
              <li>Limited model access</li>
              <li>Rate limited requests</li>
            </ul>
            
            {renderSubscriptionContent(true, (
              <>
                <div className="h-px w-full bg-[var(--subtle-divider)] my-4 opacity-50" />
                <button
                  onClick={handleDowngrade}
                  className="w-full py-2 bg-[var(--muted)]/10 text-[var(--muted)] font-medium rounded-xl hover:bg-[var(--muted)]/20 transition-all text-xs hover:scale-[1.01] active:scale-[0.99]"
                >
                  {translations.downgradeToFree}
                </button>
              </>
            ))}
            
            {renderSubscriptionContent(false, (
              <button
                onClick={handleContinueWithFree}
                className="w-full py-2 bg-[var(--muted)]/10 text-[var(--muted)] font-medium rounded-xl hover:bg-[var(--muted)]/20 transition-all text-xs hover:scale-[1.01] active:scale-[0.99]"
              >
                {translations.continueWithFree}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Downgrade Modal */}
      {showDowngradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="bg-white/95 dark:bg-black/85 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/60 p-6 max-w-sm w-full border border-black/5 dark:border-white/10"
               style={{
                 WebkitBackdropFilter: 'blur(24px)',
                 backdropFilter: 'blur(24px)'
               }}>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">{translations.confirmDowngrade}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              {translations.confirmDowngradeMessage.split('will not be able to re-subscribe at the current price')[0]}
              <span className="font-semibold text-red-500">will not be able to re-subscribe at the current price</span>
              {translations.confirmDowngradeMessage.split('will not be able to re-subscribe at the current price')[1] || '.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl bg-gray-500/10 dark:bg-gray-400/10 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-500/20 dark:hover:bg-gray-400/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={handleCloseModal}
                disabled={pendingDowngrade}
              >
                {translations.cancel}
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]"
                onClick={confirmDowngrade}
                disabled={pendingDowngrade}
              >
                {pendingDowngrade ? translations.processing : translations.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
