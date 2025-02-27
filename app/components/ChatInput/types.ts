import { FormEvent } from 'react';

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
}

export interface FileData {
  file: File;
  url: string;
}

export interface FilePreviewProps {
  files: File[];
  fileMap: Map<string, FileData>;
  removeFile: (file: File) => void;
}

export interface ShortcutsPopupProps {
  showShortcuts: boolean;
  shortcuts: PromptShortcut[];
  selectedIndex: number;
  searchTerm: string;
  handleShortcutSelect: (shortcut: PromptShortcut) => void;
  closeShortcutsPopup: () => void;
}

export interface DragDropOverlayProps {
  dragActive: boolean;
} 