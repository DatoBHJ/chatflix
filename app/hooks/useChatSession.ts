import { useState, useCallback } from 'react';
import { nanoid } from 'nanoid';

export function useChatSession(initialChatId?: string) {
  const [chatId, setChatId] = useState(() => initialChatId || nanoid());
  const [isChatMode, setIsChatMode] = useState(!!initialChatId);

  const handleServerChatId = useCallback((serverChatId: string, input: string, model: string) => {
    if (!initialChatId && serverChatId) {
      setChatId(serverChatId);
      setIsChatMode(true);
      window.history.replaceState(null, '', `/chat/${serverChatId}`);
      
      window.dispatchEvent(new CustomEvent('newChatCreated', {
        detail: {
          id: serverChatId,
          title: input.slice(0, 30) + (input.length > 30 ? '...' : '') || 'New Chat',
          created_at: new Date().toISOString(),
          current_model: model,
          initial_message: input || undefined,
        }
      }));
    }
  }, [initialChatId]);

  const resetSession = useCallback(() => {
    const newId = nanoid();
    setChatId(newId);
    setIsChatMode(false);
    return newId;
  }, []);

  return {
    chatId,
    setChatId,
    isChatMode,
    setIsChatMode,
    handleServerChatId,
    resetSession,
  };
}

