import { FormEvent, useEffect, useRef, useState, ReactNode } from 'react';
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
  const [files, setFiles] = useState<File[]>([]);
  const [fileMap, setFileMap] = useState<Map<string, { file: File, url: string }>>(new Map());
  const [dragActive, setDragActive] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isThemeChanging, setIsThemeChanging] = useState(false);
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

  // Add theme change detection
  useEffect(() => {
    // Function to detect theme changes
    const detectThemeChange = () => {
      // Briefly trigger the input focus animation
      setIsThemeChanging(true);
      
      // Reset after animation completes
      setTimeout(() => {
        setIsThemeChanging(false);
      }, 500); // Animation duration + small buffer
    };

    // Create a MutationObserver to watch for theme changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' && 
          (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme')
        ) {
          detectThemeChange();
          break;
        }
      }
    });

    // Start observing document.documentElement for class or data-theme changes
    observer.observe(document.documentElement, { 
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    // Also observe body for class changes (some themes apply changes here)
    observer.observe(document.body, { 
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      observer.disconnect();
    };
  }, []);

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
    if (!content.trim() && files.length === 0) return;

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

      // Convert File[] to FileList for submission
      const dataTransfer = new DataTransfer();
      files.forEach(file => {
        dataTransfer.items.add(file);
      });

      // Submit the form with the stored content and files
      await handleSubmit(submitEvent, dataTransfer.files);
      
      // Reset files after submission
      setFiles([]);
      setFileMap(new Map());
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Clear preview URLs
      fileMap.forEach(({ url }) => URL.revokeObjectURL(url));

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

      .futuristic-input::after,
      .futuristic-input.theme-changing::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(to right, var(--muted), transparent);
        opacity: 0;
        transform-origin: left center;
        transform: scaleX(0.95) scaleY(0.8) translateY(-0.5px);
        transition: opacity 0.3s ease;
      }

      .futuristic-input.focused::after,
      .futuristic-input.theme-changing::after {
        opacity: 0.7;
        animation: pencilStroke 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
      }
      
      @keyframes pencilStroke {
        0% {
          transform: scaleX(0) scaleY(0.8) translateY(-0.5px);
        }
        100% {
          transform: scaleX(0.95) scaleY(0.8) translateY(-0.5px);
        }
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

      .file-preview-item {
        position: relative;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        background: var(--accent);
        width: 160px;
        height: 100px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }
      
      .file-preview-item:hover {
        transform: scale(1.03);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }
      
      .file-preview-item .file-icon {
        font-size: 24px;
        margin-bottom: 8px;
        opacity: 0.8;
      }
      
      .file-preview-item .file-name {
        font-size: 12px;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.9;
      }
      
      .file-preview-item .file-size {
        font-size: 10px;
        opacity: 0.7;
        margin-top: 4px;
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

      .remove-file-btn {
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

      .file-preview-item:hover .remove-file-btn,
      .image-preview-item:hover .remove-file-btn {
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
        background: rgba(var(--background-rgb), 0.85);
        border: 2px dashed rgba(var(--foreground-rgb), 0.2);
        border-radius: 12px;
        box-shadow: 0 0 0 6px rgba(var(--background-rgb), 0.5);
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      @keyframes pulse {
        0%, 100% {
          border-color: rgba(var(--foreground-rgb), 0.2);
          box-shadow: 0 0 0 6px rgba(var(--background-rgb), 0.5);
        }
        50% {
          border-color: rgba(var(--foreground-rgb), 0.4);
          box-shadow: 0 0 0 12px rgba(var(--background-rgb), 0.3);
        }
      }

      .drag-upload-icon {
        background: rgba(var(--accent-rgb), 0.15);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        transition: all 0.3s ease;
        animation: bounce 1s infinite;
      }

      @keyframes bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-6px);
        }
      }

      .drag-upload-text {
        font-size: 16px;
        font-weight: 500;
        letter-spacing: 0.02em;
        color: var(--foreground);
        opacity: 0.9;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
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
      
      .code-preview {
        background: var(--code-bg);
        color: var(--code-text);
        font-family: monospace;
        font-size: 12px;
        padding: 8px;
        border-radius: 6px;
        max-height: 80px;
        overflow: hidden;
        position: relative;
        width: 100%;
      }
      
      .code-preview::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 24px;
        background: linear-gradient(to bottom, transparent, var(--code-bg));
      }
      
      .file-type-badge {
        position: absolute;
        top: 6px;
        left: 6px;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        backdrop-filter: blur(4px);
        z-index: 5;
      }

      .drag-target-active {
        position: relative;
        z-index: 40;
      }

      .drag-target-active::before {
        content: '';
        position: absolute;
        inset: -20px;
        background: transparent;
        z-index: 30;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Update handleDrag to be more reliable
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if the drag contains files
    if (e.dataTransfer.types.includes('Files')) {
      if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
      }
    }
  };

  // Add new dragLeave handler
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only deactivate if we're leaving the form element
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

  const handleFiles = (newFiles: FileList) => {
    // Convert FileList to Array and create new file entries
    const newFileArray = Array.from(newFiles);
    
    // Create new file entries
    const newFileEntries = newFileArray.map(file => {
      const url = URL.createObjectURL(file);
      return [file.name, { file, url }] as [string, { file: File, url: string }];
    });

    // Update file map with new entries
    setFileMap(prevMap => {
      const newMap = new Map(prevMap);
      newFileEntries.forEach(([name, data]) => {
        // If file with same name exists, revoke its old URL
        if (prevMap.has(name)) {
          URL.revokeObjectURL(prevMap.get(name)!.url);
        }
        newMap.set(name, data);
      });
      return newMap;
    });

    // Update files array
    setFiles(prevFiles => {
      const existingNames = new Set(prevFiles.map(f => f.name));
      const uniqueNewFiles = newFileArray.filter(file => !existingNames.has(file.name));
      return [...prevFiles, ...uniqueNewFiles];
    });
  };

  const removeFile = (fileToRemove: File) => {
    // Remove from fileMap and revoke URL
    setFileMap(prevMap => {
      const newMap = new Map(prevMap);
      const fileData = newMap.get(fileToRemove.name);
      if (fileData) {
        URL.revokeObjectURL(fileData.url);
        newMap.delete(fileToRemove.name);
      }
      return newMap;
    });

    // Remove from files array
    setFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
  };

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      // Cleanup all URLs
      fileMap.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, []);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Get file icon based on file type
  const getFileIcon = (file: File): ReactNode => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    const fileExt = fileName.split('.').pop() || '';
    
    // Code files
    if (fileType.includes('text') || 
        ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'py', 'java', 
         'c', 'cpp', 'cs', 'go', 'rb', 'php', 'swift', 'kt', 'rs'].includes(fileExt)) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      );
    }
    
    // PDF files
    if (fileType === 'application/pdf' || fileExt === 'pdf') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      );
    }
    
    // Default file icon
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
      </svg>
    );
  };

  // Get file type badge text
  const getFileTypeBadge = (file: File): string => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    const fileExt = fileName.split('.').pop() || '';
    
    if (fileType.startsWith('image/')) {
      return fileType.split('/')[1].toUpperCase();
    }
    
    if (fileExt) {
      return fileExt.toUpperCase();
    }
    
    return 'FILE';
  };

  // Check if file is an image
  const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/');
  };

  // Check if file is a text/code file
  const isTextFile = (file: File): boolean => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    const fileExt = fileName.split('.').pop() || '';
    
    return fileType.includes('text') || 
           ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'py', 'java', 
            'c', 'cpp', 'cs', 'go', 'rb', 'php', 'swift', 'kt', 'rs'].includes(fileExt);
  };

  // Read text file content for preview
  const readTextFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string || '';
        // Return first few lines
        const lines = content.split('\n').slice(0, 10).join('\n');
        resolve(lines);
      };
      reader.onerror = () => resolve('Error reading file');
      reader.readAsText(file);
    });
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
        {/* File Preview Section - Updated for all file types */}
        {files.length > 0 && (
          <div className="absolute bottom-full right-0 mb-4 bg-[var(--background)]/80 image-preview-container p-4 max-w-[80%] max-h-[200px] ml-auto">
            <div className="flex gap-4 image-preview-scroll" style={{ maxWidth: '100%' }}>
              {files.map((file) => {
                const fileData = fileMap.get(file.name);
                if (!fileData) return null;

                return isImageFile(file) ? (
                  // Image preview
                  <div key={file.name} className="relative group image-preview-item flex-shrink-0">
                    <div className="preview-overlay"></div>
                    <span className="file-type-badge">{getFileTypeBadge(file)}</span>
                    <img
                      src={fileData.url}
                      alt={`Preview ${file.name}`}
                      className="w-24 h-24 object-cover preview-img"
                    />
                    <button
                      onClick={() => removeFile(file)}
                      className="remove-file-btn"
                      type="button"
                      aria-label="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  // Non-image file preview
                  <div key={file.name} className="relative group file-preview-item flex-shrink-0">
                    <span className="file-type-badge">{getFileTypeBadge(file)}</span>
                    <div className="file-icon">
                      {getFileIcon(file)}
                    </div>
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{formatFileSize(file.size)}</div>
                    <button
                      onClick={() => removeFile(file)}
                      className="remove-file-btn"
                      type="button"
                      aria-label="Remove file"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Drag & Drop Zone */}
        <div 
          className={`relative transition-all duration-300 ${dragActive ? 'scale-[1.01]' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDragLeave}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="*/*" // Accept all file types
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
            {/* File upload button - Updated for all file types */}
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
              onInput={handleInputWithShortcuts}
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

        {/* Drag & Drop Overlay - Updated for all file types */}
        {dragActive && (
          <div 
            className="absolute inset-0 drag-upload-overlay
                     flex items-center justify-center transition-all duration-300 z-50"
          >
            <div className="flex flex-col items-center gap-3 transform transition-transform duration-300 scale-100 hover:scale-105">
              <div className="drag-upload-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <span className="drag-upload-text">Drop files here</span>
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