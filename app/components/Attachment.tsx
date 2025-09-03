import { Attachment } from "@/lib/types";
import { memo, useEffect, useState } from "react";
import { Download } from 'lucide-react';
import { getIcon } from 'material-file-icons';
import { fileHelpers } from './ChatInput/FileUpload';

interface AttachmentPreviewProps {
  attachment: Attachment;
  messageId?: string;
  attachmentIndex?: number;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void;
}


export const AttachmentPreview = memo(function AttachmentPreviewComponent({ 
  attachment, 
  messageId, 
  attachmentIndex, 
  togglePanel 
}: AttachmentPreviewProps) {
  const isImage = attachment.contentType?.startsWith('image/') || false;

  // Derive file size if missing using HEAD request
  const [derivedSize, setDerivedSize] = useState<number | null>(null);
  useEffect(() => {
    let aborted = false;
    if (!attachment.metadata?.fileSize && attachment.url) {
      (async () => {
        try {
          const res = await fetch(attachment.url, { method: 'HEAD' });
          const len = res.headers.get('content-length');
          if (!aborted && len) setDerivedSize(parseInt(len, 10));
        } catch {}
      })();
    }
    return () => { aborted = true; };
  }, [attachment.metadata?.fileSize, attachment.url]);

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

  // 다운로드 핸들러
  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 파일 다운로드 링크 생성
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name || 'download';
    link.target = '_blank';
    
    // 링크를 DOM에 추가하고 클릭한 후 제거
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
  const fileSize = (attachment.metadata?.fileSize ?? derivedSize) != null
    ? fileHelpers.formatFileSize((attachment.metadata?.fileSize ?? derivedSize) as number)
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
        <button
          onClick={handleDownload}
          className="hover:bg-black/10 dark:hover:bg-white/10 rounded p-1 transition-colors"
          title="Download file"
        >
          <Download className="text-neutral-500" size={20} />
        </button>
      </div>
    </div>
  );
});