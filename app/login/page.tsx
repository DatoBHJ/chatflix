'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

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
      setError(error.message)
    } else {
      setError('Please check your email for the confirmation link.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <div className="w-full max-w-sm mx-auto px-8 -mt-32">
        <div className="mb-16 text-center">
          <h1 className="text-2xl font-light uppercase tracking-wider mb-2">chatflix.app</h1>
          <p className="text-xs text-[var(--muted)] uppercase tracking-wider">Sign in or create an account</p>
        </div>
        <form className="space-y-6">
          {error && (
            <div className="text-xs text-[var(--muted)] text-center uppercase tracking-wider">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
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
            <div>
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
          </div>

          <div className="space-y-3">
            <button
              onClick={handleSignIn}
              className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--muted)] transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={handleSignUp}
              className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider border border-[var(--accent)] hover:border-[var(--foreground)] transition-colors"
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 