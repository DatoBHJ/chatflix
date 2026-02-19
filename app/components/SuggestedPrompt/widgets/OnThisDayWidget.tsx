import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

import { WidgetBaseProps } from './index'
import { loadMemoryWithCache } from '@/app/utils/memory-cache-client'
import { createClient } from '@/utils/supabase/client'
import { OnThisDaySlide, useOnThisDayData } from './useOnThisDayData'
// import { WidgetHeader } from './WidgetHeader'
import { useOnThisDaySharedState } from './useOnThisDaySharedState'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'

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

const FALLBACK_LANGUAGE = 'en'

// 볼드체 패턴을 HTML 태그로 변환하는 함수
// react-markdown이 따옴표나 특수 문자가 포함된 볼드체를 잘 처리하지 못하는 경우를 해결
const preprocessBoldMarkdown = (content: string): string => {
  if (!content) return '';
  
  // 볼드체 패턴(**...**)을 찾아서 HTML <strong> 태그로 변환
  // 볼드체는 **로 시작하고 **로 끝나며, 내부에 **가 없어야 함 (단일 *는 허용)
  const boldPattern = /\*\*((?:[^*]|\*(?!\*))+)\*\*/g;
  return content.replace(boldPattern, '<strong>$1</strong>');
}

const SUPPORTED_WIKIMEDIA_LANGUAGES = new Set([
  'en',
  'de',
  'fr',
  'sv',
  'pt',
  'es',
  'ar',
  'bs',
  'uk',
  'it',
  'tr',
  'zh',
])

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  sv: 'Svenska',
  pt: 'Português',
  es: 'Español',
  ar: 'العربية',
  bs: 'Bosanski',
  uk: 'Українська',
  it: 'Italiano',
  tr: 'Türkçe',
  zh: '中文',
}

const FALLBACK_BACKGROUNDS = [
  'linear-gradient(135deg, rgba(37, 99, 235, 0.85), rgba(147, 51, 234, 0.85))',
  'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(59, 130, 246, 0.85))',
  'linear-gradient(135deg, rgba(180, 83, 9, 0.85), rgba(217, 70, 239, 0.85))',
  'linear-gradient(135deg, rgba(6, 78, 59, 0.85), rgba(14, 165, 233, 0.85))',
]

function getWikimediaLanguageCode(): string {
  if (typeof navigator === 'undefined') {
    return FALLBACK_LANGUAGE
  }

  const preferredLocales =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language]

  for (const locale of preferredLocales) {
    if (!locale) continue
    const normalized = locale.toLowerCase()
    if (SUPPORTED_WIKIMEDIA_LANGUAGES.has(normalized)) {
      return normalized
    }
    const base = normalized.split('-')[0]
    if (SUPPORTED_WIKIMEDIA_LANGUAGES.has(base)) {
      return base
    }
  }

  return FALLBACK_LANGUAGE
}

const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const getFallbackBackground = (slide?: OnThisDaySlide) => {
  if (!slide) {
    return FALLBACK_BACKGROUNDS[0]
  }
  const index = hashString(slide.id) % FALLBACK_BACKGROUNDS.length
  return FALLBACK_BACKGROUNDS[index]
}

const STORAGE_PREFIX = 'onthisday:index:'

interface OnThisDayWidgetProps extends WidgetBaseProps {
  onPromptClick?: (prompt: string) => void;
  isFullscreen?: boolean;
}

export function OnThisDayWidget({ widgetId, onPromptClick, isFullscreen = false, isDarkMode }: OnThisDayWidgetProps) {
  const defaultLanguage = useMemo(() => getWikimediaLanguageCode(), [])
  const [sharedState, setSharedState] = useOnThisDaySharedState(widgetId, defaultLanguage)
  const selectedLanguage = sharedState.selectedLanguage || defaultLanguage
  const currentIndex = sharedState.positions[selectedLanguage] ?? 0
  const {
    summaryContent,
    summaryQuestions,
    conversationHistory,
  } = sharedState
  const lastSummarySlideKeyRef = useRef<string | null>(null)
  const summaryResponseCacheRef = useRef<Map<string, { summary: string; questions: string[] }>>(new Map())
  const inFlightSummaryRequestsRef = useRef<Set<string>>(new Set())
  const currentSummaryRequestKeyRef = useRef<string | null>(null)
  const summaryAbortControllerRef = useRef<AbortController | null>(null)
  const { slides, loading, error } = useOnThisDayData(selectedLanguage)
  const currentSlide = slides[currentIndex]
  const [isSingleRow, setIsSingleRow] = useState(false)
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  
  // Summary state (loading and error remain local as they are transient)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  
  // Q&A conversation state (loading and error remain local as they are transient)
  const [isQALoading, setIsQALoading] = useState(false)
  const [qaError, setQaError] = useState<string | null>(null)
  const [qaInput, setQaInput] = useState<string>('')

  // 🚀 최적화: 위젯 마운트 시 메모리 미리 로드 (localStorage 캐싱)
  useEffect(() => {
    const preloadMemory = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id) {
          // personal-core만 미리 로드 (위젯에서 사용하는 카테고리)
          await loadMemoryWithCache(user.id, ['00-personal-core'])
          console.log('⚡ [OnThisDayWidget] Memory preloaded on mount')
        }
      } catch (error) {
        console.warn('Failed to preload memory in OnThisDayWidget:', error)
      }
    }
    preloadMemory()
  }, [])
  
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
  
  const canNavigate = slides.length > 1

  const setCurrentIndexForLanguage = useCallback(
    (nextIndex: number) => {
      setSharedState((prev) => ({
        positions: {
          ...prev.positions,
          [selectedLanguage]: Math.max(0, Math.min(nextIndex, Math.max(slides.length - 1, 0))),
        },
      }))
    },
    [selectedLanguage, setSharedState, slides.length],
  )

  const goToNext = useCallback(() => {
    if (!canNavigate) return
    const nextIndex = (currentIndex + 1) % slides.length
    setCurrentIndexForLanguage(nextIndex)
  }, [canNavigate, currentIndex, slides.length, setCurrentIndexForLanguage])

  const goToPrevious = useCallback(() => {
    if (!canNavigate) return
    const nextIndex = (currentIndex - 1 + slides.length) % slides.length
    setCurrentIndexForLanguage(nextIndex)
  }, [canNavigate, currentIndex, slides.length, setCurrentIndexForLanguage])

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
        // Swipe left → next slide
        goToNext()
      } else {
        // Swipe right → previous slide
        goToPrevious()
      }
    }

    touchStartX.current = null
    touchStartY.current = null
  }, [goToNext, goToPrevious])

  const backgroundStyle = useMemo(() => {
    if (currentSlide?.thumbnail) {
      return undefined
    }
    return getFallbackBackground(currentSlide)
  }, [currentSlide])

  useEffect(() => {
    if (!slides.length) return
    if (currentIndex >= slides.length) {
      setCurrentIndexForLanguage(0)
    }
  }, [slides.length, currentIndex, setCurrentIndexForLanguage])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const key = `${STORAGE_PREFIX}${selectedLanguage}`
    window.localStorage.setItem(key, String(currentIndex))
  }, [currentIndex, selectedLanguage])

  const sharedIndex = sharedState.positions[selectedLanguage]
  useEffect(() => {
    if (sharedIndex !== undefined) {
      return
    }
    if (typeof window === 'undefined') {
      return
    }
    const key = `${STORAGE_PREFIX}${selectedLanguage}`
    const stored = window.localStorage.getItem(key)
    if (stored === null) {
      return
    }
    const parsed = Number(stored)
    if (!Number.isFinite(parsed)) {
      return
    }
    setCurrentIndexForLanguage(parsed)
  }, [selectedLanguage, sharedIndex, setCurrentIndexForLanguage])

  // Render navigation arrows
  const renderNavigationArrows = () => {
    if (!canNavigate || isSingleRow) return null

    return (
      <>
        {/* Left arrow */}
        <button
          onClick={goToPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full cursor-pointer"
          style={getAdaptiveGlassStyleBlur()}
          aria-label="Previous story"
        >
          <ChevronLeft size={24} className="text-white" />
        </button>
        
        {/* Right arrow */}
        <button
          onClick={goToNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full cursor-pointer"
          style={getAdaptiveGlassStyleBlur()}
          aria-label="Next story"
        >
          <ChevronRight size={24} className="text-white" />
        </button>
      </>
    )
  }

  const getSummaryRequestKey = useCallback((slide: OnThisDaySlide) => {
    return [
      slide.language || selectedLanguage,
      slide.id || '',
      String(slide.year),
      slide.headline || '',
      slide.title || '',
    ].join('|')
  }, [selectedLanguage])

  const handleGenerateSummary = useCallback(async () => {
    if (!currentSlide) return

    const summaryRequestKey = getSummaryRequestKey(currentSlide)
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

    if (inFlightSummaryRequestsRef.current.has(summaryRequestKey)) return
    inFlightSummaryRequestsRef.current.add(summaryRequestKey)

    summaryAbortControllerRef.current?.abort()
    const controller = new AbortController()
    summaryAbortControllerRef.current = controller

    setSummaryLoading(true)
    setSummaryError(null)
    setQaError(null)
    setQaInput('')
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
      let personalInfoMemory: string | null = null
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          personalInfoMemory = await loadMemoryWithCache(user.id, ['00-personal-core'])
        }
      } catch (error) {
        console.warn('Failed to load memory from cache:', error)
      }

      const response = await fetch('/api/onthisday/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: currentSlide.year,
          headline: currentSlide.headline,
          summary: currentSlide.summary,
          title: currentSlide.title,
          articleUrl: currentSlide.articleUrl,
          language: currentSlide.language,
          personalInfoMemory,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.details || 'Failed to generate summary')
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let jsonBuffer = ''
      let hasReceivedData = false

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) {
          jsonBuffer += decoder.decode(value, { stream: true })
          try {
            const data = JSON.parse(jsonBuffer)
            if (data.summary) applyIfNotStale({ summaryContent: data.summary })
            if (data.questions && Array.isArray(data.questions)) {
              applyIfNotStale({ summaryQuestions: data.questions })
            }
            if (!hasReceivedData && (data.summary || data.questions?.length)) {
              if (summaryRequestKey === currentSummaryRequestKeyRef.current) {
                setSummaryLoading(false)
              }
              hasReceivedData = true
            }
          } catch {
            // JSON incomplete during streaming
          }
        }
      }

      const finalChunk = decoder.decode()
      if (finalChunk) jsonBuffer += finalChunk

      try {
        const finalData = JSON.parse(jsonBuffer)
        if (finalData.summary) applyIfNotStale({ summaryContent: finalData.summary })
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
        throw new Error('Failed to parse final JSON response')
      }

      if (summaryRequestKey === currentSummaryRequestKeyRef.current) {
        setSummaryLoading(false)
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      if (summaryRequestKey === currentSummaryRequestKeyRef.current) {
        setSummaryError(error?.message || 'Unable to generate summary')
        setSummaryLoading(false)
      }
    } finally {
      inFlightSummaryRequestsRef.current.delete(summaryRequestKey)
    }
  }, [currentSlide, getSummaryRequestKey, setSharedState])

  const handleFollowUpQuestion = useCallback(async (question: string) => {
    if (!question.trim() || isQALoading) return

    if (!currentSlide || !summaryContent) return

    const followUpRequestKey = getSummaryRequestKey(currentSlide)

    setIsQALoading(true)
    setQaError(null)

    const userMessage = { role: 'user' as const, content: question.trim() }
    const updatedHistory = [...conversationHistory, userMessage]
    setSharedState({ conversationHistory: updatedHistory })
    setQaInput('')

    try {
      let personalInfoMemory: string | null = null
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          personalInfoMemory = await loadMemoryWithCache(user.id, ['00-personal-core'])
        }
      } catch (error) {
        console.warn('Failed to load memory from cache:', error)
      }
      
      const response = await fetch('/api/onthisday/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: currentSlide.year,
          headline: currentSlide.headline,
          summary: currentSlide.summary,
          title: currentSlide.title,
          articleUrl: currentSlide.articleUrl,
          language: currentSlide.language,
          personalInfoMemory,
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
        ...(followUpQuestions.length > 0 ? { summaryQuestions: followUpQuestions } : {}),
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
  }, [currentSlide, summaryContent, conversationHistory, isQALoading, getSummaryRequestKey, setSharedState])

  // Auto-load summary when slide changes (same pattern as GlassTrendsWidget)
  useEffect(() => {
    if (!currentSlide) return

    const slideKey = `${currentIndex}-${selectedLanguage}-${currentSlide.id || currentSlide.headline}`
    if (lastSummarySlideKeyRef.current === slideKey) return
    lastSummarySlideKeyRef.current = slideKey

    const summaryRequestKey = getSummaryRequestKey(currentSlide)
    summaryAbortControllerRef.current?.abort()
    currentSummaryRequestKeyRef.current = summaryRequestKey

    const cached = summaryResponseCacheRef.current.get(summaryRequestKey)
    if (cached?.summary) {
      setSummaryError(null)
      setSummaryLoading(false)
      setSharedState({
        conversationHistory: [],
        summaryContent: cached.summary,
        summaryQuestions: cached.questions || [],
      })
      return
    }

    setSharedState({
      conversationHistory: [],
      summaryContent: '',
      summaryQuestions: [],
    })

    void handleGenerateSummary()
  }, [
    currentSlide,
    currentIndex,
    selectedLanguage,
    getSummaryRequestKey,
    handleGenerateSummary,
    setSharedState,
  ])

  const renderBody = () => {
    if (loading && !currentSlide) {
      return (
        <div className="flex-1 flex items-center justify-center text-white/70 gap-2">
          <Loader2 size={22} className="animate-spin" />
          <span className="text-sm">Loading moments from history...</span>
        </div>
      )
    }

    if (error && !slides.length) {
      return (
        <div className="flex-1 flex items-center justify-center text-center px-6 text-white/70">
          <p className="text-sm">{error}</p>
        </div>
      )
    }

    if (!currentSlide) {
      return (
        <div className="flex-1 flex items-center justify-center text-center px-6 text-white/70">
          <p className="text-sm">No historical stories for this day yet. Try another language.</p>
        </div>
      )
    }

    return null
  }

  if (!currentSlide) {
    return (
      <div ref={setContainerElement} className="relative w-full h-full overflow-hidden bg-black text-white flex flex-col">
        <div className="relative z-20 flex flex-col h-full min-h-0">
          {/* <div className="px-6 pt-6">
            <WidgetHeader
              icon={<Clock className="text-white" size={22} />}
              title="On This Day"
              subtitle={undefined}
              actions={
                <div className="relative">
                  <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSharedState({ selectedLanguage: e.target.value })}
                    className="pl-9 pr-3 py-2 rounded-full bg-white/10 border border-white/15 text-xs font-semibold appearance-none outline-none backdrop-blur-md"
                  >
                    {Array.from(SUPPORTED_WIKIMEDIA_LANGUAGES).map((code) => (
                      <option key={code} value={code} className="text-black">
                        {LANGUAGE_NAMES[code] || code.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              }
            />
          </div> */}
          {renderBody()}
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={setContainerElement}
      className="relative w-full h-full overflow-hidden bg-black text-white flex flex-col"
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
        }}>        {currentSlide?.thumbnail ? (
          <img
            src={currentSlide.thumbnail}
            alt={currentSlide.title}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-60"
          />
        ) : (
          <div
            className="absolute inset-0 w-full h-full"
            style={{ 
              backgroundImage: backgroundStyle,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/80 to-black" />
      </div>

      {/* <div className="relative z-20 px-6 pt-6">
        <WidgetHeader
          icon={<Clock className="text-white" size={22} />}
          title="On This Day"
          subtitle={undefined}
          actions={
            <div className="relative">
              <select
                value={selectedLanguage}
                onChange={(e) => setSharedState({ selectedLanguage: e.target.value })}
                className="px-4 py-3.5 rounded-full text-xs font-semibold appearance-none outline-none text-white cursor-pointer text-center"
                style={getAdaptiveGlassStyleBlur()}
              >
                {Array.from(SUPPORTED_WIKIMEDIA_LANGUAGES).map((code) => (
                  <option key={code} value={code} className="text-black">
                    {LANGUAGE_NAMES[code] || code.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      </div> */}

      <div className={`flex-1 flex flex-col min-h-0 relative ${isFullscreen ? 'max-w-3xl mx-auto w-full' : 'w-full'}`}>
      <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
        {/* Slide Content + Summary (inline, same as GlassTrendsWidget) */}
        <div
          className={`
            absolute inset-0 overflow-y-auto flex flex-col px-6
            ${isFullscreen ? 'justify-start pt-24 pb-12' : ''}
            transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
            opacity-100 scale-100 translate-y-0
          `}
        >
          <div className={isFullscreen ? 'max-w-3xl mx-auto w-full' : 'w-full'}>
          <div className={`flex items-end justify-between gap-4 ${isFullscreen ? 'mt-0' : 'mt-4'}`}>
            <div className="flex items-end gap-4">
              <span className="text-6xl sm:text-7xl font-black tracking-tight text-white leading-none">
                {currentSlide.year}
              </span>
              <span className="text-xs uppercase tracking-[0.5em] text-white/50 mb-2">On This Day</span>
            </div>
            <button
              onClick={handleGenerateSummary}
              disabled={summaryLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 hover:text-white/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-1"
              aria-label="Refresh translation"
            >
              <RefreshCw size={14} className={summaryLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* 제목·본문 대체: 번역된 콘텐츠로 표시 */}
          {summaryLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 mt-6">
              <Loader2 size={18} className="animate-spin text-white/60" />
              <span className="text-white/60 text-sm">Translating...</span>
            </div>
          ) : summaryError ? (
            <div className="py-12 text-center mt-6">
              <p className="text-red-300 text-sm mb-4">{summaryError}</p>
              <button
                onClick={handleGenerateSummary}
                className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-all cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : summaryContent ? (
              <div className="space-y-6 mt-6">
                {/* 번역된 제목·본문 (원본 대체) */}
                <div className="prose prose-invert max-w-none text-white/90">
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                      h1: ({ children }) => <h1 className="text-4xl font-black tracking-tight leading-[1.05] mt-0 mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-bold mt-6 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>,
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

                {currentSlide.articleUrl && (
                  <a
                    href={currentSlide.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 border border-white/20 text-sm font-semibold w-fit hover:bg-white/25 transition"
                  >
                    <ExternalLink size={16} />
                    Read on Wikipedia
                  </a>
                )}

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
                              <span className="inline-block w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                              <span className="inline-block w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                              <span className="inline-block w-1 h-1 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
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

                {summaryQuestions.length > 0 && (
                  <div className="pt-4 border-t border-white/10 space-y-2">
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
                          onClick={() => handleFollowUpQuestion(question)}
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

                <div className="pt-4">
                  <div className="relative flex items-center gap-2">
                    <input
                      type="text"
                      value={qaInput}
                      onChange={(e) => setQaInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          if (qaInput.trim()) handleFollowUpQuestion(qaInput)
                        }
                      }}
                      placeholder="Ask a follow-up question..."
                      disabled={isQALoading}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    />
                    <button
                      onClick={() => {
                        if (qaInput.trim() && !isQALoading) handleFollowUpQuestion(qaInput)
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
            ) : null}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 pt-0 bg-gradient-to-t from-black via-black/90 to-transparent z-30 flex justify-center" />
      </div>
    </div>
  )
}


