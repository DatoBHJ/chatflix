'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
// import { useUser } from '@/app/lib/UserContext'
import { createCheckoutSession, checkSubscription } from '@/lib/polar'

export default function PricingPage() {
  const router = useRouter()
  const supabase = createClient()
  // const { user } = useUser()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isUserLoading, setIsUserLoading] = useState(true)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)

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
  

  // Show loading indicator while fetching user info or checking subscription
  if (isUserLoading || isCheckingSubscription) {
    return (
      <div className="min-h-screen pt-28 pb-20 px-6 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[var(--muted)]">Loading pricing information...</p>
        </div>
      </div>
    )
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
          
          {/* Paid Plan or Already Subscribed */}
          {isSubscribed ? (
            <div className="border border-[var(--foreground)] p-8 flex flex-col relative bg-gradient-to-b from-transparent to-[rgba(var(--foreground-rgb),0.03)] backdrop-blur-sm">
              <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs px-3 py-1 uppercase tracking-wider font-medium">
                Active
              </div>
              
              <h2 className="text-xl font-bold mb-2">Unlimited</h2>
              <p className="text-[var(--muted)] mb-6">Your current plan</p>
              
              <div className="flex items-center space-x-2 mb-6">
                <svg className="w-8 h-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span className="font-bold text-xl">You're all set!</span>
              </div>
              
              <div className="bg-[var(--accent)] p-4 mb-8">
                <p className="text-sm">
                  You currently have an active subscription with unlimited access to all features.
                </p>
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
              </ul>
              
              <button 
                onClick={() => router.push('/')}
                className="bg-[var(--foreground)] text-[var(--background)] px-6 py-3 text-sm font-medium uppercase tracking-wider hover:opacity-90 transition-all"
              >
                Return to App
              </button>
            </div>
          ) : (
            <div className="border border-[var(--foreground)] p-8 flex flex-col relative bg-gradient-to-b from-transparent to-[rgba(var(--foreground-rgb),0.03)] backdrop-blur-sm">
              <div className="absolute top-0 right-0 bg-[var(--foreground)] text-[var(--background)] text-xs px-3 py-1 uppercase tracking-wider font-medium">
                Recommended
              </div>
              
              <h2 className="text-xl font-bold mb-2">Unlimited</h2>
              <p className="text-[var(--muted)] mb-6">Full access without limits</p>
              
              {/* Drake Meme */}
              <div className="mb-6 rounded-md overflow-hidden border border-[var(--subtle-divider)] shadow-sm">
                <Image 
                  src="/previous/drake-meme.png" 
                  alt="Drake meme showing expensive individual AI services vs our all-in-one solution"
                  width={600}
                  height={600}
                  className="w-full h-auto object-contain scale-150 transform-gpu"
                  style={{ aspectRatio: '1/1', objectPosition: 'center' }}
                  priority
                />
              </div>
              
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
          )}
        </div>
      </div>
    </div>
  )
}
 


// 'use client'

// import React from 'react'

// export default function PricingPage() {
//   return (
//     <div className="min-h-screen flex items-center justify-center px-4">
//       <div className="text-center max-w-md p-8 border border-[var(--subtle-divider)] rounded-md backdrop-blur-sm">
//         <h1 className="text-2xl font-bold mb-4">We're updating our pricing</h1>
//         <p className="text-[var(--muted)] mb-6">
//           Our pricing page is currently being updated. Please check back later for our new plans and offers.
//         </p>
//         <div className="w-16 h-1 bg-gradient-to-r from-purple-500 to-blue-500 mx-auto"></div>
//       </div>
//     </div>
//   )
// }
 