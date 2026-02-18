import { createHash } from 'crypto'

export const GEO_CACHE_TTL_SECONDS = 60 * 30 // 30 minutes
export const TRENDS_CACHE_TTL_SECONDS = 60 * 30
export const NEWS_CACHE_TTL_SECONDS = 60 * 30

type CacheFilters = {
  geo: string
  timeRange: string
}

export const hashIp = (ip?: string | null) => {
  const normalized = ip?.trim() || 'unknown'
  return createHash('sha1').update(normalized).digest('hex')
}

export const hashNewsToken = (token: string) => {
  return createHash('sha1').update(token).digest('hex')
}

export const buildIpInfoCacheKey = (ip?: string | null) => {
  const ipHash = hashIp(ip)
  return `ipinfo:${ipHash}`
}

/** Redis key for cached language code from Accept-Language header (TTL 7 days) */
export const LANGUAGE_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

export const buildLanguageCacheKey = (acceptLanguage: string) => {
  const normalized = (acceptLanguage || '').trim() || 'unknown'
  const h = createHash('sha1').update(normalized).digest('hex')
  return `trends:lang:${h}`
}

export const buildTrendsCacheKey = ({ geo, timeRange }: CacheFilters) => {
  return `trends:${geo.toUpperCase()}:${timeRange}`
}

export const buildNewsCacheKey = ({
  geo,
  timeRange,
  newsToken,
}: CacheFilters & { newsToken: string }) => {
  const newsTokenHash = hashNewsToken(newsToken)
  return `news:${geo.toUpperCase()}:${timeRange}:${newsTokenHash}`
}

export const getCacheExpiryIso = (ttlSeconds: number, now = Date.now()) => {
  return new Date(now + ttlSeconds * 1000).toISOString()
}

