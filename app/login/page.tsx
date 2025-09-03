'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { GoogleSignIn, TwitterSignIn } from '../components/auth'
import { Mail, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [isSignIn, setIsSignIn] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setError(null)
    setShowPasswordForm(true)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
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
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      if (error.message === 'Anonymous sign-ins are disabled') {
        setError('Please enter your email and password, then click Sign Up to create your account.')
      } else {
        setError(error.message)
      }
    } else {
      setError('Please check your email for the confirmation link.')
    }
  }

  const goBackToEmail = () => {
    setShowPasswordForm(false)
    setPassword('')
    setError(null)
  }

  const goBackToMain = () => {
    setShowEmailForm(false)
    setShowPasswordForm(false)
    setEmail('')
    setPassword('')
    setError(null)
  }

  if (showPasswordForm) {
  return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        {/* Password Form */}
        <div className="flex-1 flex flex-col justify-center items-center px-6">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <h1 className="font-light text-2xl" style={{ color: 'var(--foreground)' }}>
                {isSignIn ? 'Sign in to your account' : 'Create your account'}
              </h1>
              <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
                {email}
              </p>
            </div>
            
            <form className="space-y-6" onSubmit={isSignIn ? handleSignIn : handleSignUp}>
              {error && (
                <div className="p-4 border rounded-lg text-sm" style={{ 
                  backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', 
                  borderColor: 'color-mix(in srgb, var(--foreground) 15%, transparent)',
                  color: 'var(--muted)'
                }}>
                  {error} 
              </div>
              )}
              
              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--foreground)' }}>Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignIn ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none transition-all cursor-text"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'color-mix(in srgb, var(--foreground) 20%, transparent)',
                    color: 'var(--foreground)'
                  }}
                  placeholder={isSignIn ? "Enter your password" : "Create a password"}
                  autoFocus
                />
            </div>
            
              <div className="space-y-3">
                <button
                  type="submit"
                  className="w-full py-3 rounded-lg transition-all duration-200 font-medium cursor-pointer"
                  style={{
                    backgroundColor: 'var(--foreground)',
                    color: 'var(--background)'
                  }}
                >
                  {isSignIn ? 'Sign in' : 'Sign up'}
                </button>
                <button 
                  type="button"
                  onClick={goBackToEmail}
                  className="w-full py-3 border rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'color-mix(in srgb, var(--foreground) 20%, transparent)',
                    color: 'var(--foreground)'
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to email
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (showEmailForm) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        {/* Email Form */}
        <div className="flex-1 flex flex-col justify-center items-center px-6">
          <div className="w-full max-w-md">
            <div className="mb-12 text-center">
              <h1 className="font-light text-2xl" style={{ color: 'var(--foreground)' }}>
                {isSignIn ? 'Sign in with your email' : 'Sign up with your email'}
              </h1>
            </div>
            
            <form className="space-y-6" onSubmit={handleEmailSubmit}>
              {error && (
                <div className="p-4 border rounded-lg text-sm" style={{ 
                  backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', 
                  borderColor: 'color-mix(in srgb, var(--foreground) 15%, transparent)',
                  color: 'var(--muted)'
                }}>
                  {error} 
                </div>
              )}
              
              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--foreground)' }}>Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none transition-all cursor-text"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'color-mix(in srgb, var(--foreground) 20%, transparent)',
                    color: 'var(--foreground)'
                  }}
                  placeholder="Enter your email"
                  autoFocus
                />
              </div>
              
              <div className="space-y-3">
                <button
                  type="submit"
                  className="w-full py-3 rounded-lg transition-all duration-200 font-medium cursor-pointer"
                  style={{
                    backgroundColor: 'var(--foreground)',
                    color: 'var(--background)'
                  }}
                >
                  Continue
                </button>
                <button 
                  type="button"
                  onClick={goBackToMain}
                  className="w-full py-3 border rounded-lg transition-all duration-200 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'color-mix(in srgb, var(--foreground) 20%, transparent)',
                    color: 'var(--foreground)'
                  }}
                >
                  Go back
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Create Account Screen */}
      <div className="flex-1 flex flex-col justify-center items-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-12 text-center">
            <h1 className="font-light text-3xl mb-8" style={{ color: 'var(--foreground)' }}>
              {isSignIn ? 'Sign in to your account' : 'Create your account'}
            </h1>
          </div>
          
          <div className="space-y-4">
            {/* Social Login Buttons */}
            <button 
              onClick={() => {
                setIsSignIn(isSignIn)
                setShowEmailForm(true)
              }}
              className="w-full py-3 border rounded-lg transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'color-mix(in srgb, var(--foreground) 20%, transparent)',
                color: 'var(--foreground)'
              }}
            >
              <Mail className="w-5 h-5" />
              {isSignIn ? 'Sign in with email' : 'Sign up with email'}
            </button>
            
            <GoogleSignIn isSignIn={isSignIn} />
            
            <TwitterSignIn isSignIn={isSignIn} />
          </div>
          
          <div className="text-center mt-8">
            <button 
              type="button"
              onClick={() => {
                setIsSignIn(!isSignIn)
                setError(null)
                setEmail('')
                setPassword('')
              }}
              className="text-sm transition-colors cursor-pointer"
              style={{ color: 'var(--muted)' }}
            >
              {isSignIn ? (
                <>Don't have an account? <span className="hover:underline" style={{ color: 'var(--tools-color)' }}>Sign up</span></>
              ) : (
                <>Already have an account? <span className="hover:underline" style={{ color: 'var(--tools-color)' }}>Sign in</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 
