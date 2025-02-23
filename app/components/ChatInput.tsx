import { FormEvent, useEffect, useRef, useState } from 'react';
import { IconStop } from './icons';
import { createClient } from '@/utils/supabase/client';
import { openShortcutsDialog } from './PromptShortcutsDialog'

interface PromptShortcut {
  id: string;
  name: string;
  content: string;
  created_at: string;
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
  const shortcutsListRef = useRef<HTMLDivElement>(null);
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

      // Submit the form with the stored content
      await handleSubmit(submitEvent);
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
        border-radius: 3px;
        background: var(--accent);
        color: var(--foreground);
        font-weight: 500;
        user-select: none;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="relative">
      <form 
        ref={formRef} 
        onSubmit={handleMessageSubmit} 
        className="flex gap-2 sticky bottom-0 bg-transparent p-1 md:p-0 items-center"
      >
        <div
          ref={inputRef}
          contentEditable
          onInput={handleInputWithShortcuts}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          className={`yeezy-input flex-1 transition-opacity duration-200 overflow-y-auto whitespace-pre-wrap
            ${isLoading ? 'opacity-50' : 'opacity-100'}`}
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
            className="yeezy-button flex items-center justify-center bg-red-500 hover:bg-red-600 px-4 h-[44px]"
          >
            <IconStop className="w-4 h-4 mr-2" />
            <span className="text-xs uppercase tracking-wider">Stop</span>
          </button>
        ) : (
          <button 
            type="submit" 
            className={`flex items-center justify-end transition-opacity duration-200 h-[44px] w-[44px] ${
              !(inputRef.current?.textContent || '').trim() ? 'opacity-50 cursor-not-allowed' : 'opacity-100'
            }`}
            disabled={disabled || isLoading || !(inputRef.current?.textContent || '').trim()}
          >
            <span className="flex items-center leading-none">↑</span>
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
              className="w-full p-6 text-left hover:bg-[var(--accent)] transition-colors group border-b border-[var(--accent)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
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
              <div className="divide-y divide-[var(--accent)]">
                {shortcuts.length > 0 ? (
                  shortcuts.map((shortcut, index) => (
                    <button
                      key={shortcut.id}
                      onClick={() => handleShortcutSelect(shortcut)}
                      className={`w-full p-6 text-left hover:bg-[var(--accent)] transition-colors
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