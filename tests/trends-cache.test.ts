import test from 'node:test'
import assert from 'node:assert/strict'

import {
  GEO_CACHE_TTL_SECONDS,
  NEWS_CACHE_TTL_SECONDS,
  TRENDS_CACHE_TTL_SECONDS,
  buildIpInfoCacheKey,
  buildNewsCacheKey,
  buildTrendsCacheKey,
  getCacheExpiryIso,
  hashIp,
  hashNewsToken,
} from '@/lib/trends/cache'

const filters = {
  geo: 'us',
  timeRange: 'past_4_hours',
}

test('buildTrendsCacheKey normalizes filters', () => {
  const key = buildTrendsCacheKey(filters)
  assert.equal(key, 'trends:US:past_4_hours')
})

test('buildNewsCacheKey includes hashed newsToken', () => {
  const newsToken = 'mock-token-123'
  const key = buildNewsCacheKey({ ...filters, newsToken })
  const expectedHash = hashNewsToken(newsToken)
  assert.ok(key.startsWith('news:US:past_4_hours:'))
  assert.equal(key.split(':').pop(), expectedHash)
})

test('hashNewsToken produces deterministic sha1', () => {
  const a = hashNewsToken('token-a')
  const b = hashNewsToken('token-a')
  const c = hashNewsToken('token-b')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.equal(a.length, 40)
})

test('buildIpInfoCacheKey uses hashed IP', () => {
  const key1 = buildIpInfoCacheKey('127.0.0.1')
  const key2 = buildIpInfoCacheKey('127.0.0.1')
  const key3 = buildIpInfoCacheKey('192.168.1.1')
  assert.ok(key1.startsWith('ipinfo:'))
  assert.equal(key1, key2) // Same IP should produce same hash
  assert.notEqual(key1, key3) // Different IPs should produce different hashes
  assert.equal(key1.split(':').pop()?.length, 40) // SHA1 hash is 40 chars
})

test('hashIp produces deterministic sha1', () => {
  const a = hashIp('127.0.0.1')
  const b = hashIp('127.0.0.1')
  const c = hashIp('192.168.1.1')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.equal(a.length, 40)
})

test('hashIp handles blank values', () => {
  const hash1 = hashIp('')
  const hash2 = hashIp(null)
  const hash3 = hashIp('unknown')
  assert.equal(hash1, hash2) // Both should hash 'unknown'
  assert.notEqual(hash1, hash3)
})

test('getCacheExpiryIso respects TTL', () => {
  const now = Date.UTC(2025, 0, 1)
  const expiry = getCacheExpiryIso(GEO_CACHE_TTL_SECONDS, now)
  const diffSeconds = (new Date(expiry).getTime() - now) / 1000
  assert.equal(diffSeconds, GEO_CACHE_TTL_SECONDS)
})

test('TTL constants are aligned', () => {
  assert.equal(GEO_CACHE_TTL_SECONDS, 1800)
  assert.equal(TRENDS_CACHE_TTL_SECONDS, 1800)
  assert.equal(NEWS_CACHE_TTL_SECONDS, 1800)
})

