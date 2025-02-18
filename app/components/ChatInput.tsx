import { FormEvent, useEffect, useRef, useState } from 'react';
import { IconStop } from './icons';
import { createClient } from '@/utils/supabase/client';

interface PromptShortcut {
  id: string;
  name: string;
  content: string;
}

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  stop: () => void;
  disabled?: boolean;
  placeholder?: string;
  user: any;
}

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  disabled,
  placeholder = "Type your message...",
  user
}: ChatInputProps) {
  const inputRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shortcuts, setShortcuts] = useState<PromptShortcut[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPosition, setMentionStartPosition] = useState<number | null>(null);
  const supabase = createClient();

  // Add autofocus effect
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle input change with shortcut detection
  const handleInputWithShortcuts = async () => {
    if (!inputRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const content = inputRef.current.textContent || '';
    
    // Simulate the onChange event for parent component
    const event = {
      target: { value: content }
    } as React.ChangeEvent<HTMLTextAreaElement>;
    handleInputChange(event);

    // Find the last @ symbol before cursor
    const cursorPosition = range.startOffset;
    const textBeforeCursor = content.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const afterAt = content.slice(lastAtSymbol + 1);
      const spaceAfterAt = afterAt.indexOf(' ');
      
      if (spaceAfterAt === -1) {
        setMentionStartPosition(lastAtSymbol);
        setSearchTerm(afterAt);
        const { data, error } = await supabase.rpc('search_prompt_shortcuts', {
          p_user_id: user.id,
          p_search_term: afterAt
        });

        if (!error && data) {
          setShortcuts(data);
          setShowShortcuts(true);
        }
      } else {
        setShowShortcuts(false);
        setMentionStartPosition(null);
      }
    } else {
      setShowShortcuts(false);
      setMentionStartPosition(null);
    }
  };

  // Handle shortcut selection
  const handleShortcutSelect = (shortcut: PromptShortcut) => {
    if (!inputRef.current || mentionStartPosition === null) return;
    
    const content = inputRef.current.textContent || '';
    const beforeMention = content.slice(0, mentionStartPosition);
    const afterMention = content.slice(mentionStartPosition).split(' ').slice(1).join(' ');
    
    // Create mention span
    const mentionSpan = document.createElement('span');
    mentionSpan.className = 'mention-tag';
    mentionSpan.contentEditable = 'false';
    mentionSpan.dataset.shortcutId = shortcut.id;
    mentionSpan.textContent = `@${shortcut.name}`;
    
    // Clear and update content
    inputRef.current.innerHTML = '';
    if (beforeMention) {
      inputRef.current.appendChild(document.createTextNode(beforeMention));
    }
    inputRef.current.appendChild(mentionSpan);
    // Always add a space after the mention
    inputRef.current.appendChild(document.createTextNode(' '));
    if (afterMention) {
      inputRef.current.appendChild(document.createTextNode(afterMention));
    }
    
    // Update parent component
    const event = {
      target: { value: `${beforeMention}${shortcut.content}${afterMention ? ' ' + afterMention : ' '}` }
    } as React.ChangeEvent<HTMLTextAreaElement>;
    handleInputChange(event);
    
    setShowShortcuts(false);
    setMentionStartPosition(null);
    
    // Move cursor after the space
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStartAfter(mentionSpan.nextSibling as Node);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showShortcuts && shortcuts.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % shortcuts.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + shortcuts.length) % shortcuts.length);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleShortcutSelect(shortcuts[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowShortcuts(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = inputRef.current?.textContent || '';
      if (!isLoading && content.trim()) {
        const event = {
          preventDefault: () => {},
        } as FormEvent<HTMLFormElement>;
        handleSubmit(event);
        // Clear input after submission
        if (inputRef.current) {
          inputRef.current.innerHTML = '';
        }
      }
    }
  };

  // Reset selected index when shortcuts change
  useEffect(() => {
    setSelectedIndex(0);
  }, [shortcuts]);

  return (
    <div className="relative">
      <form ref={formRef} onSubmit={(e) => {
        handleSubmit(e);
        // Clear input after submission
        if (inputRef.current) {
          inputRef.current.innerHTML = '';
        }
      }} className="flex gap-2 sticky bottom-0 bg-transparent p-1 md:p-0">
        <div
          ref={inputRef}
          contentEditable
          onInput={handleInputWithShortcuts}
          onKeyDown={handleKeyDown}
          className={`yeezy-input flex-1 text-base md:text-lg transition-opacity duration-200 overflow-y-auto whitespace-pre-wrap
            ${isLoading ? 'opacity-50' : 'opacity-100'}`}
          style={{ 
            minHeight: '44px',
            maxHeight: window.innerWidth <= 768 ? '120px' : '200px'
          }}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
        {isLoading ? (
          <button 
            onClick={(e) => { e.preventDefault(); stop(); }} 
            type="button"
            className="yeezy-button flex items-center gap-2 bg-red-500 hover:bg-red-600 transition-colors"
          >
            <IconStop />
            <span className="hidden md:inline">Stop</span>
          </button>
        ) : (
          <button 
            type="submit" 
            className={`text-start transition-opacity duration-200 ${
              !(inputRef.current?.textContent || '').trim() ? 'opacity-50 cursor-not-allowed' : 'opacity-100'
            }`}
            disabled={disabled || isLoading || !(inputRef.current?.textContent || '').trim()}
          >
            <span>↑</span>
          </button>
        )}
      </form>

      {/* Shortcuts Popup */}
      {showShortcuts && shortcuts.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 px-2">
          <div className="w-[calc(100vw-32px)] max-w-[280px] sm:max-w-md bg-[var(--background)] border border-[var(--accent)]">
            {shortcuts.map((shortcut, index) => (
              <button
                key={shortcut.id}
                onClick={() => handleShortcutSelect(shortcut)}
                className={`w-full px-4 py-3 text-left hover:bg-[var(--accent)] transition-colors
                         ${index === selectedIndex ? 'bg-[var(--accent)]' : ''}`}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium tracking-wide">@{shortcut.name}</span>
                  <span className="text-xs text-[var(--muted)] line-clamp-1">{shortcut.content}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 