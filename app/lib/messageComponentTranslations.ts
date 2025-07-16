export const messageComponentTranslations: Record<string, Record<string, string>> = {
  rateLimitReachedTitle: {
    'en': 'Rate Limit Reached',
    'ko': '사용량 제한 도달',
    'ja': 'レート制限に達しました',
    'zh': '已达到速率限制',
    'es': 'Límite de Tasa Alcanzado',
    'fr': 'Limite de Taux Atteinte',
    'de': 'Ratenbegrenzung erreicht',
    'it': 'Limite di Velocità Raggiunto',
    'pt': 'Limite de Taxa Atingido',
    'ru': 'Достигнут лимит запросов'
  },
  rateLimitMessage: {
    'en': 'Try again in {minutes} min, switch to a different model, or',
    'ko': '{minutes}분 후에 다시 시도하거나, 다른 모델로 전환하거나,',
    'ja': '{minutes}分後にもう一度試すか、別のモデルに切り替えるか、',
    'zh': '请在 {minutes} 分钟后重试，或切换到其他模型，或',
    'es': 'Inténtalo de nuevo en {minutes} min, cambia a un modelo diferente, o',
    'fr': 'Réessayez dans {minutes} min, changez de modèle, ou',
    'de': 'Versuchen Sie es in {minutes} Min. erneut, wechseln Sie zu einem anderen Modell oder',
    'it': 'Riprova tra {minutes} min, passa a un altro modello, o',
    'pt': 'Tente novamente em {minutes} min, mude para um modelo diferente, ou',
    'ru': 'Повторите попытку через {minutes} мин., переключитесь на другую модель или'
  },
  upgradeToPro: {
    'en': 'Upgrade to Pro',
    'ko': '프로로 업그레이드',
    'ja': 'プロにアップグレード',
    'zh': '升级到专业版',
    'es': 'Actualizar a Pro',
    'fr': 'Passer à Pro',
    'de': 'Upgrade auf Pro',
    'it': 'Aggiorna a Pro',
    'pt': 'Atualizar para Pro',
    'ru': 'Перейти на Pro'
  },
  model: {
    'en': 'Model',
    'ko': '모델',
    'ja': 'モデル',
    'zh': '模型',
    'es': 'Modelo',
    'fr': 'Modèle',
    'de': 'Modell',
    'it': 'Modello',
    'pt': 'Modelo',
    'ru': 'Модель'
  },
  level: {
    'en': 'Level',
    'ko': '레벨',
    'ja': 'レベル',
    'zh': '级别',
    'es': 'Nivel',
    'fr': 'Niveau',
    'de': 'Stufe',
    'it': 'Livello',
    'pt': 'Nível',
    'ru': 'Уровень'
  },
  limit: {
    'en': 'Limit',
    'ko': '제한',
    'ja': '制限',
    'zh': '限制',
    'es': 'Límite',
    'fr': 'Limite',
    'de': 'Limit',
    'it': 'Limite',
    'pt': 'Limite',
    'ru': 'Лимит'
  },
  resets: {
    'en': 'Resets',
    'ko': '초기화',
    'ja': 'リセット',
    'zh': '重置',
    'es': 'Reinicios',
    'fr': 'Réinitialisations',
    'de': 'Zurücksetzungen',
    'it': 'Reimposta',
    'pt': 'Redefinições',
    'ru': 'Сброс'
  },
  limitValue: {
    'en': '{hourlyLimit} per {hourlyWindow}, and {dailyLimit} per {dailyWindow}',
    'ko': '{hourlyWindow}마다 {hourlyLimit}회, {dailyWindow}마다 {dailyLimit}회',
    'ja': '{hourlyWindow}ごとに{hourlyLimit}回、{dailyWindow}ごとに{dailyLimit}回',
    'zh': '每 {hourlyWindow} {hourlyLimit} 次，每 {dailyWindow} {dailyLimit} 次',
    'es': '{hourlyLimit} por {hourlyWindow}, y {dailyLimit} por {dailyWindow}',
    'fr': '{hourlyLimit} par {hourlyWindow}, et {dailyLimit} par {dailyWindow}',
    'de': '{hourlyLimit} pro {hourlyWindow} und {dailyLimit} pro {dailyWindow}',
    'it': '{hourlyLimit} per {hourlyWindow}, e {dailyLimit} per {dailyWindow}',
    'pt': '{hourlyLimit} por {hourlyWindow}, e {dailyLimit} por {dailyWindow}',
    'ru': '{hourlyLimit} в {hourlyWindow} и {dailyLimit} в {dailyWindow}'
  }
};

type MessageComponentTranslationKeys = keyof typeof messageComponentTranslations;

export function getMessageComponentTranslations(): Record<MessageComponentTranslationKeys, string> {
    const defaultLang = 'en';
    const defaultTranslations: Record<string, string> = {};
    for (const key in messageComponentTranslations) {
        if (Object.prototype.hasOwnProperty.call(messageComponentTranslations, key)) {
            defaultTranslations[key] = messageComponentTranslations[key as MessageComponentTranslationKeys][defaultLang];
        }
    }

    if (typeof navigator === 'undefined') {
        return defaultTranslations as Record<MessageComponentTranslationKeys, string>;
    }

    const userLang = navigator.language.toLowerCase();
    const langCode = userLang.split('-')[0];

    const translations: Record<string, string> = {};
    for (const key in messageComponentTranslations) {
        if (Object.prototype.hasOwnProperty.call(messageComponentTranslations, key)) {
            const typedKey = key as MessageComponentTranslationKeys;
            translations[typedKey] = messageComponentTranslations[typedKey][langCode] || defaultTranslations[typedKey];
        }
    }

    return translations as Record<MessageComponentTranslationKeys, string>;
} 