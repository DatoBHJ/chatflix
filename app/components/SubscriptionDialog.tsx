'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { checkSubscriptionClient } from '@/lib/subscription-client'
import { clearAllSubscriptionCache } from '@/lib/utils'
import { getChatInputTranslations } from '@/app/lib/chatInputTranslations'
import { getSidebarTranslations } from '@/app/lib/sidebarTranslations'
import { createPortal } from 'react-dom'
import Image from 'next/image'

interface SubscriptionDialogProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
}

export function SubscriptionDialog({ isOpen, onClose, user }: SubscriptionDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null)
  const [isPageReady, setIsPageReady] = useState(false)
  const [showDowngradeModal, setShowDowngradeModal] = useState(false)
  const [pendingDowngrade, setPendingDowngrade] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // 🚀 익명 사용자 지원: 익명 사용자 식별
  const isAnonymousUser = user?.is_anonymous || user?.id === 'anonymous' || !user
  
  // Refs for optimization
  const subscriptionCheckRef = useRef<boolean>(false)
  const lastCheckTimeRef = useRef<number>(0)
  const lastCheckedUserIdRef = useRef<string | null>(null)
  const CACHE_DURATION = 5 * 60 * 1000 // 5분 캐시
  
  // Drag states for mobile header
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [currentTranslateY, setCurrentTranslateY] = useState(0)
  const [modalHeight, setModalHeight] = useState(0)
  const modalRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  
  // Apple-style animation states
  const [isAnimating, setIsAnimating] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [showElements, setShowElements] = useState({
    modal: false,
    title: false,
    content: false
  })

  const [translations, setTranslations] = useState({
    upgrade: 'Upgrade',
    continueWithFree: 'Continue with Free',
    downgradeToFree: 'Downgrade to Free',
    confirmDowngrade: 'Confirm Downgrade',
    confirmDowngradeMessage: 'If you downgrade, you will lose unlimited access and will not be able to re-subscribe at the current price.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    processing: 'Processing...',
    subscription: 'Subscription'
  })

  // Initialize translations
  useEffect(() => {
    const chatTranslations = getChatInputTranslations();
    const sidebarTranslations = getSidebarTranslations();
    setTranslations({
      upgrade: chatTranslations.upgrade,
      continueWithFree: 'Continue with Free',
      downgradeToFree: 'Downgrade to Free',
      confirmDowngrade: 'Confirm Downgrade',
      confirmDowngradeMessage: 'If you downgrade, you will lose unlimited access and will not be able to re-subscribe at the current price.',
      cancel: 'Cancel',
      confirm: 'Confirm',
      processing: chatTranslations.processing || 'Processing...',
      subscription: sidebarTranslations.subscription
    });
  }, []);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize modal height on mount
  useEffect(() => {
    if (isOpen && isMobile && modalRef.current) {
      setModalHeight(window.innerHeight * 0.85);
    }
  }, [isOpen, isMobile]);

  // Handle touch events for drag functionality
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !headerRef.current) return;
    
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !isMobile) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - dragStartY;
    
    // Only allow downward dragging
    if (deltaY > 0) {
      setCurrentTranslateY(deltaY);
    }
  }, [isDragging, isMobile, dragStartY]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || !isMobile) return;
    
    setIsDragging(false);
    
    // If dragged down more than 100px, close the modal
    if (currentTranslateY > 100) {
      handleClose();
    } else {
      // Snap back to original position
      setCurrentTranslateY(0);
    }
  }, [isDragging, isMobile, currentTranslateY]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setShowElements({
      modal: false,
      title: false,
      content: false
    });
    
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  }, [onClose]);

  // Optimized user and subscription check
  const checkSubscriptionStatus = useCallback(async (userId: string, forceCheck = false) => {
    if (subscriptionCheckRef.current && !forceCheck) return
    
    // Check cache
    const now = Date.now()
    const isCacheValid = now - lastCheckTimeRef.current < CACHE_DURATION
    const isSameUser = lastCheckedUserIdRef.current === userId
    
    if (!forceCheck && isCacheValid && isSameUser && isSubscribed !== null) {
      return
    }
    
    subscriptionCheckRef.current = true
    try {
      const hasSubscription = await checkSubscriptionClient()
      setIsSubscribed(hasSubscription)
      lastCheckTimeRef.current = now
      lastCheckedUserIdRef.current = userId
    } catch (error) {
      console.error('Error checking subscription:', error)
      setIsSubscribed(false)
    } finally {
      subscriptionCheckRef.current = false
    }
  }, [isSubscribed])

  // Single effect for user and subscription
  useEffect(() => {
    const initializeData = async () => {
      try {
        if (isAnonymousUser) {
          // 게스트 모드: 구독 상태 체크하지 않음
          setIsSubscribed(null)
        } else if (user?.id) {
          await checkSubscriptionStatus(user.id)
        } else {
          setIsSubscribed(false)
        }
      } catch (error) {
        console.error('Error loading data:', error)
        setIsSubscribed(false)
      } finally {
        setIsPageReady(true)
      }
    }

    if (isOpen) {
      initializeData()
    }
  }, [isOpen, user?.id, checkSubscriptionStatus, isAnonymousUser])

  // Animation effects
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setCurrentTranslateY(0);
      
      // Staggered animation
      setTimeout(() => setShowElements(prev => ({ ...prev, modal: true })), 50);
      setTimeout(() => setShowElements(prev => ({ ...prev, title: true })), 150);
      setTimeout(() => setShowElements(prev => ({ ...prev, content: true })), 250);
    } else {
      setShowElements({
        modal: false,
        title: false,
        content: false
      });
    }
  }, [isOpen]);

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubscribe = useCallback(async () => {
    if (!user) {
      router.push('/login')
      return
    }
    
    if (!user.id || !user.email) {
      alert('Your account information is incomplete. Please log out and sign in again.')
      return
    }
        
    setIsLoading(true)
    try {
      const response = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: user.user_metadata?.full_name || user.email.split('@')[0]
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }
            
      if (data.checkout && data.checkout.url) {
        // Clear subscription cache before redirecting to checkout
        clearAllSubscriptionCache()
        window.location.href = data.checkout.url
      } else {
        throw new Error('Invalid checkout response')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to create checkout session. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [user, router])
  
  const handleDowngrade = useCallback(() => {
    setShowDowngradeModal(true)
  }, [])

  const confirmDowngrade = useCallback(async () => {
    if (!user) return
    setPendingDowngrade(true)
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get customer portal URL')
      }

      if (data.portalUrl) {
        // Clear subscription cache before redirecting to portal
        clearAllSubscriptionCache()
        window.location.href = data.portalUrl
      } else {
        throw new Error('Invalid portal URL response')
      }
    } catch (error) {
      alert('Failed to access subscription management. Please try again.')
    } finally {
      setPendingDowngrade(false)
      setShowDowngradeModal(false)
    }
  }, [user])

  const handleContinueWithFree = useCallback(() => {
    handleClose()
  }, [handleClose])

  const handleCloseModal = useCallback(() => {
    setShowDowngradeModal(false)
  }, [])

  // Memoized subscription content renderer - no loading states
  const renderSubscriptionContent = useMemo(() => 
    (forSubscribed: boolean, content: React.ReactNode) => {
      return (isSubscribed === forSubscribed) ? content : null
    }, [isSubscribed]
  )

  if (!isOpen || !mounted) {
    return null
  }

  const modalContent = (
    <div
      className={`fixed inset-0 flex items-end sm:items-center justify-center z-[70] overflow-hidden transition-all duration-500 ease-out ${
        isMobile ? `bg-black/10 dark:bg-black/30 backdrop-blur-sm ${
          showElements.modal ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }` : 'bg-black/50 backdrop-blur-sm'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (isMobile) {
            handleClose();
          } else {
            onClose();
          }
        }
      }}
    >
      <div 
        ref={modalRef}
        className="w-full bg-[var(--background)] flex flex-col shadow-xl overflow-hidden rounded-t-2xl sm:rounded-2xl sm:w-[500px] sm:h-[600px] h-[85vh] border border-[var(--accent)]"
        onClick={e => e.stopPropagation()}
        style={{
          transform: isMobile ? 
            showElements.modal ? `translateY(${currentTranslateY}px)` : 'translateY(calc(100vh - 60px))'
            : 'none',
          transition: isDragging ? 'none' : 
            isMobile ? 
              showElements.modal ? 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease-out' : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out'
              : 'transform 0.3s ease-out',
          height: isMobile ? `${modalHeight}px` : '85vh',
          willChange: isMobile ? 'transform, opacity' : 'auto',
          opacity: isMobile ? (showElements.modal ? 1 : 0) : 1,
          backgroundColor: 'var(--background)',
          backdropFilter: 'blur(0px)'
        }}
      >
        {/* Draggable Header for Mobile */}
        <div 
          ref={headerRef}
          className={`sm:hidden text-center pt-4 pb-2 shrink-0 ${
            isMobile ? `transition-all duration-250 ease-out ${
              showElements.title ? 'translate-y-0 opacity-100' : (isClosing ? 'translate-y-6 opacity-0' : 'translate-y-6 opacity-0')
            }` : ''
          }`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ 
            touchAction: 'none',
            willChange: isMobile ? 'transform, opacity' : 'auto'
          }}
        >
          <div 
            className={`w-12 h-1.5 rounded-full mx-auto transition-colors duration-200 ${
              isDragging ? 'bg-gray-400 dark:bg-gray-600' : 'bg-gray-300 dark:bg-gray-700'
            }`} 
          />
        </div>
        
        {/* Mobile Layout */}
        {isMobile ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className={`relative flex items-center justify-center py-4 border-b border-[var(--accent)] shrink-0 transition-all duration-300 ease-out ${
              showElements.title ? 'translate-y-0 opacity-100' : (isClosing ? 'translate-y-8 opacity-0' : 'translate-y-8 opacity-0')
            }`}
            style={{ willChange: 'transform, opacity' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}>
              <h2 className="text-lg font-semibold">{isAnonymousUser ? 'Pricing' : translations.subscription}</h2>
            </div>
            <div 
              className={`flex-1 min-h-0 overflow-y-auto transition-all duration-350 ease-out ${
                showElements.content ? 'translate-y-0 opacity-100' : (isClosing ? 'translate-y-10 opacity-0' : 'translate-y-10 opacity-0')
              }`}
              style={{ 
                touchAction: isDragging ? 'none' : 'pan-y',
                pointerEvents: isDragging ? 'none' : 'auto',
                willChange: 'transform, opacity'
              }}
            >
              {!isPageReady ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-t-transparent border-[var(--foreground)] rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="w-full max-w-md mx-auto">
                    {/* 게스트 모드: Pro vs Free 비교 */}
                    {isAnonymousUser ? (
                      <div className="space-y-6">
                        {/* Pro 플랜 */}
                        <div className="p-4 rounded-xl border border-[var(--accent)] bg-[var(--background)]">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-lg font-semibold text-[var(--foreground)]">Pro</span>
                            <span className="text-2xl font-bold text-[var(--foreground)]">&#36;4<span className="text-sm text-[var(--muted)]">/mo</span></span>
                          </div>
                          <ul className="text-sm text-[var(--foreground)] space-y-1">
                            <li>✓ Access to all models</li>
                            <li>✓ Unlimited requests</li>
                            <li>✓ Priority support</li>
                          </ul>
                        </div>
                        
                        {/* Free 플랜 */}
                        <div className="p-4 rounded-xl border border-[var(--accent)] bg-[var(--background)]">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-lg font-semibold text-[var(--foreground)]">Free</span>
                            <span className="text-2xl font-bold text-[var(--foreground)]">&#36;0<span className="text-sm text-[var(--muted)]">/mo</span></span>
                          </div>
                          <ul className="text-sm text-[var(--foreground)] space-y-1">
                            <li>• Limited model access</li>
                            <li>• Rate limited requests</li>
                            <li>• Basic support</li>
                          </ul>
                        </div>
                        
                        {/* Sign In 버튼 */}
                        <button
                          onClick={() => router.push('/login')}
                          className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl transition-all hover:bg-blue-500/90 cursor-pointer shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                          style={{ letterSpacing: '0.05em' }}
                        >
                          Sign In For Free
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Pro 플랜 */}
                        <div className="p-0">
                          {/* 플랜 정보 */}
                          <div className="px-0 pb-6 flex flex-col items-center">
                            <span className="text-lg font-semibold text-[var(--foreground)] mb-2">Pro</span>
                            
                            {/* Show price only if not subscribed */}
                            {renderSubscriptionContent(false, (
                              <>
                                <span className="text-4xl font-extrabold mb-2 tracking-tight">&#36;4</span>
                                <span className="text-xs text-[var(--muted)] mb-6">/ month</span>
                              </>
                            ))}
                            
                            <ul className="text-center text-sm text-[var(--foreground)] space-y-1 mb-8">
                              <li>Access to all models</li>
                              <li>Unlimited requests</li>
                            </ul>
                            
                            {/* Subscription-dependent buttons */}
                            {renderSubscriptionContent(false, (
                                <button
                                  onClick={handleSubscribe}
                                disabled={isLoading}
                                className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl transition-all hover:bg-blue-500/90 cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                                  style={{ letterSpacing: '0.05em' }}
                                >
                                {isLoading ? translations.processing : translations.upgrade}
                                </button>
                            ))}
                            
                            {renderSubscriptionContent(true, (
                              <>
                                <span className="inline-block mt-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-500 text-sm font-medium border border-blue-500/20">Active</span>
                              </>
                            ))}
                          </div>
                        </div>
                        
                        {/* Free 플랜: 비구독자에게만 간략히 표시 (업그레이드 유도) */}
                        {renderSubscriptionContent(false, (
                          <div className="px-0 pb-6 pt-4 opacity-75">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-base font-semibold text-[var(--muted)]">Free</span>
                              <span className="bg-[var(--muted)]/15 px-3 py-1 rounded-full text-[var(--muted)] text-xs font-medium border border-[var(--muted)]/20">Current</span>
                            </div>
                            <span className="text-2xl font-bold">&#36;0</span>
                            <span className="text-xs text-[var(--muted)] ml-2">/ month</span>
                            <ul className="text-xs text-[var(--muted)] space-y-1 mt-2 mb-2">
                              <li>Limited model access</li>
                              <li>Rate limited requests</li>
                            </ul>
                            {/* 계속 무료 사용 버튼 제거로 업그레이드 유도 */}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Desktop Layout */
          <div className="flex flex-col flex-1 min-h-0">
            <div className={`relative flex items-center justify-center py-4 border-b border-[var(--accent)] shrink-0 transition-all duration-300 ease-out ${
              showElements.title ? 'translate-y-0 opacity-100' : (isClosing ? 'translate-y-8 opacity-0' : 'translate-y-8 opacity-0')
            }`}
            style={{ willChange: 'transform, opacity' }}>
              <h2 className="text-lg font-semibold">{isAnonymousUser ? 'Pricing' : translations.subscription}</h2>
            </div>
            <div 
              className={`flex-1 min-h-0 overflow-y-auto transition-all duration-350 ease-out ${
                showElements.content ? 'translate-y-0 opacity-100' : (isClosing ? 'translate-y-10 opacity-0' : 'translate-y-10 opacity-0')
              }`}
              style={{ 
                willChange: 'transform, opacity'
              }}
            >
              {!isPageReady ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-t-transparent border-[var(--foreground)] rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="w-full max-w-md mx-auto">
                    {/* 게스트 모드: Pro vs Free 비교 */}
                    {isAnonymousUser ? (
                      <div className="space-y-6">
                        {/* 드레이크 밈 - 데스크탑에서만 표시 */}
                        <div className="hidden sm:flex flex-col items-center justify-center py-8">
                          <div className="relative w-full aspect-square max-w-[340px] rounded-xl overflow-hidden bg-white">
                            <Image
                              src="/previous/drake-meme.png"
                              alt="Drake meme"
                              fill
                              className="object-cover"
                              priority
                            />
                          </div>
                        </div>
                        
                        {/* Pro 플랜 */}
                        <div className="p-4 rounded-xl border border-[var(--accent)] bg-[var(--background)]">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-lg font-semibold text-[var(--foreground)]">Pro</span>
                            <span className="text-2xl font-bold text-[var(--foreground)]">&#36;4<span className="text-sm text-[var(--muted)]">/mo</span></span>
                          </div>
                          <ul className="text-sm text-[var(--foreground)] space-y-1">
                            <li>✓ Access to all models</li>
                            <li>✓ Unlimited requests</li>
                            <li>✓ Priority support</li>
                          </ul>
                        </div>
                        
                        {/* Free 플랜 */}
                        <div className="p-4 rounded-xl border border-[var(--accent)] bg-[var(--background)]">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-lg font-semibold text-[var(--foreground)]">Free</span>
                            <span className="text-2xl font-bold text-[var(--foreground)]">&#36;0<span className="text-sm text-[var(--muted)]">/mo</span></span>
                          </div>
                          <ul className="text-sm text-[var(--foreground)] space-y-1">
                            <li>• Limited model access</li>
                            <li>• Rate limited requests</li>
                            <li>• Basic support</li>
                          </ul>
                        </div>
                        
                        {/* Sign In 버튼 */}
                        <button
                          onClick={() => router.push('/login')}
                          className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl transition-all hover:bg-blue-500/90 cursor-pointer shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                          style={{ letterSpacing: '0.05em' }}
                        >
                          Sign in for free
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* 드레이크 밈 - 데스크탑에서만 표시 */}
                        <div className="hidden sm:flex flex-col items-center justify-center py-8">
                          <div className="relative w-full aspect-square max-w-[340px] rounded-xl overflow-hidden bg-white">
                            <Image
                              src="/previous/drake-meme.png"
                              alt="Drake meme"
                              fill
                              className="object-cover"
                              priority
                            />
                          </div>
                        </div>
                        
                        {/* Pro 플랜 */}
                        <div className="p-0">
                          {/* 플랜 정보 */}
                          <div className="px-0 pb-6 flex flex-col items-center">
                            <span className="text-lg font-semibold text-[var(--foreground)] mb-2">Pro</span>
                            
                            {/* Show price only if not subscribed */}
                            {renderSubscriptionContent(false, (
                              <>
                                <span className="text-4xl font-extrabold mb-2 tracking-tight">&#36;4</span>
                                <span className="text-xs text-[var(--muted)] mb-6">/ month</span>
                              </>
                            ))}
                            
                            <ul className="text-center text-sm text-[var(--foreground)] space-y-1 mb-8">
                              <li>Access to all models</li>
                              <li>Unlimited requests</li>
                            </ul>
                            
                            {/* Subscription-dependent buttons */}
                            {renderSubscriptionContent(false, (
                                <button
                                  onClick={handleSubscribe}
                                disabled={isLoading}
                                className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl transition-all hover:bg-blue-500/90 cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                                  style={{ letterSpacing: '0.05em' }}
                                >
                                {isLoading ? translations.processing : translations.upgrade}
                                </button>
                            ))}
                            
                            {renderSubscriptionContent(true, (
                              <span className="inline-block mt-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-500 text-sm font-medium border border-blue-500/20">Active</span>
                            ))}
                          </div>
                        </div>
                        
                        {/* Free 플랜: 비구독자에게만 간략히 표시 (업그레이드 유도) */}
                        {renderSubscriptionContent(false, (
                          <div className="px-0 pb-6 pt-4 opacity-75">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-base font-semibold text-[var(--muted)]">Free</span>
                              <span className="bg-[var(--muted)]/15 px-3 py-1 rounded-full text-[var(--muted)] text-xs font-medium border border-[var(--muted)]/20">Current</span>
                            </div>
                            <span className="text-2xl font-bold">&#36;0</span>
                            <span className="text-xs text-[var(--muted)] ml-2">/ month</span>
                            <ul className="text-xs text-[var(--muted)] space-y-1 mt-2 mb-2">
                              <li>Limited model access</li>
                              <li>Rate limited requests</li>
                            </ul>
                            {/* 계속 무료 사용 버튼 제거로 업그레이드 유도 */}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Downgrade Modal */}
      {showDowngradeModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="bg-white/95 dark:bg-black/85 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/60 p-6 max-w-sm w-full border border-black/5 dark:border-white/10"
               style={{
                 WebkitBackdropFilter: 'blur(24px)',
                 backdropFilter: 'blur(24px)'
               }}>
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">{translations.confirmDowngrade}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              {translations.confirmDowngradeMessage.split('will not be able to re-subscribe at the current price')[0]}
              <span className="font-semibold text-red-500">will not be able to re-subscribe at the current price</span>
              {translations.confirmDowngradeMessage.split('will not be able to re-subscribe at the current price')[1] || '.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl bg-gray-500/10 dark:bg-gray-400/10 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-500/20 dark:hover:bg-gray-400/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={handleCloseModal}
                disabled={pendingDowngrade}
              >
                {translations.cancel}
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]"
                onClick={confirmDowngrade}
                disabled={pendingDowngrade}
              >
                {pendingDowngrade ? translations.processing : translations.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}
