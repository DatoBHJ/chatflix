'use client'

import { useRouter } from 'next/navigation'
import { Header } from '../components/Header'

export default function About() {
  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <Header 
        showBackButton={true}
        isSidebarOpen={false}
        onSidebarToggle={() => {}}
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
              
              <div className="text-xs text-[var(--muted)] tracking-wider">
                © 2025 CHATFLIX.APP
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 