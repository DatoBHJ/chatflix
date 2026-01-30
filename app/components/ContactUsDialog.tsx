'use client'

import { useState, useEffect, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { User } from '@supabase/supabase-js'
import { getDefaultBackground } from '@/app/photo/constants/backgrounds'
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage'
import { useBackgroundImageBrightness } from '@/app/hooks/useBackgroundImageBrightness'

interface ContactUsDialogProps {
  isOpen: boolean
  onClose: () => void
  user?: User | null
  hasBackgroundImage?: boolean
}

export function ContactUsDialog({ isOpen, onClose, user, hasBackgroundImage = false }: ContactUsDialogProps) {
  // Background management using shared hook
  const {
    currentBackground,
  } = useBackgroundImage(user?.id, {
    refreshOnMount: true,
    preload: true,
    useSupabase: false
  });

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

  const [isVisible, setIsVisible] = useState(false);
  const [panelElements, setPanelElements] = useState({
    background: false,
    content: false,
  });

  // Animation sequence on open/close
  useEffect(() => {
    if (isOpen) {
      // Open: ensure visible first, then animate
      setIsVisible(true);
      
      // Open animation sequence - background first, then content (like other panels)
      const timeouts = [
        setTimeout(() => setPanelElements(prev => ({ ...prev, background: true })), 20),
        setTimeout(() => setPanelElements(prev => ({ ...prev, content: true })), 300)
      ];
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    } else if (isVisible) {
      // Close: reverse sequence - content first, then background
      setPanelElements({ background: false, content: false });
      const timeoutId = setTimeout(() => setIsVisible(false), 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, isVisible]);


  if (!isVisible) {
    return null
  }

  const modalContent = (
    <div 
      className={`fixed inset-0 z-[90] text-black pointer-events-auto transition-all duration-500 ease-out ${
        panelElements.background ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Background Image Layer */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat min-h-screen w-full pointer-events-none"
        style={{
          backgroundImage: `url(${currentBackground})`,
          zIndex: 0
        }}
      />
      
      {/* Blur overlay */}
      <div 
        className="fixed inset-0 min-h-screen w-full pointer-events-none"
        style={{
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          zIndex: 0.5
        }}
      />
      
      {/* Color overlay for very dark or very bright backgrounds */}
      {overlayColor && (
        <div 
          className="fixed inset-0 min-h-screen w-full pointer-events-none"
          style={{
            backgroundColor: overlayColor,
            zIndex: 0.6
          }}
        />
      )}

      {/* Invisible overlay for backdrop click */}
      <div 
        className="absolute inset-0 pointer-events-auto"
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0)',
          zIndex: 2
        }}
        onClick={onClose}
      />
      
      <div 
        className="relative h-full w-full flex items-center justify-center"
        style={{ zIndex: 3 }}
      >
        <div 
          className={`bg-white rounded-lg shadow-lg max-w-sm mx-4 relative transition-opacity duration-400 ease-out ${
            panelElements.content ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={e => e.stopPropagation()}
          style={{
            minHeight: '120px',
            width: '480px'
          }}
        >
          {/* Main text */}
          <div className="px-6 pt-6 pb-2">
            <p className="text-center text-base font-normal">
              For all support inquiries, including billing issues, and general assistance, please email <a href="mailto:sply@chatflix.app" className="font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer">sply@chatflix.app</a>
            </p>
          </div>
          
          {/* Horizontal line separator */}
          <div className="mx-6 my-3">
            <div className="h-px bg-gray-200"></div>
          </div>
          
          {/* Close button in bottom right */}
          <div className="px-6 pb-4 flex justify-end">
            <button
              onClick={onClose}
              className="text-blue-500 hover:text-blue-600 transition-colors text-sm font-normal cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Handle case where window is not defined (SSR)
  if (typeof window === 'object') {
    const portalRoot = document.getElementById('portal-root');
    if (portalRoot) {
      return ReactDOM.createPortal(modalContent, portalRoot);
    }
  }

  // Fallback for SSR or if portal-root is not found
  return modalContent;
}
