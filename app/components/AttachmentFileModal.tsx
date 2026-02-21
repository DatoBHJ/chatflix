'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, X } from 'lucide-react';

import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle';
import { useUrlRefresh } from '@/app/hooks/useUrlRefresh';
import { AttachmentViewer } from './AttachmentViewer';

export function AttachmentFileModal({
  isOpen,
  isMobile,
  attachment,
  onClose,
}: {
  isOpen: boolean;
  isMobile: boolean;
  attachment: { name?: string; url: string; contentType?: string; metadata?: { fileSize?: number }; [k: string]: unknown } | null;
  onClose: () => void;
}) {
  const filename = attachment?.name || 'file';
  const [isFastClosing, setIsFastClosing] = useState(false);
  const closeRafRef = useRef<number | null>(null);
  const { refreshedUrl, isRefreshing, refreshError } = useUrlRefresh({
    url: attachment?.url ?? '',
    enabled: !!attachment?.url && isOpen,
  });
  useEffect(() => {
    if (isOpen) {
      setIsFastClosing(false);
    }
  }, [isOpen, attachment?.url]);
  useEffect(() => {
    return () => {
      if (closeRafRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(closeRafRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    if (refreshedUrl) navigator.clipboard.writeText(refreshedUrl);
  };

  const handleDownload = () => {
    if (!refreshedUrl) return;
    const a = document.createElement('a');
    a.href = refreshedUrl;
    a.download = filename;
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    a.click();
  };

  const requestClose = useCallback(() => {
    if (isFastClosing) return;
    setIsFastClosing(true);
    if (typeof window === 'undefined') {
      onClose();
      return;
    }
    closeRafRef.current = window.requestAnimationFrame(() => {
      closeRafRef.current = window.requestAnimationFrame(() => {
        closeRafRef.current = null;
        onClose();
      });
    });
  }, [isFastClosing, onClose]);

  if (!isOpen || !attachment) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-9999 transition-opacity duration-75"
      style={{ touchAction: 'none', overflow: 'hidden', opacity: isFastClosing ? 0 : 1, pointerEvents: isFastClosing ? 'none' : 'auto' }}
    >
      {isMobile ? (
        <>
          <div className="fixed inset-0 bg-transparent" onClick={requestClose} style={{ touchAction: 'none' }} />

          <div
            className="fixed inset-x-0 bottom-0 w-full flex flex-col overflow-hidden rounded-t-3xl"
            style={{
              height: 'calc(100vh - 120px)',
              maxHeight: 'calc(100vh - 120px)',
              transform: 'translateY(0px)',
              transition: 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.25s ease-out',
              willChange: 'transform, opacity',
              opacity: 1,
              ...getAdaptiveGlassStyleBlur(),
              backgroundColor: (typeof window !== 'undefined' && (
                document.documentElement.getAttribute('data-theme') === 'dark' ||
                (document.documentElement.getAttribute('data-theme') === 'system' &&
                  window.matchMedia('(prefers-color-scheme: dark)').matches)
              )) ? 'rgba(30, 30, 30, 0.6)' : 'rgba(240, 240, 240, 0.6)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              zIndex: 9999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center pt-4 pb-4 shrink-0">
              <div className="w-12 h-1.5 rounded-full mx-auto" style={{ backgroundColor: 'rgba(209, 213, 219, 0.3)' }} />
            </div>

            <div className="relative flex items-center justify-center py-6 px-6 shrink-0">
              <h2 className="text-2xl font-bold truncate" style={{ color: 'var(--foreground)', maxWidth: 'calc(100vw - 48px)' }}>
                {filename}
              </h2>
            </div>

            {/* 액션 행: WorkspaceFileModal과 동일 */}
            <div className="shrink-0 flex items-center gap-3 pt-2 pb-6 px-4">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                className="flex items-center gap-2 px-3 py-2 rounded-full min-w-0"
                style={{ ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)', WebkitTapHighlightColor: 'transparent' }}
                title="Copy"
              >
                <Copy size={16} />
                <span className="text-[10px] tracking-wider font-bold">Copy</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                className="flex items-center gap-2 px-3 py-2 rounded-full min-w-0"
                style={{ ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)', WebkitTapHighlightColor: 'transparent' }}
                title="Download"
              >
                <Download size={16} />
                <span className="text-[10px] tracking-wider font-bold">Download</span>
              </button>
            </div>

            {/* 컨텐츠: WorkspaceFileModal과 동일 구조 */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 pb-6">
              <div
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
                style={{
                  WebkitUserSelect: 'text',
                  userSelect: 'text',
                  touchAction: 'pan-y',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                {refreshError && (
                  <div className="text-sm text-red-500">{refreshError}</div>
                )}
                {!refreshError && (
                  <div className="p-4 rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
                    <AttachmentViewer attachment={attachment} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="fixed inset-0 text-(--foreground) pointer-events-auto" style={{ zIndex: 9999 }}>
          <div
            className="fixed inset-0 min-h-screen w-full pointer-events-none"
            style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', zIndex: 0.5 }}
          />
          <div className="absolute inset-0 pointer-events-auto" style={{ backgroundColor: 'transparent', zIndex: 1 }} onClick={requestClose} />

          <div className="relative h-full w-full flex flex-col transform-gpu" style={{ zIndex: 2 }} onClick={(e) => e.stopPropagation()}>
            <button
              aria-label="Close"
              className="absolute top-3 right-3 rounded-full p-2 z-10 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
              onClick={requestClose}
              style={{ outline: '0 !important', WebkitTapHighlightColor: 'transparent', ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)' }}
            >
              <X size={20} />
            </button>

            <div className="px-12 sm:px-16 md:px-20 lg:px-28 pt-12 sm:pt-30 pb-24 overflow-y-auto">
              {/* 제목: WorkspaceFileModal과 동일 */}
              <div className="flex items-center justify-between">
                <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight truncate min-w-0" style={{ color: 'var(--foreground)' }}>
                  {filename}
                </h2>
                <div />
              </div>

              {/* mt-12: 액션+컨텐츠 - WorkspaceFileModal과 동일 */}
              <div className="mt-12 ml-1">
                <div className="flex items-center gap-3 mb-8">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{ ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)', WebkitTapHighlightColor: 'transparent' }}
                    title="Copy"
                  >
                    <Copy size={18} />
                    <span className="text-xs font-semibold">Copy</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{ ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)', WebkitTapHighlightColor: 'transparent' }}
                    title="Download"
                  >
                    <Download size={18} />
                    <span className="text-xs font-semibold">Download</span>
                  </button>
                </div>
                {refreshError && (
                  <div className="text-sm text-red-500">{refreshError}</div>
                )}
                {!refreshError && (
                  <div className="p-4 rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
                    <AttachmentViewer attachment={attachment} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
