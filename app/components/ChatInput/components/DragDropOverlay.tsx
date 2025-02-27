import { DragDropOverlayProps } from '../types';

export const DragDropOverlay: React.FC<DragDropOverlayProps> = ({ dragActive }) => {
  if (!dragActive) return null;

  return (
    <div 
      className="absolute inset-0 drag-upload-overlay
                flex items-center justify-center transition-all duration-300 z-50"
    >
      <div className="flex flex-col items-center gap-3 transform transition-transform duration-300 scale-100 hover:scale-105">
        <div className="drag-upload-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <span className="drag-upload-text">Drop files here</span>
      </div>
    </div>
  );
}; 