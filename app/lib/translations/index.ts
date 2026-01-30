/**
 * Centralized translation data
 * All translation data is organized by namespace
 */

// Import translation data from namespace files
import { chatInputTranslations } from './chatInput';
import { sidebarTranslations } from './sidebar';
import { metricTranslations } from './metric';
import { readTranslations } from './messageTime';

// Convert metricTranslations to the expected format
// metricTranslations has a different structure: { en: { names: {...}, tooltips: {...} }, ko: {...} }
// We need to convert it to: { default: { en: '...', ko: '...' }, tps: { en: '...', ko: '...' }, ... }
const convertMetricTranslations = () => {
  const result: Record<string, Record<string, string>> = {};
  
  // Get all language codes from metricTranslations
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
  
  // Process tooltips with 'tooltip_' prefix to avoid conflicts
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
};

// Create messageTime namespace
const messageTimeTranslations: Record<string, Record<string, string>> = {
  read: readTranslations
};

// Convert metric translations
const convertedMetricTranslations = convertMetricTranslations();

// Export all translations organized by namespace
const allTranslations = {
  chatInput: chatInputTranslations,
  sidebar: sidebarTranslations,
  metric: convertedMetricTranslations,
  messageTime: messageTimeTranslations
};

export default allTranslations;

// Re-export individual translation data for backward compatibility
export { chatInputTranslations, sidebarTranslations };

