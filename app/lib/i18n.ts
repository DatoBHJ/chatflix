/**
 * Centralized i18n (Internationalization) system
 * Provides unified language detection and translation management
 */

// Language code type
export type LanguageCode = string;

// Translation namespace type
export type TranslationNamespace = 'chatInput' | 'sidebar' | 'metric' | 'messageTime';

// Cache key for stored user language
const STORED_LANGUAGE_KEY = 'user_language_preference';

/**
 * Get user language from browser navigator
 * Returns base language code (e.g., 'ko' from 'ko-KR')
 */
export function getUserLanguage(): LanguageCode {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  const userLang = navigator.language.toLowerCase();
  const langCode = userLang.split('-')[0];
  
  return langCode;
}

/**
 * Get stored user language from localStorage
 * This can be set by the server or user preference
 */
export function getStoredUserLanguage(): LanguageCode | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORED_LANGUAGE_KEY);
    if (stored && stored.trim() !== '') {
      return stored.trim().toLowerCase().split('-')[0];
    }
  } catch (error) {
    // localStorage might not be available
    console.warn('[i18n] Failed to read stored language:', error);
  }

  return null;
}

/**
 * Set user language preference in localStorage
 */
export function setStoredUserLanguage(langCode: LanguageCode): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORED_LANGUAGE_KEY, langCode);
  } catch (error) {
    console.warn('[i18n] Failed to store language preference:', error);
  }
}

/**
 * Get current language with priority:
 * 1. Stored user language (from localStorage or server)
 * 2. Browser navigator language
 * 3. Default 'en'
 */
export function getCurrentLanguage(): LanguageCode {
  const stored = getStoredUserLanguage();
  if (stored) {
    return stored;
  }

  const browserLang = getUserLanguage();
  return browserLang || 'en';
}

// Import translation data directly from namespace files to avoid circular dependency
import { chatInputTranslations } from './translations/chatInput';
import { sidebarTranslations } from './translations/sidebar';
import { metricTranslations } from './translations/metric';
import { readTranslations } from './translations/messageTime';

// Convert metricTranslations to the expected format
function convertMetricTranslations() {
  const result: Record<string, Record<string, string>> = {};
  const languages = Object.keys(metricTranslations) as string[];
  
  // Process names
  for (const lang of languages) {
    const metricData = metricTranslations[lang];
    if (metricData && metricData.names) {
      const names = metricData.names as Record<string, string>;
      for (const key in names) {
        if (Object.prototype.hasOwnProperty.call(names, key)) {
          if (!result[key]) {
            result[key] = {};
          }
          result[key][lang] = names[key];
        }
      }
    }
  }
  
  // Process tooltips with 'tooltip_' prefix
  for (const lang of languages) {
    const metricData = metricTranslations[lang];
    if (metricData && metricData.tooltips) {
      const tooltips = metricData.tooltips as Record<string, string>;
      for (const key in tooltips) {
        if (Object.prototype.hasOwnProperty.call(tooltips, key)) {
          const tooltipKey = `tooltip_${key}`;
          if (!result[tooltipKey]) {
            result[tooltipKey] = {};
          }
          result[tooltipKey][lang] = tooltips[key];
        }
      }
    }
  }
  
  return result;
}

// Create all translations object
const convertedMetricTranslations = convertMetricTranslations();
const messageTimeTranslations: Record<string, Record<string, string>> = {
  read: readTranslations
};

const allTranslations = {
  chatInput: chatInputTranslations,
  sidebar: sidebarTranslations,
  metric: convertedMetricTranslations,
  messageTime: messageTimeTranslations
};

/**
 * Get translation for a specific key in a namespace
 * @param key - Translation key
 * @param namespace - Translation namespace (optional, will search all namespaces if not provided)
 * @param langCode - Language code (optional, uses getCurrentLanguage() if not provided)
 */
export function getTranslation(
  key: string,
  namespace?: TranslationNamespace,
  langCode?: LanguageCode
): string {
  const currentLang = langCode || getCurrentLanguage();

  // If namespace is provided, search only in that namespace
  if (namespace) {
    const namespaceData = allTranslations[namespace];
    if (namespaceData && namespaceData[key]) {
      const translation = namespaceData[key][currentLang] || namespaceData[key]['en'];
      return translation || key;
    }
  } else {
    // Search in all namespaces
    for (const ns of Object.keys(allTranslations) as TranslationNamespace[]) {
      const namespaceData = allTranslations[ns];
      if (namespaceData && namespaceData[key]) {
        const translation = namespaceData[key][currentLang] || namespaceData[key]['en'];
        if (translation) {
          return translation;
        }
      }
    }
  }

  // Fallback to key if translation not found
  return key;
}

/**
 * Get all translations for a specific namespace
 * @param namespace - Translation namespace
 * @param langCode - Language code (optional, uses getCurrentLanguage() if not provided)
 */
export function getTranslations<T extends Record<string, string>>(
  namespace: TranslationNamespace,
  langCode?: LanguageCode
): T {
  const currentLang = langCode || getCurrentLanguage();
  const namespaceData = allTranslations[namespace];

  if (!namespaceData) {
    return {} as T;
  }

  const result: Record<string, string> = {};
  
  // Iterate through all keys in the namespace
  for (const key in namespaceData) {
    if (Object.prototype.hasOwnProperty.call(namespaceData, key)) {
      const translationData = namespaceData[key];
      // Get translation for current language, fallback to 'en'
      result[key] = translationData[currentLang] || translationData['en'] || key;
    }
  }

  return result as T;
}

/**
 * Initialize i18n system
 * Can be used to set initial language from server or user preference
 */
export function initI18n(initialLanguage?: LanguageCode): void {
  if (initialLanguage) {
    setStoredUserLanguage(initialLanguage);
  }
}

