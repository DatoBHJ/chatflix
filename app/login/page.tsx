'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { GoogleSignIn } from '../components/GoogleSignIn'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

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
        setError('Enter email + password then\nclick Create account')
      } else {
        setError(error.message)
      }
    } else {
      setError('Please check your email for the confirmation link.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-sm mx-auto px-8 -mt-32">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-light uppercase tracking-wider">chatflix.app</h1>
        </div>
        <div className="relative">
          <form className="space-y-6">
            {error && (
              <div className="text-xs text-[var(--muted)] text-center uppercase tracking-wider whitespace-pre-line">
                {error} 
              </div>
            )}
            <div className="flex space-x-4">
              <div className="flex-1 space-y-4">
                <div className="flex items-center">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-[46px] px-4 bg-transparent border border-[var(--accent)] focus:border-[var(--foreground)] transition-colors outline-none text-sm tracking-wider"
                    placeholder="Email"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-[46px] px-4 bg-transparent border border-[var(--accent)] focus:border-[var(--foreground)] transition-colors outline-none text-sm tracking-wider"
                    placeholder="Password"
                  />
                </div>
                <div>
                  <button
                    onClick={handleSignUp}
                    className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider border border-[var(--accent)] text-[var(--muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Create account
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <button
                  onClick={handleSignIn}
                  className="w-[120px] h-[142px] flex items-center justify-center text-sm uppercase tracking-wider bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--muted)] transition-colors"
                >
                  Sign in
                </button>
              </div>
            </div>
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--accent)]"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[var(--background)] px-4 text-xs uppercase text-[var(--muted)]">Or continue with</span>
              </div>
            </div>
            <div className="flex justify-center">
              <GoogleSignIn />
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 