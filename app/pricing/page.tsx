'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { checkSubscriptionClient } from '@/lib/subscription-client'
import { clearAllSubscriptionCache } from '@/lib/utils'

export default function PricingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null) // null = unknown, boolean = known
  const [isUserLoading, setIsUserLoading] = useState(true)
  const [showDowngradeModal, setShowDowngradeModal] = useState(false)
  const [pendingDowngrade, setPendingDowngrade] = useState(false)
  const subscriptionCheckRef = useRef<boolean>(false) // Prevent duplicate checks
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch user data - optimized for immediate UI display
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        // If no user, we can immediately show the page
        if (!user) {
          setIsSubscribed(false)
        }
      } catch (error) {
        console.error('Error loading user:', error)
        setUser(null)
        setIsSubscribed(false)
      } finally {
        setIsUserLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsSubscribed(false)
        setIsUserLoading(false)
      } else if (event === 'SIGNED_IN') {
        const newUser = session?.user || null
        setUser(newUser)
        setIsUserLoading(false)
        // Reset subscription status - will be checked by separate effect
        setIsSubscribed(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  // Background subscription check - non-blocking
  useEffect(() => {
    if (!user?.id || subscriptionCheckRef.current) {
      return
    }

    const checkUserSubscription = async () => {
      subscriptionCheckRef.current = true
      try {
        const hasSubscription = await checkSubscriptionClient()
        setIsSubscribed(hasSubscription)
      } catch (error) {
        console.error('Error checking subscription:', error)
        setIsSubscribed(false)
      } finally {
        subscriptionCheckRef.current = false
      }
    }

    // Small delay to ensure UI is rendered first
    const timeoutId = setTimeout(checkUserSubscription, 100)
    return () => clearTimeout(timeoutId)
  }, [user?.id])

  // Optimized portal return handling with debounce
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Clear any pending timeout
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current)
      }

      if (!document.hidden && user?.id && !subscriptionCheckRef.current) {
        console.log('Page became visible, refreshing subscription status...');
        
        // Debounce to prevent rapid-fire calls
        visibilityTimeoutRef.current = setTimeout(async () => {
          if (subscriptionCheckRef.current) return // Another check is in progress
          
          subscriptionCheckRef.current = true
          try {
            // Clear cache and check subscription status
            clearAllSubscriptionCache();
            const hasSubscription = await checkSubscriptionClient();
            setIsSubscribed(hasSubscription);
            console.log('Subscription status refreshed:', hasSubscription);
          } catch (error) {
            console.error('Error refreshing subscription status:', error);
          } finally {
            subscriptionCheckRef.current = false
          }
        }, 1000); // 1 second debounce
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current)
      }
    };
  }, [user?.id]);

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

      // Only redirect if we got a valid checkout URL
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
  }
  
  const handleManageSubscription = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'GET',
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
      const response = await fetch('/api/subscription/portal', {
        method: 'GET',
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
      alert('Failed to access subscription management. Please try again.');
    } finally {
      setPendingDowngrade(false);
      setShowDowngradeModal(false);
    }
  };

  // Show minimal loading only for user authentication
  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Helper function to render subscription-dependent content
  const renderSubscriptionContent = (forSubscribed: boolean, content: React.ReactNode, loadingContent?: React.ReactNode) => {
    if (isSubscribed === null) {
      // Still loading subscription status
      return loadingContent || (
        <div className="flex items-center justify-center py-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
        </div>
      )
    }
    
    return (isSubscribed === forSubscribed) ? content : null
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
              
              {/* Show price only if not subscribed or still loading */}
              {renderSubscriptionContent(false, (
                <>
                  <span className="text-4xl font-extrabold mb-2 tracking-tight">&#36;4</span>
                  <span className="text-xs text-[var(--muted)] mb-6">/ month</span>
                </>
              ), (
                <div className="h-16 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ))}
              
              <ul className="text-center text-sm text-[var(--foreground)] space-y-1 mb-8">
                <li>Access to all models</li>
                <li>Unlimited requests</li>
                <li>Fastest response</li>
                <li>Early access to new features</li>
              </ul>
              
              {/* Subscription-dependent buttons */}
              {renderSubscriptionContent(false, (
                <button
                  onClick={handleSubscribe}
                  disabled={isLoading}
                  className="w-full py-3 bg-green-500 text-white font-bold rounded-xl transition-all hover:bg-green-600 cursor-pointer disabled:opacity-50"
                  style={{ letterSpacing: '0.05em' }}
                >
                  {isLoading ? 'Processing...' : 'Upgrade'}
                </button>
              ))}
              
              {renderSubscriptionContent(true, (
                <span className="inline-block mt-2 px-4 py-2 rounded-full bg-green-500/10 text-green-500 text-sm font-medium">Active</span>
              ))}
            </div>
          </div>
          
          {/* Free 플랜 */}
          <div className="px-8 pb-8 pt-4 opacity-60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-semibold text-[var(--muted)]">Free</span>
              
              {renderSubscriptionContent(false, (
                <span className="bg-[var(--muted)]/10 px-3 py-1 rounded-full text-[var(--muted)] text-xs font-medium">Active</span>
              ))}
            </div>
            <span className="text-2xl font-bold">&#36;0</span>
            <span className="text-xs text-[var(--muted)] ml-2">/ month</span>
            <ul className="text-xs text-[var(--muted)] space-y-1 mt-2 mb-4">
              <li>Limited model access</li>
              <li>Rate limited requests</li>
              <li>Slower response</li>
              <li>Delayed access to new features</li>
            </ul>
            
            {renderSubscriptionContent(true, (
              <>
                <div className="h-px w-full bg-[var(--subtle-divider)] my-4" />
                <button
                  onClick={handleDowngrade}
                  className="w-full py-2 bg-[var(--muted)]/10 text-[var(--muted)] font-medium rounded-xl hover:bg-[var(--muted)]/20 transition-all text-xs"
                >
                  Downgrade to Free
                </button>
              </>
            ))}
            
            {renderSubscriptionContent(false, (
              <button
                onClick={() => router.push('/')}
                className="w-full py-2 bg-[var(--muted)]/10 text-[var(--muted)] font-medium rounded-xl hover:bg-[var(--muted)]/20 transition-all text-xs"
              >
                Continue with Free
              </button>
            ))}
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
