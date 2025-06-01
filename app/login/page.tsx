'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { GoogleSignIn } from '../components/GoogleSignIn'
import Image from 'next/image'
import { DemoChat } from '../components/demo/DemoChat'
import { MODEL_CONFIGS } from '@/lib/models/config'
import { getProviderLogo } from '@/app/lib/models/logoUtils'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  
  // Logo error handling for AI model providers
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({})
  
  // Group models by provider for display, but separate CHATFLIX models
  const chatflixModels = MODEL_CONFIGS.filter(model =>
    model.id === 'chatflix-ultimate' || model.id === 'chatflix-ultimate-pro'
  );
  
  // Group remaining models by provider
  const groupedModels = MODEL_CONFIGS.reduce((acc, model) => {
    // Skip CHATFLIX models as they will be displayed separately
    if (model.id === 'chatflix-ultimate' || model.id === 'chatflix-ultimate-pro') return acc;
    
    if (model.isEnabled && model.isActivated) {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
    }
    return acc;
  }, {} as Record<string, typeof MODEL_CONFIGS>);
  
  // Functions to handle provider logo display
  const getProviderLogoPath = (provider: string, modelId?: string): string => {
    // xAI uses grok.svg
    if (provider === 'xai') {
      return '/logo/grok.svg';
    }
    return `/logo/${provider}.svg`;
  };

  // Get the provider display names
  const getProviderName = (provider: string) => {
    switch(provider) {
      case 'anthropic': return 'Anthropic';
      case 'openai': return 'OpenAI';
      case 'google': return 'Google';
      case 'deepseek': return 'DeepSeek';
      case 'together': return 'Together AI';
      case 'groq': return 'Groq';
      case 'xai': return 'xAI';
      default: return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  }
  
  const handleLogoError = (provider: string) => {
    setLogoErrors(prev => ({
      ...prev,
      [provider]: true
    }));
  };

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
          <h1 className="font-light text-6xl md:text-8xl tracking-[-0.05em] mb-10 text-[var(--foreground)] uppercase">CHATFLIX</h1>
          <div className="flex flex-col sm:flex-row gap-8 justify-center">
            <button 
            onClick={() => {
              setShowLoginModal(true)
              // Add signup parameter to URL
              const url = new URL(window.location.href)
              url.searchParams.set('signup', 'true')
              window.history.replaceState({}, '', url)
            }}
              className="px-12 py-4 bg-[var(--foreground)] text-[var(--background)] rounded-none hover:opacity-90 transition-all duration-300 font-light text-sm tracking-widest uppercase"
            >
              Get Started
            </button>
            {/* <a 
              href="#demo" 
              className="px-12 py-4 border border-[var(--subtle-divider)] rounded-none hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all duration-300 font-light text-sm tracking-widest uppercase"
            >
              Try Now
            </a> */}
          </div>
        </div>
      </div>

      {/* Experience Section - Demo */}
      <div id="demo" className="py-20 md:py-32 border-t border-[var(--subtle-divider)] border-opacity-30 bg-gradient-to-b from-[var(--background)] to-[var(--background-secondary)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-16 max-w-3xl mx-auto text-center">
            <h2 className="font-light text-4xl md:text-6xl tracking-[-0.05em] text-[var(--foreground)] uppercase mb-2">EXPERIENCE</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-8">
              Test drive Chatflix demo
            </p>
          </div>
          <DemoChat />
        </div>
      </div>
      
      {/* Capabilities Section */}
      <div className="w-full bg-[var(--background-secondary)] py-20 md:py-32 border-t border-[var(--subtle-divider)]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-light text-4xl md:text-6xl tracking-[-0.05em] text-[var(--foreground)] uppercase mb-2">CAPABILITIES</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[ 
              {
                title: "Agent Mode",
                description: "Autonomously plans, reasons, and executes complex multi-step tasks. Adapts workflow for what you need."
              },
              {
                title: "Versatile Toolset",
                description: "Web search, image generation, link reader, YouTube analysis, academic search, calculator and more."
              },
              {
                title: "Personalized Memory",
                description: "Learns your preferences and conversation context for a truly tailored experience."
              }
            ].map((feature) => (
              <div key={feature.title} className="p-8 border border-[var(--subtle-divider)] bg-gradient-to-br from-[var(--background)] to-[var(--background-secondary)] flex flex-col">
                <h3 className="font-light text-2xl text-[var(--foreground)] uppercase tracking-wider mb-4">{feature.title}</h3>
                <p className="text-sm text-[var(--muted)] font-light flex-grow">{feature.description}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[ 
              {
                title: "Multi-Modal Fluency",
                description: "Seamlessly interact with text, images, and files. Your context, understood."
              },
              {
                title: "Structured Delivery",
                description: "Clear, organized outputs. From concise answers to downloadable files and interactive charts."
              }
            ].map((feature) => (
              <div key={feature.title} className="p-6 border border-[var(--subtle-divider)] bg-[var(--background)]">
                <h3 className="font-light text-xl text-[var(--foreground)] uppercase tracking-wider mb-3">{feature.title}</h3>
                <p className="text-sm text-[var(--muted)] font-light">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Models Section */}
      <div className="w-full bg-[var(--background)] py-16 md:py-24 border-t border-[var(--subtle-divider)]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-light text-4xl md:text-6xl tracking-[-0.05em] text-[var(--foreground)] uppercase mb-2">MODELS</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 md:gap-x-8 gap-y-6 md:gap-y-10 mb-16">
            {/* CHATFLIX Models Box (Featured) */}
            {chatflixModels.length > 0 && chatflixModels.some(m => m.isEnabled && m.isActivated) && (
              <div className="p-6 border border-[var(--subtle-divider)] bg-gradient-to-br from-[var(--background)] to-[var(--background-secondary)] col-span-1 sm:col-span-2 lg:col-span-3">
                <div className="flex flex-col md:flex-row gap-10">
                  {chatflixModels.filter(m => m.isEnabled && m.isActivated).map((model) => (
                    <div key={model.id} className="flex-1 min-w-0">
                      <div className="flex items-center mb-4">
                        <div className="h-8 w-8 md:h-10 md:w-10 mr-3 relative flex-shrink-0">
                          <Image 
                            src={getProviderLogo('anthropic', model.id)}
                            alt="CHATFLIX logo"
                            fill
                            className="object-contain"
                            onError={() => handleLogoError('chatflix')}
                          />
                        </div>
                        <h3 className="font-light text-xl md:text-2xl text-[var(--foreground)] uppercase tracking-wider">
                          {model.name}
                        </h3>
                      </div>
                      <div className="text-sm text-[var(--muted)] mb-2">
                        <p>{model.description || "자동으로 최적의 모델을 선택하여 작업을 수행합니다."}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Other Model Providers */}
            {Object.entries(groupedModels).map(([provider, models]) => (
              <div key={provider} className="p-6 border border-[var(--subtle-divider)]">
                <div className="flex items-center mb-6">
                  <div className="h-6 w-6 md:h-8 md:w-8 mr-3 relative flex-shrink-0">
                    {!logoErrors[provider] ? (
                      <Image 
                        src={getProviderLogoPath(provider)} 
                        alt={`${getProviderName(provider)} logo`} 
                        fill
                        className="object-contain"
                        onError={() => handleLogoError(provider)}
                      />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-sm font-light text-[var(--foreground)]">
                        {getProviderName(provider).charAt(0)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-light text-base md:text-xl text-[var(--foreground)] uppercase tracking-wider">{getProviderName(provider)}</h3>
                </div>
                
                <ul className="text-xs text-[var(--muted)] space-y-2 md:space-y-3">
                  {models.map(model => (
                    <li key={model.id} className="flex items-start">
                      <span className="w-1 h-1 bg-[var(--foreground)] opacity-50 rounded-full mr-2 mt-1.5"></span>
                      <span className="truncate">{model.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <button 
              onClick={() => {
                setShowLoginModal(true)
                const url = new URL(window.location.href)
                url.searchParams.set('signup', 'true')
                window.history.replaceState({}, '', url)
              }}
              className="px-12 py-4 md:py-5 bg-[var(--foreground)] text-[var(--background)] rounded-none hover:opacity-90 transition-all duration-300 text-sm md:text-base uppercase tracking-widest font-light"
            >
              Sign up for full access
            </button>
          </div>
        </div>
      </div>
            {/* Login Modal - Modernized */}
            {showLoginModal && (
        <div className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--background)] rounded-2xl border border-[var(--subtle-divider)] shadow-2xl max-w-md w-full p-8 animate-fade-in relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-br from-[var(--foreground)] opacity-5 blur-[80px] rounded-full"></div>
            </div>
            
            <div className="mb-12 text-center relative">
              <h2 className="font-light text-3xl tracking-[-0.05em] text-[var(--foreground)] uppercase">CHATFLIX</h2>
              <p className="text-[10px] text-[var(--muted)] mt-3 tracking-[0.2em] uppercase">Access your account</p>
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
                    className="w-full px-5 py-4 border border-[var(--subtle-divider)] rounded-none focus:outline-none bg-transparent text-[var(--foreground)] text-sm font-light tracking-wider"
                    placeholder="EMAIL"
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
                    className="w-full px-5 py-4 border border-[var(--subtle-divider)] rounded-none focus:outline-none bg-transparent text-[var(--foreground)] text-sm font-light tracking-wider"
                    placeholder="PASSWORD"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleSignUp}
                  className="flex-1 py-4 border border-[var(--subtle-divider)] rounded-none text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all duration-300 text-xs tracking-widest uppercase font-light"
                >
                  Create account
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-[var(--foreground)] text-[var(--background)] rounded-none hover:opacity-90 transition-all duration-300 text-xs tracking-widest uppercase font-light"
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
