'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { GoogleSignIn } from '../components/GoogleSignIn'
import Image from 'next/image'
import { MODEL_CONFIGS } from '@/lib/models/config'
import { getProviderLogo } from '@/app/lib/models/logoUtils'
import { Brain, Search, Calculator, Link as LinkIcon, Image as ImageIcon, GraduationCap, Video, FileVideo, Columns, MapPin, Palette, FileText, Download } from 'lucide-react'
import { getLoginPageTranslations } from '@/app/lib/loginPageTranslations'

// Tool definitions
const TOOLS = [
  { id: 'web_search', icon: <Search strokeWidth={1.25} />, name: 'Web Search' },
  { id: 'link_reader', icon: <LinkIcon strokeWidth={1.25} />, name: 'Link Reader' },
  { id: 'youtube_search', icon: <Video strokeWidth={1.25} />, name: 'YouTube' },
  { id: 'academic_search', icon: <GraduationCap strokeWidth={1.25} />, name: 'Academic' },
  { id: 'image_generator', icon: <ImageIcon strokeWidth={1.25} />, name: 'Image Gen' },
  { id: 'calculator', icon: <Calculator strokeWidth={1.25} />, name: 'Calculator' },
];

// Featured prompt examples
const FEATURED_EXAMPLES = [
  {
    icon: <FileVideo strokeWidth={1.5} />,
    prompt: "Find the top 3 M4 iPad Pro review videos and create a summary document with pros and cons from each review.",
    outcome: "Got it! I'll search YouTube for the top 3 M4 iPad Pro review videos, analyze them, and summarize the pros and cons from each in a document.",
   tools: ['YouTube Search', 'Analysis']
  },
  {
    icon: <Columns strokeWidth={1.5} />,
    prompt: "Check out Framework Laptop's specs, find their main competitors, and create a comparison chart for me.",
 outcome: "Sure! I'll review the Framework Laptop's product page, find its main competitors, and make a comparison chart of their specs.",
tools: ['Link Reader', 'Web Search']
  },
  {
    icon: <Palette strokeWidth={1.5} />,
    prompt: "Create a minimalist logo design for a sustainable coffee brand called 'GreenBean' with earthy tones.",
    outcome: "Of course. I will now generate a minimalist logo for 'GreenBean' using an earthy color palette.",
    tools: ['Image Generator']
  }
];

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const [translations, setTranslations] = useState(getLoginPageTranslations())
  
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
  }, [])

  useEffect(() => {
    setTranslations(getLoginPageTranslations())
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
        setError('Please enter your email and password, then click Sign Up to create your account.')
      } else {
        setError(error.message)
      }
    } else {
      setError('Please check your email for the confirmation link.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* Chat Interface Preview */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 pt-24 pb-24 md:pt-32">
        <div className="w-full max-w-2xl">
          <div className="space-y-1">
            {/* Link Preview - above message like in real iMessage */}
            <div className="flex justify-end">
              <div className="max-w-[280px]">
                <button 
                  onClick={() => {
                    setShowLoginModal(true)
                    const url = new URL(window.location.href)
                    url.searchParams.set('signup', 'true')
                    window.history.replaceState({}, '', url)
                  }}
                  className="imessage-link-preview w-full text-left"
                >
                  <img src="/music2.png" alt="I AM AI" className="preview-image" />
                  <div className="preview-content">
                    <p className="preview-title">{translations.chatIsThisReal}</p>
                    <p className="preview-domain">chatflix.app</p>
                  </div>
                </button>
              </div>
            </div>
            
            {/* User Input */}
            <div className="flex flex-col items-end">
              <div className="imessage-send-bubble">
                {translations.chatIsThisReal}
              </div>
              {/* Delivered status */}
              <div className="text-xs text-neutral-500 mt-1 pr-2">
                Delivered
              </div>
            </div>
          </div>
          
          {/* AI Response - with more space above */}
          <div className="mt-12 space-y-2">
            {/* AI Response 1: "Yes" */}
            <div className="flex justify-start">
              <div className="imessage-receive-bubble">
                {translations.yes}
              </div>
            </div>
            
            {/* AI Response 2: "Get Started" Button */}
            <div className="flex justify-start">
              <div className="imessage-receive-bubble p-0">
                <button 
                  onClick={() => {
                    setShowLoginModal(true)
                    const url = new URL(window.location.href)
                    url.searchParams.set('signup', 'true')
                    window.history.replaceState({}, '', url)
                  }}
                  className="hover:opacity-90 transition-all duration-300"
                >
                  {translations.getStarted}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Capabilities Section */}
      <div className="w-full bg-[var(--background-secondary)] py-24 md:py-40 border-t border-[var(--subtle-divider)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-[var(--foreground)] mb-4">More than just chat.</h2>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="space-y-4">
              {/* User Prompt */}
              <div className="flex justify-end">
                <div className="imessage-send-bubble">
                  What can you do besides just chatting?
                </div>
              </div>
              
                            {/* AI Response 1 - Toolset */}
              <div className="flex justify-start">
                <div className="imessage-receive-bubble max-w-lg">
                  I have access to powerful tools – I can search the web, generate images, analyze documents, read any link you share, and even create files for you.
                  <div className="flex flex-wrap gap-2 mt-4 border-t border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] dark:border-white/10 pt-3">
                    <span className="text-xs px-2.5 py-1 bg-[var(--background)] text-[var(--muted)] dark:bg-white/10 dark:text-white/80 rounded-full font-medium tracking-wide">Web Search</span>
                    <span className="text-xs px-2.5 py-1 bg-[var(--background)] text-[var(--muted)] dark:bg-white/10 dark:text-white/80 rounded-full font-medium tracking-wide">Image Gen</span>
                    <span className="text-xs px-2.5 py-1 bg-[var(--background)] text-[var(--muted)] dark:bg-white/10 dark:text-white/80 rounded-full font-medium tracking-wide">Analysis</span>
                  </div>
                </div>
              </div>

              {/* User Prompt 2 - Memory */}
              <div className="flex justify-end">
                <div className="imessage-send-bubble">
                  Can you learn my preferences over time?
                </div>
              </div>

                            {/* AI Response 2 - Memory */}
              <div className="flex justify-start">
                <div className="imessage-receive-bubble max-w-lg">
                  Absolutely! I remember our conversations and learn your preferences over time, so I get better at helping you with each interaction.
                </div>
              </div>

              {/* Image Preview - above message like in real iMessage */}
              <div className="flex justify-end">
                <div className="max-w-[280px]">
                  <img 
                    src="/music2.png" 
                    alt="Chatflix logo" 
                    className="imessage-image-attachment"
                  />
                </div>
              </div>

              {/* User Prompt 3 - Multi-modal */}
              <div className="flex justify-end">
                <div className="imessage-send-bubble">
                  What's this?
                </div>
              </div>

              {/* AI Response 3 - Multi-modal */}
              <div className="flex justify-start">
                <div className="imessage-receive-bubble max-w-lg">
                  That's the Chatflix logo! I can see it has a modern design with clean typography.
                </div>
              </div>

              {/* User Prompt 4 - Research */}
              <div className="flex justify-end">
                <div className="imessage-send-bubble">
                  Help me research AI model comparison for a project
                </div>
              </div>

              {/* AI Response 4 - Research with Tools */}
              <div className="flex justify-start">
                <div className="imessage-receive-bubble max-w-lg">
                  I'll research the latest AI models and create a comprehensive comparison document for you.
                  <div className="flex flex-wrap gap-2 mt-4 border-t border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] dark:border-white/10 pt-3">
                    <span className="text-xs px-2.5 py-1 bg-[var(--background)] text-[var(--muted)] dark:bg-white/10 dark:text-white/80 rounded-full font-medium tracking-wide">Web Search</span>
                    <span className="text-xs px-2.5 py-1 bg-[var(--background)] text-[var(--muted)] dark:bg-white/10 dark:text-white/80 rounded-full font-medium tracking-wide">Academic Search</span>
                    <span className="text-xs px-2.5 py-1 bg-[var(--background)] text-[var(--muted)] dark:bg-white/10 dark:text-white/80 rounded-full font-medium tracking-wide">Document Generator</span>
                  </div>
                </div>
              </div>

              {/* File Preview */}
              <div className="flex justify-start pl-2">
                <div className="imessage-file-bubble">
                  <div className="flex-shrink-0">
                    <FileText className="w-6 h-6 text-[var(--muted)]" />
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="font-medium truncate text-sm text-[var(--foreground)]">
                      AI-Model-Comparison-2024.md
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      12.4 KB
                    </p>
                  </div>
                  <div className="p-1">
                    <Download className="text-[var(--muted)]" size={20} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Examples Section */}
      <div className="w-full bg-[var(--background)] py-24 md:py-40 border-t border-[var(--subtle-divider)]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-4xl font-medium tracking-tight text-[var(--foreground)] mb-4">Beyond Conversation. Into Action.</h2>
          </div>
          
          <div className="space-y-16">
            {FEATURED_EXAMPLES.map((example, index) => (
              <div key={index} className="flex flex-col gap-4">
                {/* User Prompt */}
                <div className="flex justify-end">
                  <div className="imessage-send-bubble">
                    {example.prompt}
                  </div>
                </div>
                
                                 {/* AI Response */}
                 <div className="flex justify-start">
                   <div className="imessage-receive-bubble max-w-lg">
                     {example.outcome}
                     <div className="flex flex-wrap gap-2 mt-4 border-t border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] dark:border-white/10 pt-3">
                       {example.tools.map((tool, toolIndex) => (
                         <span key={toolIndex} className="text-xs px-2.5 py-1 bg-[var(--background)] text-[var(--muted)] dark:bg-white/10 dark:text-white/80 rounded-full font-medium tracking-wide">
                           {tool}
                         </span>
                       ))}
                     </div>
                   </div>
                 </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Models Section */}
      <div className="w-full bg-[var(--background)] py-24 md:py-40 border-t border-[var(--subtle-divider)]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-[var(--foreground)] mb-4">Powered by the Best.</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 md:gap-x-8 gap-y-6 md:gap-y-10 mb-16">
            {/* CHATFLIX Models Box (Featured) */}
            {chatflixModels.length > 0 && chatflixModels.some(m => m.isEnabled && m.isActivated) && (
              <div className="p-6 border border-[var(--subtle-divider)] bg-[var(--background-secondary)] col-span-1 sm:col-span-2 lg:col-span-3">
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
                        <p>{model.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Other Model Providers */}
            {Object.entries(groupedModels).map(([provider, models]) => (
              <div key={provider} className="p-6 border border-[var(--subtle-divider)] bg-[var(--background-secondary)]">
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
          
          <div className="text-center mt-20">
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
        <div className="max-w-6xl mx-auto px-6 text-center">
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
