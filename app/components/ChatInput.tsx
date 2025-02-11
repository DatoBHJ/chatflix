import { FormEvent } from 'react';
import { IconStop } from './icons';

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={input}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`yeezy-input flex-1 text-lg transition-opacity duration-200 ${
          isLoading ? 'opacity-50' : 'opacity-100'
        }`}
        disabled={disabled || isLoading}
        autoFocus
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
          <span>Stop</span>
        </button>
      ) : (
        <button 
          type="submit" 
          className={`yeezy-button transition-opacity duration-200 ${
            !input.trim() ? 'opacity-50 cursor-not-allowed' : 'opacity-100'
          }`}
          disabled={disabled || isLoading || !input.trim()}
        >
          Send
        </button>
      )}
    </form>
  );
} 