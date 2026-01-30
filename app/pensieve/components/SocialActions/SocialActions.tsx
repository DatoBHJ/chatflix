'use client'

import { useState } from 'react'
import { Heart, MessageCircle } from 'lucide-react'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'
import CommentsOverlay from './CommentsOverlay'
import { Comment } from '../../hooks/useSocialActions'

interface SocialActionsProps {
  liked: boolean
  likeCount: number
  commentCount: number
  comments: Comment[]
  isLiking: boolean
  isLoadingComments: boolean
  onToggleLike: () => void
  onFetchComments: () => void
  onAddComment: (content: string) => Promise<boolean>
  onDeleteComment: (commentId: string) => Promise<boolean>
  isGuest: boolean
  onShowGuestModal?: () => void
  currentUserId?: string
}

export default function SocialActions({
  liked,
  likeCount,
  commentCount,
  comments,
  isLiking,
  isLoadingComments,
  onToggleLike,
  onFetchComments,
  onAddComment,
  onDeleteComment,
  isGuest,
  onShowGuestModal,
  currentUserId
}: SocialActionsProps) {
  const [showComments, setShowComments] = useState(false)

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isGuest && onShowGuestModal) {
      onShowGuestModal()
      return
    }
    onToggleLike()
  }

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFetchComments()
    setShowComments(true)
  }

  return (
    <>
      {/* Social Actions - Right side vertical bar */}
      <div 
        className="fixed right-4 z-30 flex flex-col items-center gap-4"
        style={{ bottom: '120px' }}
      >
        {/* Like Button */}
        <button
          onClick={handleLikeClick}
          disabled={isLiking}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90 cursor-pointer disabled:opacity-70"
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <div 
            className="p-3 rounded-full transition-all"
            style={getAdaptiveGlassStyleBlur()}
          >
            <Heart 
              size={24} 
              className={`transition-all duration-200 ${
                liked 
                  ? 'fill-red-500 text-red-500 scale-110' 
                  : 'text-white hover:text-red-400'
              }`}
            />
          </div>
          {likeCount > 0 && (
            <span className="text-white text-xs font-medium drop-shadow-lg">
              {likeCount}
            </span>
          )}
        </button>

        {/* Comment Button */}
        <button
          onClick={handleCommentClick}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90 cursor-pointer"
          aria-label="Comments"
        >
          <div 
            className="p-3 rounded-full transition-all"
            style={getAdaptiveGlassStyleBlur()}
          >
            <MessageCircle 
              size={24} 
              className="text-white hover:text-blue-400 transition-colors"
            />
          </div>
          {commentCount > 0 && (
            <span className="text-white text-xs font-medium drop-shadow-lg">
              {commentCount}
            </span>
          )}
        </button>
      </div>

      {/* Comments Overlay */}
      <CommentsOverlay
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        comments={comments}
        isLoading={isLoadingComments}
        onAddComment={onAddComment}
        onDeleteComment={onDeleteComment}
        isGuest={isGuest}
        onShowGuestModal={onShowGuestModal}
        currentUserId={currentUserId}
      />
    </>
  )
}
