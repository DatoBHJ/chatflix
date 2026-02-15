import React, { useCallback } from 'react';
import { Download } from 'lucide-react';
import { getIcon } from 'material-file-icons';

/** Workspace file card shown inside chat markdown (opens modal). 스타일: 도구 미리보기(diff-inline-preview)와 동일. */
export function WorkspaceFilePathCard({
  path,
  onOpen,
}: {
  path: string;
  onOpen: (path: string) => void;
}) {
  const filename = path.replace(/^.*[/\\]/, '') || 'file';
  const icon = getIcon(filename);

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const typeLabel = ext ? `${ext.toUpperCase()} file` : 'File';

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!path) return;
    onOpen(path);
  }, [path, onOpen]);

  return (
    <div
      className="diff-inline-preview"
      onClick={handleOpen}
      onTouchStart={(e) => e.stopPropagation()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(e as any); } }}
      style={{ cursor: 'pointer', touchAction: 'manipulation' }}
      title={path}
    >
      <div className="diff-header">
        <div className="shrink-0" style={{ width: 18, height: 18 }} dangerouslySetInnerHTML={{ __html: icon.svg }} />
        <span className="diff-filename">{filename}</span>
        <span className="text-xs text-(--muted) shrink-0 truncate max-w-[120px]">{typeLabel}</span>
        <Download className="w-3.5 h-3.5 text-(--muted) shrink-0" aria-hidden />
      </div>
    </div>
  );
}

