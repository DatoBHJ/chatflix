import { NextRequest, NextResponse } from 'next/server'

import { getCachedJSON, setCachedJSON } from '@/lib/redis-json'
import {
  NEWS_CACHE_TTL_SECONDS,
  buildNewsCacheKey,
  getCacheExpiryIso,
  hashNewsToken,
} from '@/lib/trends/cache'
import { normalizeTrendFilters } from '@/lib/trends/filters'

const SEARCH_API_KEY = process.env.SEARCH_API_KEY
const SEARCH_API_URL = 'https://www.searchapi.io/api/v1/search'

type NewsCacheEntry = {
  payload: any
  cachedAt: string
  cacheExpiresAt: string
}

const fetchNewsData = async (newsToken: string) => {
  if (!SEARCH_API_KEY) {
    throw new Error('SEARCH_API_KEY is not configured')
  }

  const params = new URLSearchParams({
    engine: 'google_trends_trending_now_news',
    news_token: newsToken,
    api_key: SEARCH_API_KEY,
  })

  const response = await fetch(`${SEARCH_API_URL}?${params.toString()}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`SearchAPI news request failed: ${response.status} ${text}`)
  }

  return response.json()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const newsToken = body?.newsToken

    if (!newsToken) {
      return NextResponse.json(
        { error: 'newsToken is required' },
        { status: 400 },
      )
    }

    const { geo, timeRange } = normalizeTrendFilters(body || {})
    const newsTokenHash = hashNewsToken(newsToken)
    const cacheKey = buildNewsCacheKey({ geo, timeRange, newsToken })

    let cacheEntry = await getCachedJSON<NewsCacheEntry>(cacheKey)
    let fromCache = true

    if (!cacheEntry) {
      const payload = await fetchNewsData(newsToken)
      const cachedAt = new Date().toISOString()
      const cacheExpiresAt = getCacheExpiryIso(NEWS_CACHE_TTL_SECONDS)
      cacheEntry = { payload, cachedAt, cacheExpiresAt }
      await setCachedJSON(cacheKey, cacheEntry, NEWS_CACHE_TTL_SECONDS)
      fromCache = false
    }

    return NextResponse.json({
      filters: { geo, timeRange, newsTokenHash },
      cacheKey,
      fromCache,
      cachedAt: cacheEntry.cachedAt,
      cacheExpiresAt: cacheEntry.cacheExpiresAt,
      articlesCount: cacheEntry.payload?.news?.length || 0,
      data: cacheEntry.payload,
    })
  } catch (error: any) {
    console.error('[trends/news] error', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch news for trend',
        details: error?.message || 'Unknown error',
      },
      { status: 500 },
    )
  }
}

