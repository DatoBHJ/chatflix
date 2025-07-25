'use client'

import { useState, useEffect, useCallback } from 'react'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      setError('피드백 내용을 입력해주세요.')
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
        throw new Error('로그인이 필요합니다.')
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
        throw new Error('문제 보고 저장에 실패했습니다.')
      }
      
      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 2000)

    } catch (err: any) {
      setError(err.message || '예상치 못한 오류가 발생했습니다.')
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
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 overflow-hidden backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div 
        className="w-full bg-[var(--background)] flex flex-col shadow-xl overflow-hidden rounded-t-2xl sm:rounded-2xl sm:w-[800px] sm:h-[600px] h-[85vh] border border-[var(--accent)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden text-center pt-4 pb-2 shrink-0">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto" />
        </div>
        
        {/* Mobile Layout */}
        {isMobile ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="relative flex items-center justify-center py-4 border-b border-[var(--accent)] shrink-0">
              <h2 className="text-lg font-semibold">Report Issue</h2>
              <button 
                onClick={onClose}
                className="absolute right-4 p-2 hover:bg-[var(--accent)] rounded-lg transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
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
                      onClick={onClose}
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
              {/* Close button - top right */}
              <button 
                onClick={onClose} 
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--accent)] transition-colors"
                title="Close"
              >
                <X size={16} className="text-[var(--muted)]" />
              </button>
              
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
                          onClick={onClose}
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
