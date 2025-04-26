'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/app/lib/UserContext'
import { createCheckoutSession } from '@/lib/polar'

export default function PricingPage() {
  const router = useRouter()
  const { user } = useUser()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = async () => {
    if (!user || !user.email || !user.id) {
      router.push('/login')
      return
    }
    
    setIsLoading(true)
    try {
      const checkout = await createCheckoutSession(
        user.id,
        user.email,
        user.user_metadata?.full_name || user.email.split('@')[0]
      )
      
      window.location.href = checkout.url
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to create checkout session. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-28 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-10 text-center">Pricing</h1>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Free Plan */}
          <div className="border border-[var(--subtle-divider)] p-8 flex flex-col backdrop-blur-sm">
            <h2 className="text-xl font-bold mb-2">Free</h2>
            <p className="text-[var(--muted)] mb-6">Basic access with limitations</p>
            
            <div className="mb-8">
              <div className="text-3xl font-bold mb-1">$0</div>
              {/* <div className="text-sm text-[var(--muted)]">Forever free</div> */}
            </div>
            
            <ul className="space-y-3 mb-8 flex-grow">
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 text-green-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Access to all models</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 text-green-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Chatflix Brain Mode</span>
              </li>
              <li className="flex items-start text-[var(--muted)]">
                <svg className="w-5 h-5 mr-2 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>Rate limited requests</span>
              </li>
              <li className="flex items-start text-[var(--muted)]">
                <svg className="w-5 h-5 mr-2 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>Slow response times</span>
              </li>
              <li className="flex items-start text-[var(--muted)]">
                <svg className="w-5 h-5 mr-2 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>Late access to new features</span>
              </li>
            </ul>
            
            <button 
              className="border border-[var(--foreground)] px-6 py-3 text-sm font-medium uppercase tracking-wider hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all"
              onClick={() => router.push('/')}
            >
              Continue Free
            </button>
          </div>
          
          {/* Paid Plan */}
          <div className="border border-[var(--foreground)] p-8 flex flex-col relative bg-gradient-to-b from-transparent to-[rgba(var(--foreground-rgb),0.03)] backdrop-blur-sm">
            <div className="absolute top-0 right-0 bg-[var(--foreground)] text-[var(--background)] text-xs px-3 py-1 uppercase tracking-wider font-medium">
              Recommended
            </div>
            
            <h2 className="text-xl font-bold mb-2">Unlimited</h2>
            <p className="text-[var(--muted)] mb-6">Full access without limits</p>
            
            <div className="mb-2">
              <div className="text-3xl font-bold mb-1">$4</div>
              <div className="text-sm text-[var(--muted)]">per month</div>
            </div>
            
            {/* Point #1: Price lock guarantee - emphasized with futuristic design */}
            <div className="border-[1px] border-[var(--foreground)] mb-3 p-2 text-center relative overflow-hidden backdrop-blur-sm rounded-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(var(--foreground-rgb),0.05)] to-transparent animate-pulse-slow"></div>
              <span className="font-bold uppercase tracking-wider relative z-10">Lock In This Price Forever</span>
            </div>
            
            {/* Point #2: Special discount period with futuristic design */}
            <div className="text-xs text-red-500 font-bold text-center mb-8 px-2 py-1 relative">
              <div className="absolute left-0 right-0 h-[1px] bottom-0 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-70"></div>
              This is a limited-time offer. Price will increase soon.
            </div>
            
            <ul className="space-y-3 mb-8 flex-grow">
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 text-green-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Access to all models</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 text-green-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Chatflix Brain Mode</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 text-green-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Unlimited requests</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 mr-2 text-green-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Fast response times</span>
              </li>
              <li className="flex items-start"> 
                <svg className="w-5 h-5 mr-2 text-green-500 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Early access to new features</span>
              </li>
            </ul>
            
            <button 
              onClick={handleSubscribe}
              disabled={isLoading}
              className="bg-[var(--foreground)] text-[var(--background)] px-6 py-3 text-sm font-medium uppercase tracking-wider hover:opacity-90 transition-all relative overflow-hidden group"
            >
              <span className="relative z-10">{isLoading ? 'Processing...' : 'Subscribe Now'}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(var(--background-rgb),0.15)] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
