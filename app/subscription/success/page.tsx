'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Header } from '@/app/components/Header'
import { clearRateLimitInfo } from '@/lib/utils'

export default function SubscriptionSuccess() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [countdown, setCountdown] = useState(5)
  const router = useRouter()
  const supabase = createClient()
  
  // Clear rate limit information on subscription success page load
  useEffect(() => {
    clearRateLimitInfo();
  }, []);
  
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setIsLoading(false)
    }
    
    getUser()
  }, [supabase])
  
  // Countdown to redirect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      router.push('/')
    }
  }, [countdown, router])
  
  // if (isLoading) {
  //   return <div className="flex h-screen items-center justify-center">Chatflix.app</div>
  // }
  
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
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-green-500">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            
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
          </div>
        </div>
      </div>
    </main>
  )
} 