import { NextRequest, NextResponse } from 'next/server'

import { getCachedJSON, setCachedJSON } from '@/lib/redis-json'
import {
  TRENDS_CACHE_TTL_SECONDS,
  buildTrendsCacheKey,
  getCacheExpiryIso,
} from '@/lib/trends/cache'
import { normalizeTrendFilters } from '@/lib/trends/filters'

const SEARCH_API_KEY = process.env.SEARCH_API_KEY
const SEARCH_API_URL = 'https://www.searchapi.io/api/v1/search'

type TrendsCacheEntry = {
  payload: any
  cachedAt: string
  cacheExpiresAt: string
}

const fetchTrendingData = async (geo: string, timeRange: string) => {
  if (!SEARCH_API_KEY) {
    throw new Error('SEARCH_API_KEY is not configured')
  }

  const params = new URLSearchParams({
    engine: 'google_trends_trending_now',
    geo,
    time: timeRange,
    api_key: SEARCH_API_KEY,
  })

  const response = await fetch(`${SEARCH_API_URL}?${params.toString()}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`SearchAPI trends request failed: ${response.status} ${text}`)
  }

  return response.json()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { geo, timeRange } = normalizeTrendFilters(body || {})
    const cacheKey = buildTrendsCacheKey({ geo, timeRange })

    let cacheEntry = await getCachedJSON<TrendsCacheEntry>(cacheKey)
    let fromCache = true

    if (!cacheEntry) {
      const payload = await fetchTrendingData(geo, timeRange)
      const cachedAt = new Date().toISOString()
      const cacheExpiresAt = getCacheExpiryIso(TRENDS_CACHE_TTL_SECONDS)
      cacheEntry = { payload, cachedAt, cacheExpiresAt }
      await setCachedJSON(cacheKey, cacheEntry, TRENDS_CACHE_TTL_SECONDS)
      fromCache = false
    }

    return NextResponse.json({
      filters: { geo, timeRange },
      cacheKey,
      fromCache,
      cachedAt: cacheEntry.cachedAt,
      cacheExpiresAt: cacheEntry.cacheExpiresAt,
      trendsCount: cacheEntry.payload?.trends?.length || 0,
      data: cacheEntry.payload,
    })
  } catch (error: any) {
    console.error('[trends/data] error', error)
    const status = error?.message?.includes('required') ? 400 : 500
    return NextResponse.json(
      {
        error: 'Failed to fetch trends data',
        details: error?.message || 'Unknown error',
      },
      { status },
    )
  }
}

