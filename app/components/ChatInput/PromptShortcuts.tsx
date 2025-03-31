// app/components/chat/ChatInput/PromptShortcuts.tsx
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { PromptShortcutsProps, PromptShortcut } from './types';

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
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<PromptShortcut | null>(null);
  const supabase = createClient();
  
  const positionClass = popupPosition === 'top' 
    ? 'bottom-full mb-2' 
    : 'top-full mt-12';
    
  // Auto-scroll to the selected item when selectedIndex changes
  useEffect(() => {
    if (!shortcutsListRef.current || shortcuts.length === 0) return;
    
    const scrollToSelectedItem = () => {
      const listElement = shortcutsListRef.current;
      if (!listElement) return;
      
      const items = listElement.querySelectorAll('.shortcut-item');
      if (!items[selectedIndex]) return;

      const item = items[selectedIndex] as HTMLElement;
      const itemRect = item.getBoundingClientRect();
      const listRect = listElement.getBoundingClientRect();

      // Check if scrolling is needed
      if (itemRect.bottom > listRect.bottom) {
        // Need to scroll down
        const scrollDistance = itemRect.bottom - listRect.bottom;
        listElement.scrollBy({ 
          top: scrollDistance + 8, // Add some padding
          behavior: 'smooth'
        });
      } else if (itemRect.top < listRect.top) {
        // Need to scroll up
        const scrollDistance = listRect.top - itemRect.top;
        listElement.scrollBy({ 
          top: -scrollDistance - 8, // Add some padding
          behavior: 'smooth'
        });
      }
    };
    
    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(scrollToSelectedItem, 50);
    return () => clearTimeout(timeoutId);
  }, [selectedIndex, shortcuts.length, shortcutsListRef]);
  
  const handleAddOrUpdateShortcut = async () => {
    if (!newName.trim() || !newContent.trim()) return;
    
    try {
      setIsSaving(true);
      const formattedName = newName.trim().replace(/\s+/g, '_');
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      if (editingShortcut) {
        // Update existing shortcut
        const { error } = await supabase
          .from('prompt_shortcuts')
          .update({
            name: formattedName,
            content: newContent.trim(),
          })
          .eq('id', editingShortcut.id)
          .eq('user_id', userId);
          
        if (error) throw error;
      } else {
        // Create new shortcut
        const { error } = await supabase
          .from('prompt_shortcuts')
          .insert({
            id: `ps-${Date.now()}`,
            name: formattedName,
            content: newContent.trim(),
            user_id: userId
          });
          
        if (error) throw error;
      }
      
      // Reset form and hide it
      resetForm();
      closeShortcutsPopup();
      
    } catch (error) {
      console.error('Error saving shortcut:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteShortcut = async (shortcut: PromptShortcut, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection of the shortcut
    e.preventDefault(); // Prevent any default behavior
    
    if (!confirm(`Are you sure you want to delete shortcut @${shortcut.name}?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('prompt_shortcuts')
        .delete()
        .eq('id', shortcut.id)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);
        
      if (error) throw error;
      
      // Refresh shortcuts (this would require adding a callback to reload shortcuts)
      closeShortcutsPopup();
      
    } catch (error) {
      console.error('Error deleting shortcut:', error);
    }
  };
  
  const handleEditShortcut = (shortcut: PromptShortcut, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection of the shortcut
    e.preventDefault(); // Prevent any default behavior
    
    setEditingShortcut(shortcut);
    setNewName(shortcut.name);
    setNewContent(shortcut.content);
    setShowInlineForm(true);
  };
  
  const resetForm = () => {
    setNewName('');
    setNewContent('');
    setShowInlineForm(false);
    setEditingShortcut(null);
  };
  
  if (!showShortcuts) return null;
  
  return (
    <div className={`absolute ${positionClass} left-0 right-0 z-40`}>
      <div className="bg-[var(--background)]/95 backdrop-blur-xl shortcuts-container">
        {/* 커스터마이징 버튼 또는 인라인 폼 */}
        {showInlineForm ? (
          <div className="p-4 space-y-3 bg-[var(--accent)]/10">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">
                {editingShortcut ? 'Edit Shortcut' : 'Add New Shortcut'}
              </h3>
              <button 
                onClick={resetForm}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                type="button"
              >
                ×
              </button>
            </div>
            
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full p-2 bg-[var(--accent)] text-sm focus:outline-none rounded"
              placeholder="Shortcut name (without @)"
              autoFocus
            />
            
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full min-h-[100px] p-2 bg-[var(--accent)] text-sm resize-none focus:outline-none rounded"
              placeholder="Prompt content"
            />
            
            <div className="flex gap-2">
              <button
                onClick={handleAddOrUpdateShortcut}
                disabled={!newName.trim() || !newContent.trim() || isSaving}
                className="flex-1 py-2 text-xs uppercase tracking-wider bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity disabled:opacity-50 rounded"
                type="button"
              >
                {isSaving ? 'Saving...' : (editingShortcut ? 'Update' : 'Save Shortcut')}
              </button>
              <button
                onClick={resetForm}
                className="w-24 py-2 text-xs uppercase tracking-wider bg-[var(--accent)] hover:opacity-90 transition-opacity rounded"
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowInlineForm(true)}
            className="w-full px-4 py-3 text-left transition-all duration-300 group relative overflow-hidden bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20"
            type="button"
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
        )}
        
        {/* 스크롤 가능한 숏컷 목록 */}
        {!showInlineForm && (
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
                  <div
                    key={shortcut.id}
                    className={`shortcut-item group ${index === selectedIndex ? 'selected' : ''} flex items-center justify-between`}
                  >
                    <button
                      onClick={() => handleShortcutSelect(shortcut)}
                      className="flex-1 flex flex-col gap-1 text-left pr-2"
                      type="button"
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
                    <div className="flex gap-1 items-center ml-2 min-w-[60px] justify-end">
                      <button
                        onClick={(e) => handleEditShortcut(shortcut, e)}
                        className="p-1.5 rounded-md bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 transition-colors"
                        title="Edit shortcut"
                        type="button"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDeleteShortcut(shortcut, e)}
                        className="p-1.5 rounded-md bg-[var(--accent)]/20 hover:bg-red-500/20 transition-colors"
                        title="Delete shortcut"
                        type="button"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-3 text-sm text-[var(--muted)] text-center">
                No shortcuts found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}