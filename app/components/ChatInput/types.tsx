// app/components/chat/ChatInput/types.ts
import { FormEvent, ReactNode } from 'react';

export interface PromptShortcut {
  id: string;
  name: string;
  content: string;
  created_at: string;
  match_type?: string;
  highlight_ranges?: Array<{start: number, end: number}>;
}

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
  isWebSearchEnabled?: boolean;
  setIsWebSearchEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
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

export interface PromptShortcutsProps {
  showShortcuts: boolean;
  shortcuts: PromptShortcut[];
  selectedIndex: number;
  searchTerm: string;
  handleShortcutSelect: (shortcut: PromptShortcut) => void;
  closeShortcutsPopup: () => void;
  popupPosition: 'top' | 'bottom';
  shortcutsListRef: React.RefObject<HTMLDivElement | null>;
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