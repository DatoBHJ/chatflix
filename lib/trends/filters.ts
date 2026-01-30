import { TIME_RANGE_OPTIONS } from './options'

const ALLOWED_TIMES = new Set(TIME_RANGE_OPTIONS.map((option) => option.id))

export type TrendFilterInput = {
  geo: string
  timeRange?: string
}

export const normalizeTrendFilters = ({ geo, timeRange }: TrendFilterInput) => {
  if (!geo) {
    throw new Error('geo is required')
  }

  const normalizedTime = ALLOWED_TIMES.has(timeRange || '') ? (timeRange as string) : 'past_24_hours'

  return {
    geo: geo.toUpperCase(),
    timeRange: normalizedTime,
  }
}

export { ALLOWED_TIMES }

