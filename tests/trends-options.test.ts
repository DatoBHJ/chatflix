import test from 'node:test'
import assert from 'node:assert/strict'

import { getCountryGroups } from '@/lib/trends/options'

test('getCountryGroups includes United States regions', async () => {
  const countries = await getCountryGroups()
  const us = countries.find((country) => country.country_id === 'US')
  assert.ok(us, 'United States should exist in geo dataset')
  assert.ok(us!.regions.length >= 50, 'US should expose all state-level regions')
  assert.ok(us!.regions.some((region) => region.geo_id === 'US-CA'))
})

test('getCountryGroups handles countries without regions', async () => {
  const countries = await getCountryGroups()
  const sg = countries.find((country) => country.country_id === 'SG')
  assert.ok(sg, 'Singapore should exist')
  assert.equal(sg!.regions.length, 0, 'Singapore should not have regions')
})

