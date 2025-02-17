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

  return (
    <div className="relative">
      <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2 sticky bottom-0 bg-transparent p-1 md:p-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputWithShortcuts}
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!isLoading && input.trim()) {
                handleSubmit(e as any);
              }
            }
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
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--background)] border border-[var(--accent)]">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.id}
              onClick={() => handleShortcutSelect(shortcut)}
              className="w-full px-4 py-2 text-left hover:bg-[var(--accent)] transition-colors"
            >
              <span className="text-[var(--muted)]">@{shortcut.name}</span>
              <span className="ml-2 text-xs text-[var(--muted)]">{shortcut.content}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 