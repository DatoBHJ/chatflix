'use client'

import { JSX, useState } from 'react'
import { MarkdownContent } from '../../components/MarkdownContent'
import { CategoryData, categoryNames } from './types'
import { Cellular, LightBulb, BubbleChat, Speaker, Heart } from 'react-ios-icons'

interface MemoryModalsProps {
  selectedCategory: CategoryData | null
  setSelectedCategory: (category: CategoryData | null) => void
  editingCategory: CategoryData | null
  setEditingCategory: (category: CategoryData | null) => void
  editingContent: string
  setEditingContent: (content: string) => void
  isSaving: boolean
  handleSaveEdit: () => void
  handleCancelEdit: () => void
  expandedCard: 'conversation' | 'refinement' | null
  setExpandedCard: (card: 'conversation' | 'refinement' | null) => void
  getCategoryIcon?: (category: string) => JSX.Element
}

export default function MemoryModals({
  selectedCategory,
  setSelectedCategory,
  editingCategory,
  setEditingCategory,
  editingContent,
  setEditingContent,
  isSaving,
  handleSaveEdit,
  handleCancelEdit,
  expandedCard,
  setExpandedCard,
  getCategoryIcon
}: MemoryModalsProps) {
  
  // Get category icon function
  const getCategoryIconLocal = (category: string) => {
    const iconProps = { className: "w-12 h-12 sm:w-16 sm:h-16 text-[#2997FF]" }
    
    switch (category) {
      case '00-personal-info':
        return (
          <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
      case '01-preferences':
        return (
          <Heart {...iconProps} />
        )
      case '02-interests':
        return (
          <LightBulb {...iconProps} />
        )
      case '03-interaction-history':
        return (
          <BubbleChat {...iconProps} />
        )
      case '04-relationship':
        return (
          <Speaker {...iconProps} />
        )
      default:
        return (
          <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
    }
  }
  return (
    <>
      {/* Expanded Card Modal */}
      {expandedCard && (
        <div 
          className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setExpandedCard(null)}
        >
          <div 
            className="bg-[#1C1C1E] rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 sm:p-12"
            onClick={(e) => e.stopPropagation()}
          >
            {expandedCard === 'conversation' ? (
              <>
                <h2 className="text-4xl font-semibold mb-6 text-white">
                  Conversation-Based Updates
                </h2>
                <div className="space-y-6 text-[#86868B] text-lg">
                  <p>
                    As you send messages, every conversation is analyzed in real-time to identify valuable information worth remembering.
                  </p>
                  <div>
                    <h4 className="text-white font-semibold mb-2">Automatic Detection</h4>
                    <p>
                      Chatflix intelligently identifies new preferences, interests, and personal information from natural conversation flow. No explicit commands needed.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">Explicit Commands</h4>
                    <p>
                      You can also directly control what gets remembered by saying "remember this" or "save this preference," which triggers an immediate update.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">Smart Updates</h4>
                    <p>
                      The system intelligently determines when updates are needed based on conversation content and automatically processes them in the background for optimal performance.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-4xl font-semibold mb-6 text-white">
                  Daily Refinement
                </h2>
                <div className="space-y-6 text-[#86868B] text-lg">
                  <p>
                    The system performs a comprehensive review and refinement of your Memory Bank based on your activity level to maintain its quality and accuracy.
                  </p>
                  <div>
                    <h4 className="text-white font-semibold mb-2">Activity-Based Processing</h4>
                    <p>
                      Active users get daily refinement, while less active users are processed weekly. This happens automatically in the background with no impact on your experience.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">Consolidation</h4>
                    <p>
                      The system analyzes your last 50 conversations to consolidate related information, merging duplicate entries and strengthening consistent patterns.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-2">Cleanup</h4>
                    <p>
                      Outdated or contradictory information is identified and removed, ensuring your Memory Bank stays relevant and accurate over time.
                    </p>
                  </div>
                </div>
              </>
            )}
            
            {/* Close Button */}
            <button 
              onClick={() => setExpandedCard(null)}
              className="mt-8 w-full py-4 rounded-full bg-[#3A3A3C] hover:bg-[#48484A] text-white font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedCategory && (
        <div 
          className="modal-overlay fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6 md:p-8"
          onClick={() => setSelectedCategory(null)}
        >
          <div 
            className="modal-content bg-accent rounded-none sm:rounded-3xl w-full h-full sm:max-w-3xl sm:w-auto sm:h-auto sm:max-h-[85vh] overflow-y-auto p-6 sm:p-8 md:p-12 relative"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Icon */}
          <div className="mb-2 flex items-center justify-start">
            {getCategoryIconLocal(selectedCategory.category)}
          </div>
          
          {/* Title */}
          <h2 className="ml-1 text-[clamp(1.75rem,5vw,2.5rem)] font-semibold mb-6 text-[var(--foreground)]">
            {categoryNames[selectedCategory.category] || selectedCategory.category}
          </h2>
          
          {/* Content */}
          <div className="text-base sm:text-lg leading-relaxed text-[var(--foreground)]">
            <MarkdownContent 
              content={selectedCategory.content} 
              enableSegmentation={true}
              messageType="assistant"
            />
          </div>
          
          {/* Close Button */}
          <button 
            onClick={() => setSelectedCategory(null)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E5E5E7] hover:bg-[#D1D1D6] dark:bg-[#3A3A3C] dark:hover:bg-[#48484A] text-[#1D1D1F] dark:text-white transition-colors flex items-center justify-center cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )}

    {/* Edit Modal */}
    {editingCategory && (
      <div 
        className="modal-overlay fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6 md:p-8"
        onClick={handleCancelEdit}
      >
        <div 
          className="modal-content bg-accent rounded-none sm:rounded-3xl w-full h-full sm:max-w-3xl sm:w-full sm:h-auto sm:max-h-[90vh] overflow-y-auto p-6 sm:p-8 md:p-12 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="mb-2 flex items-center justify-start">
            {getCategoryIconLocal(editingCategory.category)}
          </div>
          
          {/* Title */}
          <h2 className="ml-1 text-[clamp(1.75rem,5vw,2.5rem)] font-semibold mb-6 text-[var(--foreground)]">
            Edit {categoryNames[editingCategory.category] || editingCategory.category}
          </h2>
          
          {/* Content Textarea */}
          <div className="mb-8">
            <textarea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              className="w-full h-[400px] sm:h-[500px] p-4 border border-[var(--subtle-divider)] rounded-lg bg-[var(--accent)] text-[var(--foreground)] resize-none focus:outline-none focus:border-transparent"
              placeholder="Enter category content..."
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <button 
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{
                // 다크모드 전용 스타일
                ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                    (document.documentElement.getAttribute('data-theme') === 'system' && 
                     window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                  WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                } : {
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                  WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                })
              }}
              title="Cancel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <button 
              onClick={handleSaveEdit}
              disabled={isSaving || !editingContent.trim()}
              className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{
                // 다크모드 전용 스타일
                ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                    (document.documentElement.getAttribute('data-theme') === 'system' && 
                     window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                  WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                } : {
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                  WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                })
              }}
              title="Save"
            >
              {isSaving ? (
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
              )}
            </button>
          </div>
          
          {/* Close Button */}
          <button 
            onClick={handleCancelEdit}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E5E5E7] hover:bg-[#D1D1D6] dark:bg-[#3A3A3C] dark:hover:bg-[#48484A] text-[#1D1D1F] dark:text-white transition-colors flex items-center justify-center cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )}
  </>
  )
}
