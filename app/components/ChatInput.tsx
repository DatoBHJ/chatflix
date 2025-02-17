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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shortcuts, setShortcuts] = useState<PromptShortcut[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const supabase = createClient();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Adjust max height based on screen size
      const isMobile = window.innerWidth <= 768;
      const maxHeight = isMobile ? 120 : 200; // Smaller max height on mobile
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  // Scroll to bottom when textarea grows
  useEffect(() => {
    const form = formRef.current;
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [input]);

  // Handle input change with shortcut detection
  const handleInputWithShortcuts = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    handleInputChange(e);

    // Check for @ symbol
    const lastAtSymbol = newValue.lastIndexOf('@');
    if (lastAtSymbol !== -1) {
      const afterAt = newValue.slice(lastAtSymbol + 1);
      const spaceAfterAt = afterAt.indexOf(' ');
      
      if (spaceAfterAt === -1) {
        // Search for shortcuts
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
      }
    } else {
      setShowShortcuts(false);
    }
  };

  // Handle shortcut selection
  const handleShortcutSelect = (shortcut: PromptShortcut) => {
    if (textareaRef.current) {
      const currentValue = textareaRef.current.value;
      const lastAtSymbol = currentValue.lastIndexOf('@');
      const newValue = currentValue.slice(0, lastAtSymbol) + shortcut.content + ' ';
      
      const event = {
        target: { value: newValue }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      
      handleInputChange(event);
      setShowShortcuts(false);
      textareaRef.current.focus();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      if (!isLoading && input.trim()) {
        handleSubmit(e as any);
      }
    }
  };

  // Reset selected index when shortcuts change
  useEffect(() => {
    setSelectedIndex(0);
  }, [shortcuts]);

  return (
    <div className="relative">
      <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2 sticky bottom-0 bg-transparent p-1 md:p-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputWithShortcuts}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className={`yeezy-input flex-1 text-base md:text-lg transition-opacity duration-200 resize-none overflow-y-auto
            ${isLoading ? 'opacity-50' : 'opacity-100'}`}
          disabled={disabled || isLoading}
          autoFocus
          style={{ 
            minHeight: '44px',
            maxHeight: window.innerWidth <= 768 ? '120px' : '200px'
          }}
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
            className={`yeezy-button transition-opacity duration-200 ${
              !input.trim() ? 'opacity-50 cursor-not-allowed' : 'opacity-100'
            }`}
            disabled={disabled || isLoading || !input.trim()}
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
                className={`w-full px-3 py-2 text-left hover:bg-[var(--accent)] transition-colors
                         ${index === selectedIndex ? 'bg-[var(--accent)]' : ''}`}
              >
                <div className="flex items-baseline gap-2 truncate">
                  <span className="text-[var(--muted)] shrink-0">@{shortcut.name}</span>
                  <span className="text-xs text-[var(--muted)] truncate">{shortcut.content}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 