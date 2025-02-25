import { FormEvent, useEffect, useRef, useState } from 'react';
import { IconStop } from './icons';
import { createClient } from '@/utils/supabase/client';
import { openShortcutsDialog } from './PromptShortcutsDialog'
// import { PromptShortcut } from '@/types';

interface PromptShortcut {
  id: string;
  name: string;
  content: string;
  created_at: string;
}
import { getModelById } from '@/lib/models/config';

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>, files?: FileList) => void;
  isLoading: boolean;
  stop: () => void;
  disabled?: boolean;
  placeholder?: string;
  user: any;
  modelId: string;
}

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  disabled,
  placeholder = "Type @ for shortcuts ...",
  user,
  modelId
}: ChatInputProps) {
  const inputRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shortcutsListRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shortcuts, setShortcuts] = useState<PromptShortcut[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPosition, setMentionStartPosition] = useState<number | null>(null);
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const supabase = createClient();
  
  // Add check for vision support
  const modelConfig = getModelById(modelId);
  const supportsVision = modelConfig?.supportsVision ?? false;

  // Add autofocus effect on initial render
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Add focus effect when model changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      setIsFocused(true);
    }
  }, [modelId]);

  // Add paste event handler
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!inputRef.current) return;
    
    // Get plain text from clipboard
    const text = e.clipboardData.getData('text/plain');
    
    // Get current selection
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Insert text at cursor position
    range.deleteContents();
    const textNode = document.createTextNode(text.replace(/\n/g, ' '));
    range.insertNode(textNode);
    
    // Clean up any unwanted formatting and normalize content
    const content = inputRef.current.innerHTML;
    inputRef.current.innerHTML = content
      .replace(/<div>/g, '')
      .replace(/<\/div>/g, '')
      .replace(/<br\s*\/?>/g, ' ')
      .replace(/\s+/g, ' ');
    
    // Normalize spaces and text nodes
    inputRef.current.normalize();
    
    // Restore selection and move cursor to end of pasted text
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      
      const selection = window.getSelection();
      const range = document.createRange();
      
      // Find the text node at the current cursor position
      const walker = document.createTreeWalker(
        inputRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let lastNode: Text | null = null;
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.nodeType === Node.TEXT_NODE) {
          lastNode = node as Text;
        }
      }
      
      if (lastNode) {
        range.setStart(lastNode, lastNode.length);
        range.setEnd(lastNode, lastNode.length);
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        // Ensure input maintains focus
        inputRef.current.focus();
      }
    });
    
    // Trigger input handler to process mentions after a short delay
    setTimeout(() => {
      handleInputWithShortcuts();
    }, 0);
  };
  
  // Helper function to get cursor position
  const getCursorPosition = (element: HTMLElement): number => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return 0;
    
    const range = document.createRange();
    range.selectNodeContents(element);
    range.setEnd(selection.anchorNode!, selection.anchorOffset);
    return range.toString().length;
  };
  
  // Helper function to set cursor position
  const setCursorPosition = (element: HTMLElement, position: number) => {
    const range = document.createRange();
    const selection = window.getSelection();
    
    // Find the text node and offset
    let currentPos = 0;
    let targetNode: Node | null = null;
    let targetOffset = 0;
    
    const walk = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node: Node | null = walk.nextNode();
    while (node) {
      const nodeLength = node.textContent?.length || 0;
      if (currentPos + nodeLength >= position) {
        targetNode = node;
        targetOffset = position - currentPos;
        break;
      }
      currentPos += nodeLength;
      node = walk.nextNode();
    }
    
    if (targetNode) {
      range.setStart(targetNode, targetOffset);
      range.setEnd(targetNode, targetOffset);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  // Modify handleInputWithShortcuts to handle mentions more reliably
  const handleInputWithShortcuts = async () => {
    if (!inputRef.current || isSubmittingRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    // Normalize content first
    inputRef.current.normalize();
    
    const cursorPosition = getCursorPosition(inputRef.current);
    const content = inputRef.current.textContent || '';
    
    console.log('[Debug] handleInputWithShortcuts:', {
      cursorPosition,
      content,
      mentionStartPosition,
      showShortcuts
    });
    
    // Clean up any unwanted characters
    if (content.includes('\u200B')) {
      inputRef.current.textContent = content.replace(/\u200B/g, '');
    }
    
    // Check if input is empty and clear it completely
    if (!content.trim()) {
      inputRef.current.innerHTML = '';
      return;
    }
    
    // Simulate the onChange event for parent component
    const event = {
      target: { value: content }
    } as React.ChangeEvent<HTMLTextAreaElement>;
    handleInputChange(event);
    
    // Find the last @ symbol before cursor
    const textBeforeCursor = content.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    console.log('[Debug] Mention detection:', {
      textBeforeCursor,
      lastAtSymbol,
      hasAtSymbol: lastAtSymbol !== -1
    });
    
    if (lastAtSymbol !== -1) {
      // Check if cursor is inside or right after a mention tag
      const range = selection.getRangeAt(0);
      const mentionTags = inputRef.current.getElementsByClassName('mention-tag');
      let isInsideMention = false;
      
      for (const tag of mentionTags) {
        if (tag.contains(range.startContainer) || 
            tag.contains(range.endContainer) ||
            (tag.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING) &&
            (tag.compareDocumentPosition(range.endContainer) & Node.DOCUMENT_POSITION_PRECEDING)) {
          isInsideMention = true;
          break;
        }
      }
      
      console.log('[Debug] Mention tag check:', {
        mentionTagsCount: mentionTags.length,
        isInsideMention,
        rangeStart: range.startContainer.textContent,
        rangeEnd: range.endContainer.textContent
      });
      
      if (!isInsideMention) {
        const afterAt = content.slice(lastAtSymbol + 1);
        const spaceAfterAt = afterAt.indexOf(' ');
        const searchText = spaceAfterAt === -1 ? afterAt : afterAt.substring(0, spaceAfterAt);
        
        // Check if we're actually typing a new mention
        const textBetweenAtAndCursor = content.slice(lastAtSymbol, cursorPosition);
        const hasMentionInBetween = textBetweenAtAndCursor.includes('@') && 
                                  textBetweenAtAndCursor.length > textBetweenAtAndCursor.lastIndexOf('@') + 1;
        
        console.log('[Debug] Search text analysis:', {
          afterAt,
          spaceAfterAt,
          searchText,
          textBetweenAtAndCursor,
          hasMentionInBetween
        });
        
        if (!hasMentionInBetween && (spaceAfterAt === -1 || searchText.trim())) {
          setMentionStartPosition(lastAtSymbol);
          setSearchTerm(searchText.trim());
          const { data, error } = await supabase.rpc('search_prompt_shortcuts', {
            p_user_id: user.id,
            p_search_term: searchText.trim()
          });
          
          console.log('[Debug] Supabase search result:', {
            searchTerm: searchText.trim(),
            hasData: !!data,
            dataLength: data?.length,
            error
          });
          
          if (!error && data) {
            setShortcuts(data);
            setShowShortcuts(true);
            return;
          }
        }
      }
    }
    
    setShowShortcuts(false);
    setMentionStartPosition(null);
  };

  // Handle shortcut selection
  const handleShortcutSelect = (shortcut: PromptShortcut) => {
    console.log('[Debug] handleShortcutSelect:', {
      shortcut,
      mentionStartPosition,
      hasInputRef: !!inputRef.current
    });
    
    if (!inputRef.current || mentionStartPosition === null) return;
    
    const content = inputRef.current.textContent || '';
    const beforeMention = content.slice(0, mentionStartPosition);
    const afterMention = content.slice(mentionStartPosition).split(' ').slice(1).join(' ');
    
    console.log('[Debug] Content analysis:', {
      content,
      beforeMention,
      afterMention,
      mentionStartPosition
    });
    
    // Create mention data as JSON
    const mentionData = {
      displayName: shortcut.name,
      promptContent: shortcut.content
    };
    
    // Create mention span
    const mentionSpan = document.createElement('span');
    mentionSpan.className = 'mention-tag';
    mentionSpan.contentEditable = 'false';
    mentionSpan.dataset.shortcutId = shortcut.id;
    mentionSpan.dataset.mentionData = JSON.stringify(mentionData);
    mentionSpan.textContent = `@${shortcut.name}`;
    mentionSpan.style.display = 'inline';
    mentionSpan.style.whiteSpace = 'normal';
    
    // Create container for new content
    const container = document.createElement('span');
    container.style.whiteSpace = 'pre-wrap';
    container.style.display = 'inline';
    
    // Add content before mention
    if (beforeMention) {
      container.appendChild(document.createTextNode(beforeMention));
    }
    
    // Add mention
    container.appendChild(mentionSpan);
    
    // Add space after mention
    container.appendChild(document.createTextNode(' '));
    
    // Add remaining content
    if (afterMention) {
      container.appendChild(document.createTextNode(afterMention));
    }
    
    // Update content
    inputRef.current.innerHTML = '';
    inputRef.current.appendChild(container);
    
    console.log('[Debug] DOM update:', {
      containerHTML: container.innerHTML,
      inputHTML: inputRef.current.innerHTML,
      mentionSpanCount: inputRef.current.getElementsByClassName('mention-tag').length,
      mentionData
    });
    
    // Update parent component with JSON data
    const event = {
      target: { value: `${beforeMention}${JSON.stringify(mentionData)}${afterMention ? ' ' + afterMention : ' '}` }
    } as React.ChangeEvent<HTMLTextAreaElement>;
    handleInputChange(event);
    
    setShowShortcuts(false);
    setMentionStartPosition(null);
    
    // Set cursor position after the mention and space
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      
      const selection = window.getSelection();
      if (!selection) return;
      
      const range = document.createRange();
      const textNodes = Array.from(inputRef.current.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE);
      
      // Find the text node after the mention span
      const mentionSpans = inputRef.current.getElementsByClassName('mention-tag');
      
      console.log('[Debug] Cursor positioning:', {
        textNodesCount: textNodes.length,
        mentionSpansCount: mentionSpans.length,
        hasSelection: !!selection
      });
      
      if (mentionSpans.length > 0) {
        const lastMention = mentionSpans[mentionSpans.length - 1];
        const nextNode = lastMention.nextSibling;
        
        console.log('[Debug] Next node:', {
          hasNextNode: !!nextNode,
          nextNodeType: nextNode?.nodeType,
          nextNodeContent: nextNode?.textContent
        });
        
        if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
          range.setStart(nextNode, 1); // Position after the space
          range.setEnd(nextNode, 1);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      
      // Ensure input maintains focus
      inputRef.current.focus();
    });
  };

  const clearInput = () => {
    if (inputRef.current) {
      // Clear all content including empty nodes
      inputRef.current.innerHTML = '';
      
      // Ensure parent state is updated
      const event = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      handleInputChange(event);
      
      // Focus the input
      inputRef.current.focus();
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

      // Submit the form with the stored content and files
      await handleSubmit(submitEvent, files);
      
      // Reset files after submission
      setFiles(undefined);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Clear preview URLs
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);

    } finally {
      isSubmittingRef.current = false;
      // Ensure input is cleared even after submission
      clearInput();
    }
  };

  // 스크롤 함수 추가
  const scrollToItem = (index: number) => {
    if (!shortcutsListRef.current) return;
    
    const listElement = shortcutsListRef.current;
    const items = listElement.getElementsByTagName('button');
    if (!items[index]) return;

    const item = items[index];
    const itemRect = item.getBoundingClientRect();
    const listRect = listElement.getBoundingClientRect();

    if (itemRect.bottom > listRect.bottom) {
      // 아래로 스크롤이 필요한 경우
      listElement.scrollTop += itemRect.bottom - listRect.bottom;
    } else if (itemRect.top < listRect.top) {
      // 위로 스크롤이 필요한 경우
      listElement.scrollTop -= listRect.top - itemRect.top;
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (showShortcuts && shortcuts.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = (prev + 1) % shortcuts.length;
          scrollToItem(newIndex);
          return newIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = (prev - 1 + shortcuts.length) % shortcuts.length;
          scrollToItem(newIndex);
          return newIndex;
        });
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

  // Add styles to the document head
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .mention-tag {
        display: inline !important;
        white-space: normal !important;
        vertical-align: baseline !important;
        padding: 1px 4px;
        margin: 0 1px;
        background-color: rgba(239, 68, 68, 0.1);
        color: rgb(239, 68, 68);
        font-weight: 500;
        user-select: none;
      }

      .futuristic-input {
        position: relative;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        background: transparent;
        outline: none !important;
      }
      
      .futuristic-input:focus,
      .futuristic-input:focus-visible {
        outline: none !important;
        box-shadow: none !important;
        background: transparent !important;
      }

      .futuristic-input::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 1px;
        background: linear-gradient(to right, transparent, var(--muted), transparent);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .futuristic-input.focused::after {
        opacity: 0.5;
      }

      .futuristic-button {
        position: relative;
        overflow: hidden;
        transition: all 0.3s ease;
      }

      .futuristic-button:before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        background: rgba(255, 255, 255, 0.05);
        transform: translate(-50%, -50%);
        transition: width 0.6s ease, height 0.6s ease;
      }

      .futuristic-button:hover:before {
        width: 120%;
        height: 120%;
      }

      .image-preview-container {
        backdrop-filter: blur(12px);
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        z-index: 30;
      }
      
      .image-preview-scroll {
        overflow-x: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--muted) transparent;
      }
      
      .image-preview-scroll::-webkit-scrollbar {
        height: 4px;
      }
      
      .image-preview-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .image-preview-scroll::-webkit-scrollbar-thumb {
        background: var(--muted);
        border-radius: 4px;
        opacity: 0.5;
      }

      .image-preview-item {
        position: relative;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      }
      
      .image-preview-item:hover {
        transform: scale(1.03);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }

      .preview-img {
        transition: all 0.3s ease;
        filter: contrast(1.05);
      }

      .image-preview-item:hover .preview-img {
        filter: contrast(1.1) brightness(1.05);
      }

      .remove-image-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transform: translateY(-6px);
        transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 14px;
        z-index: 10;
      }

      .image-preview-item:hover .remove-image-btn {
        opacity: 1;
        transform: translateY(0);
      }

      .preview-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0) 50%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .image-preview-item:hover .preview-overlay {
        opacity: 1;
      }

      .drag-upload-overlay {
        backdrop-filter: blur(12px);
        background: rgba(var(--background-rgb), 0.65);
        border: 1px dashed rgba(var(--foreground-rgb), 0.15);
        border-radius: 12px;
      }

      .drag-upload-icon {
        background: rgba(var(--accent-rgb), 0.1);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        transition: all 0.3s ease;
      }

      .drag-upload-text {
        font-size: 14px;
        font-weight: 500;
        letter-spacing: 0.02em;
        color: var(--foreground);
        opacity: 0.8;
      }

      /* Placeholder implementation */
      .yeezy-input:empty:before {
        content: attr(data-placeholder);
        color: var(--muted);
        opacity: 0.7;
        pointer-events: none;
      }
      
      .input-container {
        padding-left: 1px;
        padding-right: 1px;
      }
      
      @media (max-width: 640px) {
        .input-container {
          padding-left: 1px;
          padding-right: 1px;
        }
      }

      .upload-button {
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
      }

      .upload-button-indicator {
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        bottom: 8px;
        right: 8px;
        opacity: 0;
        transform: scale(0);
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        box-shadow: 0 0 8px var(--accent);
      }

      .upload-button-active .upload-button-indicator {
        opacity: 1;
        transform: scale(1);
      }

      .upload-icon {
        transition: all 0.3s ease;
      }

      .upload-button:hover .upload-icon {
        transform: scale(1.1);
        opacity: 0.9;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFiles = (files: FileList) => {
    setFiles(files);
    // Create preview URLs for the images
    const urls = Array.from(files).map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...urls]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    
    if (files) {
      const newFiles = Array.from(files).filter((_, i) => i !== index);
      const dataTransfer = new DataTransfer();
      newFiles.forEach(file => dataTransfer.items.add(file));
      setFiles(dataTransfer.files);
    }
  };

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  return (
    <div className="relative">
      <form 
        ref={formRef} 
        onSubmit={handleMessageSubmit} 
        className="flex flex-col gap-2 sticky bottom-0 bg-transparent p-1 md:p-0"
        onDragEnter={handleDrag}
      >
        {/* Image Preview Section - Updated positioning and styling */}
        {previewUrls.length > 0 && (
          <div className="absolute bottom-full right-0 mb-4 bg-[var(--background)]/80 image-preview-container p-4 max-w-[80%] max-h-[200px] ml-auto">
            <div className="flex gap-4 image-preview-scroll" style={{ maxWidth: '100%' }}>
              {previewUrls.map((url, index) => (
                <div key={url} className="relative group image-preview-item flex-shrink-0">
                  <div className="preview-overlay"></div>
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-24 h-24 object-cover preview-img"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="remove-image-btn"
                    type="button"
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drag & Drop Zone */}
        <div 
          className={`relative transition-all duration-300 ${dragActive ? 'scale-[1.01]' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            ref={fileInputRef}
            className="hidden"
            multiple
          />
          
          <div className="flex gap-0 items-center input-container py-2">
            {supportsVision && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`upload-button futuristic-button w-10 h-10 flex items-center justify-center transition-all hover:bg-[var(--accent)]/20 ${files?.length ? 'upload-button-active' : ''}`}
                title="Upload images"
              >
                <div className="upload-button-indicator"></div>
                {files?.length ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon opacity-80">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon opacity-50 hover:opacity-80 transition-opacity">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                )}
              </button>
            )}

            <div
              ref={inputRef}
              contentEditable
              onInput={handleInputWithShortcuts}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={`yeezy-input futuristic-input flex-1 transition-all duration-300 py-2 px-2
                ${isFocused ? 'focused' : 'bg-transparent'}`}
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
                className={`futuristic-button w-10 h-10 flex items-center justify-center transition-all hover:bg-[var(--accent)]/30
                  ${!(inputRef.current?.textContent || '').trim() && !files?.length ? 'opacity-40' : 'opacity-100'}`}
                disabled={disabled || isLoading || (!(inputRef.current?.textContent || '').trim() && !files?.length)}
                aria-label="Send message"
              >
                <span className="flex items-center justify-center leading-none">↑</span>
              </button>
            )}
          </div>
        </div>

        {/* Drag & Drop Overlay */}
        {dragActive && (
          <div 
            className="absolute inset-0 drag-upload-overlay
                     flex items-center justify-center transition-all duration-300"
          >
            <div className="flex flex-col items-center gap-3 transform transition-transform duration-300 scale-100 hover:scale-105">
              <div className="drag-upload-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <span className="drag-upload-text">Release to upload</span>
            </div>
          </div>
        )}

        {/* Shortcuts Popup - Added higher z-index */}
        {showShortcuts && (
          <div className="absolute bottom-full left-0 right-0 mb-2 z-40">
            <div className="bg-[var(--background)]/90 backdrop-blur-md overflow-hidden shadow-lg transition-all duration-300">
              {/* Customize shortcuts button */}
              <button
                onClick={() => {
                  setShowShortcuts(false)
                  openShortcutsDialog()
                }}
                className="w-full p-4 text-left hover:bg-[var(--accent)]/30 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    <span className="text-xs tracking-wide text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                      CUSTOMIZE SHORTCUTS
                    </span>
                  </div>
                </div>
              </button>

              {/* Scrollable shortcuts list */}
              <div 
                ref={shortcutsListRef}
                className="max-h-[30vh] overflow-y-auto"
              >
                {shortcuts.length > 0 ? (
                  shortcuts.map((shortcut, index) => (
                    <button
                      key={shortcut.id}
                      onClick={() => handleShortcutSelect(shortcut)}
                      className={`w-full p-4 text-left transition-colors
                               ${index === selectedIndex ? 'bg-[var(--accent)]/30' : 'hover:bg-[var(--accent)]/10'}`}
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
        )}
      </form>
    </div>
  );
} 