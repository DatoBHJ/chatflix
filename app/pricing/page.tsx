'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { createCheckoutSession, checkSubscription, getCustomerPortalUrl } from '@/lib/polar'

export default function PricingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isUserLoading, setIsUserLoading] = useState(true)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)
  const [showDowngradeModal, setShowDowngradeModal] = useState(false)
  const [pendingDowngrade, setPendingDowngrade] = useState(false)

  // Fetch user data
  useEffect(() => {
    const getUser = async () => {
      setIsUserLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        // Only check subscription if we have a user
        if (user && user.id) {
          try {
            const hasSubscription = await checkSubscription(user.id)
            setIsSubscribed(hasSubscription)
          } catch (error) {
            console.error('Error checking subscription:', error)
          } finally {
            setIsCheckingSubscription(false)
          }
        } else {
          setIsCheckingSubscription(false)
        }
      } catch (error) {
        console.error('Error loading user:', error)
        setUser(null)
        setIsCheckingSubscription(false)
      } finally {
        setIsUserLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsUserLoading(true)
      setIsCheckingSubscription(true)
      
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsSubscribed(false)
        setIsUserLoading(false)
        setIsCheckingSubscription(false)
      } else if (event === 'SIGNED_IN') {
        const newUser = session?.user || null
        setUser(newUser)
        
        // Check subscription status when user signs in
        if (newUser && newUser.id) {
          checkSubscription(newUser.id)
            .then(hasSubscription => {
              setIsSubscribed(hasSubscription)
            })
            .catch(error => {
              console.error('Error checking subscription:', error)
            })
            .finally(() => {
              setIsUserLoading(false)
              setIsCheckingSubscription(false)
            })
        } else {
          setIsUserLoading(false)
          setIsCheckingSubscription(false)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleSubscribe = async () => {
    // Check if user is logged in
    if (!user) {
      router.push('/login')
      return
    }
    
    // Verify user has the required data
    if (!user.id || !user.email) {
      alert('Your account information is incomplete. Please log out and sign in again.')
      return
    }
        
    setIsLoading(true)
    try {
      const checkout = await createCheckoutSession(
        user.id,
        user.email,
        user.user_metadata?.full_name || user.email.split('@')[0]
      )
            
      // Only redirect if we got a valid checkout URL
      if (checkout && checkout.url) {
        window.location.href = checkout.url
      } else {
        throw new Error('Invalid checkout response')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to create checkout session. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleManageSubscription = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const portalUrl = await getCustomerPortalUrl(user.id);
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Error getting customer portal URL:', error);
      alert('Failed to access subscription management. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDowngrade = () => {
    setShowDowngradeModal(true);
  };

  const confirmDowngrade = async () => {
    if (!user) return;
    setPendingDowngrade(true);
    try {
      const portalUrl = await getCustomerPortalUrl(user.id);
      window.location.href = portalUrl;
    } catch (error) {
      alert('Failed to access subscription management. Please try again.');
    } finally {
      setPendingDowngrade(false);
      setShowDowngradeModal(false);
    }
  };

  // Loading
  if (isUserLoading || isCheckingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-2 pt-10 sm:pt-20">
      <div className="w-full max-w-md mx-auto animate-fade-in">
        {/* 카드 */}
        <div className="bg-[var(--background)] border border-[var(--subtle-divider)] rounded-2xl p-0 shadow-none">
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
              <span className="text-lg font-bold text-green-500 mb-2">Pro</span>
              {!isSubscribed && (
                <>
                  <span className="text-4xl font-extrabold mb-2 tracking-tight">&#36;4</span>
                  <span className="text-xs text-[var(--muted)] mb-6">/ month</span>
                </>
              )}
              <ul className="text-center text-sm text-[var(--foreground)] space-y-1 mb-8">
                <li>Access to all models</li>
                <li>Unlimited requests</li>
                <li>Fastest response</li>
                <li>Early access to new features</li>
              </ul>
              {!isSubscribed && (
                <>
                  <button
                    onClick={handleSubscribe}
                    className="w-full py-3 bg-green-500 text-white font-bold rounded-xl transition-all hover:bg-green-600 cursor-pointer"
                    style={{ letterSpacing: '0.05em' }}
                  >
                    Upgrade
                  </button>
                </>
              )}
              {isSubscribed && (
                <span className="inline-block mt-2 px-4 py-2 rounded-full bg-green-500/10 text-green-500 text-sm font-medium">Active</span>
              )}
            </div>
          </div>
          
          {/* Free 플랜 */}
          <div className="px-8 pb-8 pt-4 opacity-60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-semibold text-[var(--muted)]">Free</span>
              {!isSubscribed && (
                <span className="bg-[var(--muted)]/10 px-3 py-1 rounded-full text-[var(--muted)] text-xs font-medium">Active</span>
              )}
            </div>
            <span className="text-2xl font-bold">&#36;0</span>
            <span className="text-xs text-[var(--muted)] ml-2">/ month</span>
            <ul className="text-xs text-[var(--muted)] space-y-1 mt-2 mb-4">
              <li>Limited model access</li>
              <li>Rate limited requests</li>
              <li>Slower response</li>
              <li>Delayed access to new features</li>
            </ul>
            {isSubscribed && (
              <>
                <div className="h-px w-full bg-[var(--subtle-divider)] my-4" />
                <button
                  onClick={handleDowngrade}
                  className="w-full py-2 bg-[var(--muted)]/10 text-[var(--muted)] font-medium rounded-xl hover:bg-[var(--muted)]/20 transition-all text-xs"
                >
                  Downgrade to Free
                </button>
              </>
            )}
            {!isSubscribed && (
              <button
                onClick={() => router.push('/')}
                className="w-full py-2 bg-[var(--muted)]/10 text-[var(--muted)] font-medium rounded-xl hover:bg-[var(--muted)]/20 transition-all text-xs"
              >
                Continue with Free
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Downgrade Modal */}
      {showDowngradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-[var(--background)] rounded-xl shadow-xl p-6 max-w-sm w-full border border-[var(--subtle-divider)]">
            <h2 className="text-lg font-semibold mb-3">Confirm Downgrade</h2>
            <p className="text-sm text-[var(--muted)] mb-5">
              If you downgrade, you will lose unlimited access and <span className="font-semibold text-red-500">will not be able to re-subscribe at the current price</span>.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-lg bg-[var(--muted)]/10 text-[var(--muted)] text-sm font-medium hover:bg-[var(--muted)]/20 transition-all"
                onClick={() => setShowDowngradeModal(false)}
                disabled={pendingDowngrade}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all"
                onClick={confirmDowngrade}
                disabled={pendingDowngrade}
              >
                {pendingDowngrade ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
