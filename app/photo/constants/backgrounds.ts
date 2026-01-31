export interface DefaultBackground {
  id: string;
  name: string;
  url: string;
  ai_prompt?: string;
  ai_json_prompt?: object;
}

// Default background ID (first background in the array)
export const DEFAULT_BACKGROUND_ID = 'clouds';

// Default backgrounds (pre-selected wallpapers)
export const DEFAULT_BACKGROUNDS: DefaultBackground[] = [
  {
    id: 'clouds',
    name: 'Clouds',
    url: '/wallpaper/Chatflix bg/251117 clouds/seedream_1763363622522_j3vect7yhxg.jpeg',
    ai_json_prompt: {
      prompt_description: 'A dramatic, vibrant sky filled with clouds at sunrise or sunset.',
      environment: {
        setting: 'Sky with dynamic cloud formations',
        background: 'Deep blue sky contrasting with warm orange and yellow illuminated clouds',
        atmospheric_effects: 'Fiery orange and yellow hues on cloud edges, soft peach and grey-brown in lower clouds'
      },
      technical_style: {
        aesthetic: 'Atmospheric, Photorealistic',
        render_quality: 'High resolution, sharp focus',
        camera_angle: 'Wide shot of sky'
      }
    }
  }
] as const;

// Helper function to get the default background
export function getDefaultBackground(): DefaultBackground {
  return DEFAULT_BACKGROUNDS.find(bg => bg.id === DEFAULT_BACKGROUND_ID) || DEFAULT_BACKGROUNDS[0];
}
