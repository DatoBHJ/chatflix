import { FormEvent, useEffect, useRef } from 'react';
import { IconStop } from './icons';

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  stop: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  disabled,
  placeholder = "Type your message..."
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex gap-2 sticky bottom-0 bg-transparent p-1 md:p-0">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
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
  );
} 