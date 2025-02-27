import { useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { PromptShortcut } from '../types';

export const useShortcuts = (user: any) => {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shortcuts, setShortcuts] = useState<PromptShortcut[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPosition, setMentionStartPosition] = useState<number | null>(null);
  const [mentionEndPosition, setMentionEndPosition] = useState<number | null>(null);
  const [mentionQueryActive, setMentionQueryActive] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  const mentionRegex = /@(\w*)$/;

  const closeShortcutsPopup = () => {
    setShowShortcuts(false);
    setMentionStartPosition(null);
    setMentionEndPosition(null);
    setMentionQueryActive(false);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  const handleInputWithShortcuts = async (content: string, cursorPosition: number) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    const textBeforeCursor = content.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(mentionRegex);
    
    if (mentionMatch) {
      setMentionQueryActive(true);
      const mentionStartPos = textBeforeCursor.lastIndexOf('@');
      setMentionStartPosition(mentionStartPos);
      
      const query = mentionMatch[1] || '';
      setSearchTerm(query);
      
      debounceTimerRef.current = setTimeout(async () => {
        const { data, error } = await supabase.rpc('search_prompt_shortcuts', {
          p_user_id: user.id,
          p_search_term: query
        });
        
        if (error) {
          console.error('Error searching shortcuts:', error);
          return;
        }
        
        setShortcuts(data || []);
        setShowShortcuts(true);
        setSelectedIndex(0);
      }, 100);
    } else {
      closeShortcutsPopup();
    }
  };

  const handleKeyNavigation = (e: React.KeyboardEvent, callback: () => void) => {
    if (showShortcuts && shortcuts.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % shortcuts.length);
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + shortcuts.length) % shortcuts.length);
          break;
          
        case 'Enter':
          if (!e.shiftKey) {
            e.preventDefault();
            callback();
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          closeShortcutsPopup();
          break;
          
        case 'Tab':
          e.preventDefault();
          callback();
          break;
      }
    }
  };

  return {
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
  };
}; 