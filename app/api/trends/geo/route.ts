import { NextRequest, NextResponse } from 'next/server'

import { getCachedJSON, setCachedJSON } from '@/lib/redis-json'
import {
  GEO_CACHE_TTL_SECONDS,
  buildIpInfoCacheKey,
  getCacheExpiryIso,
} from '@/lib/trends/cache'
import { TIME_RANGE_OPTIONS, getCountryGroups, getGeoOptions } from '@/lib/trends/options'
import { updateUserLocale } from '@/lib/user-locale'
import { createClient } from '@/utils/supabase/server'

type IpInfoPayload = {
  country?: string
  region?: string
  region_code?: string
  [key: string]: any
}

type IpInfoCacheEntry = {
  geo: string
  payload: IpInfoPayload
  resolvedAt: string
  cacheExpiresAt: string
}

const IPINFO_TOKEN = process.env.INFO_TOKEN || process.env.IPINFO_TOKEN

const isPrivateIp = (ip?: string | null) => {
  if (!ip) return true
  if (ip === '::1' || ip === '127.0.0.1') return true
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.')) {
    return true
  }
  return false
}

const extractClientIp = (req: NextRequest) => {
  const headerCandidates = [
    req.headers.get('x-client-ip'),
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    req.headers.get('x-real-ip'),
  ]

  return headerCandidates.find(Boolean) || null
}

const resolveGeoFromIpinfo = (payload: IpInfoPayload) => {
  const country = payload.country?.toUpperCase()
  const regionCode = payload.region_code?.toUpperCase()

  if (country && regionCode) {
    return `${country}-${regionCode}`
  }

  return country || 'US'
}

const fetchIpinfo = async (ip?: string | null): Promise<IpInfoPayload> => {
  if (!IPINFO_TOKEN) {
    throw new Error('INFO_TOKEN (or IPINFO_TOKEN) is not configured')
  }

  const baseUrl = 'https://ipinfo.io'
  const path = !ip || isPrivateIp(ip) ? '/json' : `/${ip}/json`
  const url = `${baseUrl}${path}?token=${IPINFO_TOKEN}`

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const msg = await response.text()
    throw new Error(`IPinfo request failed: ${response.status} ${msg}`)
  }

  return response.json()
}

export async function GET(req: NextRequest) {
  try {
    const geoOptions = await getGeoOptions()
    const countryGroups = await getCountryGroups()
    const clientIp = extractClientIp(req)
    const cacheKey = buildIpInfoCacheKey(clientIp)

    let cached = await getCachedJSON<IpInfoCacheEntry>(cacheKey)

    if (!cached) {
      const payload = await fetchIpinfo(clientIp)
      const geo = resolveGeoFromIpinfo(payload)
      const resolvedAt = new Date().toISOString()
      const cacheExpiresAt = getCacheExpiryIso(GEO_CACHE_TTL_SECONDS)

      cached = { payload, geo, resolvedAt, cacheExpiresAt }
      await setCachedJSON(cacheKey, cached, GEO_CACHE_TTL_SECONDS)
    }

    // Update all_user table with locale information for logged-in users
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Extract locale information from request headers
        const acceptLanguage = req.headers.get('accept-language')?.split(',')[0]?.split(';')[0]?.trim()
        const timezone = req.headers.get('x-timezone') || cached.payload.timezone

        await updateUserLocale(supabase, user.id, {
          country: cached.payload.country,
          region: cached.payload.region,
          geo: cached.geo,
          timezone: timezone,
          language: acceptLanguage
        })
      }
    } catch (localeError) {
      // Don't fail the request if locale update fails
      console.warn('[trends/geo] Failed to update user locale:', localeError)
    }

    const defaultCountry = cached.geo.split('-')[0]
    const defaultRegion = cached.geo.includes('-') ? cached.geo : null

    return NextResponse.json({
      clientIp,
      defaultGeo: cached.geo,
      defaultCountry,
      defaultRegion,
      ipinfo: cached.payload,
      resolvedAt: cached.resolvedAt,
      cacheExpiresAt: cached.cacheExpiresAt,
      geoOptions,
      countries: countryGroups,
      timeRangeOptions: TIME_RANGE_OPTIONS,
      geoCount: geoOptions.length,
    })
  } catch (error: any) {
    console.error('[trends/geo] error', error)
    return NextResponse.json(
      {
        error: 'Failed to resolve geo information',
        details: error?.message || 'Unknown error',
      },
      { status: 500 },
    )
  }
}

