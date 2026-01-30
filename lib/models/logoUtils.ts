

// Get provider logo helper functions
export const getProviderLogo = (provider: string, modelId?: string) => {
    // Special case for Chatflix Ultimate and Chatflix Ultimate Pro
    if (modelId === 'chatflix-ultimate' || modelId === 'chatflix-ultimate-pro') {
      return '/android-chrome-512x512-modified.png';
    }
  
    const logoMap: {[key: string]: string} = {
      anthropic: '/logo/anthropic.svg',
      openai: '/logo/openai.svg',
      google: '/logo/gemini.svg',
      together: '/logo/together.svg',
      xai: '/logo/grok.svg',
      deepseek: '/logo/deepseek.svg',
      groq: '/logo/groq.svg',
      wan: '/logo/wan-ai.svg',
      qwen: '/logo/wan-ai.svg',
      seedream: '/logo/seedream.svg',
      moonshot: '/logo/moonshot.svg',
      fireworks: '/logo/fireworks.svg'
    };
    
    return logoMap[provider] || '';
  };
  
  // Check if provider has a logo
  export const hasLogo = (provider: string, modelId?: string) => {
    // Special case for Chatflix models
    if (modelId === 'chatflix-ultimate' || modelId === 'chatflix-ultimate-pro') {
      return true;
    }
    
    const providersWithLogos = ['anthropic', 'openai', 'google', 'together', 'xai', 'deepseek', 'groq', 'wan', 'seedream', 'qwen', 'moonshot', 'fireworks'];
    return providersWithLogos.includes(provider);
  };

  // Get Chatflix logo based on context
  export const getChatflixLogo = (options?: {
    isDark?: boolean;
    isSelected?: boolean;
    isAgentEnabled?: boolean;
    selectedTool?: string | null;
    hasBackgroundImage?: boolean;
    brightness?: number;
  }) => {
    // 우선순위: isSelected > isAgentEnabled/selectedTool > hasBackgroundImage > brightness > isDark
    if (options?.isSelected) {
      return '/logo/chatflix-logo-dark-transparent.svg';
    }
    if (options?.isAgentEnabled || options?.selectedTool) {
      return '/logo/chatflix-logo-dark-transparent.svg';
    }
    if (options?.hasBackgroundImage) {
      return '/logo/chatflix-logo-dark-transparent.svg';
    }
    if (options?.brightness !== undefined && options.brightness > 190) {
      return '/logo/chatflix-logo-light-transparent.svg';
    }
    if (options?.isDark) {
      return '/logo/chatflix-logo-dark-transparent.svg';
    }
    return '/logo/chatflix-logo-light-transparent.svg';
  };

