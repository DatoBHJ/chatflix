import { FormEvent, useRef } from 'react';
import { getModelById } from '@/lib/models/config';
import { ChatInputProps } from './types';
import { useFileUpload } from './hooks/useFileUpload';
import { useShortcuts } from './hooks/useShortcuts';
import { useInputHandling } from './hooks/useInputHandling';
import { FilePreview } from './components/FilePreview';
import { ShortcutsPopup } from './components/ShortcutsPopup';
import { DragDropOverlay } from './components/DragDropOverlay';
import './styles/index.css';

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  disabled,
  placeholder = "Type @ for shortcuts ...",
  user,
  modelId,
  popupPosition = 'top'
}: ChatInputProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    files,
    fileMap,
    dragActive,
    setDragActive,
    handleFiles,
    removeFile,
    clearFiles
  } = useFileUpload();

  const {
    showShortcuts,
    shortcuts,
    searchTerm,
    selectedIndex,
    mentionStartPosition,
    mentionQueryActive,
    handleInputWithShortcuts,
    handleKeyNavigation,
    closeShortcutsPopup,
    setSelectedIndex
  } = useShortcuts(user);

  const {
    inputRef,
    isFocused,
    setIsFocused,
    isThemeChanging,
    isSubmittingRef,
    handlePaste,
    handleShortcutSelect,
    clearInput,
    getCursorPosition
  } = useInputHandling();

  const modelConfig = getModelById(modelId);
  const supportsVision = modelConfig?.supportsVision ?? false;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.types.includes('Files')) {
      if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleMessageSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isSubmittingRef.current || isLoading) return;
    
    const content = inputRef.current?.textContent || '';
    if (!content.trim() && files.length === 0) return;

    try {
      isSubmittingRef.current = true;
      const messageContent = content.trim();
      clearInput();

      const event = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      handleInputChange(event);

      const submitEvent = {
        preventDefault: () => {},
        target: {
          value: messageContent
        }
      } as unknown as FormEvent<HTMLFormElement>;

      const dataTransfer = new DataTransfer();
      files.forEach(file => {
        dataTransfer.items.add(file);
      });

      await handleSubmit(submitEvent, dataTransfer.files);
      clearFiles();
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } finally {
      isSubmittingRef.current = false;
      clearInput();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showShortcuts && shortcuts.length > 0) {
      handleKeyNavigation(e, () => {
        if (mentionStartPosition !== null) {
          handleShortcutSelect(shortcuts[selectedIndex], mentionStartPosition);
        }
      });
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSubmittingRef.current && !isLoading) {
        formRef.current?.dispatchEvent(
          new Event('submit', { cancelable: true, bubbles: true })
        );
      }
    }
  };

  return (
    <div className="relative">
      <form 
        ref={formRef} 
        onSubmit={handleMessageSubmit} 
        className={`flex flex-col gap-2 sticky bottom-0 bg-transparent p-1 md:p-0
          ${dragActive ? 'drag-target-active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <FilePreview 
          files={files}
          fileMap={fileMap}
          removeFile={removeFile}
        />

        <div 
          className={`relative transition-all duration-300 ${dragActive ? 'scale-[1.01]' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDragLeave}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="*/*"
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(e.target.files);
              }
            }}
            ref={fileInputRef}
            className="hidden"
            multiple
          />
          
          <div className="flex gap-0 items-center input-container py-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`upload-button futuristic-button w-10 h-10 flex items-center justify-center transition-all hover:bg-[var(--accent)]/20 ${files.length ? 'upload-button-active' : ''}`}
              title="Upload files"
            >
              <div className="upload-button-indicator"></div>
              {files.length ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon opacity-80">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon opacity-50 hover:opacity-80 transition-opacity">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              )}
            </button>

            <div
              ref={inputRef}
              contentEditable
              onInput={(e) => {
                if (inputRef.current) {
                  handleInputWithShortcuts(inputRef.current.textContent || '', getCursorPosition(inputRef.current));
                }
              }}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={`yeezy-input futuristic-input flex-1 transition-all duration-300 py-2 px-2
                ${isFocused ? 'focused' : ''}
                ${isThemeChanging ? 'theme-changing' : ''}
                ${!isFocused && !isThemeChanging ? 'bg-transparent' : ''}`}
              style={{ 
                minHeight: '44px',
                maxHeight: window.innerWidth <= 768 ? '120px' : '200px',
                lineHeight: '1.5',
                wordBreak: 'break-word',
                overflowWrap: 'break-word'
              }}
              data-placeholder={placeholder}
              suppressContentEditableWarning
            />

            {isLoading ? (
              <button 
                onClick={(e) => { e.preventDefault(); stop(); }} 
                type="button"
                className="futuristic-button w-10 h-10 flex items-center justify-center transition-all hover:bg-[var(--accent)]/30"
                aria-label="Stop generation"
              >
                <span className="text-red-500 flex items-center justify-center w-3 h-3">■</span>
              </button>
            ) : (
              <button 
                type="submit" 
                className={`futuristic-button w-10 h-10 flex items-center justify-center transition-all hover:bg-[var(--accent)]/30`}
                disabled={disabled || isLoading}
                aria-label="Send message"
              >
                <span className="flex items-center justify-center leading-none">↑</span>
              </button>
            )}
          </div>
        </div>

        <DragDropOverlay dragActive={dragActive} />
        <ShortcutsPopup
          showShortcuts={showShortcuts}
          shortcuts={shortcuts}
          selectedIndex={selectedIndex}
          searchTerm={searchTerm}
          handleShortcutSelect={(shortcut) => {
            if (mentionStartPosition !== null) {
              handleShortcutSelect(shortcut, mentionStartPosition);
            }
          }}
          closeShortcutsPopup={closeShortcutsPopup}
          position={popupPosition}
        />
      </form>
    </div>
  );
} 