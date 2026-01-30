'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import ReactDOM from 'react-dom'
import { LifeBuoy, FileText, ShieldAlert, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface ProblemReportDialogProps {
  isOpen: boolean
  onClose: () => void
  user: any
}

export function ProblemReportDialog({ isOpen, onClose, user }: ProblemReportDialogProps) {
  const [reportType, setReportType] = useState('general_feedback')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  
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

  const resetForm = useCallback(() => {
    setReportType('general_feedback');
    setContent('');
    setError(null);
    setSuccess(false);
    setIsSubmitting(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

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
    if (!isMobile) return;
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
    setCurrentTranslateY(0);
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !isDragging) return;
    e.preventDefault();
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY;
    
    // Only allow downward dragging
    if (diff > 0) {
      setCurrentTranslateY(diff);
    }
  }, [isMobile, isDragging, dragStartY]);

  // Apple-style closing animation - exact reverse of opening
  const handleClose = useCallback(() => {
    if (isMobile) {
      setIsClosing(true);
      
      // Reverse animation sequence - balanced timing
      // Opening: modal(20ms) → title(250ms) → content(350ms)
      // Closing: content(0ms) → title(100ms) → modal(300ms)
      setTimeout(() => setShowElements(prev => ({ ...prev, content: false })), 0);
      setTimeout(() => setShowElements(prev => ({ ...prev, title: false })), 100);
      setTimeout(() => setShowElements(prev => ({ ...prev, modal: false })), 300);
      setTimeout(() => {
        onClose();
        setIsClosing(false);
      }, 400);
    } else {
      // Desktop: immediate close
      onClose();
    }
  }, [isMobile, onClose]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !isDragging) return;
    
    setIsDragging(false);
    
    // If dragged down more than 100px, close the modal
    if (currentTranslateY > 100) {
      handleClose();
    } else {
      // Reset position
      setCurrentTranslateY(0);
    }
  }, [isMobile, isDragging, currentTranslateY, handleClose]);

  // Reset drag state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsDragging(false);
      setCurrentTranslateY(0);
      setIsAnimating(false);
      setIsClosing(false);
      setShowElements({
        modal: false,
        title: false,
        content: false
      });
    }
  }, [isOpen]);

  // Apple-style staggered animation when opening
  useEffect(() => {
    if (isOpen && isMobile) {
      // Only start animation if not already animating
      if (!isAnimating) {
        setIsAnimating(true);
        
        // Start with all elements hidden
        setShowElements({
          modal: false,
          title: false,
          content: false
        });
        
        // Staggered sequence - background first, then elements
        const timeouts = [
          setTimeout(() => setShowElements(prev => ({ ...prev, modal: true })), 20),
          setTimeout(() => setShowElements(prev => ({ ...prev, title: true })), 250),
          setTimeout(() => setShowElements(prev => ({ ...prev, content: true })), 350),
          setTimeout(() => setIsAnimating(false), 450)
        ];
        
        // Cleanup function to clear timeouts
        return () => {
          timeouts.forEach(timeout => clearTimeout(timeout));
        };
      }
    } else if (!isOpen) {
      // Reset immediately when closing
      setIsAnimating(false);
    }
  }, [isOpen, isMobile]); // isAnimating 의존성 제거

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      setError('Please enter feedback content.')
      return
    }
    
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new Error('Login is required.')
      }

      const chatIdMatch = pathname.match(/\/chat\/([a-zA-Z0-9-]+)/)
      const chatId = chatIdMatch ? chatIdMatch[1] : null

      // Direct Supabase insert instead of API call
      const { data, error } = await supabase
        .from('problem_reports')
        .insert({
          user_id: user.id,
          email: user.email,
          report_type: reportType,
          content,
          chat_id: chatId,
          metadata: {
            url: window.location.href,
            userAgent: navigator.userAgent,
          },
        })
        .select()
        .single()

      if (error) {
        throw new Error('Failed to save problem report.')
      }
      
      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'bug_report':
        return <FileText size={16} />
      case 'safety_issue':
        return <ShieldAlert size={16} />
      default:
        return <LifeBuoy size={16} />
    }
  }

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'bug_report':
        return 'Bug Report'
      case 'safety_issue':
        return 'Safety Issue'
      default:
        return 'General Feedback'
    }
  }

  if (!isOpen) {
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
        className="w-full bg-[var(--background)] flex flex-col shadow-xl overflow-hidden rounded-t-2xl sm:rounded-2xl sm:w-[800px] sm:h-[600px] h-[85vh] border border-[var(--accent)]"
        onClick={e => e.stopPropagation()}
        style={{
          transform: isMobile ? 
            showElements.modal ? `translateY(${currentTranslateY}px)` : 'translateY(calc(100vh - 60px))'
            : 'none',
          transition: isDragging ? 'none' : 
            isMobile ? 
              showElements.modal ? 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease-out' : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out'
              : 'none',
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
              <h2 className="text-lg font-semibold">Report Issue</h2>
            </div>
            <div 
              className={`flex-1 min-h-0 overflow-y-auto p-6 transition-all duration-350 ease-out ${
                showElements.content ? 'translate-y-0 opacity-100' : (isClosing ? 'translate-y-10 opacity-0' : 'translate-y-10 opacity-0')
              }`}
              style={{ 
                touchAction: isDragging ? 'none' : 'pan-y',
                pointerEvents: isDragging ? 'none' : 'auto',
                willChange: 'transform, opacity'
              }}
            >
              {success ? (
                <div className="text-center py-10">
                  <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium">Thank you!</h3>
                  <p className="text-[var(--muted)]">Your feedback has been submitted.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Chat context info for mobile */}
                  {pathname.includes('/chat/') && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0 mt-0.5"></div>
                        <div className="text-sm">
                          <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Report from current chat
                          </p>
                          <p className="text-blue-700 dark:text-blue-300 text-xs leading-relaxed">
                            Your report will include a reference to this chat conversation, helping our team understand the context and reproduce any issues more effectively.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-3">Feedback Type</label>
                    <div className="space-y-2">
                      {['general_feedback', 'bug_report', 'safety_issue'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setReportType(type)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            reportType === type 
                              ? 'bg-[#007AFF]/10 border-[#007AFF]' 
                              : 'bg-[var(--accent)] border-[var(--accent)] hover:border-[var(--muted)]'
                          }`}
                        >
                          {getReportTypeIcon(type)}
                          <span className="font-medium">{getReportTypeLabel(type)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="content" className="block text-sm font-medium mb-3">
                      Feedback Details
                    </label>
                    <textarea
                      id="content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full min-h-[140px] p-3 bg-[var(--accent)] text-sm resize-none focus:outline-none rounded-lg border border-[var(--accent)] focus:border-[var(--muted)]"
                      placeholder="Please describe the issue or feedback in detail..."
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-500 text-sm">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 py-3 text-sm font-medium bg-[var(--accent)] hover:opacity-90 transition-opacity rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !content.trim()}
                      className="flex-1 py-3 text-sm font-medium bg-[#007AFF] text-white hover:opacity-90 transition-opacity disabled:opacity-50 rounded-lg flex items-center justify-center"
                    >
                      {isSubmitting && (
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {isSubmitting ? 'Submitting...' : 'Send'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* Desktop Layout */
          <div className="flex flex-col sm:flex-row flex-1 min-h-0">
            {/* Sidebar */}
            <div className="w-full sm:w-56 sm:bg-[var(--accent)] p-4 flex flex-col border-b sm:border-b-0 sm:border-r border-[var(--accent)]">
              <h2 className="text-lg font-semibold mb-6 px-2 hidden sm:block">Report Issue</h2>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 px-2 py-2 text-sm text-[var(--muted)]">
                  <LifeBuoy size={16} />
                  <span>Feedback & Reports</span>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 flex flex-col overflow-y-auto relative">
              <div className="flex-1 p-6">
                <div className="max-w-md">
                  <h3 className="text-xl font-semibold mb-2">Report an Issue</h3>
                  <p className="text-sm text-[var(--muted)] mb-6">Share your valuable feedback to help us improve our service.</p>
                  
                  {/* Chat context info */}
                  {pathname.includes('/chat/') && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-6">
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0 mt-0.5"></div>
                        <div className="text-sm">
                          <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Report from current chat
                          </p>
                          <p className="text-blue-700 dark:text-blue-300 text-xs leading-relaxed">
                            Your report will include a reference to this chat conversation, helping our team understand the context and reproduce any issues more effectively.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {success ? (
                    <div className="text-center py-10">
                      <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium mb-2">Thank you!</h3>
                      <p className="text-[var(--muted)]">Your feedback has been successfully submitted.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium mb-3">Feedback Type</label>
                        <div className="space-y-2">
                          {['general_feedback', 'bug_report', 'safety_issue'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setReportType(type)}
                              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                reportType === type 
                                  ? 'bg-[#007AFF]/10 border-[#007AFF] text-[#007AFF]' 
                                  : 'bg-[var(--accent)] border-[var(--accent)] hover:border-[var(--muted)]'
                              }`}
                            >
                              {getReportTypeIcon(type)}
                              <span className="font-medium">{getReportTypeLabel(type)}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="content-desktop" className="block text-sm font-medium mb-3">
                          Feedback Details
                        </label>
                        <textarea
                          id="content-desktop"
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          className="w-full min-h-[140px] p-3 bg-[var(--accent)] text-sm resize-none focus:outline-none rounded-lg border border-[var(--accent)] focus:border-[var(--muted)]"
                          placeholder="Please describe the issue or feedback in detail..."
                        />
                      </div>

                      {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <p className="text-red-500 text-sm">{error}</p>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={handleClose}
                          className="px-6 py-2.5 text-sm font-medium bg-[var(--accent)] hover:opacity-90 transition-opacity rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || !content.trim()}
                          className="px-6 py-2.5 text-sm font-medium bg-[#007AFF] text-white hover:opacity-90 transition-opacity disabled:opacity-50 rounded-lg flex items-center"
                        >
                          {isSubmitting && (
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          )}
                          {isSubmitting ? 'Submitting...' : 'Send'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

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
