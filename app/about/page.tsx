'use client'

import { useRouter } from 'next/navigation'
import { Header } from '../components/Header'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function About() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setIsLoading(false)
    }
    
    getUser()
  }, [supabase])
  
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Chatflix.app</div>
  }
  
  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <Header 
        showBackButton={true}
        isSidebarOpen={false}
        onSidebarToggle={() => {}}
        user={user}
      />
      
      <div className="flex-1 overflow-y-auto pt-24 sm:pt-40">
        <div className="max-w-2xl mx-auto px-6">
          <div className="space-y-20">
            {/* Introduction */}
            <div className="space-y-6">
              <h1 className="text-2xl sm:text-3xl font-light uppercase tracking-wider">
                chatflix.app
              </h1>
              <div className="space-y-2">
                <p className="text-base font-light">
                  Minimalist AI chat interface.
                </p>
                <p className="text-base text-[var(--muted)] font-light leading-relaxed">
                  Focused on simplicity and efficiency in every interaction.
                </p>
              </div>
            </div>

            {/* Core Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="h-[1px] w-8 bg-[var(--muted)]" />
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
                    Intelligence
                  </div>
                  <div className="text-sm leading-relaxed">
                    Multiple AI models integrated for versatile conversation capabilities.
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="h-[1px] w-8 bg-[var(--muted)]" />
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
                    Customization
                  </div>
                  <div className="text-sm leading-relaxed">
                    Personalized shortcuts and system prompts for efficient workflows.
                  </div>
                </div>
              </div>
            </div>

            {/* Links & Version */}
            <div className="pt-12 pb-10 space-y-4">
              <div className="flex flex-col gap-3">
                <a 
                  href="https://github.com/DatoBHJ/chatflix" 
                  target="_blank"
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                  </svg>
                  <span className="tracking-wider">SOURCE CODE</span>
                </a>
                
                {/* <a 
                  href="https://x.com/DatoBHJ" 
                  target="_blank"
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
                  </svg>
                  <span className="tracking-wider">@DATOBHJ</span>
                </a>
                 */}
                <a 
                  href="mailto:datobhj@gmail.com" 
                  className="flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <span className="tracking-wider">DATOBHJ@GMAIL.COM</span>
                </a>
              </div>
              
              <div className="text-xs text-[var(--muted)] tracking-wider pt-1">
                © 2025 CHATFLIX.APP
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}