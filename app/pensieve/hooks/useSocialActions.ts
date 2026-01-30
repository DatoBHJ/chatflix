import { useState, useEffect, useCallback } from 'react'

export interface Comment {
  id: string
  user_id: string
  content: string
  created_at: string
  author_name: string
}

interface UseSocialActionsProps {
  targetType: 'project' | 'saved_image'
  targetId: string | undefined
  isOpen: boolean
  onViewCountUpdate?: (targetId: string, newCount: number) => void
  onLikeCountUpdate?: (targetId: string, newCount: number) => void
}

export function useSocialActions({ targetType, targetId, isOpen, onViewCountUpdate, onLikeCountUpdate }: UseSocialActionsProps) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [viewCount, setViewCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [comments, setComments] = useState<Comment[]>([])
  const [isLiking, setIsLiking] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)

  // Fetch initial data and record view
  useEffect(() => {
    if (!targetId || !isOpen) return

    const fetchLikes = async () => {
      try {
        const res = await fetch(`/api/pensieve/likes?targetType=${targetType}&targetId=${targetId}`)
        if (res.ok) {
          const data = await res.json()
          setLiked(data.liked)
          setLikeCount(data.count)
        }
      } catch (err) {
        console.error('Failed to fetch likes:', err)
      }
    }

    const fetchCommentCount = async () => {
      try {
        // Only fetch count, not full comments list (faster)
        const res = await fetch(`/api/pensieve/comments/count?targetType=${targetType}&targetId=${targetId}`)
        if (res.ok) {
          const data = await res.json()
          setCommentCount(data.count || 0)
        }
      } catch (err) {
        console.error('Failed to fetch comment count:', err)
        // Fallback: try to get count from full API
        try {
          const res = await fetch(`/api/pensieve/comments?targetType=${targetType}&targetId=${targetId}`)
          if (res.ok) {
            const data = await res.json()
            setCommentCount(data.comments?.length || 0)
          }
        } catch (fallbackErr) {
          console.error('Failed to fetch comments (fallback):', fallbackErr)
        }
      }
    }

    // Record view and get count
    const recordAndFetchViews = async () => {
      try {
        const res = await fetch('/api/pensieve/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetType, targetId })
        })
        if (res.ok) {
          const data = await res.json()
          setViewCount(data.count)
          // Notify parent component to update thumbnail view count
          if (targetId && onViewCountUpdate) {
            onViewCountUpdate(targetId, data.count)
          }
        }
      } catch (err) {
        console.error('Failed to record view:', err)
      }
    }

    fetchLikes()
    fetchCommentCount()
    recordAndFetchViews()
  }, [targetType, targetId, isOpen, onViewCountUpdate])

  const toggleLike = useCallback(async () => {
    if (!targetId || isLiking) return

    // Optimistic update
    setLiked(prev => !prev)
    setLikeCount(prev => liked ? prev - 1 : prev + 1)
    setIsLiking(true)

    try {
      const res = await fetch('/api/pensieve/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId })
      })

      if (res.ok) {
        const data = await res.json()
        setLiked(data.liked)
        setLikeCount(data.count)
        // Notify parent component to update thumbnail like count
        if (targetId && onLikeCountUpdate) {
          onLikeCountUpdate(targetId, data.count)
        }
      } else {
        // Revert on error
        setLiked(prev => !prev)
        setLikeCount(prev => !liked ? prev - 1 : prev + 1)
      }
    } catch (err) {
      // Revert on error
      setLiked(prev => !prev)
      setLikeCount(prev => !liked ? prev - 1 : prev + 1)
    } finally {
      setIsLiking(false)
    }
  }, [targetId, targetType, liked, isLiking, onLikeCountUpdate])

  const fetchComments = useCallback(async () => {
    if (!targetId) return

    setIsLoadingComments(true)
    try {
      const res = await fetch(`/api/pensieve/comments?targetType=${targetType}&targetId=${targetId}`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments || [])
        setCommentCount(data.comments?.length || 0)
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err)
    } finally {
      setIsLoadingComments(false)
    }
  }, [targetType, targetId])

  const addComment = useCallback(async (content: string) => {
    if (!targetId || !content.trim()) return false

    try {
      const res = await fetch('/api/pensieve/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, content: content.trim() })
      })

      if (res.ok) {
        const data = await res.json()
        setComments(prev => [...prev, data.comment])
        setCommentCount(prev => prev + 1)
        return true
      }
    } catch (err) {
      console.error('Failed to add comment:', err)
    }
    return false
  }, [targetType, targetId])

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      const res = await fetch(`/api/pensieve/comments?id=${commentId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId))
        setCommentCount(prev => prev - 1)
        return true
      }
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
    return false
  }, [])

  return {
    liked,
    likeCount,
    viewCount,
    commentCount,
    comments,
    isLiking,
    isLoadingComments,
    toggleLike,
    fetchComments,
    addComment,
    deleteComment
  }
}
