// app/components/chat/ChatInput/types.ts
import { FormEvent, ReactNode } from 'react';

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
}

export interface FilePreviewProps {
  files: File[];
  fileMap: Map<string, { file: File, url: string }>;
  removeFile: (file: File) => void;
}

export interface DragDropOverlayProps {
  dragActive: boolean;
  supportsPDFs?: boolean;
}



export interface FileUploadButtonProps {
  filesCount: number;
  onClick: () => void;
}

export interface FileHelpers {
  formatFileSize: (bytes: number) => string;
  getFileIcon: (file: File) => ReactNode;
  getFileTypeBadge: (file: File) => string;
  isImageFile: (file: File) => boolean;
  isTextFile: (file: File) => boolean;
  isPDFFile: (file: File) => boolean;
}