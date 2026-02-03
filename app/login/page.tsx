'use client'

import { useState, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { GoogleSignIn, TwitterSignIn } from '../components/auth'
import { Mail, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { useBackgroundImageBrightness } from '@/app/hooks/useBackgroundImageBrightness'
import { useElementBackgroundBrightness } from '@/app/hooks/useBackgroundBrightness'
import { getAdaptiveGlassStyleBlur, getAdaptiveGlassStyleClean } from '@/app/lib/adaptiveGlassStyle'
import { getChatflixLogo } from '@/lib/models/logoUtils'
import { getDefaultBackground } from '@/app/photo/constants/backgrounds'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [isSignIn, setIsSignIn] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Always use default Chatflix background for login page
  const defaultBg = getDefaultBackground();
  const currentBackground = defaultBg.url;

  // Calculate background image brightness for overlay
  const { isVeryDark, isVeryBright } = useBackgroundImageBrightness(
    currentBackground
  );

  const overlayColor = useMemo(() => {
    if (isVeryDark) {
      return 'rgba(255, 255, 255, 0.125)';
    }
    if (isVeryBright) {
      return 'rgba(0, 0, 0, 0.2)';
    }
    return undefined;
  }, [isVeryDark, isVeryBright]);

  // Refs for each button and input field to detect their position brightness
  const emailButtonRef = useRef<HTMLButtonElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const passwordSubmitButtonRef = useRef<HTMLButtonElement>(null);
  const passwordBackButtonRef = useRef<HTMLButtonElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const emailSubmitButtonRef = useRef<HTMLButtonElement>(null);
  const emailBackButtonRef = useRef<HTMLButtonElement>(null);
  const mainEmailButtonRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const mainLogoRef = useRef<HTMLDivElement>(null);

  // Detect brightness at each element's position
  const { brightness: emailButtonBrightness } = useElementBackgroundBrightness(emailButtonRef, true, 'login-email-button');
  const { brightness: passwordInputBrightness } = useElementBackgroundBrightness(passwordInputRef, showPasswordForm, 'login-password-input');
  const { brightness: passwordSubmitBrightness } = useElementBackgroundBrightness(passwordSubmitButtonRef, showPasswordForm, 'login-password-submit');
  const { brightness: passwordBackBrightness } = useElementBackgroundBrightness(passwordBackButtonRef, showPasswordForm, 'login-password-back');
  const { brightness: emailInputBrightness } = useElementBackgroundBrightness(emailInputRef, showEmailForm, 'login-email-input');
  const { brightness: emailSubmitBrightness } = useElementBackgroundBrightness(emailSubmitButtonRef, showEmailForm, 'login-email-submit');
  const { brightness: emailBackBrightness } = useElementBackgroundBrightness(emailBackButtonRef, showEmailForm, 'login-email-back');
  const { brightness: mainEmailButtonBrightness } = useElementBackgroundBrightness(mainEmailButtonRef, !showEmailForm && !showPasswordForm, 'login-main-email-button');
  const { brightness: titleBrightness } = useElementBackgroundBrightness(titleRef, true, 'login-title');
  const { brightness: mainLogoBrightness } = useElementBackgroundBrightness(mainLogoRef, !showEmailForm && !showPasswordForm, 'login-main-logo');

  // Text style helper function - 각 요소의 위치 밝기에 따라 결정
  const getTextStyle = (brightness?: number) => {
    const isVeryBrightAtPosition = brightness !== undefined && brightness > 190;
    if (isVeryBrightAtPosition) {
      return { color: 'rgba(0, 0, 0)', textShadow: 'none' };
    }
    return { color: 'rgba(255, 255, 255)', textShadow: 'none' };
  };

  // Logo selection function - 밝기에 따라 적절한 로고 선택
  const getLogoSrc = (brightness?: number) => {
    return getChatflixLogo({ brightness });
  };

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
      <div className="min-h-screen flex flex-col relative">
        {/* Background Image Layer */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat min-h-screen w-full pointer-events-none"
          style={{
            backgroundImage: currentBackground ? `url("${currentBackground.replace(/"/g, '\\"')}")` : undefined,
            zIndex: 0
          }}
        />
        
        {/* Blur overlay */}
        <div 
          className="fixed inset-0 min-h-screen w-full pointer-events-none"
          style={{
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            zIndex: 1
          }}
        />
        
        {/* Color overlay for very dark or very bright backgrounds */}
        {overlayColor && (
          <div 
            className="fixed inset-0 min-h-screen w-full pointer-events-none"
            style={{
              backgroundColor: overlayColor,
              zIndex: 2
            }}
          />
        )}
        
        {/* Password Form */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-6">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <h1 ref={titleRef} className="font-light text-2xl" style={getTextStyle(titleBrightness)}>
                {isSignIn ? 'Sign in to your account' : 'Create your account'}
              </h1>
              <p className="text-sm mt-2" style={getTextStyle(titleBrightness)}>
                {email}
              </p>
            </div>
            
            <form className="space-y-6" onSubmit={isSignIn ? handleSignIn : handleSignUp}>
              {error && (
                <div className="p-4 rounded-lg text-sm" style={{ 
                  ...getAdaptiveGlassStyleBlur(),
                  color: getTextStyle(titleBrightness).color
                }}>
                  {error} 
                </div>
              )}
              
              <div>
                <label className="block text-sm mb-2" style={getTextStyle(passwordInputBrightness)}>Password</label>
                <input
                  ref={passwordInputRef}
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignIn ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg focus:outline-none transition-all cursor-text"
                  style={{
                    ...getAdaptiveGlassStyleBlur(),
                    color: getTextStyle(passwordInputBrightness).color
                  }}
                  placeholder={isSignIn ? "Enter your password" : "Create a password"}
                  autoFocus
                />
            </div>
            
              <div className="space-y-3">
                <button
                  ref={passwordSubmitButtonRef}
                  type="submit"
                  className="w-full py-3 rounded-lg transition-all duration-200 font-medium cursor-pointer"
                  style={{
                    ...getAdaptiveGlassStyleBlur(),
                    color: getTextStyle(passwordSubmitBrightness).color
                  }}
                >
                  {isSignIn ? 'Sign in' : 'Sign up'}
                </button>
                <button 
                  ref={passwordBackButtonRef}
                  type="button"
                  onClick={goBackToEmail}
                  className="w-full py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    ...getAdaptiveGlassStyleBlur(),
                    color: getTextStyle(passwordBackBrightness).color
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
      <div className="min-h-screen flex flex-col relative">
        {/* Background Image Layer */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat min-h-screen w-full pointer-events-none"
          style={{
            backgroundImage: currentBackground ? `url("${currentBackground.replace(/"/g, '\\"')}")` : undefined,
            zIndex: 0
          }}
        />
        
        {/* Blur overlay */}
        <div 
          className="fixed inset-0 min-h-screen w-full pointer-events-none"
          style={{
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            zIndex: 1
          }}
        />
        
        {/* Color overlay for very dark or very bright backgrounds */}
        {overlayColor && (
          <div 
            className="fixed inset-0 min-h-screen w-full pointer-events-none"
            style={{
              backgroundColor: overlayColor,
              zIndex: 2
            }}
          />
        )}
        
        {/* Email Form */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-6">
          <div className="w-full max-w-md">
            <div className="mb-12 text-center">
              <h1 ref={titleRef} className="font-light text-2xl" style={getTextStyle(titleBrightness)}>
                {isSignIn ? 'Sign in with your email' : 'Sign up with your email'}
              </h1>
            </div>
            
            <form className="space-y-6" onSubmit={handleEmailSubmit}>
              {error && (
                <div className="p-4 rounded-lg text-sm" style={{ 
                  ...getAdaptiveGlassStyleBlur(),
                  color: getTextStyle(titleBrightness).color
                }}>
                  {error} 
                </div>
              )}
              
              <div>
                <label className="block text-sm mb-2" style={getTextStyle(emailInputBrightness)}>Email</label>
                  <input
                    ref={emailInputRef}
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg focus:outline-none transition-all cursor-text"
                  style={{
                    ...getAdaptiveGlassStyleBlur(),
                    color: getTextStyle(emailInputBrightness).color
                  }}
                  placeholder="Enter your email"
                  autoFocus
                />
              </div>
              
              <div className="space-y-3">
                <button
                  ref={emailSubmitButtonRef}
                  type="submit"
                  className="w-full py-3 rounded-lg transition-all duration-200 font-medium cursor-pointer"
                  style={{
                    ...getAdaptiveGlassStyleBlur(),
                    color: getTextStyle(emailSubmitBrightness).color
                  }}
                >
                  Continue
                </button>
                <button 
                  ref={emailBackButtonRef}
                  type="button"
                  onClick={goBackToMain}
                  className="w-full py-3 rounded-lg transition-all duration-200 cursor-pointer"
                  style={{
                    ...getAdaptiveGlassStyleBlur(),
                    color: getTextStyle(emailBackBrightness).color
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
    <div className="min-h-screen flex flex-col relative">
      {/* Background Image Layer */}
      <div 
        className="fixed bg-cover bg-center bg-no-repeat w-full pointer-events-none"
        style={{
          backgroundImage: currentBackground ? `url("${currentBackground.replace(/"/g, '\\"')}")` : undefined,
          zIndex: 0,
          top: 'calc(-1 * env(safe-area-inset-top, 0px))',
          right: 'calc(-1 * env(safe-area-inset-right, 0px))',
          bottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))',
          left: 'calc(-1 * env(safe-area-inset-left, 0px))',
          minHeight: 'calc(100dvh + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))'
        }}
      />
      
      {/* Blur overlay */}
      <div 
        className="fixed w-full pointer-events-none"
        style={{
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          zIndex: 1,
          top: 'calc(-1 * env(safe-area-inset-top, 0px))',
          right: 'calc(-1 * env(safe-area-inset-right, 0px))',
          bottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))',
          left: 'calc(-1 * env(safe-area-inset-left, 0px))',
          minHeight: 'calc(100dvh + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))'
        }}
      />
      
      {/* Color overlay for very dark or very bright backgrounds */}
      {overlayColor && (
        <div 
          className="fixed w-full pointer-events-none"
          style={{
            backgroundColor: overlayColor,
            zIndex: 2,
            top: 'calc(-1 * env(safe-area-inset-top, 0px))',
            right: 'calc(-1 * env(safe-area-inset-right, 0px))',
            bottom: 'calc(-1 * env(safe-area-inset-bottom, 0px))',
            left: 'calc(-1 * env(safe-area-inset-left, 0px))',
            minHeight: 'calc(100dvh + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px))'
          }}
        />
      )}
      
      {/* Create Account Screen */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-12 text-center">
            {/* Logo - 제목 위에 표시 */}
            <div ref={mainLogoRef} className="mb-8 flex justify-center">
              <Image
                src={getLogoSrc(mainLogoBrightness)}
                alt="Chatflix"
                width={180}
                height={58}
                className="h-14 w-auto"
                priority
              />
            </div>
            <h1 ref={titleRef} className="font-light text-3xl mb-8" style={getTextStyle(titleBrightness)}>
              {isSignIn ? 'Sign in to your account' : 'Create your account'}
            </h1>
          </div>
          
          <div className="space-y-4">
            {/* Social Login Buttons */}
            <button 
              ref={mainEmailButtonRef}
              onClick={() => {
                setIsSignIn(isSignIn)
                setShowEmailForm(true)
              }}
              className="w-full py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer"
              style={{
                ...getAdaptiveGlassStyleBlur(),
                color: getTextStyle(mainEmailButtonBrightness).color
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
              style={getTextStyle(titleBrightness)}
            >
              {isSignIn ? (
                <>Don't have an account? <span className="text-blue-500 underline">Sign up</span></>
              ) : (
                <>Already have an account? <span className="text-blue-500 underline">Sign in</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 
