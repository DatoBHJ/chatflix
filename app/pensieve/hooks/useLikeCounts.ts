import { useState, useEffect, useCallback, useRef } from 'react'

interface UseLikeCountsProps {
  targetType: 'project' | 'saved_image'
  targetIds: string[]
}

export function useLikeCounts({ targetType, targetIds }: UseLikeCountsProps) {
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const fetchedIdsRef = useRef<Set<string>>(new Set())

  const fetchLikeCounts = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return

    // Filter out already fetched IDs
    const newIds = ids.filter(id => !fetchedIdsRef.current.has(id))
    if (newIds.length === 0) return

    setIsLoading(true)
    try {
      // Fetch like counts in batch (same as view counts)
      const res = await fetch('/api/pensieve/likes/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetIds: newIds })
      })

      if (res.ok) {
        const data = await res.json()
        setLikeCounts(prev => {
          const next = new Map(prev)
          Object.entries(data.counts as Record<string, number>).forEach(([id, count]) => {
            next.set(id, count)
            fetchedIdsRef.current.add(id)
          })
          return next
        })
      }
    } catch (err) {
      console.error('Failed to fetch like counts:', err)
    } finally {
      setIsLoading(false)
    }
  }, [targetType])

  // Fetch counts when targetIds change
  useEffect(() => {
    const validIds = targetIds.filter(id => id && typeof id === 'string')
    if (validIds.length > 0) {
      fetchLikeCounts(validIds)
    }
  }, [targetIds, fetchLikeCounts])

  const getLikeCount = useCallback((id: string) => {
    return likeCounts.get(id) || 0
  }, [likeCounts])

  // Update like count for a specific ID (optimistic update)
  const updateLikeCount = useCallback((id: string, increment: number = 1) => {
    setLikeCounts(prev => {
      const next = new Map(prev)
      const current = next.get(id) || 0
      next.set(id, Math.max(0, current + increment)) // Ensure non-negative
      return next
    })
  }, [])

  return {
    likeCounts,
    isLoading,
    getLikeCount,
    updateLikeCount,
    refetch: () => {
      fetchedIdsRef.current.clear()
      fetchLikeCounts(targetIds)
    }
  }
}
