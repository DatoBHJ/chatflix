// 언어 코드에서 Google Trends geo 코드로의 매핑
export const languageToGeoMapping: Record<string, string> = {
  // 주요 언어 코드와 국가 코드 매핑
  'ar': 'SA',    // 아랍어 -> 사우디아라비아
  'bn': 'BD',    // 벵골어 -> 방글라데시
  'cs': 'CZ',    // 체코어 -> 체코 공화국
  'da': 'DK',    // 덴마크어 -> 덴마크
  'de': 'DE',    // 독일어 -> 독일
  'el': 'GR',    // 그리스어 -> 그리스
  'en': 'US',    // 영어 -> 미국 (기본값)
  'es': 'ES',    // 스페인어 -> 스페인
  'fi': 'FI',    // 핀란드어 -> 핀란드
  'fr': 'FR',    // 프랑스어 -> 프랑스
  'he': 'IL',    // 히브리어 -> 이스라엘
  'hi': 'IN',    // 힌디어 -> 인도
  'hu': 'HU',    // 헝가리어 -> 헝가리
  'id': 'ID',    // 인도네시아어 -> 인도네시아
  'it': 'IT',    // 이탈리아어 -> 이탈리아
  'ja': 'JP',    // 일본어 -> 일본
  'ko': 'KR',    // 한국어 -> 한국
  'nl': 'NL',    // 네덜란드어 -> 네덜란드
  'no': 'NO',    // 노르웨이어 -> 노르웨이
  'pl': 'PL',    // 폴란드어 -> 폴란드
  'pt': 'PT',    // 포르투갈어 -> 포르투갈
  'ro': 'RO',    // 루마니아어 -> 루마니아
  'ru': 'RU',    // 러시아어 -> 러시아
  'sk': 'SK',    // 슬로바키아어 -> 슬로바키아
  'sv': 'SE',    // 스웨덴어 -> 스웨덴
  'th': 'TH',    // 태국어 -> 태국
  'tr': 'TR',    // 터키어 -> 터키
  'uk': 'UA',    // 우크라이나어 -> 우크라이나
  'vi': 'VN',    // 베트남어 -> 베트남
  'zh': 'CN',    // 중국어 -> 중국
  
  // 지역 특정 언어 코드
  'en-US': 'US',   // 미국 영어 -> 미국
  'en-GB': 'GB',   // 영국 영어 -> 영국
  'en-CA': 'CA',   // 캐나다 영어 -> 캐나다
  'en-AU': 'AU',   // 호주 영어 -> 호주
  'en-NZ': 'NZ',   // 뉴질랜드 영어 -> 뉴질랜드
  'es-MX': 'MX',   // 멕시코 스페인어 -> 멕시코
  'es-AR': 'AR',   // 아르헨티나 스페인어 -> 아르헨티나
  'es-CL': 'CL',   // 칠레 스페인어 -> 칠레
  'es-CO': 'CO',   // 콜롬비아 스페인어 -> 콜롬비아
  'es-PE': 'PE',   // 페루 스페인어 -> 페루
  'fr-CA': 'CA',   // 캐나다 프랑스어 -> 캐나다
  'fr-BE': 'BE',   // 벨기에 프랑스어 -> 벨기에
  'fr-CH': 'CH',   // 스위스 프랑스어 -> 스위스
  'pt-BR': 'BR',   // 브라질 포르투갈어 -> 브라질
  'zh-TW': 'TW',   // 대만 중국어 -> 대만
  'zh-HK': 'HK',   // 홍콩 중국어 -> 홍콩
  'zh-SG': 'SG',   // 싱가포르 중국어 -> 싱가포르
};

// 국가 코드에서 국가 이름으로의 매핑 (영어)
export const geoToCountryName: Record<string, string> = {
  'AR': 'Argentina',
  'AU': 'Australia',
  'AT': 'Austria',
  'BE': 'Belgium',
  'BR': 'Brazil',
  'CA': 'Canada',
  'CL': 'Chile',
  'CN': 'China',
  'CO': 'Colombia',
  'CZ': 'Czech Republic',
  'DK': 'Denmark',
  'FI': 'Finland',
  'FR': 'France',
  'DE': 'Germany',
  'GR': 'Greece',
  'HK': 'Hong Kong',
  'HU': 'Hungary',
  'IN': 'India',
  'ID': 'Indonesia',
  'IL': 'Israel',
  'IT': 'Italy',
  'JP': 'Japan',
  'KR': 'South Korea',
  'MY': 'Malaysia',
  'MX': 'Mexico',
  'NL': 'Netherlands',
  'NZ': 'New Zealand',
  'NO': 'Norway',
  'PE': 'Peru',
  'PH': 'Philippines',
  'PL': 'Poland',
  'PT': 'Portugal',
  'RO': 'Romania',
  'RU': 'Russia',
  'SA': 'Saudi Arabia',
  'SG': 'Singapore',
  'SK': 'Slovakia',
  'ZA': 'South Africa',
  'ES': 'Spain',
  'SE': 'Sweden',
  'CH': 'Switzerland',
  'TW': 'Taiwan',
  'TH': 'Thailand',
  'TR': 'Turkey',
  'UA': 'Ukraine',
  'GB': 'United Kingdom',
  'US': 'United States',
  'VN': 'Vietnam',
  'BD': 'Bangladesh',
};

// 브라우저 언어 설정을 기반으로 국가 코드 추출
export function detectCountryFromLanguage(): string {
  // 브라우저 환경이 아닌 경우 기본값 반환
  if (typeof navigator === 'undefined') return 'US';
  
  // 사용자의 선호 언어 가져오기
  const userLanguage = navigator.language || (navigator as any).userLanguage || 'en-US';
  
  // 완전 일치 확인 (예: en-US)
  if (languageToGeoMapping[userLanguage]) {
    return languageToGeoMapping[userLanguage];
  }
  
  // 기본 언어 코드 추출 (예: en-US에서 en)
  const baseLanguage = userLanguage.split('-')[0];
  
  // 기본 언어 코드로 매핑 확인
  if (languageToGeoMapping[baseLanguage]) {
    return languageToGeoMapping[baseLanguage];
  }
  
  // 매핑이 없는 경우 기본값 반환
  return 'US';
}

// 국가 코드로부터 국가 이름 가져오기
export function getCountryNameFromGeo(geoCode: string): string {
  return geoToCountryName[geoCode] || 'Global';
} 