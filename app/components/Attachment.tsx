import { Attachment } from "@/lib/types";
import { memo, useEffect, useState, useCallback } from "react";
import { Download } from 'lucide-react';
import { getIcon } from 'material-file-icons';
import { fileHelpers } from './ChatInput/FileUpload';
import { useUrlRefresh } from '../hooks/useUrlRefresh';
import { ImageGalleryStack } from "./ImageGalleryStack";
import { ImageModal } from "./ImageModal";

interface AttachmentPreviewProps {
  attachment: Attachment;
  messageId?: string;
  chatId?: string;
  attachmentIndex?: number;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void;
  isMobile?: boolean;
}


export const AttachmentPreview = memo(function AttachmentPreviewComponent({ 
  attachment, 
  messageId, 
  chatId, 
  attachmentIndex, 
  togglePanel,
  isMobile = false
}: AttachmentPreviewProps) {
  const isImage = attachment.contentType?.startsWith('image/') || false;

  // 이미지 모달 상태
  const [showImageModal, setShowImageModal] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [savedImage, setSavedImage] = useState(false);

  // URL 자동 갱신 훅 사용
  const { refreshedUrl, isRefreshing, refreshError, refreshUrl } = useUrlRefresh({
    url: attachment.url,
    enabled: true
  });

  // Derive file size if missing using HEAD request
  const [derivedSize, setDerivedSize] = useState<number | null>(null);
  useEffect(() => {
    let aborted = false;
    if (!attachment.metadata?.fileSize && refreshedUrl) {
      (async () => {
        try {
          const res = await fetch(refreshedUrl, { method: 'HEAD' });
          const len = res.headers.get('content-length');
          if (!aborted && len) setDerivedSize(parseInt(len, 10));
        } catch {}
      })();
    }
    return () => { aborted = true; };
  }, [attachment.metadata?.fileSize, refreshedUrl]);

  // 이미지 모달 열기
  const openImageModal = useCallback(() => {
    setShowImageModal(true);
    setSavedImage(false); // 모달 열 때 저장 상태 초기화
  }, []);

  // 이미지 모달 닫기
  const closeImageModal = useCallback(() => {
    setShowImageModal(false);
    setSavedImage(false);
  }, []);

  // 클릭 핸들러 - 파일을 사이드 패널에서 열기 (이미지 제외)
  const handleClick = (e?: React.MouseEvent) => {
    if (togglePanel && messageId !== undefined && attachmentIndex !== undefined) {
      e?.preventDefault();
      e?.stopPropagation();
      togglePanel(messageId, 'attachment', attachmentIndex, undefined, attachment.name);
    } else {
      window.open(refreshedUrl, '_blank');
    }
  };

  // 모달에서 Save 핸들러. ImageModal은 { imageUrl, prompt?, sourceImageUrl?, originalSrc? } 페이로드 전달.
  const handleModalSave = useCallback(async (payload: { imageUrl: string; prompt?: string | null; sourceImageUrl?: string | null; originalSrc?: string }) => {
    if (savingImage || savedImage) return;
    setSavingImage(true);
    try {
      const imageUrl = payload.imageUrl;
      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: payload.prompt || null,
          ai_prompt: null,
          ai_json_prompt: null,
          chatId: chatId || null,
          messageId: messageId || null,
          metadata: { sourceImageUrl: payload.sourceImageUrl || null }
        })
      });
      if (response.ok) {
        setSavedImage(true);
        setTimeout(() => {
          setSavedImage(false);
        }, 2000);
      } else {
        const error = await response.json();
        console.error('Save failed:', error);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSavingImage(false);
    }
  }, [savingImage, savedImage, messageId, chatId]);

  // 다운로드 핸들러
  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 파일 다운로드 링크 생성 (갱신된 URL 사용)
    const link = document.createElement('a');
    link.href = refreshedUrl;
    link.download = attachment.name || 'download';
    link.target = '_blank';
    
    // 링크를 DOM에 추가하고 클릭한 후 제거
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isImage) {
    // 🚀 ChatGPT STYLE: 고정 크기 400px (모바일/데스크탑 동일)
    return (
      <>
        <div className="relative" style={{ maxWidth: '400px' }}>
          <ImageGalleryStack
            images={[{
              src: refreshedUrl,
              alt: attachment.name || 'Image Attachment'
            }]}
            onSingleImageClick={() => {
              openImageModal();
            }}
            isMobile={isMobile}
            chatId={chatId}
            messageId={messageId}
          />
        </div>

        {/* 이미지 모달 */}
        <ImageModal
          isOpen={showImageModal}
          imageUrl={refreshedUrl}
          imageAlt={attachment.name || 'Image Attachment'}
          onClose={closeImageModal}
          enableDownload={true}
          enableSave={true}
          enableUrlRefresh={true}
          messageId={messageId}
          chatId={chatId}
          userId={undefined}
          showPromptButton={false}
          isMobile={isMobile}
          isSaving={savingImage}
          isSaved={savedImage}
          onSave={handleModalSave}
        />
      </>
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