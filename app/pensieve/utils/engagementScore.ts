/**
 * Engagement 스코어 계산 유틸리티
 */

/**
 * Engagement 스코어 계산
 * @param likes 좋아요 수
 * @param views 조회수
 * @param comments 댓글 수
 * @returns Engagement 스코어
 */
export function calculateEngagementScore(
  likes: number,
  views: number,
  comments: number
): number {
  return likes * 3 + views * 0.5 + comments * 2
}

/**
 * 시간 Freshness 보너스 계산
 * 최근 콘텐츠에 가중치를 부여하여 신선도를 반영
 * @param createdDate 생성일 (ISO string)
 * @returns Freshness 보너스 점수
 */
export function calculateTimeFreshnessBonus(createdDate: string): number {
  const daysSinceCreation = (Date.now() - new Date(createdDate).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceCreation <= 7) return 10
  if (daysSinceCreation <= 30) return 5
  return 0
}

// 페이지 로드 시마다 새로운 시드 생성 (모듈 레벨)
let pageSeed: number | null = null

/**
 * 페이지 로드 시드 가져오기
 * 새로고침할 때마다 새로운 시드가 생성됨
 * @returns 0-1 사이의 랜덤 시드 값
 */
export function getPageLoadSeed(): number {
  if (pageSeed === null) {
    pageSeed = Math.random()
  }
  return pageSeed
}

/**
 * 아이템별 랜덤 값 생성
 * 페이지 로드 시드와 아이템 ID를 조합하여 각 아이템마다 랜덤 값 생성
 * 새로고침할 때마다 다른 순서가 됨
 * @param itemId 아이템 ID
 * @returns 0-1 사이의 랜덤 값
 */
export function getItemRandomValue(itemId: string): number {
  const seed = getPageLoadSeed()
  
  // 아이템 ID를 해시하여 숫자로 변환
  let hash = 0
  for (let i = 0; i < itemId.length; i++) {
    const char = itemId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  // 해시를 0-1 사이 값으로 정규화
  const hashValue = Math.abs(hash) % 10000 / 10000
  
  // 페이지 시드와 해시를 조합하여 새로운 값 생성
  // 시드가 바뀌면 전체 순서가 섞임
  const combined = (seed * 7919 + hashValue * 104729) % 1
  return combined
}
