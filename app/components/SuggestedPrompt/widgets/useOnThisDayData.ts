import { useCallback, useEffect, useRef, useState } from 'react'

export type OnThisDaySlide = {
  id: string
  year: number
  headline: string
  summary: string
  title: string
  thumbnail?: string
  articleUrl?: string
  language: string
  hasImage: boolean
}

type WikimediaPage = {
  title?: string
  displaytitle?: string
  extract?: string
  description?: string
  content_urls?: {
    desktop?: { page?: string }
    mobile?: { page?: string }
  }
  titles?: {
    canonical?: string
    normalized?: string
    display?: string
  }
  thumbnail?: {
    source?: string
  }
  originalimage?: {
    source?: string
  }
}

type WikimediaEvent = {
  text: string
  year: number
  pages?: WikimediaPage[]
}

type WikimediaResponse = {
  selected?: WikimediaEvent[]
  events?: WikimediaEvent[]
  births?: WikimediaEvent[]
  deaths?: WikimediaEvent[]
  holidays?: WikimediaEvent[]
}

const CACHE_TTL_MS = 5 * 60 * 1000

type CacheEntry = {
  slides: OnThisDaySlide[]
  expiresAt: number
  fetchedAt: number
}

const inMemoryCache = new Map<string, CacheEntry>()

const getDateParts = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const key = `${now.getFullYear()}-${month}-${day}`
  return { month, day, key }
}

const getPrimaryPage = (pages?: WikimediaPage[]): WikimediaPage | undefined => {
  if (!pages || !pages.length) return undefined
  return pages.find((page) => page.thumbnail?.source) || pages[0]
}

const toSlides = (events: WikimediaEvent[], language: string): OnThisDaySlide[] => {
  return events
    .map((event, index) => {
      const primaryPage = getPrimaryPage(event.pages)
      const thumbnail =
        primaryPage?.thumbnail?.source || primaryPage?.originalimage?.source || undefined

      const title =
        primaryPage?.displaytitle ||
        primaryPage?.titles?.display ||
        primaryPage?.title ||
        event.text

      const summary =
        primaryPage?.extract ||
        event.pages?.find((page) => page.extract)?.extract ||
        event.text

      const articleUrl =
        primaryPage?.content_urls?.desktop?.page || primaryPage?.content_urls?.mobile?.page

      return {
        id: `${event.year}-${index}-${title}`,
        year: event.year,
        headline: event.text,
        summary,
        title,
        thumbnail,
        articleUrl,
        language,
        hasImage: Boolean(thumbnail),
      }
    })
    .filter((slide) => Boolean(slide.headline))
}

type HookState = {
  slides: OnThisDaySlide[]
  loading: boolean
  error: string | null
  lastUpdated: number | null
}

const initialState: HookState = {
  slides: [],
  loading: true,
  error: null,
  lastUpdated: null,
}

export function useOnThisDayData(language: string) {
  const [state, setState] = useState<HookState>(initialState)
  const dateKeyRef = useRef(getDateParts().key)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchSlides = useCallback(
    async (forceRefresh = false) => {
      const { month, day, key } = getDateParts()
      dateKeyRef.current = key
      const cacheKey = `${language}:${key}`
      const now = Date.now()

      if (!forceRefresh) {
        const cached = inMemoryCache.get(cacheKey)
        if (cached && cached.expiresAt > now) {
          setState({
            slides: cached.slides,
            loading: false,
            error: cached.slides.length ? null : 'No events available for today',
            lastUpdated: cached.fetchedAt,
          })
          return
        }
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const response = await fetch(
          `/api/wikimedia/onthisday?language=${language}&type=selected&month=${month}&day=${day}`,
          { signal: controller.signal },
        )

        if (response.status === 404) {
          throw new Error('No events found for today')
        }

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.error || 'Failed to load events')
        }

        const payload = (await response.json()) as WikimediaResponse
        const sourceEvents =
          (payload.selected && payload.selected.length ? payload.selected : payload.events) || []
        const slides = toSlides(sourceEvents, language)
        const fetchedAt = Date.now()

        inMemoryCache.set(cacheKey, {
          slides,
          fetchedAt,
          expiresAt: fetchedAt + CACHE_TTL_MS,
        })

        if (!controller.signal.aborted) {
          setState({
            slides,
            loading: false,
            error: slides.length ? null : 'No events available for today',
            lastUpdated: fetchedAt,
          })
        }
      } catch (error: any) {
        if (controller.signal.aborted) {
          return
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          error: error?.message || 'Failed to load historical events',
        }))
      }
    },
    [language],
  )

  const refresh = useCallback(() => {
    fetchSlides(true)
  }, [fetchSlides])

  useEffect(() => {
    fetchSlides()
  }, [fetchSlides])

  useEffect(() => {
    const interval = setInterval(() => {
      const { key } = getDateParts()
      if (key !== dateKeyRef.current) {
        fetchSlides()
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [fetchSlides])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    slides: state.slides,
    loading: state.loading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    refresh,
  }
}


