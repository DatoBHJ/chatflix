import { useCallback, useSyncExternalStore } from 'react'

type GlassTrendsSharedState = {
  currentTrendIndex: number
  isFilterExpanded: boolean
  isListOpen: boolean
  isAutoPlaying: boolean
  selectedCategory: string
  selectedCountry: string
  selectedRegion: string
  timeRange: string
  lastFilterSignature: string
  isSummaryExpanded: boolean
  summaryContent: string
  summaryQuestions: string[]
  conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>
}

const defaultState: GlassTrendsSharedState = {
  currentTrendIndex: 0,
  isFilterExpanded: false,
  isListOpen: false,
  isAutoPlaying: true,
  selectedCategory: '',
  selectedCountry: '',
  selectedRegion: '',
  timeRange: 'past_24_hours',
  lastFilterSignature: '',
  isSummaryExpanded: false,
  summaryContent: '',
  summaryQuestions: [],
  conversationHistory: [],
}

type Listener = () => void
type SharedStateUpdate =
  | Partial<GlassTrendsSharedState>
  | ((prev: GlassTrendsSharedState) => Partial<GlassTrendsSharedState>)

const store = new Map<string, GlassTrendsSharedState>()
const listeners = new Map<string, Set<Listener>>()

const getState = (widgetId: string) => {
  if (!store.has(widgetId)) {
    store.set(widgetId, { ...defaultState })
  }
  return store.get(widgetId)!
}

const setState = (widgetId: string, update: SharedStateUpdate) => {
  const prev = getState(widgetId)
  const patch = typeof update === 'function' ? update(prev) : update
  const next = { ...prev, ...patch }
  store.set(widgetId, next)
  listeners.get(widgetId)?.forEach((listener) => listener())
}

const subscribe = (widgetId: string, listener: Listener) => {
  let widgetListeners = listeners.get(widgetId)
  if (!widgetListeners) {
    widgetListeners = new Set()
    listeners.set(widgetId, widgetListeners)
  }
  widgetListeners.add(listener)
  return () => {
    widgetListeners?.delete(listener)
    if (widgetListeners?.size === 0) {
      listeners.delete(widgetId)
    }
  }
}

export const useGlassTrendsSharedState = (widgetId?: string) => {
  const stableId = widgetId || 'glass-trends-widget'

  const snapshot = useSyncExternalStore(
    (listener) => subscribe(stableId, listener),
    () => getState(stableId),
    () => getState(stableId),
  )

  const update = useCallback(
    (updateAction: SharedStateUpdate) => {
      setState(stableId, updateAction)
    },
    [stableId],
  )

  return [snapshot, update] as const
}

export type { GlassTrendsSharedState, SharedStateUpdate }

