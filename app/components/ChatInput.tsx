import { FormEvent, useEffect, useRef, useState } from 'react';
import { IconStop } from './icons';
import { createClient } from '@/utils/supabase/client';
import { openShortcutsDialog } from './PromptShortcutsDialog'

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
  placeholder = "Type @ for shortcuts ...",
  user
}: ChatInputProps) {
  const inputRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isSubmittingRef = useRef(false);
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
    if (!inputRef.current || isSubmittingRef.current) return;
    
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
    
    // Create wrapper span for better control
    const wrapperSpan = document.createElement('span');
    wrapperSpan.className = 'mention-wrapper';
    
    // Create mention span
    const mentionSpan = document.createElement('span');
    mentionSpan.className = 'mention-tag';
    mentionSpan.contentEditable = 'false';
    mentionSpan.dataset.shortcutId = shortcut.id;
    mentionSpan.textContent = `@${shortcut.name}`;
    
    // Create space span
    const spaceSpan = document.createElement('span');
    spaceSpan.className = 'mention-space';
    spaceSpan.contentEditable = 'true';
    spaceSpan.textContent = ' ';
    
    // Assemble the wrapper
    wrapperSpan.appendChild(mentionSpan);
    wrapperSpan.appendChild(spaceSpan);
    
    // Create a temporary container
    const tempDiv = document.createElement('div');
    
    // Add content in sequence
    if (beforeMention) {
      tempDiv.appendChild(document.createTextNode(beforeMention));
    }
    tempDiv.appendChild(wrapperSpan);
    if (afterMention) {
      tempDiv.appendChild(document.createTextNode(afterMention));
    }
    
    // Update content all at once
    inputRef.current.innerHTML = tempDiv.innerHTML;
    
    // Update parent component with original shortcut format
    const event = {
      target: { value: `${beforeMention}@${shortcut.name}${afterMention ? ' ' + afterMention : ' '}` }
    } as React.ChangeEvent<HTMLTextAreaElement>;
    handleInputChange(event);
    
    setShowShortcuts(false);
    setMentionStartPosition(null);
    
    // Set cursor position after the mention
    const selection = window.getSelection();
    const range = document.createRange();
    const spaceSpans = inputRef.current.getElementsByClassName('mention-space');
    if (spaceSpans.length > 0) {
      const lastSpaceSpan = spaceSpans[spaceSpans.length - 1];
      range.selectNodeContents(lastSpaceSpan);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  const clearInput = () => {
    if (inputRef.current) {
      // Clear all content and children
      while (inputRef.current.firstChild) {
        inputRef.current.removeChild(inputRef.current.firstChild);
      }
      inputRef.current.innerHTML = '';
      inputRef.current.textContent = '';
      
      // Ensure parent state is updated
      const event = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      handleInputChange(event);
      
      // Reset the selection
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputRef.current);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      
      // Force a clean state through blur/focus cycle
      inputRef.current.blur();
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Double check content is cleared
          if (inputRef.current.textContent) {
            inputRef.current.textContent = '';
          }
        }
      }, 0);
    }
  };

  const handleMessageSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isSubmittingRef.current || isLoading) return;
    
    const content = inputRef.current?.textContent || '';
    if (!content.trim()) return;

    try {
      isSubmittingRef.current = true;

      // Store the content before clearing
      const messageContent = content.trim();

      // Clear input using the new method
      clearInput();

      // Update parent state
      const event = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      handleInputChange(event);

      // Create a new submit event with the stored content
      const submitEvent = {
        preventDefault: () => {},
        target: {
          value: messageContent
        }
      } as unknown as FormEvent<HTMLFormElement>;

      // Submit the form with the stored content
      await handleSubmit(submitEvent);
    } finally {
      isSubmittingRef.current = false;
      // Ensure input is cleared even after submission
      clearInput();
    }
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
      if (!isSubmittingRef.current && !isLoading) {
        formRef.current?.dispatchEvent(
          new Event('submit', { cancelable: true, bubbles: true })
        );
      }
    }
  };

  // Reset selected index when shortcuts change
  useEffect(() => {
    setSelectedIndex(0);
  }, [shortcuts]);

  return (
    <div className="relative">
      <form 
        ref={formRef} 
        onSubmit={handleMessageSubmit} 
        className="flex gap-2 sticky bottom-0 bg-transparent p-1 md:p-0"
      >
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
      {showShortcuts && (
        <div className="absolute bottom-full left-0 right-0 mb-2">
          <div className="w-[calc(100vw-32px)] max-w-[280px] sm:max-w-md bg-[var(--background)] border border-[var(--accent)]">
            {/* Customize shortcuts button - Fixed at top */}
            <button
              onClick={() => {
                setShowShortcuts(false)
                openShortcutsDialog()
              }}
              className="w-full px-4 py-3 text-left hover:bg-[var(--accent)] transition-colors group border-b border-[var(--accent)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs tracking-wide text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                  CUSTOMIZE SHORTCUTS
                </span>
                <span className="text-xs text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                  ⚡
                </span>
              </div>
            </button>

            {/* Scrollable shortcuts list */}
            <div className="max-h-[35vh] overflow-y-auto">
              <div className="divide-y divide-[var(--accent)]">
                {shortcuts.length > 0 ? (
                  shortcuts.map((shortcut, index) => (
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
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-[var(--muted)]">
                    No shortcuts found
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 