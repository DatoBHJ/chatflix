import { Attachment } from "@/lib/types";
import { memo } from "react";
import { Download } from 'lucide-react';
import { getIcon } from 'material-file-icons';
import { fileHelpers } from './ChatInput/FileUpload';

interface AttachmentPreviewProps {
  attachment: Attachment;
  messageId?: string;
  attachmentIndex?: number;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void;
}

// Function to get file extension from filename
function getFileExtension(fileName: string): string {
  if (!fileName) return '';
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

export const AttachmentPreview = memo(function AttachmentPreviewComponent({ 
  attachment, 
  messageId, 
  attachmentIndex, 
  togglePanel 
}: AttachmentPreviewProps) {
  const isImage = attachment.contentType?.startsWith('image/') || false;

  // 클릭 핸들러 - 모든 파일을 사이드 패널에서 열기
  const handleClick = (e: React.MouseEvent) => {
    if (togglePanel && messageId !== undefined && attachmentIndex !== undefined) {
      // 이미지와 일반 파일 모두 사이드패널에서 열기
      e.preventDefault();
      e.stopPropagation();
      togglePanel(messageId, 'attachment', attachmentIndex, undefined, attachment.name);
    } else {
      // togglePanel이 없으면 새 탭에서 열기
      window.open(attachment.url, '_blank');
    }
  };

  if (isImage) {
    return (
      <img 
        src={attachment.url} 
        alt={attachment.name || 'Image Attachment'}
        className="imessage-image-attachment"
        onClick={handleClick}
        style={{ 
          cursor: togglePanel ? 'pointer' : 'default' 
        }}
      />
    );
  }

  const fileName = attachment.name || '';
  const icon = getIcon(fileName);
  
  // 파일 크기 계산 - metadata에서 가져오거나 기본값 사용
  const fileSize = attachment.metadata?.fileSize 
    ? fileHelpers.formatFileSize(attachment.metadata.fileSize)
    : 'Unknown size';

  // Fallback for generic files, styled like the screenshot
  return (
    <div 
      className="imessage-file-bubble" 
      onClick={handleClick}
      style={{ 
        cursor: togglePanel ? 'pointer' : 'default' 
      }}
    >
      {/* File Icon */}
      <div className="flex-shrink-0">
        <div 
          style={{ width: '24px', height: '24px' }}
          dangerouslySetInnerHTML={{ __html: icon.svg }}
        />
      </div>
      {/* File Info */}
      <div className="flex-1 text-left overflow-hidden">
        <p className="font-medium truncate text-sm text-black/60 dark:text-white/80">{attachment.name || 'File'}</p>
        <p className="text-xs text-black/40 dark:text-white/60">{fileSize}</p>
      </div>
      {/* Download Icon */}
      <div className="p-1">
         <Download className="text-neutral-500" size={20} />
      </div>
    </div>
  );
});