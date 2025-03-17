// app/components/chat/ChatInput/DragDropOverlay.tsx
import { DragDropOverlayProps } from './types';

export function DragDropOverlay({ dragActive }: DragDropOverlayProps) {
  if (!dragActive) return null;

  return (
    <div 
      className="absolute inset-0 drag-upload-overlay
                flex items-center justify-center transition-all duration-300 z-50"
    >
      <div className="flex flex-col items-center gap-3 transform transition-transform duration-300 scale-100 hover:scale-105">
        {/* <div className="drag-upload-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div> */}
        <div className="flex flex-col items-center text-center">
          {/* <span className="text-foreground ">Drop files here</span> */}
          <span className="text-xs text-red-400 mt-0.5">(PDF files and folders not supported)</span>
        </div>
      </div>
    </div>
  );
}

// 에러 토스트 컴포넌트
export function ErrorToast({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;

  return (
    <div className="absolute bottom-full mb-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fadeIn z-50">
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{message}</span>
      </div>
    </div>
  );
}