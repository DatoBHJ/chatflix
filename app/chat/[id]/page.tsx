'use client'

// created new files while refactoring og_page.tsx : chat/[id]/utils.ts, chat/[id]/types.ts, components/ReasoningSection.tsx, components/MarkdownContent.tsx

import { useChat } from '@ai-sdk/react';
import { Message } from 'ai'
import { useState, useEffect, use, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { IconRefresh, IconCopy, IconCheck } from '../../components/icons'
import { createClient } from '@/utils/supabase/client'
import { ModelSelector } from '../../components/ModelSelector'
import { ChatInput } from '../../components/ChatInput'
import { MODEL_OPTIONS } from '../../components/ModelSelector'
import { Header } from '../../components/Header'
import { Sidebar } from '../../components/Sidebar'
import { MarkdownContent } from '../../components/MarkdownContent'
import { ReasoningSection } from '../../components/ReasoningSection'
import { convertMessage } from './utils'
import { PageProps, ExtendedMessage } from './types'

export default function Chat({ params }: PageProps) {
  const { id: chatId } = use(params)
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState('claude-3-5-sonnet-latest')
  const [nextModel, setNextModel] = useState(currentModel)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const initialMessageSentRef = useRef(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Chat hook configuration
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages, reload } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel,
      chatId,
    },
    id: chatId,
    initialMessages: [],
    onResponse: (response) => {
      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages];
        for (let i = updatedMessages.length - 1; i >= 0; i--) {
          const message = updatedMessages[i];
          if (message.role === 'assistant' && !(message as ExtendedMessage).model) {
            (message as ExtendedMessage).model = currentModel;
            break;
          }
        }
        return updatedMessages;
      });
    },
    onError: (error: Error & { data?: string }) => {
      const errorResponse = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Rate limit reached. Please try other models.',
        createdAt: new Date(),
        model: currentModel
      } as ExtendedMessage;

      setMessages(prevMessages => [...prevMessages, errorResponse]);
    }
  });

  // Scroll to bottom effect
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom])

  // Authentication effect
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
    }
    getUser()
  }, [supabase.auth, router])

  // Initialize chat session
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      if (initialMessageSentRef.current || !user) return;
      
      try {
        const { data: session, error: sessionError } = await supabase
          .from('chat_sessions')
          .select('current_model, initial_message')
          .eq('id', chatId)
          .eq('user_id', user.id)
          .single();

        if (sessionError || !session) {
          console.error('Session error:', sessionError);
          router.push('/');
          return;
        }

        if (session.current_model && isMounted) {
          setCurrentModel(session.current_model);
          setNextModel(session.current_model);
        }

        const { data: existingMessages, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_session_id', chatId)
          .eq('user_id', user.id)
          .order('sequence_number', { ascending: true });

        if (messagesError) {
          console.error('Failed to load messages:', messagesError);
          return;
        }

        if (existingMessages?.length > 0 && isMounted) {
          const sortedMessages = existingMessages
            .map(convertMessage)
            .sort((a: any, b: any) => {
              const seqA = (a as any).sequence_number || 0;
              const seqB = (b as any).sequence_number || 0;
              return seqA - seqB;
            });
          setMessages(sortedMessages);
          setIsInitialized(true);
        } else if (session.initial_message && isMounted) {
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          await supabase.from('messages').insert([{
            id: messageId,
            content: session.initial_message,
            role: 'user',
            created_at: new Date().toISOString(),
            model: session.current_model,
            host: 'user',
            chat_session_id: chatId,
            user_id: user.id
          }]);

          setMessages([{
            id: messageId,
            content: session.initial_message,
            role: 'user',
            createdAt: new Date()
          }]);

          initialMessageSentRef.current = true;
          setIsInitialized(true);

          if (isMounted) {
            reload({
              body: {
                model: session.current_model,
                chatId,
                messages: [{
                  id: messageId,
                  content: session.initial_message,
                  role: 'user',
                  createdAt: new Date()
                }]
              }
            });
          }
        }
      } catch (error) {
        console.error('Error in initialization:', error);
        if (isMounted) {
          router.push('/');
        }
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, [chatId, user]);

  // Real-time updates subscription
  useEffect(() => {
    if (!isInitialized || !user) return;

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_session_id=eq.${chatId} AND user_id=eq.${user.id}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data: allMessages, error } = await supabase
              .from('messages')
              .select('*')
              .eq('chat_session_id', chatId)
              .eq('user_id', user.id)
              .order('sequence_number', { ascending: true });

            if (!error && allMessages) {
              const hasSequenceGap = allMessages.some((msg, index) => {
                if (index === 0) return false;
                return allMessages[index].sequence_number - allMessages[index - 1].sequence_number > 1;
              });

              if (hasSequenceGap) {
                const lastMessage = allMessages[allMessages.length - 1];
                if (lastMessage?.role === 'assistant') {
                  await supabase
                    .from('messages')
                    .delete()
                    .eq('id', lastMessage.id)
                    .eq('user_id', user.id);
                
                  setMessages(allMessages.slice(0, -1).map(convertMessage));
                  return;
                }
              }

              setMessages(allMessages.map(convertMessage));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, setMessages, isInitialized]);

  // Message handlers
  const handleModelSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (nextModel !== currentModel) {
      try {
        await supabase
          .from('chat_sessions')
          .update({ current_model: nextModel })
          .eq('id', chatId);
        
        setCurrentModel(nextModel);
      } catch (error) {
        console.error('Failed to update model:', error);
      }
    }

    await handleSubmit(e, {
      body: {
        model: nextModel,
        chatId
      }
    });
  }, [nextModel, currentModel, chatId, handleSubmit]);

  const handleReload = useCallback((messageId: string) => async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsRegenerating(true);
    
    try {
      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) return;

      const targetUserMessage = messages
        .slice(0, messageIndex)
        .reverse()
        .find(m => m.role === 'user')
      
      if (!targetUserMessage) return;

      const { data: validMessages } = await supabase
        .from('messages')
        .select('sequence_number')
        .eq('chat_session_id', chatId)
        .eq('user_id', user.id)
        .order('sequence_number', { ascending: true })
        .limit(messageIndex);

      const lastSequenceNumber = validMessages?.[validMessages.length - 1]?.sequence_number || 0;

      await supabase
        .from('messages')
        .delete()
        .eq('chat_session_id', chatId)
        .eq('user_id', user.id)
        .gt('sequence_number', lastSequenceNumber);

      const updatedMessages = messages.slice(0, messageIndex);
      setMessages(updatedMessages);

      await reload({
        body: {
          messages: [...updatedMessages, {
            id: targetUserMessage.id,
            content: targetUserMessage.content,
            role: targetUserMessage.role,
            createdAt: targetUserMessage.createdAt
          }],
          model: currentModel,
          chatId
        }
      });
    } catch (error) {
      console.error('Regeneration failed:', error);
    } finally {
      setIsRegenerating(false);
    }
  }, [messages, setMessages, currentModel, chatId, reload, user?.id]);

  const handleCopyMessage = async (message: Message) => {
    try {
      const textToCopy = message.parts
        ? message.parts
            .filter(part => part.type === 'text')
            .map(part => (part as { text: string }).text || '')
            .join('\n')
            .trim()
        : message.content;

      await navigator.clipboard.writeText(textToCopy);
      setCopiedMessageId(message.id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handleStop = useCallback(async () => {
    try {
      stop();

      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'assistant') {
        const { data: messageData } = await supabase
          .from('messages')
          .select('id')
          .eq('chat_session_id', chatId)
          .eq('user_id', user.id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (messageData) {
          await supabase
            .from('messages')
            .update({
              content: lastMessage.content || 'Response interrupted',
              reasoning: lastMessage.parts?.find(part => part.type === 'reasoning')?.reasoning || null,
              model: currentModel,
              created_at: new Date().toISOString()
            })
            .eq('id', messageData.id)
            .eq('user_id', user.id);

          setMessages(prevMessages => {
            const updatedMessages = [...prevMessages];
            const lastIndex = updatedMessages.length - 1;
            if (lastIndex >= 0 && updatedMessages[lastIndex].role === 'assistant') {
              updatedMessages[lastIndex] = {
                ...updatedMessages[lastIndex],
                content: lastMessage.content || 'Response interrupted',
                parts: lastMessage.parts
              };
            }
            return updatedMessages;
          });
        }
      }
    } catch (error) {
      console.error('Error in handleStop:', error);
    }
  }, [stop, messages, currentModel, chatId, user?.id, setMessages]);

  const handleEditStart = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleEditSave = async (messageId: string) => {
    try {
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('id, sequence_number')
        .eq('id', messageId)
        .eq('user_id', user.id)
        .single();

      if (!existingMessage) {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          setMessages(messages.map(msg =>
            msg.id === messageId ? { ...msg, content: editingContent } : msg
          ));
        }
        setEditingMessageId(null);
        setEditingContent('');
        return;
      }

      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      const updatedMessages = messages.slice(0, messageIndex + 1).map(msg =>
        msg.id === messageId
          ? {
              ...msg,
              content: editingContent,
              parts: msg.parts ? msg.parts.map(part => 
                part.type === 'text' ? { ...part, text: editingContent } : part
              ) : undefined
            }
          : msg
      );
      setMessages(updatedMessages);

      setEditingMessageId(null);
      setEditingContent('');

      await supabase
        .from('messages')
        .update({
          content: editingContent,
          is_edited: true,
          edited_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('user_id', user.id);

      await supabase
        .from('messages')
        .delete()
        .eq('chat_session_id', chatId)
        .eq('user_id', user.id)
        .gt('sequence_number', existingMessage.sequence_number);

      await reload({
        body: {
          messages: updatedMessages,
          model: currentModel,
          chatId
        }
      });
    } catch (error) {
      console.error('Failed to update message:', error);
      setEditingMessageId(messageId);
      setEditingContent(messages.find(msg => msg.id === messageId)?.content || '');
    }
  };

  return (
    <main className="flex-1 relative h-full">
      <Header 
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      
      <div className={`fixed left-0 top-0 h-full transform transition-all duration-300 ease-in-out z-50 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar user={user} onClose={() => setIsSidebarOpen(false)} />
      </div>

      <div
        className={`fixed inset-0 backdrop-blur-[1px] bg-black transition-all duration-200 ease-in-out z-40 ${
          isSidebarOpen ? 'opacity-40 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 overflow-y-auto pb-32 pt-10 sm:pt-16">
        <div className="messages-container py-4 max-w-2xl mx-auto px-4 sm:px-6 w-full">
          {messages.map((message) => (
            <div key={message.id} className="message-group group animate-fade-in overflow-hidden">
              <div className={`message-role ${message.role === 'user' ? 'text-right' : ''}`}>
                {message.role === 'assistant' ? 'Chatflix.app' : 'You'}
              </div>
              <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`${message.role === 'user' ? 'message-user' : 'message-assistant'} max-w-full overflow-x-auto ${
                  editingMessageId === message.id ? 'w-full' : ''
                }`}>
                  {editingMessageId === message.id ? (
                    <div className="flex flex-col gap-2 w-full">
                      <textarea
                        value={editingContent}
                        onChange={(e) => {
                          setEditingContent(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onFocus={(e) => {
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        className="w-full min-h-[100px] p-4 
                                 bg-[var(--foreground)] text-[var(--background)]
                                 resize-none overflow-hidden transition-all duration-200
                                 focus:outline-none border-none outline-none ring-0
                                 placeholder-[var(--background-80)]"
                        style={{
                          height: 'auto',
                          minHeight: '100px',
                          caretColor: 'var(--background)'
                        }}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleEditCancel}
                          className="px-4 py-2 text-sm
                                   bg-[var(--foreground)] text-[var(--background)]
                                   hover:opacity-80 transition-opacity duration-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEditSave(message.id)}
                          className="px-4 py-2 text-sm
                                   bg-[var(--foreground)] text-[var(--background)]
                                   hover:opacity-80 transition-opacity duration-200"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {message.parts ? (
                        <>
                          {message.parts.map((part, index) => {
                            if (part.type === 'reasoning') {
                              return <ReasoningSection key={index} content={part.reasoning} />;
                            }
                            if (part.type === 'text') {
                              return <MarkdownContent key={index} content={part.text} />;
                            }
                          })}
                        </>
                      ) : (
                        <MarkdownContent content={message.content} />
                      )}
                    </>
                  )}
                </div>
              </div>
              {message.role === 'assistant' ? (
                <div className="flex justify-start pl-1 mt-2 gap-4">
                  <button 
                    onClick={handleReload(message.id)}
                    disabled={isRegenerating}
                    className={`text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2 ${
                      isRegenerating ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Regenerate response"
                  >
                    <IconRefresh className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleCopyMessage(message)}
                    className={`text-xs hover:text-[var(--foreground)] transition-colors flex items-center gap-2 ${
                      copiedMessageId === message.id ? 'text-green-500' : 'text-[var(--muted)]'
                    }`}
                    title={copiedMessageId === message.id ? "Copied!" : "Copy message"}
                  >
                    {copiedMessageId === message.id ? (
                      <IconCheck className="w-3 h-3" />
                    ) : (
                      <IconCopy className="w-3 h-3" />
                    )}
                  </button>
                  <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
                    {MODEL_OPTIONS.find(option => option.id === ((message as ExtendedMessage).model || currentModel))?.name || 
                     ((message as ExtendedMessage).model || currentModel)}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end pr-1 mt-2 gap-4">
                  <button
                    onClick={() => handleEditStart(message)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                    title="Edit message"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleCopyMessage(message)}
                    className={`text-xs hover:text-[var(--foreground)] transition-colors flex items-center gap-2 ${
                      copiedMessageId === message.id ? 'text-green-500' : 'text-[var(--muted)]'
                    }`}
                    title={copiedMessageId === message.id ? "Copied!" : "Copy message"}
                  >
                    {copiedMessageId === message.id ? (
                      <IconCheck className="w-3 h-3" />
                    ) : (
                      <IconCopy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} className="h-px" />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 w-full">
        <div className="bg-gradient-to-t from-[var(--background)] from-50% via-[var(--background)]/80 to-transparent pt-8 pb-6 w-full">
          <div className="max-w-2xl mx-auto w-full px-10 pl-13 relative flex flex-col items-center">
            <div className="w-full max-w-[calc(100vw-2rem)]">
              <ModelSelector
                currentModel={currentModel}
                nextModel={nextModel}
                setNextModel={setNextModel}
                position="top"
              />
              <ChatInput
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleModelSubmit}
                isLoading={isLoading}
                stop={handleStop}
                user={user}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 