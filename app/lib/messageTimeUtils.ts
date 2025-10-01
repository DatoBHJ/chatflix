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
  
  // Get user's locale and timezone
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Format time
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone
  }).format(messageDate);
  
  // Get dates in local timezone for accurate comparison
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  
  const dateStr = messageDate.toDateString();
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();
  
  // Today
  if (dateStr === todayStr) {
    // Use relative time formatter for "today"
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const todayText = rtf.format(0, 'day'); // This gives us "today" in local language
    return `${readText} ${todayText.charAt(0).toUpperCase() + todayText.slice(1)} ${timeFormat}`;
  }
  
  // Yesterday
  if (dateStr === yesterdayStr) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const yesterdayText = rtf.format(-1, 'day'); // This gives us "yesterday" in local language
    return `${readText} ${yesterdayText.charAt(0).toUpperCase() + yesterdayText.slice(1)} ${timeFormat}`;
  }
  
  // Calculate days difference for this week check
  const diffMs = now.getTime() - messageDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // This week (within 7 days)
  if (diffDays < 7) {
    const dayFormat = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      timeZone
    }).format(messageDate);
    return `${readText} ${dayFormat} ${timeFormat}`;
  }
  
  // More than a week ago
  const fullDateFormat = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone
  }).format(messageDate);
  
  // Format to match "Mon, Jun 30 at 12:39 PM" style
  const formattedDate = fullDateFormat.replace(/,\s*(\d+:\d+\s*[AP]M)/, ' at $1');
  return `${readText} ${formattedDate}`;
} 