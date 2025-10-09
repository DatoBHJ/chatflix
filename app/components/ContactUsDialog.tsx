'use client'

import ReactDOM from 'react-dom'

interface ContactUsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ContactUsDialog({ isOpen, onClose }: ContactUsDialogProps) {
  if (!isOpen) {
    return null
  }

  const modalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[70] bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white dark:bg-[var(--background)] rounded-lg shadow-lg max-w-sm mx-4 relative"
        onClick={e => e.stopPropagation()}
        style={{
          minHeight: '120px',
          width: '480px'
        }}
      >
        {/* Main text */}
        <div className="px-6 pt-6 pb-2">
          <p className="text-black dark:text-[var(--foreground)] text-center text-base font-normal">
            For all support inquiries, including billing issues, and general assistance, please email <a href="mailto:sply@chatflix.app" className="font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer">sply@chatflix.app</a>
          </p>
        </div>
        
        {/* Horizontal line separator */}
        <div className="mx-6 my-3">
          <div className="h-px bg-gray-200 dark:bg-[var(--muted)]/30"></div>
        </div>
        
        {/* Close button in bottom right */}
        <div className="px-6 pb-4 flex justify-end">
          <button
            onClick={onClose}
            className="text-blue-500 hover:text-blue-600 transition-colors text-sm font-normal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  // Handle case where window is not defined (SSR)
  if (typeof window === 'object') {
    const portalRoot = document.getElementById('portal-root');
    if (portalRoot) {
      return ReactDOM.createPortal(modalContent, portalRoot);
    }
  }

  // Fallback for SSR or if portal-root is not found
  return modalContent;
}
