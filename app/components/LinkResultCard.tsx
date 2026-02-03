'use client';

import React, { useMemo, useState } from 'react';
import { ExternalLink, ImageIcon } from 'lucide-react';

import { extractDomain, formatPublishedDate, getSeedGradient } from '@/app/lib/linkCardUtils';
import type { LinkCardData } from '@/app/types/linkPreview';

const highlightPhrases = (text: string, phrases: string[]) => {
  if (!phrases || phrases.length === 0 || !text) return text;

  const escaped = phrases
    .filter(phrase => phrase && phrase.trim().length > 0)
    .map(phrase => phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (escaped.length === 0) return text;

  const regex = new RegExp(`(${escaped.join('|')})`, 'giu');
  const parts = text.split(regex);
  const highlightClass =
    'px-0.5 rounded font-medium transition-colors bg-[#007AFF]/20 text-[#007AFF] dark:bg-[#007AFF]/30 dark:text-[#58a6ff]';

  return parts.map((part, index) => {
    const isMatch = escaped.some(phrase => new RegExp(`^${phrase}$`, 'i').test(part));
    if (isMatch) {
      return (
        <span key={`${part}-${index}`} className={highlightClass}>
          {part}
        </span>
      );
    }
    return part;
  });
};

interface LinkResultCardProps {
  data: LinkCardData;
  variant?: 'default' | 'compact';
  className?: string;
  hideThumbnail?: boolean;
}

export const LinkResultCard = ({ data, variant = 'default', className, hideThumbnail }: LinkResultCardProps) => {
  const [thumbnailError, setThumbnailError] = useState(false);

  const normalizedData = useMemo(() => {
    const formattedDate = formatPublishedDate(data.publishedDate);
    const domainLabel = data.domain || extractDomain(data.url);
    const fallbackSeed = data.fallbackSeed || data.url;
    const fallbackGradient = getSeedGradient(fallbackSeed);
    const displayDomain = data.metadata?.publisher || domainLabel;
    const displayTitle = data.title || data.metadata?.title || displayDomain;
    const displaySummary =
      data.summary || data.content || data.metadata?.description || 'No description available.';
    const highlightList =
      data.snippetHighlightedWords && data.snippetHighlightedWords.length > 0
        ? data.snippetHighlightedWords
        : undefined;

    return {
      formattedDate,
      domainLabel,
      fallbackGradient,
      displayDomain,
      displayTitle,
      displaySummary,
      highlightList
    };
  }, [data]);

  const hasThumbnail = Boolean(data.thumbnail) && !thumbnailError;
  const faviconUrl = data.metadata?.favicon;

  const heroHeight = variant === 'compact' ? 'h-32 md:h-40' : 'h-40 md:h-48';
  const textPadding = variant === 'compact' ? 'px-4 py-4' : 'px-5 py-6';
  const gapSpacing = variant === 'compact' ? 'gap-2.5' : 'gap-3';
  const titleClass = variant === 'compact' ? 'text-xl font-bold' : 'text-2xl font-bold';
  const summaryClass = variant === 'compact' ? 'text-sm' : 'text-base';

  return (
    <article className={`h-full ${className || ''}`}>
      <a
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col h-full rounded-2xl border border-[var(--subtle-divider)] bg-[var(--background)] overflow-hidden cursor-pointer"
      >
        {!hideThumbnail && (
          <div className={`relative ${heroHeight} bg-[var(--accent)]`}>
            {hasThumbnail ? (
              <img
                src={data.thumbnail || ''}
                alt={data.title || data.metadata?.title || extractDomain(data.url)}
                className="h-full w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setThumbnailError(true)}
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center text-white text-center px-6"
                style={{ backgroundImage: normalizedData.fallbackGradient }}
              >
                <p className="text-xl md:text-2xl font-bold tracking-wide uppercase opacity-90">
                  {normalizedData.domainLabel}
                </p>
              </div>
            )}
          </div>
        )}

        <div className={`flex flex-col ${gapSpacing} ${textPadding}`}>
          <div className="text-[12px] uppercase tracking-[0.2em] text-[var(--muted)] flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1">
              {faviconUrl ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className="h-3.5 w-3.5 rounded-sm object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <ImageIcon className="h-3 w-3" strokeWidth={1.5} />
              )}
              {normalizedData.displayDomain}
            </span>
            {normalizedData.formattedDate && (
              <>
                <span className="w-1 h-1 rounded-full bg-[var(--subtle-divider)]" />
                <span className="tracking-normal">{normalizedData.formattedDate}</span>
              </>
            )}
          </div>

          <h3 className={`${titleClass} text-[var(--foreground)] leading-snug line-clamp-3`}>
            {normalizedData.displayTitle}
          </h3>

          <p className={`${summaryClass} text-[var(--muted)] leading-relaxed line-clamp-4`}>
            {normalizedData.highlightList
              ? highlightPhrases(normalizedData.displaySummary, normalizedData.highlightList)
              : normalizedData.displaySummary}
          </p>

          {/* <div className="flex items-center text-xs text-[var(--muted)] pt-3 border-t border-[var(--subtle-divider)]">
            <span className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
              Visit
            </span>
          </div> */}
        </div>
      </a>
    </article>
  );
};

