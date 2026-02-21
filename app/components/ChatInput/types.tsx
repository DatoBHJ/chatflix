// app/components/chat/ChatInput/types.ts
import { FormEvent } from 'react';

export interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>, files?: FileList) => void;
  isLoading: boolean;
  stop: () => void;
  disabled?: boolean;
  placeholder?: string;
  user: any;
  modelId: string;
  popupPosition?: 'top' | 'bottom';
  isAgentEnabled?: boolean;
  setisAgentEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
  allMessages?: any[]; // 전체 대화 메시지 (대화창에서만 사용)
  
  // Global drag and drop props
  globalDragActive?: boolean;
  globalShowPDFError?: boolean;
  globalShowFolderError?: boolean;
  globalShowVideoError?: boolean;
  
  // 도구 선택 관련 props
  selectedTool?: string | null;
  setSelectedTool?: React.Dispatch<React.SetStateAction<string | null>>;
  
  // 배경 이미지 존재 여부
  hasBackgroundImage?: boolean;
}

export interface FileHelpers {
  formatFileSize: (bytes: number) => string;
  isPDFFile: (file: File) => boolean;
}
