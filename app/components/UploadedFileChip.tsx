'use client';

import React, { memo } from 'react';
import { getIcon } from 'material-file-icons';

export interface UploadedFileChipProps {
  filename: string;
  className?: string;
}

const UploadedFileChip = memo(function UploadedFileChip({
  filename,
  className = '',
}: UploadedFileChipProps) {
  const icon = getIcon(filename || 'file');
  const safeName = filename || 'file';

  return (
    <span
      className={`inline-flex items-center gap-1.5 align-middle rounded-full overflow-hidden shrink-0 text-xs text-white px-2 py-0.5 bg-black/50 dark:bg-white/25 ${className}`}
      style={{ maxWidth: '100%' }}
    >
      <span
        className="w-[1em] h-[1em] min-w-[1em] min-h-[1em] overflow-hidden shrink-0"
        dangerouslySetInnerHTML={{ __html: icon.svg }}
      />
      <span className="truncate font-medium" title={safeName}>
        {safeName}
      </span>
    </span>
  );
});

export { UploadedFileChip };
