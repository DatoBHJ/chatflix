export function formatMessageGroupTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  
  // Get user's locale and timezone
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Format time
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone
  }).format(date);
  
  // Get dates in local timezone for accurate comparison
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  
  const dateStr = date.toDateString();
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();
  
  // Today
  if (dateStr === todayStr) {
    // Use relative time formatter for "today"
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const todayText = rtf.format(0, 'day'); // This gives us "today" in local language
    return `${todayText.charAt(0).toUpperCase() + todayText.slice(1)} ${timeFormat}`;
  }
  
  // Yesterday
  if (dateStr === yesterdayStr) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const yesterdayText = rtf.format(-1, 'day'); // This gives us "yesterday" in local language
    return `${yesterdayText.charAt(0).toUpperCase() + yesterdayText.slice(1)} ${timeFormat}`;
  }
  
  // Calculate days difference for this week check
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // This week (within 7 days)
  if (diffDays < 7) {
    const dayFormat = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      timeZone
    }).format(date);
    return `${dayFormat} ${timeFormat}`;
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
  }).format(date);
  
  // Format to match "Mon, Jun 30 at 12:39 PM" style
  return fullDateFormat.replace(/,\s*(\d+:\d+\s*[AP]M)/, ' at $1');
} 