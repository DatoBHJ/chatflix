import { useRef, useState, useEffect } from 'react';
import { PromptShortcut } from '../types';

export const useInputHandling = () => {
  const inputRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isThemeChanging, setIsThemeChanging] = useState(false);
  const isSubmittingRef = useRef(false);

  const getCursorPosition = (element: HTMLElement): number => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return 0;
    
    const range = document.createRange();
    range.selectNodeContents(element);
    range.setEnd(selection.anchorNode!, selection.anchorOffset);
    return range.toString().length;
  };

  const setCursorPosition = (element: HTMLElement, position: number) => {
    const range = document.createRange();
    const selection = window.getSelection();
    
    let currentPos = 0;
    let targetNode: Node | null = null;
    let targetOffset = 0;
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node: Node | null = walker.nextNode();
    while (node) {
      const nodeLength = node.textContent?.length || 0;
      if (currentPos + nodeLength >= position) {
        targetNode = node;
        targetOffset = position - currentPos;
        break;
      }
      currentPos += nodeLength;
      node = walker.nextNode();
    }
    
    if (targetNode) {
      range.setStart(targetNode, targetOffset);
      range.setEnd(targetNode, targetOffset);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  const handleShortcutSelect = (shortcut: PromptShortcut, mentionStartPosition: number) => {
    if (!inputRef.current) return;
    
    const content = inputRef.current.textContent || '';
    const beforeMention = content.slice(0, mentionStartPosition);
    const afterMention = content.slice(getCursorPosition(inputRef.current));
    
    const mentionTag = document.createElement('span');
    mentionTag.className = 'mention-tag-wrapper';
    
    const mentionData = {
      id: shortcut.id,
      name: shortcut.name,
      content: shortcut.content
    };
    
    const mentionInner = document.createElement('span');
    mentionInner.className = 'mention-tag';
    mentionInner.contentEditable = 'false';
    mentionInner.dataset.shortcutId = shortcut.id;
    mentionInner.dataset.mentionData = JSON.stringify(mentionData);
    mentionInner.textContent = `@${shortcut.name}`;
    
    mentionTag.appendChild(mentionInner);
    
    inputRef.current.innerHTML = '';
    
    if (beforeMention) {
      inputRef.current.appendChild(document.createTextNode(beforeMention));
    }
    
    inputRef.current.appendChild(mentionTag);
    inputRef.current.appendChild(document.createTextNode(' '));
    
    if (afterMention) {
      inputRef.current.appendChild(document.createTextNode(afterMention));
    }
    
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      
      const mentionElement = inputRef.current.querySelector('.mention-tag-wrapper');
      if (mentionElement && mentionElement.nextSibling) {
        const nextNode = mentionElement.nextSibling;
        if (nextNode.nodeType === Node.TEXT_NODE) {
          const range = document.createRange();
          range.setStart(nextNode, 1);
          range.collapse(true);
          
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          
          inputRef.current.focus();
        }
      }
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!inputRef.current) return;
    
    const text = e.clipboardData.getData('text/plain');
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text.replace(/\n/g, ' '));
    range.insertNode(textNode);
    
    const content = inputRef.current.innerHTML;
    inputRef.current.innerHTML = content
      .replace(/<div>/g, '')
      .replace(/<\/div>/g, '')
      .replace(/<br\s*\/?>/g, ' ')
      .replace(/\s+/g, ' ');
    
    inputRef.current.normalize();
    
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      
      const selection = window.getSelection();
      const range = document.createRange();
      
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
        
        inputRef.current.focus();
      }
    });
  };

  const clearInput = () => {
    if (inputRef.current) {
      inputRef.current.innerHTML = '';
      inputRef.current.focus();
    }
  };

  // Theme change detection
  useEffect(() => {
    const detectThemeChange = () => {
      setIsThemeChanging(true);
      setTimeout(() => {
        setIsThemeChanging(false);
      }, 500);
    };

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

    observer.observe(document.documentElement, { 
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    observer.observe(document.body, { 
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    inputRef,
    isFocused,
    setIsFocused,
    isThemeChanging,
    isSubmittingRef,
    handlePaste,
    handleShortcutSelect,
    clearInput,
    getCursorPosition
  };
}; 