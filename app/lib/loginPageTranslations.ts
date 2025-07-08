export const loginPageTranslations: Record<string, Record<string, string>> = {
  chatIsThisReal: {
    "en": "Chat is this real?",
    "ko": "챗, 이거 실화냐?",
    "ja": "チャット、これマジ？",
    "zh": "家人们，这真的假的？",
    "es": "Chat, ¿pero esto es real?",
    "fr": "Non mais Chat, c'est réel ça ?",
    "de": "Chat, im Ernst jetzt?",
    "it": "Chat, ma sta succedendo davvero?",
    "pt": "Chat, isso é sério mesmo?",
    "ru": "Чат, это реально?",
    "ar": "شات، عنجد هاد؟",
    "hi": "Chat, yeh real hai kya?",
    "th": "แชท, นี่เรื่องจริงปะเนี่ย?",
    "vi": "Chat ơi, thật không vậy?",
    "nl": "Chat, is dit serieus?",
    "sv": "Chatt, händer det här på riktigt?",
    "da": "Chat, sker det her seriøst?",
    "no": "Chat, er dette seriøst?",
    "fi": "Chat, onko tää totta nyt?",
    "pl": "Czat, to się dzieje naprawdę?",
    "tr": "Sohbet, bu gerçek olamaz, değil mi?",
    "he": "צ'אט, זה אמיתי כאילו?",
    "uk": "Чат, це що, реально?",
    "cs": "Chate, to jako vážně?",
    "hu": "Chat, ez most komoly?",
    "ro": "Chat, e pe bune?",
    "bg": "Чат, това наистина ли се случва?",
    "hr": "Chat, jel se ovo stvarno događa?",
    "sk": "Chat, toto je akože reálne?",
    "sl": "Klepet, se to res dogaja?",
    "et": "Chat, on see päriselt ka?",
    "lv": "Čat, tas notiek pa īstam?",
    "lt": "Čatai, ar čia rimtai?",
    "mt": "Chat, dan bis-serjetà?",
    "is": "Spjall, er þetta í alvörunni að gerast?",
    "ga": "A Chomhrá, an bhfuil sé seo ag tarlú i ndáiríre?",
    "cy": "Sgwrs, ydy hyn go iawn?",
    "eu": "Txat, hau benetan gertatzen ari da?",
    "ca": "Xat, això està passant de veritat?",
    "gl": "Chat, isto está a pasar de verdade?"
  },
  yes: {
    'en': 'Yes', 'ko': '네', 'ja': 'はい', 'zh': '是的', 'es': 'Sí', 'fr': 'Oui', 'de': 'Ja', 'it': 'Sì', 'pt': 'Sim', 'ru': 'Да', 'ar': 'نعم', 'hi': 'हाँ', 'th': 'ใช่', 'vi': 'Vâng', 'nl': 'Ja', 'sv': 'Ja', 'da': 'Ja', 'no': 'Ja', 'fi': 'Kyllä', 'pl': 'Tak', 'tr': 'Evet', 'he': 'כן', 'uk': 'Так', 'cs': 'Ano', 'hu': 'Igen', 'ro': 'Da', 'bg': 'Да', 'hr': 'Da', 'sk': 'Áno', 'sl': 'Da', 'et': 'Jah', 'lv': 'Jā', 'lt': 'Taip', 'mt': 'Iva', 'is': 'Já', 'ga': 'Tá', 'cy': 'Ydw', 'eu': 'Bai', 'ca': 'Sí', 'gl': 'Si'
  },
  getStarted: {
    'en': 'Click here to get started', 'ko': '시작하려면 여기를 클릭하세요', 'ja': 'ここをクリックして開始します', 'zh': '点击此处开始', 'es': 'Haga clic aquí para comenzar', 'fr': 'Cliquez ici pour commencer', 'de': 'Klicken Sie hier, um zu beginnen', 'it': 'Clicca qui per iniziare', 'pt': 'Clique aqui para começar', 'ru': 'Нажмите здесь, чтобы начать', 'ar': 'انقر هنا للبدء', 'hi': 'शुरू करने के लिए यहां क्लिक करें', 'th': 'คลิกที่นี่เพื่อเริ่มต้น', 'vi': 'Nhấp vào đây để bắt đầu', 'nl': 'Klik hier om te beginnen', 'sv': 'Klicka här för att komma igång', 'da': 'Klik her for at komme i gang', 'no': 'Klikk her for å komme i gang', 'fi': 'Aloita napsauttamalla tästä', 'pl': 'Kliknij tutaj, aby rozpocząć', 'tr': 'Başlamak için buraya tıklayın', 'he': 'לחץ כאן כדי להתחיל', 'uk': 'Натисніть тут, щоб почати', 'cs': 'Klikněte zde pro zahájení', 'hu': 'Kattintson ide a kezdéshez', 'ro': 'Faceți clic aici pentru a începe', 'bg': 'Натиснете тук, за да започнете', 'hr': 'Kliknite ovdje za početak', 'sk': 'Kliknite sem a začnite', 'sl': 'Kliknite tukaj za začetek', 'et': 'Alustamiseks klõpsake siin', 'lv': 'Noklikšķiniet šeit, lai sāktu', 'lt': 'Spustelėkite čia, kad pradėtumėte', 'mt': 'Ikklikkja hawn biex tibda', 'is': 'Smelltu hér til að byrja', 'ga': 'Cliceáil anseo chun tús a chur leis', 'cy': 'Cliciwch yma i ddechrau', 'eu': 'Egin klik hemen hasteko', 'ca': 'Feu clic aquí per començar', 'gl': 'Fai clic aquí para comezar'
  }
};

type LoginPageTranslationKeys = 'chatIsThisReal' | 'yes' | 'getStarted';

export function getLoginPageTranslations(): Record<LoginPageTranslationKeys, string> {
  const defaultTranslations: Record<LoginPageTranslationKeys, string> = {
    chatIsThisReal: loginPageTranslations.chatIsThisReal['en'],
    yes: loginPageTranslations.yes['en'],
    getStarted: loginPageTranslations.getStarted['en'],
  };

  if (typeof navigator === 'undefined') {
    return defaultTranslations;
  }
  
  const userLang = navigator.language.toLowerCase();
  const langCode = userLang.split('-')[0];
  
  const translations: Record<LoginPageTranslationKeys, string> = {
    chatIsThisReal: loginPageTranslations.chatIsThisReal[langCode] || defaultTranslations.chatIsThisReal,
    yes: loginPageTranslations.yes[langCode] || defaultTranslations.yes,
    getStarted: loginPageTranslations.getStarted[langCode] || defaultTranslations.getStarted,
  };

  return translations;
} 