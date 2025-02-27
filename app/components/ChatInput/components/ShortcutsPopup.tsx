import { useRef, useEffect } from 'react';
import { ShortcutsPopupProps } from '../types';
import { openShortcutsDialog } from '@/app/components/PromptShortcutsDialog';

export const ShortcutsPopup: React.FC<ShortcutsPopupProps & { position?: 'top' | 'bottom' }> = ({
  showShortcuts,
  shortcuts,
  selectedIndex,
  searchTerm,
  handleShortcutSelect,
  closeShortcutsPopup,
  position = 'top'
}) => {
  const shortcutsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shortcutsListRef.current) {
      const listElement = shortcutsListRef.current;
      const items = listElement.getElementsByTagName('button');
      if (!items[selectedIndex]) return;

      const item = items[selectedIndex];
      const itemRect = item.getBoundingClientRect();
      const listRect = listElement.getBoundingClientRect();

      if (itemRect.bottom > listRect.bottom) {
        const scrollDistance = itemRect.bottom - listRect.bottom;
        listElement.scrollBy({ 
          top: scrollDistance + 8,
          behavior: 'smooth'
        });
      } else if (itemRect.top < listRect.top) {
        const scrollDistance = listRect.top - itemRect.top;
        listElement.scrollBy({ 
          top: -scrollDistance - 8,
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex]);

  if (!showShortcuts) return null;

  return (
    <div className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 right-0 z-40`}>
      <div className="bg-[var(--background)]/95 backdrop-blur-xl shortcuts-container">
        <button
          onClick={() => {
            closeShortcutsPopup();
            openShortcutsDialog();
          }}
          className="w-full px-4 py-6 text-left transition-all duration-200 group relative overflow-hidden hover:bg-[var(--accent)]/5"
        >
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-[var(--accent)]/10 flex items-center justify-center transition-all duration-200">
                <svg 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  className="text-[var(--foreground)] transition-transform duration-200 group-hover:rotate-12"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-xs tracking-wide text-[var(--foreground)] font-medium">
                  CUSTOMIZE SHORTCUTS
                </span>
                <span className="text-[10px] text-[var(--muted)]">
                  Add or modify your custom prompts
                </span>
              </div>
            </div>
            <div className="flex items-center text-[var(--muted)]">
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </div>
          </div>
        </button>
        
        <div 
          ref={shortcutsListRef}
          className="max-h-40 overflow-y-auto"
        >
          {shortcuts.length > 0 ? (
            shortcuts.map((shortcut, index) => {
              const name = shortcut.name;
              const highlightRanges = shortcut.highlight_ranges || [];
              
              let highlightedName;
              
              if (highlightRanges.length > 0 && searchTerm) {
                const parts: React.ReactNode[] = [];
                let lastEnd = 0;
                
                highlightRanges.forEach(range => {
                  if (range.start > lastEnd) {
                    parts.push(name.substring(lastEnd, range.start));
                  }
                  
                  parts.push(
                    <span key={`${range.start}-${range.end}`} className="highlight">
                      {name.substring(range.start, range.end)}
                    </span>
                  );
                  
                  lastEnd = range.end;
                });
                
                if (lastEnd < name.length) {
                  parts.push(name.substring(lastEnd));
                }
                
                highlightedName = <>{parts}</>;
              } else {
                highlightedName = name;
              }
              
              return (
                <button
                  key={shortcut.id}
                  onClick={() => handleShortcutSelect(shortcut)}
                  className={`shortcut-item ${index === selectedIndex ? 'selected' : ''}`}
                >
                  {index === selectedIndex && <div className="indicator" />}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium tracking-wide">
                      @{highlightedName}
                    </span>
                    <span className="text-xs line-clamp-2 text-[var(--muted)]">
                      {shortcut.content.substring(0, 80)}{shortcut.content.length > 80 ? '...' : ''}
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-3 text-sm text-[var(--muted)] text-center">
              No shortcuts found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 