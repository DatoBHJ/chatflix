import { useState, useEffect, useCallback, useRef } from 'react'

interface UseCommentCountsProps {
  targetType: 'project' | 'saved_image'
  targetIds: string[]
}

export function useCommentCounts({ targetType, targetIds }: UseCommentCountsProps) {
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const fetchedIdsRef = useRef<Set<string>>(new Set())

  const fetchCommentCounts = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return

    // Filter out already fetched IDs
    const newIds = ids.filter(id => !fetchedIdsRef.current.has(id))
    if (newIds.length === 0) return

    setIsLoading(true)
    try {
      // Fetch comment counts in batch (same as view and like counts)
      const res = await fetch('/api/pensieve/comments/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetIds: newIds })
      })

      if (res.ok) {
        const data = await res.json()
        setCommentCounts(prev => {
          const next = new Map(prev)
          Object.entries(data.counts as Record<string, number>).forEach(([id, count]) => {
            next.set(id, count)
            fetchedIdsRef.current.add(id)
          })
          return next
        })
      }
    } catch (err) {
      console.error('Failed to fetch comment counts:', err)
    } finally {
      setIsLoading(false)
    }
  }, [targetType])

  // Fetch counts when targetIds change
  useEffect(() => {
    const validIds = targetIds.filter(id => id && typeof id === 'string')
    if (validIds.length > 0) {
      fetchCommentCounts(validIds)
    }
  }, [targetIds, fetchCommentCounts])

  const getCommentCount = useCallback((id: string) => {
    return commentCounts.get(id) || 0
  }, [commentCounts])

  // Update comment count for a specific ID (optimistic update)
  const updateCommentCount = useCallback((id: string, increment: number = 1) => {
    setCommentCounts(prev => {
      const next = new Map(prev)
      const current = next.get(id) || 0
      next.set(id, Math.max(0, current + increment)) // Ensure non-negative
      return next
    })
  }, [])

  return {
    commentCounts,
    isLoading,
    getCommentCount,
    updateCommentCount,
    refetch: () => {
      fetchedIdsRef.current.clear()
      fetchCommentCounts(targetIds)
    }
  }
}
