'use client';

import React, { memo } from 'react';

export interface UploadedImageChipProps {
  url: string;
  /** Label shown next to the thumbnail (e.g. "image 1", "image 2"). */
  label: string;
  className?: string;
}

const UploadedImageChip = memo(function UploadedImageChip({
  url,
  label,
  className = '',
}: UploadedImageChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 align-middle rounded-full overflow-hidden shrink-0 text-xs text-white px-2 py-0.5 bg-black/50 dark:bg-white/25 ${className}`}
      style={{ maxWidth: '100%' }}
    >
      <span
        className="w-[1em] h-[1em] min-w-[1em] min-h-[1em] rounded-full overflow-hidden shrink-0 ring-1 ring-white/20"
      >
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover block"
          loading="lazy"
        />
      </span>
      <span className="truncate font-medium" title={label}>
        {label}
      </span>
    </span>
  );
});

export { UploadedImageChip };
