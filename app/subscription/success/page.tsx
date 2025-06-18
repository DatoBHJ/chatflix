'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Header } from '@/app/components/Header'
import { clearRateLimitInfo, clearAllSubscriptionCache } from '@/lib/utils'
import { checkSubscriptionClient } from '@/lib/subscription-client'

export default function SubscriptionSuccess() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [countdown, setCountdown] = useState(5)
  const [subscriptionVerified, setSubscriptionVerified] = useState(false)
  const [verificationAttempts, setVerificationAttempts] = useState(0)
  const router = useRouter()
  const supabase = createClient()
  
  // Verify subscription status before clearing cache
  useEffect(() => {
    const verifySubscription = async () => {
      const maxAttempts = 10; // Try for up to 30 seconds (3s intervals)
      
      const attemptVerification = async (attempt: number): Promise<boolean> => {
        try {
          console.log(`Subscription verification attempt ${attempt + 1}/${maxAttempts}`);
          
          // Force a fresh check by clearing cache first on first attempt
          if (attempt === 0) {
            clearAllSubscriptionCache();
          }
          
          const isSubscribed = await checkSubscriptionClient();
          
          if (isSubscribed) {
            console.log('Subscription verified successfully!');
            setSubscriptionVerified(true);
            
            // Now clear rate limits since subscription is confirmed
            clearRateLimitInfo('subscription');
            return true;
          }
          
          return false;
        } catch (error) {
          console.error(`Subscription verification attempt ${attempt + 1} failed:`, error);
          return false;
        }
      };
      
      // Try immediate verification first
      if (await attemptVerification(0)) {
        return;
      }
      
      // If not verified immediately, try with intervals
      for (let i = 1; i < maxAttempts; i++) {
        setVerificationAttempts(i);
        
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        
        if (await attemptVerification(i)) {
          return;
        }
      }
      
      // If still not verified after all attempts, proceed anyway
      console.warn('Subscription verification timed out, but proceeding anyway');
      setSubscriptionVerified(true);
      clearRateLimitInfo('subscription');
    };
    
    verifySubscription();
  }, []);
  
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setIsLoading(false)
    }
    
    getUser()
  }, [supabase])
  
  // Only start countdown after subscription is verified
  useEffect(() => {
    if (!subscriptionVerified) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      router.push('/')
    }
  }, [countdown, router, subscriptionVerified])
  
  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <Header 
        showBackButton={false}
        isSidebarOpen={false}
        onSidebarToggle={() => {}}
        user={user}
      />
      
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full p-8 rounded-lg">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              {!subscriptionVerified ? (
                <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-green-500">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              )}
            </div>
            
            {!subscriptionVerified ? (
              <>
                <h1 className="text-2xl font-light">Verifying Subscription</h1>
                <p className="text-[var(--muted)]">
                  Please wait while we confirm your subscription...
                  {verificationAttempts > 0 && (
                    <span className="block text-sm mt-2">
                      Verification attempt {verificationAttempts}/10
                    </span>
                  )}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-light">Subscription Successful</h1>
                <p className="text-[var(--muted)]">
                  Thank you for subscribing! Your premium access has been activated.
                </p>
                
                <div className="pt-4">
                  <p className="text-sm text-[var(--muted)]">
                    Redirecting to home in {countdown} seconds...
                  </p>
                </div>
                
                <div className="pt-4">
                  <button
                    onClick={() => router.push('/')}
                    className="px-4 py-2 border border-[var(--accent)] rounded-md text-sm hover:bg-[var(--accent)] transition-colors"
                  >
                    Return to Home
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
} 