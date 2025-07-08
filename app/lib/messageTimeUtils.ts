// Read 텍스트 다국어 번역
const readTranslations: Record<string, string> = {
  'en': 'Read',
  'ko': '읽음',
  'ja': '既読',
  'zh': '已读',
  'es': 'Leído',
  'fr': 'Lu',
  'de': 'Gelesen',
  'it': 'Letto',
  'pt': 'Lido',
  'ru': 'Прочитано',
  'ar': 'مقروء',
  'hi': 'पढ़ा गया',
  'th': 'อ่านแล้ว',
  'vi': 'Đã đọc',
  'nl': 'Gelezen',
  'sv': 'Läst',
  'da': 'Læst',
  'no': 'Lest',
  'fi': 'Luettu',
  'pl': 'Przeczytano',
  'tr': 'Okundu',
  'he': 'נקרא',
  'uk': 'Прочитано',
  'cs': 'Přečteno',
  'hu': 'Elolvasva',
  'ro': 'Citit',
  'bg': 'Прочетено',
  'hr': 'Pročitano',
  'sk': 'Prečítané',
  'sl': 'Prebrano',
  'et': 'Loetud',
  'lv': 'Izlasīts',
  'lt': 'Perskaityta',
  'mt': 'Maqru',
  'is': 'Lesið',
  'ga': 'Léite',
  'cy': 'Wedi darllen',
  'eu': 'Irakurrita',
  'ca': 'Llegit',
  'gl': 'Lido'
};

// 사용자 locale 감지 및 Read 텍스트 반환
function getReadText(): string {
  if (typeof navigator === 'undefined') return 'Read';
  
  const userLang = navigator.language.toLowerCase();
  const langCode = userLang.split('-')[0]; // 'ko-KR' -> 'ko'
  
  return readTranslations[langCode] || 'Read';
}

// iMessage 스타일 Read 시간 포맷팅 함수 (다국어 지원)
export function formatMessageTime(createdAt: Date | string): string {
  const messageDate = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  
  // 사용자 locale 감지
  const userLocale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const readText = getReadText();
  
  // 메시지가 유효하지 않은 날짜인 경우 현재 시간 사용
  if (isNaN(messageDate.getTime())) {
    const time = now.toLocaleTimeString(userLocale, { hour: 'numeric', minute: '2-digit' });
    return `${readText} ${time}`;
  }
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
  
  // 같은 날인 경우: 시간만 표시
  if (messageDay.getTime() === today.getTime()) {
    const time = messageDate.toLocaleTimeString(userLocale, { hour: 'numeric', minute: '2-digit' });
    return `${readText} ${time}`;
  }
  
  // 다른 날인 경우
  const time = messageDate.toLocaleTimeString(userLocale, { hour: 'numeric', minute: '2-digit' });
  
  // 같은 년도: 월 이름 + 일 + 시간
  if (messageDate.getFullYear() === now.getFullYear()) {
    const monthDay = messageDate.toLocaleDateString(userLocale, { month: 'long', day: 'numeric' });
    return `${readText} ${monthDay} ${time}`;
  }
  
  // 다른 년도: 월 이름 + 일 + 년도 + 시간
  const monthDayYear = messageDate.toLocaleDateString(userLocale, { month: 'long', day: 'numeric', year: 'numeric' });
  return `${readText} ${monthDayYear} ${time}`;
} 