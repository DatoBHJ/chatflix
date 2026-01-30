export interface DefaultBackground {
  id: string;
  name: string;
  url: string;
  ai_prompt?: string;
  ai_json_prompt?: object;
}

// Default background ID (first background in the array)
export const DEFAULT_BACKGROUND_ID = 'fruit-in-space';

// Default backgrounds (pre-selected wallpapers)
export const DEFAULT_BACKGROUNDS: DefaultBackground[] = [
  {
    id: 'fruit-in-space',
    name: 'Fruit in Space',
    url: '/wallpaper/Chatflix bg/251115 fruit in space/seedream_1763191423514_zocwne0tckb.jpeg',
    ai_json_prompt: {
      prompt_description: 'A surreal, cinematic composition of a conceptual art installation located on the moon.',
      subject: {
        object: 'A single, ripe yellow banana',
        position: 'Suspended in mid-air, hanging by a barely visible thin string',
        orientation: 'Centered vertically and horizontally within the case'
      },
      enclosure: {
        type: 'Rectangular display case / Monolith',
        materials: ['Clear glass panels', 'Brushed steel metal frame', 'Solid metal base'],
        lighting: 'Internally illuminated with a warm, bright amber/gold glow that serves as the primary light source'
      },
      environment: {
        setting: 'Lunar surface / Moonscape',
        ground_texture: 'Grey, uneven regolith, dust, small rocks, and deep craters',
        background: 'Pitch black void of space',
        atmospheric_effects: 'Subtle mist or dust kicking up on the left side, illuminated by the case light'
      },
      lighting_and_shadows: {
        style: 'High contrast, Chiaroscuro',
        shadows: 'Deep, harsh black shadows inside craters; a long, distinct shadow cast by the box onto the ground to the right',
        highlights: 'Soft warm rim lighting on the terrain near the box'
      },
      technical_style: {
        aesthetic: 'Sci-fi, Surrealism, Minimalist, Photorealistic',
        render_quality: '8k resolution, Unreal Engine 5 render style, sharp focus',
        camera_angle: 'Eye-level, wide shot'
      }
    }
  }
] as const;

// Helper function to get the default background
export function getDefaultBackground(): DefaultBackground {
  return DEFAULT_BACKGROUNDS.find(bg => bg.id === DEFAULT_BACKGROUND_ID) || DEFAULT_BACKGROUNDS[0];
}
