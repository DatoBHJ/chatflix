export interface CustomBackground {
  id: string;
  path: string;
  url: string;
  name: string;
  created_at: string;
  bucket_name?: string;
  prompt?: string;
  ai_prompt?: string;
  ai_json_prompt?: any;
}

export interface DefaultBackground {
  id: string;
  name: string;
  url: string;
}

export interface SavedImage {
  prompt?: string;
  id: string;
  url: string;
  created_at: string;
  name?: string;
  ai_prompt?: string;
  ai_json_prompt?: any;
  chatId?: string;
  messageId?: string;
  sourceImageUrl?: string;
}

export type PhotoSection = 'default' | 'uploads' | 'saved';

export interface PhotoContentProps {
  user: any;
  currentBackground: string;
  backgroundType: 'default' | 'custom';
  backgroundId?: string;
  onBackgroundChange: (backgroundUrl: string, backgroundType: 'default' | 'custom', backgroundId?: string) => void;
  hideActionButtons?: boolean;
  onImageClick?: (imageId: string) => void;
  disableVideos?: boolean;
}
