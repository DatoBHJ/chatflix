// JSON 파일을 직접 import하여 Vercel 서버리스 환경에서도 동작하도록 함
import geoData from './data/geo-options.json'

export type GeoOption = {
  geo_id: string
  geo_description: string
  type: 'country' | 'region'
  parent_geo_id: string | null
}

export type CountryWithRegions = {
  country_id: string
  country_name: string
  regions: Array<{
    geo_id: string
    geo_description: string
  }>
}

let cachedGeoOptions: GeoOption[] | null = null
let cachedCountryGroups: CountryWithRegions[] | null = null

export const TIME_RANGE_OPTIONS = [
  { id: 'past_4_hours', label: 'Past 4 hours' },
  { id: 'past_24_hours', label: 'Past 24 hours' },
  { id: 'past_48_hours', label: 'Past 48 hours' },
  { id: 'past_7_days', label: 'Past 7 days' },
]

export async function getGeoOptions(): Promise<GeoOption[]> {
  if (cachedGeoOptions) {
    return cachedGeoOptions
  }

  const parsed: Array<{ geo_id: string; geo_description: string }> = geoData

  cachedGeoOptions = parsed.map((option) => {
    const parts = option.geo_id.split('-')
    const isRegion = parts.length > 1
    const parent = isRegion ? parts[0] : null

    return {
      ...option,
      type: isRegion ? 'region' : 'country',
      parent_geo_id: parent,
    }
  })

  return cachedGeoOptions
}

export async function getCountryGroups(): Promise<CountryWithRegions[]> {
  if (cachedCountryGroups) {
    return cachedCountryGroups
  }

  const geoList = await getGeoOptions()
  const grouped = new Map<string, CountryWithRegions>()

  geoList.forEach((option) => {
    if (option.type === 'country') {
      const existing = grouped.get(option.geo_id)
      grouped.set(option.geo_id, {
        country_id: option.geo_id,
        country_name: option.geo_description,
        regions: existing?.regions || [],
      })
      return
    }

    const countryId = option.parent_geo_id || option.geo_id.split('-')[0]
    if (!grouped.has(countryId)) {
      grouped.set(countryId, {
        country_id: countryId,
        country_name: countryId,
        regions: [],
      })
    }

    grouped.get(countryId)!.regions.push({
      geo_id: option.geo_id,
      geo_description: option.geo_description,
    })
  })

  cachedCountryGroups = Array.from(grouped.values()).sort((a, b) =>
    a.country_name.localeCompare(b.country_name),
  )

  cachedCountryGroups.forEach((country) => {
    country.regions.sort((a, b) => a.geo_description.localeCompare(b.geo_description))
  })

  return cachedCountryGroups
}

