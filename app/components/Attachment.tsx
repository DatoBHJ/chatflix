import { Attachment } from "@/lib/types";
import { memo } from "react";

interface AttachmentPreviewProps {
    attachments: Attachment[]
    messageId: string
  }
  
  // Memoize the AttachmentPreview component
export const AttachmentPreview = memo(function AttachmentPreviewComponent({ attachments, messageId }: AttachmentPreviewProps) {
    return (
      <div className="flex flex-wrap gap-2 mb-2">
        {attachments.map((attachment, index) => {
          const isImage = attachment.contentType?.startsWith('image/') || false
          const isPdf = attachment.contentType === 'application/pdf' || 
                       (attachment.name && attachment.name.toLowerCase().endsWith('.pdf'))
          const isCode = attachment.contentType?.includes('text') || 
                       (attachment.name && /\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs)$/i.test(attachment.name))
          
          const getTypeBadge = () => {
            if (isImage && attachment.contentType) {
              return attachment.contentType.split('/')[1].toUpperCase()
            }
            if (attachment.name) {
              const ext = attachment.name.split('.').pop()
              return ext ? ext.toUpperCase() : 'FILE'
            }
            return 'FILE'
          }
          
          return isImage ? (
            <div 
              key={`${messageId}-${index}`} 
              className="relative group image-preview-item cursor-pointer"
              onClick={() => window.open(attachment.url, '_blank')}
            >
              <span className="file-type-badge">
                {getTypeBadge()}
              </span>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <img 
                src={attachment.url} 
                alt={attachment.name || `Image ${index + 1}`}
                className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
              />
            </div>
          ) : (
            <div 
              key={`${messageId}-${index}`} 
              className="relative group file-preview-item cursor-pointer"
              onClick={() => window.open(attachment.url, '_blank')}
            >
              <span className="file-type-badge">
                {getTypeBadge()}
              </span>
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <div className="file-icon">
                {isCode ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                ) : isPdf ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                )}
              </div>
              <div className="file-name">{attachment.name || `File ${index + 1}`}</div>
            </div>
          )
        })}
      </div>
    )
  });