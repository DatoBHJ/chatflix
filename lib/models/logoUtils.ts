

// Get provider logo helper functions
export const getProviderLogo = (provider: string, modelId?: string) => {
    // Special case for Chatflix Ultimate and Chatflix Ultimate Pro
    if (modelId === 'chatflix-ultimate' || modelId === 'chatflix-ultimate-pro') {
      return '/android-chrome-512x512-modified.png';
    }
  
    const logoMap: {[key: string]: string} = {
      anthropic: '/logo/anthropic.svg',
      openai: '/logo/openai.svg',
      google: '/logo/google.svg',
      together: '/logo/together.svg',
      xai: '/logo/grok.svg',
      deepseek: '/logo/deepseek.svg',
      groq: '/logo/groq.svg'
    };
    
    return logoMap[provider] || '';
  };
  
  // Check if provider has a logo
  export const hasLogo = (provider: string) => {
    const providersWithLogos = ['anthropic', 'openai', 'google', 'together', 'xai', 'deepseek', 'groq'];
    return providersWithLogos.includes(provider);
  };

