/**
 * Pensieve 관련 상수 정의
 */

/**
 * pensieve_curated에서 이미지를 표시하지 않을 항목 ID 목록
 * 이 ID를 가진 항목은:
 * - 갤러리에서 필터링되어 표시되지 않음
 * - 직접 URL 접근 시 404 반환
 * - 중복 제거에는 포함됨 (tweetIds 기준)
 */
export const PENSIEVE_CURATED_EXCLUDED_IDS: readonly string[] = [
  'c83a48cd-f3d5-460d-aeb6-e1b6279641ce',
  'ecfe63bc-6d82-43fc-a865-b17f4840f58f', // Story context description, not image generation prompt
  '36746a80-c934-4b45-b11d-02422c7ac797', // Story context description, not image generation prompt
  'f84b673f-660c-42c1-a455-2985e1c49214', // Model/style description and review, not image generation prompt
  '7a4e9776-e650-483b-b0f1-d26f6b723c54', // Search query prompt, not image generation prompt
  '4b12c020-5a75-4d5d-95d4-002bd9abf556', // Too short and vague prompt: "Gyaru, she is wearing heavy makeup.😊"
  'bbebb6ca-9214-4e88-9d49-4a8c350e1eb5', // Text generation prompt: {"task": "write a thread", ...}
  '84ebd960-0ee1-4b42-b158-b2f3e467be69', // Text generation prompt: {"task": "recommend books", ...}
]

/**
 * 벤된 트위터 ID 목록
 * 이 트위터 ID에서 온 항목들은:
 * - 검색 결과에서 제외
 * - LLM 필터링 단계에서 제외
 * - 중복 제거 단계에서 제외
 * - 완전히 처리되지 않음 (평생 벤)
 */
export const PENSIEVE_CURATED_BANNED_TWEET_IDS: readonly string[] = [
  '2004881597141782716', // Text generation prompt: {"task": "write a thread", ...}
  '2004881638556401999', // Text generation prompt: {"task": "recommend books", ...}
]

// 하위 호환성을 위한 별칭 (점진적 마이그레이션용)
export const X_SEARCH_EXCLUDED_IDS = PENSIEVE_CURATED_EXCLUDED_IDS

