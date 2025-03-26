// app/components/chat/ChatInput/PromptShortcuts.tsx
import { openShortcutsDialog } from '../PromptShortcutsDialog';
import { PromptShortcutsProps } from './types';


export function PromptShortcuts({
  showShortcuts,
  shortcuts,
  selectedIndex,
  searchTerm,
  handleShortcutSelect,
  closeShortcutsPopup,
  popupPosition,
  shortcutsListRef
}: PromptShortcutsProps) {
  if (!showShortcuts) return null;
  
  const positionClass = popupPosition === 'top' 
    ? 'bottom-full mb-2' 
    : 'top-full mt-12';
  
  return (
    <div className={`absolute ${positionClass} left-0 right-0 z-40`}>
      <div className="bg-[var(--background)]/95 backdrop-blur-xl shortcuts-container">
        {/* 커스터마이징 버튼 */}
        <button
          onClick={() => {
            closeShortcutsPopup();
            openShortcutsDialog();
          }}
          className="w-full px-4 py-3 text-left transition-all duration-300 group relative overflow-hidden bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/10 to-transparent opacity-100 transition-opacity duration-300" />
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-[var(--accent)]/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                <svg 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  className="text-[var(--foreground)] transition-colors transform rotate-0 duration-300"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-xs tracking-wide text-[var(--foreground)] transition-colors font-medium">
                CLICK TO CUSTOMIZE SHORTCUTS
                </span>
                <span className="text-[10px] text-[var(--muted)] transition-colors">
                  Add or modify your custom prompts
                </span>
              </div>
            </div>
          </div>
        </button>
        
        {/* 스크롤 가능한 숏컷 목록 */}
        <div 
          ref={shortcutsListRef}
          className="max-h-60 overflow-y-auto"
        >
          {shortcuts.length > 0 ? (
            shortcuts.map((shortcut, index) => {
              // 이름 하이라이팅 처리
              const name = shortcut.name;
              const highlightRanges = shortcut.highlight_ranges || [];
              
              // 하이라이트된 이름 생성
              let highlightedName;
              
              if (highlightRanges.length > 0 && searchTerm) {
                // DB에서 전달받은 하이라이트 범위 사용
                const parts: React.ReactNode[] = [];
                let lastEnd = 0;
                
                highlightRanges.forEach(range => {
                  // 하이라이트 전 텍스트
                  if (range.start > lastEnd) {
                    parts.push(name.substring(lastEnd, range.start));
                  }
                  
                  // 하이라이트된 부분
                  parts.push(
                    <span key={`${range.start}-${range.end}`} className="highlight">
                      {name.substring(range.start, range.end)}
                    </span>
                  );
                  
                  lastEnd = range.end;
                });
                
                // 남은 부분
                if (lastEnd < name.length) {
                  parts.push(name.substring(lastEnd));
                }
                
                highlightedName = <>{parts}</>;
              } else {
                // 기본 이름 표시
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
}