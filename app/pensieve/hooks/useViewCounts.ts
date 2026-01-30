import { useState, useEffect, useCallback, useRef } from 'react'

interface UseViewCountsProps {
  targetType: 'project' | 'saved_image'
  targetIds: string[]
}

export function useViewCounts({ targetType, targetIds }: UseViewCountsProps) {
  const [viewCounts, setViewCounts] = useState<Map<string, number>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const fetchedIdsRef = useRef<Set<string>>(new Set())

  const fetchViewCounts = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return

    // Filter out already fetched IDs
    const newIds = ids.filter(id => !fetchedIdsRef.current.has(id))
    if (newIds.length === 0) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/pensieve/views/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetIds: newIds })
      })

      if (res.ok) {
        const data = await res.json()
        setViewCounts(prev => {
          const next = new Map(prev)
          Object.entries(data.counts as Record<string, number>).forEach(([id, count]) => {
            next.set(id, count)
            fetchedIdsRef.current.add(id)
          })
          return next
        })
      }
    } catch (err) {
      console.error('Failed to fetch view counts:', err)
    } finally {
      setIsLoading(false)
    }
  }, [targetType])

  // Fetch counts when targetIds change
  useEffect(() => {
    const validIds = targetIds.filter(id => id && typeof id === 'string')
    if (validIds.length > 0) {
      fetchViewCounts(validIds)
    }
  }, [targetIds, fetchViewCounts])

  const getViewCount = useCallback((id: string) => {
    return viewCounts.get(id) || 0
  }, [viewCounts])

  // Update view count for a specific ID (optimistic update)
  const updateViewCount = useCallback((id: string, increment: number = 1) => {
    setViewCounts(prev => {
      const next = new Map(prev)
      const current = next.get(id) || 0
      next.set(id, current + increment)
      return next
    })
  }, [])

  return {
    viewCounts,
    isLoading,
    getViewCount,
    updateViewCount,
    refetch: () => {
      fetchedIdsRef.current.clear()
      fetchViewCounts(targetIds)
    }
  }
}

// Helper function to format view count
export function formatViewCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}
