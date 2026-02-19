import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react'

// Send Icon (upward arrow) for send button style - matches Chat Starter widget
const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="12" 
    height="12" 
    viewBox="0 0 24 24" 
    className={className}
    fill="none" 
    stroke="currentColor" 
    strokeWidth="4" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 2L12 22M5 9L12 2L19 9"></path>
  </svg>
)
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

import { WidgetBaseProps } from './index'
import { useGlassTrendsSharedState } from './useGlassTrendsSharedState'
import { WidgetHeader } from './WidgetHeader'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'
import { OnboardingRenderer } from '@/app/components/Onboarding/OnboardingRenderer'

const formatSearchVolume = (volume = 0): string => {
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(1)}M+`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(0)}K+`
  }
  return `${volume}+`
}

const formatPercentageIncrease = (percentage = 0): string => `+${percentage.toLocaleString()}%`

// 볼드체 패턴을 HTML 태그로 변환하는 함수
// react-markdown이 따옴표나 특수 문자가 포함된 볼드체를 잘 처리하지 못하는 경우를 해결
const preprocessBoldMarkdown = (content: string): string => {
  if (!content) return '';
  
  // 볼드체 패턴(**...**)을 찾아서 HTML <strong> 태그로 변환
  // 볼드체는 **로 시작하고 **로 끝나며, 내부에 **가 없어야 함 (단일 *는 허용)
  const boldPattern = /\*\*((?:[^*]|\*(?!\*))+)\*\*/g;
  return content.replace(boldPattern, '<strong>$1</strong>');
}

const formatRelativeTime = (isoDate: string): string => {
  if (!isoDate) return 'Unknown'
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

const formatTimeAgo = (isoDate: string): string => {
  if (!isoDate) return 'Just now'
  const diff = new Date().getTime() - new Date(isoDate).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  return `${hours}h ago`
}

const formatCategoryLabel = (category = '') =>
  category
    .split(/[\s_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

type GeoOption = {
  geo_id: string
  geo_description: string
  type: 'country' | 'region'
  parent_geo_id: string | null
}

type CountryOption = {
  country_id: string
  country_name: string
  regions: Array<{
    geo_id: string
    geo_description: string
  }>
}

type ServerTrend = {
  position: number
  query: string
  search_volume?: number
  percentage_increase?: number
  news_token?: string
  keywords?: string[]
  start_date?: string
}

type NewsArticle = {
  title: string
  source?: string
  iso_date?: string
  thumbnail?: string
  link?: string
}

type TrendItem = ServerTrend & {
  search_volume_display: string
  percentage_increase_display: string
  search_volume_original: number
  percentage_increase_original: number
  categories?: string[]
  news?: NewsArticle[]
}

type Filters = {
  geo: string
  timeRange: string
}

type GeoOptionsResponse = {
  defaultGeo: string
  defaultCountry?: string
  defaultRegion?: string | null
  geoOptions: GeoOption[]
  countries: CountryOption[]
  timeRangeOptions: { id: string; label: string }[]
  geoCount?: number
  cacheExpiresAt?: string
  resolvedAt?: string
}

type TrendsPayload = {
  filters: Filters
  data: {
    trends: ServerTrend[]
    search_parameters?: {
      geo?: string
      time?: string
      hl?: string
    }
  }
  cachedAt?: string
  cacheExpiresAt?: string
  cacheKey?: string
}

const NEWS_CACHE_TTL_MS = 60 * 60 * 1000
const getCachedNews = (key: string): NewsArticle[] | null => {
  if (!key || typeof window === 'undefined') return null
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null
    const parsed = JSON.parse(cached)
    const cacheAge = Date.now() - (parsed.timestamp || 0)
    if (cacheAge > NEWS_CACHE_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return parsed.articles || null
  } catch {
    return null
  }
}
const setCachedNews = (key: string, articles: NewsArticle[]) => {
  if (!key || typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ articles, timestamp: Date.now() }))
  } catch {
    // Ignore storage errors
  }
}

const getNewsCacheKey = (filters: Filters, newsToken?: string) => {
  if (!newsToken) return ''
  return `${filters.geo}|${filters.timeRange}|${newsToken}`
}

// ─────────────────────────────────────────────────────────────
// Minimal Apple Style Components (iOS Settings Style)
// ─────────────────────────────────────────────────────────────

// iOS 설정 메뉴 스타일의 행(Row) 컴포넌트
const SettingRow = ({
  label,
  value,
  onClick,
  isActive = false,
}: {
  label: string
  value: React.ReactNode
  onClick?: () => void
  isActive?: boolean
}) => (
  <div
    onClick={onClick}
    className={`
      group flex items-center justify-between py-3 cursor-pointer transition-all duration-200
      border-b border-white/5 last:border-0
      ${isActive ? 'opacity-100' : 'opacity-80 hover:opacity-100'}
    `}
  >
    <span className="text-[13px] font-medium text-white/40 group-hover:text-white/60 transition-colors">
      {label}
    </span>
    <div className="flex items-center gap-2">
      <span className="text-[14px] font-medium text-white tracking-tight">
        {value}
      </span>
      {onClick && (
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
      )}
    </div>
  </div>
)

// 애플 스타일의 텍스트 기반 탭 (Pill 형태 대신 텍스트로 미니멀하게)
const TextSegmentedControl = ({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[]
  value: string
  onChange: (val: string) => void
}) => (
  <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2">
    {options.map((opt) => {
      const isActive = value === opt.id
      return (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`
            text-[14px] font-medium whitespace-nowrap transition-all duration-300 relative cursor-pointer
            ${isActive ? 'text-white' : 'text-white/30 hover:text-white/60'}
          `}
        >
          {opt.label}
          {isActive && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
          )}
        </button>
      )
    })}
  </div>
)

interface GlassTrendsWidgetProps extends WidgetBaseProps {
  onPromptClick?: (prompt: string) => void;
  isFullscreen?: boolean;
}

export function GlassTrendsWidget({
  isDarkMode,
  isBackgroundDark,
  isEditMode = false,
  widgetId,
  onPromptClick,
  isFullscreen = false,
}: GlassTrendsWidgetProps) {
  const stableWidgetId = widgetId || 'glass-trends-widget'
  const [sharedState, setSharedState] = useGlassTrendsSharedState(stableWidgetId)
  const {
    currentTrendIndex,
    isFilterExpanded,
    selectedCategory,
    selectedCountry,
    selectedRegion,
    timeRange,
    lastFilterSignature,
    summaryContent,
    summaryQuestions,
    conversationHistory,
  } = sharedState
  const lastFilterSignatureRef = useRef(lastFilterSignature)
  const previousCategoryRef = useRef(selectedCategory)
  const lastSummaryTrendKeyRef = useRef<string | null>(null)
  const summaryResponseCacheRef = useRef<Map<string, { summary: string; questions: string[] }>>(new Map())
  const inFlightSummaryRequestsRef = useRef<Set<string>>(new Set())
  const currentSummaryRequestKeyRef = useRef<string | null>(null)
  const summaryAbortControllerRef = useRef<AbortController | null>(null)
  useEffect(() => {
    lastFilterSignatureRef.current = lastFilterSignature
  }, [lastFilterSignature])

  const [geoOptionsResponse, setGeoOptionsResponse] = useState<GeoOptionsResponse | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const latestRequestRef = useRef(0)
  const computedGeo = selectedRegion || selectedCountry

  const [trendsState, setTrendsState] = useState<{
    loading: boolean
    error: string | null
    payload: TrendsPayload | null
  }>({
    loading: false,
    error: null,
    payload: null,
  })

  const [newsCache, setNewsCache] = useState<Record<string, NewsArticle[]>>({})
  const [newsLoadingKey, setNewsLoadingKey] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isSingleRow, setIsSingleRow] = useState(false)
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  
  // Summary state (loading and error remain local as they are transient)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  
  // Q&A conversation state (loading and error remain local as they are transient)
  const [isQALoading, setIsQALoading] = useState(false)
  const [qaError, setQaError] = useState<string | null>(null)
  const [qaInput, setQaInput] = useState<string>('')

  // Detect if widget is single row height
  useEffect(() => {
    if (!containerElement) return
    const updateSize = () => {
      if (containerElement) {
        // 280px is a safe threshold between 1 row (max 200px) and 2 rows (min ~330px)
        setIsSingleRow(containerElement.offsetHeight < 280)
      }
    }
    const observer = new ResizeObserver(updateSize)
    observer.observe(containerElement)
    updateSize()
    return () => observer.disconnect()
  }, [containerElement])
  const inFlightNewsRequests = useRef<Set<string>>(new Set())

  // Local storage cache helpers
  const getCacheKey = (filters: Filters) => `trends:${filters.geo}:${filters.timeRange}`
  const getCachedData = (key: string): TrendsPayload | null => {
    try {
      const cached = localStorage.getItem(key)
      if (!cached) return null
      const parsed = JSON.parse(cached)
      // Check if cache is still valid (5 minutes)
      const cacheAge = Date.now() - (parsed.timestamp || 0)
      if (cacheAge > 5 * 60 * 1000) {
        localStorage.removeItem(key)
        return null
      }
      return parsed.payload
    } catch {
      return null
    }
  }
  const setCachedData = (key: string, payload: TrendsPayload) => {
    try {
      localStorage.setItem(key, JSON.stringify({ payload, timestamp: Date.now() }))
    } catch {
      // Ignore storage errors
    }
  }

  const countries = geoOptionsResponse?.countries || []
  const selectedCountryData = useMemo(
    () => countries.find((country) => country.country_id === selectedCountry),
    [countries, selectedCountry],
  )
  const regionOptions = selectedCountryData?.regions || []
  const currentFilters: Filters = useMemo(
    () => ({
      geo: computedGeo || '',
      timeRange,
    }),
    [computedGeo, timeRange],
  )
  const handleCountryChange = useCallback(
    async (value: string) => {
      setSharedState({
        selectedCountry: value,
        selectedRegion: '',
      })

      // Save to database
      try {
        await fetch('/api/trends/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_country: value,
            selected_region: null, // Clear region when country changes
            is_custom: true,
          }),
        })
      } catch (error) {
        // Silently fail - preferences saving shouldn't block UI
        console.warn('[trends] Failed to save country preference:', error)
      }
    },
    [setSharedState],
  )

  const handleRegionChange = useCallback(
    async (value: string) => {
      setSharedState({ selectedRegion: value })

      // Save to database
      try {
        const countryToSave = selectedCountry || ''
        await fetch('/api/trends/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_country: countryToSave,
            selected_region: value || null,
            is_custom: true,
          }),
        })
      } catch (error) {
        // Silently fail - preferences saving shouldn't block UI
        console.warn('[trends] Failed to save region preference:', error)
      }
    },
    [setSharedState, selectedCountry],
  )

  const handleCategoryChange = useCallback(
    async (value: string) => {
      setSharedState({ selectedCategory: value })

      // Save to database
      try {
        await fetch('/api/trends/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_category: value || null,
            is_custom: true,
          }),
        })
      } catch (error) {
        // Silently fail - preferences saving shouldn't block UI
        console.warn('[trends] Failed to save category preference:', error)
      }
    },
    [setSharedState],
  )

  const handleCategorySelect = useCallback(
    async (category: string) => {
      const newCategory = selectedCategory === category ? '' : category
      setSharedState((prev) => ({
        selectedCategory: newCategory,
      }))

      // Save to database
      try {
        await fetch('/api/trends/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selected_category: newCategory || null,
            is_custom: true,
          }),
        })
      } catch (error) {
        // Silently fail - preferences saving shouldn't block UI
        console.warn('[trends] Failed to save category preference:', error)
      }
    },
    [setSharedState, selectedCategory],
  )
  useEffect(() => {
    if (!selectedCountry || !countries.length) return
    const country = countries.find((country) => country.country_id === selectedCountry)
    if (!country) {
      setSharedState({
        selectedCountry: '',
        selectedRegion: '',
      })
      return
    }
    if (selectedRegion && !country.regions.some((region) => region.geo_id === selectedRegion)) {
      setSharedState({ selectedRegion: '' })
    }
  }, [selectedCountry, selectedRegion, countries, setSharedState])

  useEffect(() => {
    if (!computedGeo) {
      return
    }

    const requestId = ++latestRequestRef.current
    const fetchFilters: Filters = {
      geo: computedGeo,
      timeRange,
    }

    const cacheKey = getCacheKey(fetchFilters)
    const filterSignature = `${fetchFilters.geo}|${fetchFilters.timeRange}`
    const filtersChanged = filterSignature !== lastFilterSignatureRef.current

    const cachedPayload = getCachedData(cacheKey)

    // If we have cached data, use it immediately (especially important for expanded view)
    if (cachedPayload) {
      setTrendsState({ loading: false, error: null, payload: cachedPayload })
      setDetailError(null)
      // Only reset index if filters actually changed
      if (filtersChanged) {
        setSharedState({ currentTrendIndex: 0, lastFilterSignature: filterSignature })
      }
    } else {
      // No cache, show loading state
      setTrendsState((prev) => ({ ...prev, loading: true, error: null }))
      setDetailError(null)
    }

    if (cachedPayload) {
      // Valid local cache already hydrated the UI, so no need to hit the API
      return
    }

    const fetchData = async () => {
      try {
        const response = await fetch('/api/trends/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fetchFilters),
          cache: 'no-store',
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.details || 'Failed to fetch trend data')
        }

        const payload = (await response.json()) as TrendsPayload
        if (requestId !== latestRequestRef.current) return

        // Cache the payload
        setCachedData(cacheKey, payload)

        setTrendsState({ loading: false, error: null, payload })
        // Only reset index if filters actually changed
        if (filtersChanged) {
          setSharedState({ currentTrendIndex: 0, lastFilterSignature: filterSignature })
        }
      } catch (error: any) {
        if (requestId !== latestRequestRef.current) return
        
        // On error, if we have cached data, keep using it
        if (cachedPayload) {
          setTrendsState({ loading: false, error: null, payload: cachedPayload })
        } else {
          setTrendsState({
            loading: false,
            error: error?.message || 'Unable to load trends',
            payload: null,
          })
        }
      }
    }

    // Always fetch fresh data in background, but use cache immediately if available
    fetchData()
  }, [computedGeo, timeRange, setSharedState])

  useEffect(() => {
    let cancelled = false

    const loadGeoOptions = async () => {
      setOptionsLoading(true)
      setOptionsError(null)
      try {
        // First, try to load saved preferences
        let savedPreferences: {
          selected_country?: string | null
          selected_region?: string | null
          time_range?: string
          selected_category?: string | null
        } | null = null

        try {
          const prefsResponse = await fetch('/api/trends/preferences', {
            cache: 'no-store',
          })
          if (prefsResponse.ok) {
            const prefsData = await prefsResponse.json()
            if (prefsData.preferences) {
              savedPreferences = prefsData.preferences
            }
          }
        } catch (prefsError) {
          // Ignore preferences fetch errors, fall back to IP-based detection
          console.warn('[trends] Failed to load saved preferences:', prefsError)
        }

        // Get timezone from browser
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        const response = await fetch('/api/trends/geo', {
          cache: 'no-store',
          headers: {
            'x-timezone': timezone
          }
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.details || 'Geo lookup failed')
        }
        const payload = (await response.json()) as GeoOptionsResponse
        if (cancelled) return
        setGeoOptionsResponse(payload)

        // Priority: saved preferences > IP-based detection > default
        let inferredCountry: string
        let inferredRegion: string = ''
        let inferredTimeRange: string = 'past_24_hours'

        if (savedPreferences) {
          // Use saved preferences (is_custom = true)
          inferredCountry = savedPreferences.selected_country || 
            payload.defaultRegion?.split('-')[0] ||
            payload.defaultCountry ||
            payload.defaultGeo?.split('-')[0] ||
            payload.countries?.[0]?.country_id ||
            'US'
          inferredRegion = savedPreferences.selected_region || ''
          inferredTimeRange = savedPreferences.time_range || 'past_24_hours'
        } else {
          // Fall back to IP-based detection
          inferredCountry =
            payload.defaultRegion?.split('-')[0] ||
            payload.defaultCountry ||
            payload.defaultGeo?.split('-')[0] ||
            payload.countries?.[0]?.country_id ||
            'US'
          inferredRegion = payload.defaultRegion || ''
          inferredTimeRange = 'past_24_hours'

          // Save IP-based values as default (is_custom = false)
          try {
            await fetch('/api/trends/preferences', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                selected_country: inferredCountry,
                selected_region: inferredRegion,
                time_range: inferredTimeRange,
                selected_category: null,
                is_custom: false,
              }),
            })
          } catch (saveError) {
            // Silently fail - preferences saving shouldn't block UI
            console.warn('[trends] Failed to save default preferences:', saveError)
          }
        }

        // Only set values if not already set (preserve existing state)
        setSharedState((prev) => ({
          selectedCountry: prev.selectedCountry || inferredCountry,
          selectedRegion: prev.selectedRegion || inferredRegion,
          timeRange: prev.timeRange || inferredTimeRange,
          selectedCategory: savedPreferences?.selected_category || prev.selectedCategory || '',
        }))

      } catch (error: any) {
        if (cancelled) return
        setOptionsError(error?.message || 'Failed to load IP based geo')
      } finally {
        if (!cancelled) {
          setOptionsLoading(false)
        }
      }
    }

    loadGeoOptions()
    return () => {
      cancelled = true
    }
  }, [setSharedState])

  const activeFilters = trendsState.payload?.filters || currentFilters

  const processedData = useMemo(() => {
    const rawTrends = trendsState.payload?.data?.trends || []
    if (!rawTrends.length) {
      return null
    }

    const normalizedTrends: TrendItem[] = rawTrends.map((trend) => {
      const newsKey = getNewsCacheKey(activeFilters, trend.news_token)
      return {
        ...trend,
        query: trend.query,
        search_volume_original: trend.search_volume || 0,
        percentage_increase_original: trend.percentage_increase || 0,
        search_volume_display: formatSearchVolume(trend.search_volume || 0),
        percentage_increase_display: formatPercentageIncrease(trend.percentage_increase || 0),
        news: newsKey ? newsCache[newsKey] : undefined,
      }
    })

    return {
      trends: normalizedTrends,
    }
  }, [trendsState.payload, newsCache, activeFilters])

  const categoryOptions = useMemo(() => {
    if (!processedData?.trends?.length) {
      return []
    }
    const set = new Set<string>()
    processedData.trends.forEach((trend) => {
      trend.categories?.forEach((category: string) => {
        if (category) {
          set.add(category)
        }
      })
    })
    return Array.from(set).sort()
  }, [processedData?.trends])

  const filteredTrends = useMemo(() => {
    if (!processedData?.trends?.length) return []
    if (!selectedCategory) return processedData.trends
    return processedData.trends.filter((trend) => trend.categories?.includes(selectedCategory))
  }, [processedData?.trends, selectedCategory])

  useEffect(() => {
    if (typeof window === 'undefined' || !activeFilters) return
    if (!filteredTrends.length) return

    const restoredEntries: Record<string, NewsArticle[]> = {}
    filteredTrends.forEach((trend) => {
      if (!trend.news_token) return
      const cacheKey = getNewsCacheKey(activeFilters, trend.news_token)
      if (!cacheKey) return
      const cached = getCachedNews(cacheKey)
      if (cached && cached.length) {
        restoredEntries[cacheKey] = cached
      }
    })

    if (!Object.keys(restoredEntries).length) return

    setNewsCache((prev) => {
      let hasChanges = false
      const next = { ...prev }
      Object.entries(restoredEntries).forEach(([key, articles]) => {
        if (!next[key]) {
          next[key] = articles
          hasChanges = true
        }
      })
      return hasChanges ? next : prev
    })
  }, [activeFilters, filteredTrends])

  // Preload thumbnails for next few trends
  useEffect(() => {
    if (!filteredTrends.length || !activeFilters) return

    const preloadCount = 2 // Reduced from 5 to minimize API calls
    // Start from next trend (currentTrendIndex + 1) since current is already loading
    const trendsToPreload = filteredTrends.slice(currentTrendIndex + 1, currentTrendIndex + 1 + preloadCount)

    trendsToPreload.forEach((trend) => {
      if (!trend.news_token) return
      const cacheKey = getNewsCacheKey(activeFilters, trend.news_token)

      const inMemory = newsCache[cacheKey]
      if (inMemory) return // Already cached in state

      const cachedArticles = getCachedNews(cacheKey)
      if (cachedArticles) {
        setNewsCache((prev) => (prev[cacheKey] ? prev : { ...prev, [cacheKey]: cachedArticles }))
        return
      }

      if (inFlightNewsRequests.current.has(cacheKey)) return
      inFlightNewsRequests.current.add(cacheKey)

      // Preload news in background
      fetch('/api/trends/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...activeFilters,
          newsToken: trend.news_token,
        }),
        cache: 'no-store',
      })
        .then((res) => res.json())
        .then((payload) => {
          const articles: NewsArticle[] = payload?.data?.news || []
          setCachedNews(cacheKey, articles)
          setNewsCache((prev) => {
            if (prev[cacheKey]) return prev
            return { ...prev, [cacheKey]: articles }
          })
        })
        .catch(() => {
          // Ignore preload errors
        })
        .finally(() => {
          inFlightNewsRequests.current.delete(cacheKey)
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrendIndex, filteredTrends.length, activeFilters?.geo, activeFilters?.timeRange])

  const navigateToTrend = useCallback(
    (index: number) => {
      if (!filteredTrends.length) return
      const validIndex = Math.max(0, Math.min(index, filteredTrends.length - 1))
      setSharedState({
        currentTrendIndex: validIndex,
      })
    },
    [filteredTrends.length, setSharedState],
  )

  // Manual navigation functions
  const goToNextTrend = useCallback(() => {
    if (!filteredTrends.length) return
    setSharedState((prev) => ({
      currentTrendIndex: (prev.currentTrendIndex + 1) % filteredTrends.length,
    }))
  }, [filteredTrends.length, setSharedState])

  const goToPreviousTrend = useCallback(() => {
    if (!filteredTrends.length) return
    setSharedState((prev) => ({
      currentTrendIndex: (prev.currentTrendIndex - 1 + filteredTrends.length) % filteredTrends.length,
    }))
  }, [filteredTrends.length, setSharedState])

  // Swipe detection handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartX.current = touch.clientX
    touchStartY.current = touch.clientY
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    
    const touch = e.touches[0]
    const deltaX = touch.clientX - touchStartX.current
    const deltaY = touch.clientY - touchStartY.current
    
    // If horizontal swipe is dominant, prevent default scrolling
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      e.preventDefault()
    }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) {
      touchStartX.current = null
      touchStartY.current = null
      return
    }

    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStartX.current
    const deltaY = touch.clientY - touchStartY.current
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    // Minimum swipe distance: 50px
    // Horizontal swipe must be dominant
    if (absDeltaX > 50 && absDeltaX > absDeltaY) {
      if (deltaX < 0) {
        // Swipe left → next trend
        goToNextTrend()
      } else {
        // Swipe right → previous trend
        goToPreviousTrend()
      }
    }

    touchStartX.current = null
    touchStartY.current = null
  }, [goToNextTrend, goToPreviousTrend])

  const loadTrendNews = useCallback(
    async (trend: TrendItem) => {
      if (!trend.news_token) return

      const computedFilters = trendsState.payload?.filters || currentFilters
      const cacheKey = getNewsCacheKey(computedFilters, trend.news_token)
      if (!cacheKey) return

      if (newsCache[cacheKey]) return // Already cached

      const cachedArticles = getCachedNews(cacheKey)
      if (cachedArticles) {
        setNewsCache((prev) => (prev[cacheKey] ? prev : { ...prev, [cacheKey]: cachedArticles }))
        return
      }

      if (inFlightNewsRequests.current.has(cacheKey)) return

      setNewsLoadingKey(cacheKey)
      setDetailError(null)
      inFlightNewsRequests.current.add(cacheKey)
      try {
        const response = await fetch('/api/trends/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...computedFilters,
            newsToken: trend.news_token,
          }),
          cache: 'no-store',
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.details || 'Failed to load news')
        }
        const payload = await response.json()
        const articles: NewsArticle[] = payload?.data?.news || []
        setCachedNews(cacheKey, articles)
        setNewsCache((prev) => ({ ...prev, [cacheKey]: articles }))
      } catch (error: any) {
        setDetailError(error?.message || 'Unable to fetch related news')
      } finally {
        inFlightNewsRequests.current.delete(cacheKey)
        setNewsLoadingKey(null)
      }
    },
    [currentFilters, newsCache, trendsState.payload],
  )

  const handleGenerateSummary = useCallback(async () => {
    const trend = filteredTrends[currentTrendIndex]
    if (!trend) return

    // Calculate location string inline
    const countryLabel = countries.find((c) => c.country_id === selectedCountry)?.country_name || 'Select country'
    const regionLabel = regionOptions.find((r) => r.geo_id === selectedRegion)?.geo_description || ''
    const locString = regionLabel
      ? `${countryLabel}, ${regionLabel}`
      : countryLabel === 'Select country'
      ? 'Global'
      : countryLabel

    const deviceLang =
      typeof navigator !== 'undefined' && navigator.language ? navigator.language.split('-')[0].toLowerCase() : 'unknown'
    const summaryRequestKey = [
      deviceLang,
      activeFilters?.geo || '',
      activeFilters?.timeRange || '',
      trend.news_token || '',
      trend.query || '',
      locString,
    ].join('|')

    const cached = summaryResponseCacheRef.current.get(summaryRequestKey)
    if (cached?.summary) {
      setSummaryError(null)
      setSummaryLoading(false)
      setSharedState({
        summaryContent: cached.summary,
        summaryQuestions: cached.questions || [],
      })
      return
    }

    if (inFlightSummaryRequestsRef.current.has(summaryRequestKey)) {
      return
    }
    inFlightSummaryRequestsRef.current.add(summaryRequestKey)

    // Abort any in-flight summary request from previous trend
    summaryAbortControllerRef.current?.abort()
    const controller = new AbortController()
    summaryAbortControllerRef.current = controller

    setSummaryLoading(true)
    setSummaryError(null)
    setQaError(null)
    setQaInput('')
    
    // Reset summary/Q&A for this trend before streaming response.
    setSharedState({
      summaryContent: '',
      summaryQuestions: [],
      conversationHistory: [],
    })

    const applyIfNotStale = (updates: { summaryContent?: string; summaryQuestions?: string[] }) => {
      if (summaryRequestKey !== currentSummaryRequestKeyRef.current) return
      setSharedState(updates)
    }
    
    try {
      const cacheKey = getNewsCacheKey(activeFilters, trend.news_token)
      const newsList = newsCache[cacheKey] || []
      
      const response = await fetch('/api/trends/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trend.query,
          location: locString,
          news: newsList,
          categories: trend.categories || [],
          keywords: trend.keywords || [],
          position: trend.position,
          searchVolume: trend.search_volume_original,
          percentageIncrease: trend.percentage_increase_original,
        }),
        signal: controller.signal,
      })
      
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.details || 'Failed to generate summary')
      }
      
      // Handle JSON streaming response
      if (!response.body) {
        throw new Error('No response body')
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let jsonBuffer = ''
      let hasReceivedData = false
      
      // Stream chunks and parse JSON incrementally
      while (true) {
        const { value, done } = await reader.read()
        
        if (done) break
        
        if (value) {
          // Accumulate chunks into buffer
          jsonBuffer += decoder.decode(value, { stream: true })
          
          // Try to parse JSON after each chunk
          // Google GenAI streams valid partial JSON, so we can parse incrementally
          try {
            const data = JSON.parse(jsonBuffer)
            if (data.summary) {
              applyIfNotStale({ summaryContent: data.summary })
            }
            if (data.questions && Array.isArray(data.questions)) {
              applyIfNotStale({ summaryQuestions: data.questions })
            }
            
            // Stop loading on first valid data
            if (!hasReceivedData && (data.summary || data.questions?.length)) {
              if (summaryRequestKey === currentSummaryRequestKeyRef.current) {
                setSummaryLoading(false)
              }
              hasReceivedData = true
            }
          } catch {
            // JSON is incomplete, wait for more chunks
            // This is expected during streaming
          }
        }
      }
      
      // Final decode and parse
      const finalChunk = decoder.decode()
      if (finalChunk) {
        jsonBuffer += finalChunk
      }
      
      // Final parse attempt
      try {
        const finalData = JSON.parse(jsonBuffer)
        if (finalData.summary) {
          applyIfNotStale({ summaryContent: finalData.summary })
        }
        if (finalData.questions && Array.isArray(finalData.questions)) {
          applyIfNotStale({ summaryQuestions: finalData.questions })
        }

        if (finalData.summary && summaryRequestKey === currentSummaryRequestKeyRef.current) {
          summaryResponseCacheRef.current.set(summaryRequestKey, {
            summary: finalData.summary,
            questions: Array.isArray(finalData.questions) ? finalData.questions : [],
          })
        }
      } catch (error) {
        // If final parse fails, there's an issue with the response
        throw new Error('Failed to parse final JSON response')
      }
      
      if (summaryRequestKey === currentSummaryRequestKeyRef.current) {
        setSummaryLoading(false)
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return
      }
      if (summaryRequestKey === currentSummaryRequestKeyRef.current) {
        setSummaryError(error?.message || 'Unable to generate summary')
        setSummaryLoading(false)
      }
    } finally {
      inFlightSummaryRequestsRef.current.delete(summaryRequestKey)
    }
  }, [filteredTrends, currentTrendIndex, activeFilters, newsCache, countries, selectedCountry, regionOptions, selectedRegion, setSharedState])

  const handleFollowUpQuestion = useCallback(async (question: string) => {
    if (!question.trim() || isQALoading) return
    
    const trend = filteredTrends[currentTrendIndex]
    if (!trend || !summaryContent) return
    
    const countryLabel = countries.find((c) => c.country_id === selectedCountry)?.country_name || 'Select country'
    const regionLabel = regionOptions.find((r) => r.geo_id === selectedRegion)?.geo_description || ''
    const locString = regionLabel 
      ? `${countryLabel}, ${regionLabel}`
      : countryLabel === 'Select country' 
      ? 'Global' 
      : countryLabel
    const followUpRequestKey = [
      typeof navigator !== 'undefined' && navigator.language ? navigator.language.split('-')[0].toLowerCase() : 'unknown',
      activeFilters?.geo || '',
      activeFilters?.timeRange || '',
      trend.news_token || '',
      trend.query || '',
      locString,
    ].join('|')
    
    setIsQALoading(true)
    setQaError(null)
    
    // Add user question to conversation history
    const userMessage = { role: 'user' as const, content: question.trim() }
    const updatedHistory = [...conversationHistory, userMessage]
    setSharedState({ conversationHistory: updatedHistory })
    setQaInput('')
    
    try {
      const cacheKey = getNewsCacheKey(activeFilters, trend.news_token)
      const newsList = newsCache[cacheKey] || []
      
      const response = await fetch('/api/trends/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trend.query,
          location: locString,
          news: newsList,
          categories: trend.categories || [],
          keywords: trend.keywords || [],
          position: trend.position,
          searchVolume: trend.search_volume_original,
          percentageIncrease: trend.percentage_increase_original,
          isFollowUp: true,
          conversationHistory: updatedHistory,
          initialSummary: summaryContent,
        }),
      })
      
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.details || 'Failed to get answer')
      }
      
      // Handle JSON streaming response
      if (!response.body) {
        throw new Error('No response body')
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let jsonBuffer = ''
      let answer = ''
      let followUpQuestions: string[] = []
      
      while (true) {
        const { value, done } = await reader.read()
        
        if (done) break
        
        if (value) {
          jsonBuffer += decoder.decode(value, { stream: true })
          
          try {
            const data = JSON.parse(jsonBuffer)
            if (data.answer) {
              answer = data.answer
            }
            if (data.followUpQuestions && Array.isArray(data.followUpQuestions)) {
              followUpQuestions = data.followUpQuestions
            }
          } catch {
            // JSON is incomplete, wait for more chunks
          }
        }
      }
      
      // Final decode and parse
      const finalChunk = decoder.decode()
      if (finalChunk) {
        jsonBuffer += finalChunk
      }
      
      try {
        const finalData = JSON.parse(jsonBuffer)
        if (finalData.answer) {
          answer = finalData.answer
        }
        if (finalData.followUpQuestions && Array.isArray(finalData.followUpQuestions)) {
          followUpQuestions = finalData.followUpQuestions
        }
      } catch (error) {
        throw new Error('Failed to parse final JSON response')
      }
      
      if (!answer) {
        throw new Error('No answer received')
      }
      
      if (followUpRequestKey !== currentSummaryRequestKeyRef.current) {
        setIsQALoading(false)
        return
      }
      
      const assistantMessage = { role: 'assistant' as const, content: answer }
      setSharedState({ 
        conversationHistory: [...updatedHistory, assistantMessage],
        ...(followUpQuestions.length > 0 ? { summaryQuestions: followUpQuestions } : {})
      })
      
      setIsQALoading(false)
    } catch (error: any) {
      if (followUpRequestKey !== currentSummaryRequestKeyRef.current) {
        setIsQALoading(false)
        return
      }
      setQaError(error?.message || 'Unable to get answer')
      setIsQALoading(false)
      // Keep the user message in history even on error, so user can see their question
      // The history already includes the user message from earlier
    }
  }, [filteredTrends, currentTrendIndex, activeFilters, newsCache, countries, selectedCountry, regionOptions, selectedRegion, summaryContent, conversationHistory, isQALoading, setSharedState])

  const containerStyle = 'relative rounded-[24px] select-none transition-all duration-300 ease-spring-smooth'
  const glassStyle =
    'bg-black/25 backdrop-blur-2xl border border-white/10 shadow-lg font-sans text-white flex flex-col h-full overflow-hidden relative'

  const timeRangeLabel =
    geoOptionsResponse?.timeRangeOptions?.find((option) => option.id === timeRange)?.label || 'Past 24 hours'

  const selectedCountryLabel =
    countries.find((country) => country.country_id === selectedCountry)?.country_name || 'Select country'
  const selectedRegionLabel = regionOptions.find((region) => region.geo_id === selectedRegion)?.geo_description || ''

  // Format Location String for Header
  const locationString = useMemo(() => {
    if (selectedRegionLabel) return `${selectedCountryLabel}, ${selectedRegionLabel}`
    if (selectedCountryLabel === 'Select country') return 'Global'
    return selectedCountryLabel
  }, [selectedCountryLabel, selectedRegionLabel])

  // For iOS Settings Style Filter View
  const currentCountryName = useMemo(
    () => countries.find((c) => c.country_id === selectedCountry)?.country_name || 'Global',
    [countries, selectedCountry],
  )

  const currentRegionName = useMemo(
    () => regionOptions.find((r) => r.geo_id === selectedRegion)?.geo_description || 'All Regions',
    [regionOptions, selectedRegion],
  )

  // Header is currently unused; keep commented for possible reuse.
  // const renderHeader = () => (
  //   <div className="px-5 py-4 flex-shrink-0 border-b border-white/10">
  //     <WidgetHeader
  //       icon={<TrendingUp size={20} className="text-white" />}
  //       title="Trending"
  //       subtitle="Realtime Google trends"
  //     />
  //   </div>
  // )

  const renderFilterToggleButton = (wrapperClassName = 'absolute top-4 right-4 z-30') => (
    <div className={wrapperClassName}>
      <button
        type="button"
        aria-expanded={isFilterExpanded}
        onClick={() => setSharedState((prev) => ({ isFilterExpanded: !prev.isFilterExpanded }))}
        data-onboarding-target="glass-trends-filter-button"
        className="w-12 h-12 flex items-center justify-center rounded-full cursor-pointer"
        style={getAdaptiveGlassStyleBlur()}
        aria-label="Filters"
      >
        {(optionsLoading || trendsState.loading) ? (
          <Loader2 size={24} className="animate-spin text-white" />
        ) : (
          <SlidersHorizontal size={24} className="text-white" />
        )}
      </button>
    </div>
  )

  const renderFilterBar = () => {
    if (!isFilterExpanded) return null

    return (
      <div className="px-4 pb-4 pt-4 bg-white/5 border-b border-white/10 text-[11px]">
        <div className="flex flex-row gap-2">
          <div className="flex-1">
            <label className="block text-white/50 text-[9px] uppercase mb-1">Country</label>
                <select
                  value={selectedCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-1.5 text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-white/40"
            >
              {!selectedCountry && <option value="">Select country</option>}
                  {countries.map((country) => (
                <option key={country.country_id} value={country.country_id} className="text-black">
                      {country.country_name}
                    </option>
                  ))}
                </select>
              </div>
          <div className="flex-1">
            <label className="block text-white/50 text-[9px] uppercase mb-1">Region</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  disabled={!regionOptions.length}
              className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-1.5 text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-white/40 disabled:opacity-50"
            >
              <option value="">All regions</option>
                  {regionOptions.map((region) => (
                <option key={region.geo_id} value={region.geo_id} className="text-black">
                      {region.geo_description}
                    </option>
                  ))}
                </select>
              </div>
          <div className="flex-1">
            <label className="block text-white/50 text-[9px] uppercase mb-1">Time</label>
                <select
                  value={timeRange}
                  onChange={async (e) => {
                    const newTimeRange = e.target.value
                    setSharedState({ timeRange: newTimeRange })
                    // Save to database
                    try {
                      await fetch('/api/trends/preferences', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          time_range: newTimeRange,
                          is_custom: true,
                        }),
                      })
                    } catch (error) {
                      // Silently fail - preferences saving shouldn't block UI
                      console.warn('[trends] Failed to save time range preference:', error)
                    }
                  }}
              className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-1.5 text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-white/40"
                >
                  {(geoOptionsResponse?.timeRangeOptions || [
                    { id: 'past_4_hours', label: 'Past 4 hours' },
                    { id: 'past_24_hours', label: 'Past 24 hours' },
                    { id: 'past_48_hours', label: 'Past 48 hours' },
                    { id: 'past_7_days', label: 'Past 7 days' },
                  ]).map((option) => (
                <option key={option.id} value={option.id} className="text-black">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
          <div className="flex-1">
            <label className="block text-white/50 text-[9px] uppercase mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  disabled={!categoryOptions.length}
              className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-1.5 text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-white/40 disabled:opacity-40"
            >
              <option value="">All categories</option>
                  {categoryOptions.map((category: string) => (
                <option key={category} value={category} className="text-black">
                      {formatCategoryLabel(category)}
                    </option>
                  ))}
                </select>
          </div>
        </div>
      </div>
    )
  }

  const renderFilterStatus = () => {
    if (!optionsError && !trendsState.error) {
      return null
    }

    return (
      <div className="px-5 py-2 text-[11px]">
        {optionsError && <p className="text-amber-200">{optionsError}</p>}
        {trendsState.error && <p className="text-red-200 mt-1">{trendsState.error}</p>}
      </div>
    )
  }

  const renderEmptyState = () => null

  // Render navigation arrows
  const renderNavigationArrows = () => {
    // 필터링 후 트렌드가 1개 이하면 버튼 숨김
    if (!filteredTrends.length || filteredTrends.length <= 1 || isFilterExpanded || isSingleRow) return null

    return (
      <>
        {/* Left arrow */}
        <button
          onClick={goToPreviousTrend}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full cursor-pointer"
          style={getAdaptiveGlassStyleBlur()}
          aria-label="Previous trend"
        >
          <ChevronLeft size={24} className="text-white" />
        </button>
        
        {/* Right arrow */}
        <button
          onClick={goToNextTrend}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full cursor-pointer"
          style={getAdaptiveGlassStyleBlur()}
          aria-label="Next trend"
        >
          <ChevronRight size={24} className="text-white" />
        </button>
      </>
    )
  }

  // Get current trend
  const currentTrend = filteredTrends[currentTrendIndex]
  
  // Kick off news + summary requests immediately (parallel) when trend changes.
  // Also pause auto-play by default so we don't churn through summaries every 5s.
  useEffect(() => {
    if (!currentTrend) return

    const trendKey = `${currentTrendIndex}-${lastFilterSignature}`
    if (lastSummaryTrendKeyRef.current === trendKey) return
    lastSummaryTrendKeyRef.current = trendKey

    const countryLabel = countries.find((c) => c.country_id === selectedCountry)?.country_name || 'Select country'
    const regionLabel = regionOptions.find((r) => r.geo_id === selectedRegion)?.geo_description || ''
    const locString = regionLabel
      ? `${countryLabel}, ${regionLabel}`
      : countryLabel === 'Select country'
      ? 'Global'
      : countryLabel

    const deviceLang =
      typeof navigator !== 'undefined' && navigator.language ? navigator.language.split('-')[0].toLowerCase() : 'unknown'
    const summaryRequestKey = [
      deviceLang,
      activeFilters?.geo || '',
      activeFilters?.timeRange || '',
      currentTrend.news_token || '',
      currentTrend.query || '',
      locString,
    ].join('|')

    // Abort any in-flight summary from previous trend so stale responses don't overwrite
    summaryAbortControllerRef.current?.abort()
    currentSummaryRequestKeyRef.current = summaryRequestKey

    // If we already have a cached summary for this exact trend+filters+device language,
    // render it immediately and do not re-request.
    const cached = summaryResponseCacheRef.current.get(summaryRequestKey)
    if (cached?.summary) {
      setSummaryError(null)
      setSummaryLoading(false)
      setSharedState({
        conversationHistory: [],
        summaryContent: cached.summary,
        summaryQuestions: cached.questions || [],
      })
      void loadTrendNews(currentTrend)
      return
    }

    setSharedState({
      conversationHistory: [],
      summaryContent: '',
      summaryQuestions: [],
    })

    void loadTrendNews(currentTrend)
    void handleGenerateSummary()
  }, [
    currentTrend,
    currentTrendIndex,
    lastFilterSignature,
    activeFilters?.geo,
    activeFilters?.timeRange,
    loadTrendNews,
    handleGenerateSummary,
    setSharedState,
    countries,
    selectedCountry,
    regionOptions,
    selectedRegion,
  ])

  useEffect(() => {
    if (previousCategoryRef.current !== selectedCategory) {
      setSharedState({ currentTrendIndex: 0 })
    }
    previousCategoryRef.current = selectedCategory
  }, [selectedCategory, setSharedState])

  useEffect(() => {
    if (!filteredTrends.length) {
      // When data hasn't loaded yet, preserve the current index
      return
    }
    if (currentTrendIndex >= filteredTrends.length) {
      setSharedState({ currentTrendIndex: 0 })
    }
  }, [filteredTrends.length, currentTrendIndex, setSharedState])

  // Render Filter View (iOS Settings Style) - 헤더 아래에서 확장
  const renderFilterView = (headerHeight?: string) => (
    <div
      className={`
        absolute inset-0 ${headerHeight || 'top-[73px]'} px-6 py-2 flex flex-col
        transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
        ${
          isFilterExpanded
            ? 'opacity-100 scale-100 translate-y-0 visible'
            : 'opacity-0 scale-[0.98] translate-y-4 invisible pointer-events-none'
        }
      `}
    >
      {/* 부드러운 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 py-2">
        {/* Section: Time */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/30 ml-1">
            Time Frame
          </span>
          <TextSegmentedControl
            value={timeRange}
            onChange={async (val) => {
              setSharedState({ timeRange: val })
              // Save to database
              try {
                await fetch('/api/trends/preferences', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    time_range: val,
                    is_custom: true,
                  }),
                })
              } catch (error) {
                // Silently fail - preferences saving shouldn't block UI
                console.warn('[trends] Failed to save time range preference:', error)
              }
            }}
            options={(geoOptionsResponse?.timeRangeOptions || [
              { id: 'past_4_hours', label: '4 Hours' },
              { id: 'past_24_hours', label: 'Today' },
              { id: 'past_7_days', label: 'Week' },
              { id: 'today 1-m', label: 'Month' },
            ]).map((opt) => {
              // Special handling for "Past 7 days" to show as "Week"
              if (opt.id === 'past_7_days') {
                return { id: opt.id, label: 'Week' }
              }
              // Transform other labels: "Past X hours/days" → "X Hours/Days"
              return {
                id: opt.id,
                label: opt.label
                  .replace('Past ', '')
                  .replace(' hours', ' Hours')
                  .replace(' days', ' Days')
                  .replace(' hour', ' Hour'),
              }
            })}
          />
        </div>

        {/* Section: Location (iOS Settings Style) */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/30 ml-1 mb-2 block">
            Region
          </span>
          <div className="bg-white/5 rounded-[24px] px-4 backdrop-blur-sm border border-white/5">
            {/* Country Selector */}
            <div className="relative">
              <select
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                value={selectedCountry}
                onChange={(e) => handleCountryChange(e.target.value)}
              >
                <option value="" className="text-black">Global</option>
                {countries.map((c) => (
                  <option key={c.country_id} value={c.country_id} className="text-black">
                    {c.country_name}
                  </option>
                ))}
              </select>
              <SettingRow label="Country" value={currentCountryName} />
            </div>

            {/* Region Selector (조건부 렌더링) */}
            <div
              className={`
                relative transition-all duration-300 overflow-hidden
                ${selectedCountry && regionOptions.length > 0 ? 'max-h-20 opacity-100 border-t border-white/5' : 'max-h-0 opacity-0'}
              `}
            >
              <select
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                value={selectedRegion}
                onChange={(e) => handleRegionChange(e.target.value)}
              >
                <option value="" className="text-black">All Regions</option>
                {regionOptions.map((r) => (
                  <option key={r.geo_id} value={r.geo_id} className="text-black">
                    {r.geo_description}
                  </option>
                ))}
              </select>
              <SettingRow label="Region" value={currentRegionName} />
            </div>
          </div>
        </div>

        {/* Section: Category (Search List 유지) */}
        {/* 하단 고정 버튼(Reset / Done)에 가리지 않도록 충분한 여백 확보 */}
        <div className="space-y-3 pb-32">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white/30 ml-1">
            Topics
          </span>
          <div className="grid grid-cols-2 gap-3">
            {categoryOptions.length > 0 ? (
              <>
                <button
                  onClick={async () => {
                    setSharedState({ selectedCategory: '' })
                    // Save to database
                    try {
                      await fetch('/api/trends/preferences', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          selected_category: null,
                          is_custom: true,
                        }),
                      })
                    } catch (error) {
                      // Silently fail - preferences saving shouldn't block UI
                      console.warn('[trends] Failed to save category preference:', error)
                    }
                  }}
                  className={`
                    px-4 py-3 rounded-xl text-left transition-all duration-200 border cursor-pointer
                    ${
                      !selectedCategory
                        ? 'bg-white/10 border-white/20 text-white shadow-lg'
                        : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5 hover:text-white/70'
                    }
                  `}
                >
                  <span className="text-[14px] font-medium">All Topics</span>
                </button>
                {categoryOptions.map((category: string) => (
                  <button
                    key={category}
                    onClick={() => handleCategorySelect(category)}
                    className={`
                      px-4 py-3 rounded-xl text-left transition-all duration-200 border cursor-pointer
                      ${
                        selectedCategory === category
                          ? 'bg-white/10 border-white/20 text-white shadow-lg'
                          : 'bg-transparent border-white/5 text-white/40 hover:bg-white/5 hover:text-white/70'
                      }
                    `}
                  >
                    <span className="text-[14px] font-medium">{formatCategoryLabel(category)}</span>
                  </button>
                ))}
              </>
            ) : (
              <span className="text-sm text-white/50">No categories available</span>
            )}
          </div>
        </div>

        {renderFilterStatus()}
      </div>

      {/* Bottom Action (Fixed) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/20 to-transparent space-y-3">
        <button
          onClick={async () => {
            // Reset to default (IP-based detection)
            try {
              await fetch('/api/trends/preferences', {
                method: 'DELETE',
              })
              // Reload geo options to get IP-based defaults
              const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
              const response = await fetch('/api/trends/geo', {
                cache: 'no-store',
                headers: {
                  'x-timezone': timezone
                }
              })
              if (response.ok) {
                const payload = (await response.json()) as GeoOptionsResponse
                const inferredCountry =
                  payload.defaultRegion?.split('-')[0] ||
                  payload.defaultCountry ||
                  payload.defaultGeo?.split('-')[0] ||
                  payload.countries?.[0]?.country_id ||
                  'US'
                const inferredRegion = payload.defaultRegion || ''
                setSharedState({
                  selectedCountry: inferredCountry,
                  selectedRegion: inferredRegion,
                  timeRange: 'past_24_hours',
                  selectedCategory: '',
                })
              }
            } catch (error) {
              console.warn('[trends] Failed to reset to defaults:', error)
            }
          }}
          className="w-full py-3.5 text-white rounded-xl text-[14px] font-bold tracking-tight cursor-pointer"
          style={getAdaptiveGlassStyleBlur()}
        >
          Reset to Default
        </button>
        <button
          onClick={() => {
            setSharedState({ isFilterExpanded: false })
          }}
          className="w-full py-3.5 bg-white text-black rounded-xl text-[14px] font-bold tracking-tight hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  )

  // Show loading or empty state
  if (!processedData?.trends?.length) {
    if (trendsState.loading) {
      return (
        <div ref={setContainerElement} className={`${containerStyle} w-full h-full relative`}>
          <div className={glassStyle}>
            {/* {renderHeader()} */}
            {renderFilterToggleButton()}
            <div className="relative flex-1 min-h-0">
              {/* Loading Content */}
              <div
                className={`
                  absolute inset-0 flex items-center justify-center text-white/70 gap-2
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  ${isFilterExpanded ? 'opacity-0 scale-[0.98] translate-y-4 pointer-events-none' : 'opacity-100 scale-100 translate-y-0'}
                `}
              >
                <Loader2 size={16} className="animate-spin" />
              </div>
              {/* Filter View */}
              {renderFilterView()}
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className={`${containerStyle} w-full h-full relative`}>
        <div className={glassStyle}>
          {/* {renderHeader()} */}
          {renderFilterToggleButton()}
          <div className="relative flex-1 min-h-0 overflow-hidden">
            {/* Empty State Content */}
            <div
              className={`
                absolute inset-0 overflow-y-auto
                transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                ${isFilterExpanded ? 'opacity-0 scale-[0.98] translate-y-4 pointer-events-none' : 'opacity-100 scale-100 translate-y-0'}
              `}
            >
              {renderFilterStatus()}
              {renderEmptyState()}
            </div>
            {/* Filter View */}
            {renderFilterView()}
          </div>
        </div>
      </div>
    )
  }

  if (!filteredTrends.length) {
    return (
      <div ref={setContainerElement} className={`${containerStyle} w-full h-full relative`}>
        <div className={glassStyle}>
          {/* {renderHeader()} */}
          {renderFilterToggleButton()}
          <div className="relative flex-1 min-h-0 overflow-hidden">
            {/* Empty State Content */}
            <div
              className={`
                absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white/70 gap-3
                transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                ${isFilterExpanded ? 'opacity-0 scale-[0.98] translate-y-4 pointer-events-none' : 'opacity-100 scale-100 translate-y-0'}
              `}
            >
              <p className="text-sm font-medium">
                No realtime trends found.
              </p>
              <button
                onClick={async () => {
                  setSharedState({ selectedCategory: '' })
                  // Save to database
                  try {
                    await fetch('/api/trends/preferences', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        selected_category: null,
                        is_custom: true,
                      }),
                    })
                  } catch (error) {
                    // Silently fail - preferences saving shouldn't block UI
                    console.warn('[trends] Failed to save category preference:', error)
                  }
                }}
                className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-white/20 text-white text-sm hover:bg-white/10 transition-colors cursor-pointer"
              >
                Clear category filter
              </button>
            </div>
            {/* Filter View */}
            {renderFilterView()}
          </div>
        </div>
      </div>
    )
  }

  if (currentTrend) {
    const cacheKey = getNewsCacheKey(activeFilters, currentTrend.news_token)
    const newsList = newsCache[cacheKey] || []
    const heroNews = newsList[0]
    const backgroundImage =
      heroNews?.thumbnail ||
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80'
    const relatedTopics = currentTrend.keywords?.slice(0, 6) || []
    const trendCategories = currentTrend.categories?.length ? currentTrend.categories : []

    return (
      <div 
        ref={(el) => {
          setContainerElement(el)
          ;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        }}
        className="relative w-full h-full overflow-hidden bg-black  text-white flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {renderNavigationArrows()}
        <div className="absolute inset-0 z-0 bg-black" style={{ 
          left: '-1px',
          right: '-1px',
          top: '-1px',
          bottom: '-1px',
        }}>
          <img
            src={backgroundImage}
            alt="Background"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/80 to-black" />
        </div>

        {/* <div className="relative z-20 px-6 pt-6">
          <WidgetHeader
            icon={<TrendingUp className="text-white" size={22} />}
            title="Trending"
            subtitle={undefined}
          />
        </div> */}

        <div className={`flex-1 flex flex-col min-h-0 relative ${isFullscreen ? 'max-w-3xl mx-auto w-full' : 'w-full'}`}>
        <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
          {/* Trend Content */}
          <div
            className={`
              absolute inset-0 overflow-y-auto flex flex-col px-6
              ${isFullscreen ? 'justify-start pt-24 pb-12' : ''}
              transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
              ${isFilterExpanded ? 'opacity-0 scale-[0.98] translate-y-4 pointer-events-none' : 'opacity-100 scale-100 translate-y-0'}
            `}
          >
          <div className={isFullscreen ? 'max-w-3xl mx-auto w-full' : 'w-full'}>
          <div className={`flex items-center gap-4 ${isFullscreen ? 'mt-0' : 'mt-4'}`}>
            <span className="text-6xl sm:text-7xl font-black tracking-tight text-white leading-none">
              {selectedCategory ? currentTrendIndex + 1 : currentTrend.position}
            </span>
            <div className="flex flex-1 items-end justify-between gap-3">
              <div className="flex flex-col mb-2">
                <span className="text-xs uppercase tracking-[0.2em] text-white/70 font-semibold">
                  Trending in
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-white/50 truncate max-w-[200px]">
                  {locationString}
                </span>
              </div>
              {renderFilterToggleButton('relative flex-shrink-0')}
            </div>
          </div>

          <div className="mt-4 mb-6">
            <h1 
              className="text-5xl font-black tracking-tight leading-none break-keep text-balance"
              style={{ wordBreak: 'keep-all' }}
            >
              {currentTrend.query}
            </h1>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Topics</h3>
              {selectedCategory && (
                <span className="text-[10px] text-white/40 font-medium">
                  • {formatCategoryLabel(selectedCategory)}
                </span>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-6 px-6 no-scrollbar snap-x">
              {categoryOptions.length ? (
                <>
                  {/* "All" 버튼 */}
                  <button
                    onClick={async () => {
                      setSharedState({ selectedCategory: '' })
                      try {
                        await fetch('/api/trends/preferences', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            selected_category: null,
                            is_custom: true,
                          }),
                        })
                      } catch (error) {
                        console.warn('[trends] Failed to save category preference:', error)
                      }
                    }}
                    className={`
                      px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer
                      whitespace-nowrap snap-center shrink-0
                      ${selectedCategory === '' 
                        ? 'bg-white/15 text-white border border-white/30' 
                        : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/8 hover:text-white/70'
                      }
                    `}
                  >
                    All
                  </button>
                  {/* 선택된 카테고리 (All 바로 우측에 배치) */}
                  {selectedCategory && categoryOptions.includes(selectedCategory) && (
                    <button
                      onClick={() => handleCategorySelect(selectedCategory)}
                      className={`
                        px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer
                        whitespace-nowrap snap-center shrink-0
                        bg-white/15 text-white border border-white/30
                      `}
                    >
                      {formatCategoryLabel(selectedCategory)}
                    </button>
                  )}
                  {/* 나머지 카테고리들 (선택된 것 제외) */}
                  {categoryOptions
                    .filter((category: string) => category !== selectedCategory)
                    .map((category: string) => {
                      const isInCurrentTrend = trendCategories.includes(category)
                      return (
                        <button
                          key={`chip-${category}`}
                          onClick={() => handleCategorySelect(category)}
                          className={`
                            px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 cursor-pointer
                            whitespace-nowrap snap-center shrink-0
                            ${isInCurrentTrend
                              ? 'bg-white/8 text-white/80 border border-white/15 hover:bg-white/12'
                              : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/8 hover:text-white/70'
                            }
                          `}
                        >
                          {formatCategoryLabel(category)}
                        </button>
                      )
                    })}
                </>
              ) : (
                <span className="text-[13px] text-white/40">No categories available</span>
              )}
            </div>
          </div>

          {/* Summary + Q&A (main content) */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Summary</h3>
              <button
                onClick={handleGenerateSummary}
                disabled={summaryLoading}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/80 text-xs hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Refresh summary"
              >
                Refresh
              </button>
            </div>

            {summaryLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 bg-white/5 border border-white/10 rounded-[24px]">
                <Loader2 size={18} className="animate-spin text-white/60" />
                <span className="text-white/60 text-sm">Generating summary...</span>
              </div>
            ) : summaryError ? (
              <div className="py-8 text-center bg-white/5 border border-white/10 rounded-[24px]">
                <p className="text-red-300 text-sm mb-4">{summaryError}</p>
                <button
                  onClick={handleGenerateSummary}
                  className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-all cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            ) : summaryContent ? (
              <div className="space-y-6">
                {/* Summary content */}
                <div className="prose prose-invert max-w-none text-white/90 bg-white/5 border border-white/10 rounded-[24px] p-5">
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                      h1: ({ children }) => <h1 className="text-2xl font-bold mt-4 mb-3">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-bold mt-4 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-bold mt-3 mb-2">{children}</h3>,
                      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-white/20 pl-4 my-4 italic">{children}</blockquote>
                      ),
                      code: ({ children }) => <code className="px-1.5 py-0.5 rounded bg-white/10 text-sm">{children}</code>,
                      pre: ({ children }) => <pre className="bg-white/5 rounded-lg p-4 overflow-x-auto mb-2">{children}</pre>,
                    }}
                  >
                    {preprocessBoldMarkdown(summaryContent)}
                  </ReactMarkdown>
                </div>

                {/* Conversation History */}
                {(conversationHistory.length > 0 || isQALoading || qaError) && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white/70">Q&A</h3>
                    {conversationHistory.map((message, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col gap-2 ${
                          message.role === 'user' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-[24px] px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-white/10 text-white'
                              : 'bg-white/5 text-white/90 border border-white/10'
                          }`}
                        >
                          {message.role === 'assistant' ? (
                            <div className="prose prose-invert max-w-none text-sm">
                              <ReactMarkdown
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                  p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                                  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                  em: ({ children }) => <em className="italic">{children}</em>,
                                  ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  code: ({ children }) => <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs">{children}</code>,
                                }}
                              >
                                {preprocessBoldMarkdown(message.content)}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm">{message.content}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {isQALoading && (
                      <div className="flex flex-col gap-2 items-start">
                        <div className="max-w-[85%] rounded-[24px] px-4 py-3 bg-white/5 text-white/90 border border-white/10">
                          <div className="flex items-center gap-1">
                            <span className="flex gap-0.5">
                              <span
                                className="inline-block w-1 h-1 bg-white/60 rounded-full animate-bounce"
                                style={{ animationDelay: '0ms' }}
                              ></span>
                              <span
                                className="inline-block w-1 h-1 bg-white/60 rounded-full animate-bounce"
                                style={{ animationDelay: '150ms' }}
                              ></span>
                              <span
                                className="inline-block w-1 h-1 bg-white/60 rounded-full animate-bounce"
                                style={{ animationDelay: '300ms' }}
                              ></span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {qaError && (
                      <div className="text-red-300 text-sm px-4 py-2 bg-red-500/10 rounded-xl border border-red-500/20">
                        {qaError}
                      </div>
                    )}
                  </div>
                )}

                {/* Follow-up Questions */}
                {summaryQuestions.length > 0 && (
                  <div className="pt-2">
                    <h3 className="text-sm font-semibold text-white/70 mb-3">Follow-up Questions</h3>
                    <div className="space-y-2">
                      {summaryQuestions.map((question, idx) => (
                        <div
                          key={idx}
                          className="futuristic-input relative w-full transition-colors duration-300 py-1.5 outline-none min-h-[32px] cursor-pointer"
                          style={{
                            ...getAdaptiveGlassStyleBlur(),
                            boxShadow: 'none',
                            paddingLeft: '1rem',
                            paddingRight: '3rem',
                            overflow: 'visible',
                            overflowY: 'visible',
                            maxHeight: 'none',
                            height: 'auto',
                          }}
                          onClick={() => {
                            handleFollowUpQuestion(question)
                          }}
                        >
                          <div
                            className="text-sm sm:text-base font-normal text-white"
                            style={{
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word',
                              whiteSpace: 'pre-wrap',
                              lineHeight: '1.3',
                            }}
                          >
                            <ReactMarkdown
                              rehypePlugins={[rehypeRaw]}
                              components={{
                                p: ({ children }) => <span>{children}</span>,
                                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                em: ({ children }) => <em className="italic">{children}</em>,
                              }}
                            >
                              {preprocessBoldMarkdown(question)}
                            </ReactMarkdown>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleFollowUpQuestion(question)
                            }}
                            className="absolute right-1 bottom-[3px] sm:bottom-1.5 w-8 h-6 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer bg-[var(--chat-input-primary)] text-[var(--chat-input-primary-foreground)] hover:scale-105 active:scale-95"
                            aria-label="Send question"
                          >
                            <SendIcon className="transition-transform duration-300" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Q&A Input */}
                <div className="pt-2">
                  <div className="relative flex items-center gap-2">
                    <input
                      type="text"
                      value={qaInput}
                      onChange={(e) => setQaInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          if (qaInput.trim()) {
                            handleFollowUpQuestion(qaInput)
                          }
                        }
                      }}
                      placeholder="Ask a follow-up question..."
                      disabled={isQALoading}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    />
                    <button
                      onClick={() => {
                        if (qaInput.trim() && !isQALoading) {
                          handleFollowUpQuestion(qaInput)
                        }
                      }}
                      disabled={!qaInput.trim() || isQALoading}
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer bg-[var(--chat-input-primary)] text-[var(--chat-input-primary-foreground)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Send question"
                    >
                      {isQALoading ? <Loader2 size={16} className="animate-spin" /> : <SendIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center bg-white/5 border border-white/10 rounded-[24px]">
                <p className="text-sm text-white/60">Summary will appear here shortly.</p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-bold mb-3">Latest News</h3>
            {detailError && <p className="text-sm text-red-300 mb-2">{detailError}</p>}
            {newsList.length === 0 && !detailError ? (
              <p className="text-sm text-white/50">No news available for this trend yet.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6 snap-x">
                {newsList.map((news, idx) => {
                  const CardWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
                    news.link ? (
                      <a
                        href={news.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="snap-center shrink-0 w-[260px] no-underline"
                      >
                        {children}
                      </a>
                    ) : (
                      <div className="snap-center shrink-0 w-[260px]">{children}</div>
                    )

                  return (
                    <CardWrapper key={idx}>
                      <div className="bg-white/5 border border-white/10 rounded-[24px] overflow-hidden backdrop-blur-sm active:scale-95 transition-transform duration-200 cursor-pointer">
                        <div className="h-32 w-full relative">
                          {news.thumbnail ? (
                            <img src={news.thumbnail} alt={news.title} className="w-full h-full object-cover" />
                          ) : ( 
                            <div className="w-full h-full bg-white/10" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                          <div className="absolute bottom-2 left-3 right-3 flex items-center gap-1.5">
                            <span className="text-[10px] font-medium text-white/90 truncate">
                              {news.source || 'Unknown'}
                            </span>
                            <span className="text-[10px] text-white/50">• {formatTimeAgo(news.iso_date || '')}</span>
                          </div>
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium leading-snug line-clamp-2 text-white/90">{news.title}</p>
                        </div>
                      </div>
                    </CardWrapper>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-bold mb-3">Related Queries</h3>
            <div className="flex flex-wrap gap-2">
              {relatedTopics.length === 0 && <p className="text-sm text-white/50">No related queries provided.</p>}
              {relatedTopics.map((topic, idx) => (
                <span
                  key={idx}
                  className="px-4 py-2 rounded-full bg-white/10 border border-white/5 text-sm font-medium text-white/80"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
          </div>
          </div>
          {/* Filter View - iOS Settings Style (Cross-fade) */}
          {renderFilterView('top-0')}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 pt-0 bg-gradient-to-t from-black via-black/90 to-transparent z-30 flex justify-center" />
        </div>
        
        {/* Onboarding Tooltip */}
        <OnboardingRenderer
          location="quick-access"
          context={{ widgetId: stableWidgetId }}
          displayTypes={['tooltip']}
          hideWhen={isFilterExpanded || isSingleRow}
          scopeRef={containerRef}
          scopeElement={containerElement}
          elevateForOverlay={isFullscreen}
        />
      </div>
    )
  }

  // Fallback: should not reach here
  return (
    <div ref={setContainerElement} className={`${containerStyle} w-full h-full`}>
      <div className={glassStyle}>
        {/* {renderHeader()} */}
        {renderFilterToggleButton()}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {renderFilterBar()}
          {renderFilterStatus()}
          {renderEmptyState()}
        </div>
      </div>
    </div>
  )
}

