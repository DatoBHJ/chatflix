'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export function GoogleSignIn() {
  const router = useRouter()
  const supabase = createClient()
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [buttonRendered, setButtonRendered] = useState(false)

  async function handleSignInWithGoogle(response: any) {
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
      })

      if (error) throw error
      
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Error signing in with Google:', error)
    }
  }

  // Register global callback when component mounts
  useEffect(() => {
    // Make the function available globally
    (window as any).handleSignInWithGoogle = handleSignInWithGoogle
    
    // Return cleanup function
    return () => {
      // Clean up global function when component unmounts
      delete (window as any).handleSignInWithGoogle
    }
  }, [])

  // Handle Google button initialization
  useEffect(() => {
    if (!scriptLoaded) return
    
    // Attempt to initialize Google button
    const initializeGoogleButton = () => {
      try {
        // Check if google object is available
        if (typeof window.google !== 'undefined' && window.google?.accounts?.id) {
          // Clear any existing buttons
          window.google.accounts.id.cancel()
          
          // Initialize button - using programmatic approach
          window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
            callback: handleSignInWithGoogle,
            context: 'signin',
            ux_mode: 'popup',
            auto_prompt: false
          })
          
          // Render the button
          window.google.accounts.id.renderButton(
            document.getElementById('google-signin-button')!,
            { 
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 280
            }
          )
          
          setButtonRendered(true)
        } else {
          // If Google object is not available yet, retry after short delay
          setTimeout(initializeGoogleButton, 100)
        }
      } catch (error) {
        console.error('Error initializing Google button:', error)
        // Retry initialization on error
        setTimeout(initializeGoogleButton, 1000)
      }
    }
    
    // Initialize button
    initializeGoogleButton()
  }, [scriptLoaded])

  return (
    <>
      <Script 
        src="https://accounts.google.com/gsi/client" 
        onLoad={() => setScriptLoaded(true)}
        onError={(e) => console.error('Error loading Google script:', e)}
      />
      
      {/* Fallback while button is loading */}
      {!buttonRendered && (
        <div className="w-[280px] h-[40px] border border-[var(--subtle-divider)] rounded-md flex items-center justify-center">
          <span className="text-sm text-[var(--muted)]">Loading Google Sign-In...</span>
        </div>
      )}
      
      {/* Button container - Google script will inject button here */}
      <div id="google-signin-button"></div>
    </>
  )
}

// Add TypeScript declaration for window.google
declare global {
  interface Window {
    google?: {
      accounts?: {
        id: {
          initialize: (config: any) => void;
          renderButton: (container: HTMLElement, options: any) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
} 