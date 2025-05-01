'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { GoogleSignIn } from '../components/GoogleSignIn'
import Image from 'next/image'
import { DemoChat } from '../components/demo/DemoChat'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Check URL for signup parameter and show modal
  useEffect(() => {
    // Check if URL has signup parameter
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('signup') === 'true') {
      setShowLoginModal(true)
    }

    // Listen for custom event from DemoChat component
    const handleOpenSignupModal = () => {
      setShowLoginModal(true)
    }
    
    window.addEventListener('openSignupModal', handleOpenSignupModal)
    
    // Clean up event listener on unmount
    return () => {
      window.removeEventListener('openSignupModal', handleOpenSignupModal)
    }
  }, [])

  // Function to close modal and clean up URL
  const closeLoginModal = () => {
    setShowLoginModal(false)
    // Remove signup parameter from URL without page reload
    const url = new URL(window.location.href)
    url.searchParams.delete('signup')
    window.history.replaceState({}, '', url)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      if (error.message === 'Anonymous sign-ins are disabled') {
        setError('Enter email + password then\nclick Create account')
      } else {
        setError(error.message)
      }
    } else {
      setError('Please check your email for the confirmation link.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      {/* Hero Section */}
      <div className="relative flex-1 flex flex-col justify-center items-center px-6 py-24 md:py-40 max-w-7xl mx-auto">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 w-3/4 h-3/4 bg-gradient-to-br from-[var(--foreground)] opacity-[0.03] blur-[150px] rounded-full transform -translate-x-1/4 -translate-y-1/4"></div>
          <div className="absolute bottom-0 right-0 w-3/4 h-3/4 bg-gradient-to-tl from-[var(--foreground)] opacity-[0.03] blur-[150px] rounded-full transform translate-x-1/4 translate-y-1/4"></div>
        </div>
        
        <div className="max-w-3xl w-full text-center z-10">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-8 text-[var(--foreground)]">CHATFLIX<span className="text-opacity-50">.APP</span></h1>
          <p className="text-xl md:text-2xl text-[var(--muted)] mb-12 max-w-xl mx-auto font-light leading-relaxed">
            
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button 
            onClick={() => {
              setShowLoginModal(true)
              // Add signup parameter to URL
              const url = new URL(window.location.href)
              url.searchParams.set('signup', 'true')
              window.history.replaceState({}, '', url)
            }}
              className="px-10 py-4 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition-all duration-300 font-medium tracking-wide shadow-lg hover:shadow-xl hover:translate-y-[-2px]"
            >
              Get Started
            </button>
            <a 
              href="#demo" 
              className="px-10 py-4 border border-[var(--subtle-divider)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] hover:border-transparent transition-all duration-300 font-medium tracking-wide hover:shadow-lg hover:translate-y-[-2px]"
            >
              Try Now
            </a>
          </div>
        </div>
      </div>

      {/* Demo Section - Enhanced styling */}
      <div id="demo" className="py-20 md:py-32 border-t border-[var(--subtle-divider)] border-opacity-30 bg-gradient-to-b from-[var(--background)] to-[var(--background-secondary)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-16 max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-[var(--foreground)] tracking-tight">Try Chatflix Agent</h2>
            <p className="text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
               Ask questions, summarize YouTube videos, create images, and more ...
            </p>
          </div>
          <DemoChat />
        </div>
      </div>
      
      {/* Login Modal - Modernized */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--background)] rounded-2xl border border-[var(--subtle-divider)] shadow-2xl max-w-md w-full p-8 animate-fade-in relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-br from-[var(--foreground)] opacity-5 blur-[80px] rounded-full"></div>
            </div>
            
            <div className="mb-8 text-center relative">
              <h2 className="text-2xl font-light tracking-widest text-[var(--foreground)]">CHATFLIX.APP</h2>
              <p className="text-xs text-[var(--muted)] mt-2 tracking-wide">Sign in to continue</p>
            </div>
            
            <form className="space-y-6 relative" onSubmit={handleSignIn}>
              {error && (
                <div className="p-4 bg-[var(--accent)] border border-[var(--subtle-divider)] text-[var(--foreground)] rounded-xl text-sm">
                  {error} 
                </div>
              )}
              
              <div className="space-y-5">
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-5 py-4 border border-[var(--subtle-divider)] rounded-xl focus:ring-2 focus:ring-[var(--foreground)] focus:border-[var(--foreground)] outline-none transition-all duration-300 bg-[var(--background)] text-[var(--foreground)]"
                    placeholder="Email"
                  />
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-4 border border-[var(--subtle-divider)] rounded-xl focus:ring-2 focus:ring-[var(--foreground)] focus:border-[var(--foreground)] outline-none transition-all duration-300 bg-[var(--background)] text-[var(--foreground)]"
                    placeholder="Password"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleSignUp}
                  className="flex-1 py-4 border border-[var(--subtle-divider)] rounded-xl hover:bg-[var(--foreground)] hover:text-[var(--background)] hover:border-transparent transition-all duration-300 text-[var(--foreground)]"
                >
                  Create account
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-[var(--foreground)] text-[var(--background)] rounded-xl hover:opacity-90 transition-all duration-300"
                >
                  Sign in
                </button>
              </div>
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--subtle-divider)]"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[var(--background)] px-4 text-xs uppercase text-[var(--muted)]">Or continue with Google</span>
                </div>
              </div>
              
              <div className="flex justify-center">
              <GoogleSignIn />
            </div>
              
              <div className="text-center mt-6">
              <button 
                type="button"
                onClick={() => closeLoginModal()}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors uppercase tracking-wider py-2 px-4"
              >
                  ← Back to Home
              </button>
            </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Footer - Minimal */}
      <footer className="py-12 border-t border-[var(--subtle-divider)] border-opacity-30">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-[var(--muted)] text-sm">© {new Date().getFullYear()} Chatflix.app. All rights reserved.</p>
          <p className="text-[var(--muted)] text-sm mt-2">
            <a href="mailto:sply@chatflix.app" className="hover:text-[var(--foreground)] transition-colors">
              sply@chatflix.app
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
} 