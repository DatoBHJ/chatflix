import { useCallback, useSyncExternalStore } from 'react'

type OnThisDaySharedState = {
  selectedLanguage: string
  positions: Record<string, number>
  isAutoPlaying: boolean
  isSummaryExpanded: boolean
  summaryContent: string
  summaryQuestions: string[]
  conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>
}

type SharedStateUpdate =
  | Partial<OnThisDaySharedState>
  | ((prev: OnThisDaySharedState) => Partial<OnThisDaySharedState>)

const store = new Map<string, OnThisDaySharedState>()
const listeners = new Map<string, Set<() => void>>()

const ensureState = (widgetId: string, defaultLanguage: string) => {
  if (!store.has(widgetId)) {
    store.set(widgetId, {
      selectedLanguage: defaultLanguage,
      positions: {},
      isAutoPlaying: true,
      isSummaryExpanded: false,
      summaryContent: '',
      summaryQuestions: [],
      conversationHistory: [],
    })
  }
}

const getState = (widgetId: string) => {
  return store.get(widgetId)!
}

const setState = (widgetId: string, update: SharedStateUpdate) => {
  const prev = getState(widgetId)
  const patch = typeof update === 'function' ? update(prev) : update
  const next = { ...prev, ...patch }
  store.set(widgetId, next)
  listeners.get(widgetId)?.forEach((listener) => listener())
}

const subscribe = (widgetId: string, listener: () => void) => {
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

export const useOnThisDaySharedState = (widgetId?: string, defaultLanguage = 'en') => {
  const stableId = widgetId || 'onthisday-widget'
  ensureState(stableId, defaultLanguage)

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

export type { OnThisDaySharedState, SharedStateUpdate }


