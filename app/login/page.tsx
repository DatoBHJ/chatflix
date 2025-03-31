'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { GoogleSignIn } from '../components/GoogleSignIn'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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
    <div className="login-container">
      {!showLoginModal ? (
        <div className="text-center animate-fade-in">
          <div 
            className="cursor-pointer transition-transform duration-300 hover:scale-105 pb-12"
            onClick={() => setShowLoginModal(true)}
          >
            <Image 
              src="/music.png" 
              alt="Drake Meme - All in One" 
              width={320} 
              height={320}
              priority
            />
            {/* <p className="mt-6 text-[#666666] text-sm tracking-wider">Click to continue</p> */}
          </div>
        </div>
      ) : (
        <div className="login-form-container animate-fade-in">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-light tracking-widest text-[#111111]">CHATFLIX.APP</h1>
            {/* <p className="text-xs text-[#666666] mt-1 tracking-wide">Sign in to continue</p> */}
          </div>
          <div className="relative">
            {/* Notice about email registration being disabled */}
            {/* <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-md">
              <p className="text-sm">
                Due to high registration volume, email/password registration is temporarily disabled. 
                Please use Google Sign at the bottom of the page. If you don't see one, please refresh the page.
              </p>
            </div> */}
            
            {/* Email/password form commented out */}
            <form className="space-y-6" onSubmit={handleSignIn}>
              {error && (
                <div className="login-error">
                  {error} 
                </div>
              )}
              
              <div className="space-y-4">
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="login-input h-[54px]"
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
                    className="login-input h-[54px]"
                    placeholder="Password"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleSignUp}
                  className="login-button-secondary flex-1 h-[54px]"
                >
                  Create account
                </button>
                <button
                  type="submit"
                  className="login-button-primary flex-1 h-[54px]"
                >
                  Sign in
                </button>
              </div>
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#f5f5f5]"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-xs uppercase text-[#666666]">Or continue with Google</span>
                </div>
              </div>
            </form>
            <div className="flex justify-center mt-6">
              <GoogleSignIn />
            </div>
              
            <div className="text-center mt-8">
              <button 
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="text-xs text-[#666666] hover:text-[#111111] transition-colors uppercase tracking-wider py-2 px-4"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 