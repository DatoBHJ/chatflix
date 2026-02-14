import React, { useCallback } from 'react';
import { Maximize } from 'lucide-react';
import { getIcon } from 'material-file-icons';

/** Workspace file card shown inside chat markdown (opens modal). */
export function WorkspaceFilePathCard({
  path,
  onOpen,
}: {
  path: string;
  onOpen: (path: string) => void;
}) {
  const filename = path.replace(/^.*[/\\]/, '') || 'file';
  const icon = getIcon(filename);

  // Rough type label from extension
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const typeLabel = ext.toUpperCase() || 'File';

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!path) return;
    onOpen(path);
  }, [path, onOpen]);

  return (
    <div
      className="imessage-file-bubble"
      onClick={handleOpen}
      style={{ cursor: 'pointer' }}
    >
      <div className="shrink-0">
        <div
          style={{ width: '24px', height: '24px' }}
          dangerouslySetInnerHTML={{ __html: icon.svg }}
        />
      </div>
      <div className="flex-1 text-left overflow-hidden">
        <p className="font-medium truncate text-sm text-black/60 dark:text-white/80">{filename}</p>
        <p className="text-xs text-black/40 dark:text-white/60">{typeLabel}</p>
      </div>
      <div className="p-1">
        <button
          onClick={handleOpen}
          className="hover:bg-black/10 dark:hover:bg-white/10 rounded p-1 transition-colors"
          title="Open file"
        >
          <Maximize className="text-neutral-500" size={20} />
        </button>
      </div>
    </div>
  );
}

