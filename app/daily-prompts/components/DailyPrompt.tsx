import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { fetchUserName } from '@/app/components/AccountDialog';
import { formatMessageTime } from '@/app/lib/translations/messageTime';
import { formatMessageGroupTimestamp } from '@/app/lib/messageGroupTimeUtils';
import { Edit, Trash2 } from 'lucide-react';

export const DEFAULT_PROMPTS = [
  "What is today's biggest global news?",
  "Send me funny minions gifs",
];

export interface DailyPromptProps {
  userId: string;
  onPromptClick: (prompt: string) => void;
  className?: string;
  isVisible?: boolean;
  isEditMode?: boolean;
  onEditModeToggle?: () => void;
  user?: { created_at?: string };
}

export function DailyPrompt({ userId, onPromptClick, className = '', isVisible = true, isEditMode: externalIsEditMode, onEditModeToggle, user }: DailyPromptProps) {
  const [DailyPrompts, setDailyPrompts] = useState<string[]>(DEFAULT_PROMPTS);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const getCachedPrompts = useCallback((uid: string) => {
    if (uid === 'anonymous' || !uid) return null;
    try {
      const cached = localStorage.getItem(`prompts_${uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.prompts;
        }
      }
    } catch (error) {
      console.warn('Failed to load cached prompts:', error);
    }
    return null;
  }, []);
  const setCachedPrompts = useCallback((uid: string, prompts: string[]) => {
    if (uid === 'anonymous' || !uid) return;
    try {
      localStorage.setItem(`prompts_${uid}`, JSON.stringify({ prompts, timestamp: Date.now() }));
    } catch (error) {
      console.warn('Failed to cache prompts:', error);
    }
  }, []);
  const [hoveredPromptIndex, setHoveredPromptIndex] = useState<number>(-1);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPromptIndex, setEditingPromptIndex] = useState<number>(-1);
  const [editingContent, setEditingContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newPromptContent, setNewPromptContent] = useState<string>('');
  const [internalIsEditMode, setInternalIsEditMode] = useState(false);
  const isEditMode = externalIsEditMode !== undefined ? externalIsEditMode : internalIsEditMode;
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [isUserNameLoading, setIsUserNameLoading] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const newPromptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  function renderPromptWithLinks(text: string) {
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        let href = part;
        if (!href.startsWith('http')) href = 'https://' + href;
        const displayText = part.length > 20 ? part.slice(0, 20) + '...' : part;
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-muted underline break-all hover:text-blue-800" onClick={e => e.stopPropagation()} title={part}>
            {displayText}
          </a>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  }

  const loadUserPrompts = async () => {
    if (!userId) {
      setDailyPrompts([]);
      setIsInitialLoading(false);
      return;
    }
    if (userId === 'anonymous') {
      setDailyPrompts(DEFAULT_PROMPTS);
      setIsInitialLoading(false);
      return;
    }
    const cachedPrompts = getCachedPrompts(userId);
    if (cachedPrompts && Array.isArray(cachedPrompts)) {
      setDailyPrompts(cachedPrompts);
      setIsInitialLoading(false);
      loadUserPromptsFromDB(userId, false);
      return;
    }
    await loadUserPromptsFromDB(userId, true);
  };

  const loadUserPromptsFromDB = async (uid: string, updateLoading: boolean = true) => {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
      const queryPromise = supabase.from('initial_prompts').select('prompts').eq('user_id', uid).maybeSingle();
      const { data } = await Promise.race([queryPromise, timeoutPromise]) as any;
      if (data?.prompts && Array.isArray(data.prompts)) {
        setDailyPrompts(data.prompts);
        setCachedPrompts(uid, data.prompts);
      } else {
        setDailyPrompts(DEFAULT_PROMPTS);
      }
    } catch (err) {
      setDailyPrompts(DEFAULT_PROMPTS);
    } finally {
      if (updateLoading) setIsInitialLoading(false);
    }
  };

  const saveUserPrompts = async (prompts: string[]) => {
    if (!userId) return;
    try {
      setIsSaving(true);
      await supabase.from('initial_prompts').upsert({ user_id: userId, prompts }, { onConflict: 'user_id' });
      setCachedPrompts(userId, prompts);
    } catch {
    } finally {
      setIsSaving(false);
    }
  };

  const loadUserName = async () => {
    if (!userId) { setIsUserNameLoading(false); return; }
    if (userId === 'anonymous') { setUserName('Guest'); setIsUserNameLoading(false); return; }
    try {
      const nameResult = await fetchUserName(userId, supabase).catch(() => 'You');
      setUserName(nameResult);
    } catch (error) {
      console.error('Error loading user name:', error);
      setUserName('You');
    } finally {
      setIsUserNameLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsInitialLoading(true);
      setIsUserNameLoading(true);
      Promise.all([loadUserPrompts(), loadUserName()]);
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [userId]);

  useEffect(() => {
    const checkIfMobile = () => { setIsMobile(window.innerWidth < 640); };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const handleEditModeToggle = () => {
    if (userId === 'anonymous') { alert('Please sign in to edit prompts'); return; }
    if (onEditModeToggle) onEditModeToggle(); else setInternalIsEditMode(!internalIsEditMode);
    if (isEditMode) { setSelectedPromptIds([]); setIsAdding(false); setNewPromptContent(''); }
  };
  const handleEditStart = (promptIndex: number) => {
    if (userId === 'anonymous') { alert('Please sign in to edit prompts'); return; }
    setIsEditing(true); setEditingPromptIndex(promptIndex); setEditingContent(DailyPrompts[promptIndex]);
  };
  const handleEditCancel = () => { setIsEditing(false); setEditingPromptIndex(-1); setEditingContent(''); };
  const handleEditSave = async () => {
    if (!editingContent.trim() || editingPromptIndex === -1) return;
    const updatedPrompts = [...DailyPrompts]; updatedPrompts[editingPromptIndex] = editingContent.trim();
    setDailyPrompts(updatedPrompts); setIsEditing(false); setEditingPromptIndex(-1); setEditingContent('');
    await saveUserPrompts(updatedPrompts);
  };
  const handleSelectPrompt = (promptIndex: number) => {
    const promptId = `prompt-${promptIndex}`;
    setSelectedPromptIds(prev => prev.includes(promptId) ? prev.filter(id => id !== promptId) : [...prev, promptId]);
  };
  const handleDeleteSelected = async () => {
    if (selectedPromptIds.length === 0) return;
    const indicesToDelete = selectedPromptIds.map(id => parseInt(id.split('-')[1]));
    const updatedPrompts = DailyPrompts.filter((_, index) => !indicesToDelete.includes(index));
    setDailyPrompts(updatedPrompts); setSelectedPromptIds([]); await saveUserPrompts(updatedPrompts);
  };
  const handleAddPromptStart = () => {
    if (userId === 'anonymous') { alert('Please sign in to add prompts'); return; }
    setIsAdding(true); setNewPromptContent(''); setTimeout(() => { newPromptTextareaRef.current?.focus(); }, 0);
  };
  const handleAddPromptCancel = () => { setIsAdding(false); setNewPromptContent(''); };
  const handleAddPromptSave = async () => {
    if (!newPromptContent.trim()) return;
    const updatedPrompts = [...DailyPrompts, newPromptContent.trim()];
    setDailyPrompts(updatedPrompts); setIsAdding(false); setNewPromptContent(''); await saveUserPrompts(updatedPrompts);
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;
      const resizeTextarea = () => {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        if (typeof window !== 'undefined') {
          const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10);
          textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        } else {
          textarea.style.height = `${scrollHeight}px`;
        }
      };
      resizeTextarea(); textarea.focus(); const len = textarea.value.length; textarea.setSelectionRange(len, len);
    }
  }, [isEditing]);

  useEffect(() => {
    if (isAdding && newPromptTextareaRef.current) {
      const textarea = newPromptTextareaRef.current;
      const resizeTextarea = () => {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        if (typeof window !== 'undefined') {
          const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10);
          textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        } else {
          textarea.style.height = `${scrollHeight}px`;
        }
      };
      resizeTextarea();
    }
  }, [isAdding, newPromptContent]);

  const handleMouseEnter = (promptIndex: number) => { if (!isMobile) setHoveredPromptIndex(promptIndex); };
  const handleMouseLeave = () => { setHoveredPromptIndex(-1); };
  const handleClick = (prompt: string) => { if (prompt && !isEditing && !isAdding && !isInitialLoading) onPromptClick(prompt); };

  if (isInitialLoading || isUserNameLoading) {
    return <div className={`relative flex items-center justify-end min-h-[400px] ${className}`}></div>;
  }

  return (
    <div className={`relative flex flex-col items-end ${className} group text-sm sm:text-base `}>
      <div className="w-full flex flex-col items-center mb-4">
        <div className="message-timestamp chatflix-header relative z-10" style={{ paddingBottom: '0', textTransform: 'none', color: '#737373' }}>
          Chatflix
        </div>
        <div className="message-timestamp relative z-10" style={{ paddingTop: '0', textTransform: 'none', color: '#737373' }}>
          {user?.created_at ? formatMessageGroupTimestamp(new Date(user.created_at)) : formatMessageGroupTimestamp(new Date())}
        </div>
      </div>
      {userId === 'anonymous' ? (
        <>
          <div className="flex justify-start w-full group mb-2">
            <div className="max-w-[85%] md:max-w-[75%]">
              <div className="imessage-receive-bubble"><span>Hey there</span></div>
            </div>
          </div>
          <div className="flex justify-end w-full group mb-4">
            <div className="max-w-[85%] md:max-w-[75%]">
              <div className="flex flex-col items-end gap-0">
                <div className="imessage-send-bubble"><span>Hey</span></div>
                <div className="text-[10px] text-neutral-500 mt-1 pr-1">{formatMessageTime(new Date())}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 w-full mb-2">
            <button onClick={() => handleClick("What is today's biggest global news?")} className="imessage-send-bubble follow-up-question max-w-md opacity-100 transition-all duration-200 ease-out hover:scale-105 cursor-pointer">
              <span>What is today's biggest global news?</span>
            </button>
            <button onClick={() => handleClick("Send me funny minions gifs")} className="imessage-send-bubble follow-up-question max-w-md opacity-100 transition-all duration-200 ease-out hover:scale-105 cursor-pointer">
              <span>Send me funny minions gifs</span>
            </button>
          </div>
          <div className="flex justify-start w-full group">
            <div className="max-w-[85%] md:max-w-[75%]">
              <div className="imessage-receive-bubble">
                <span><a href="/login" className="text-blue-500 underline hover:text-blue-700">Sign in</a> to save conversations and unlock more features!</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-start w-full group mb-2">
            <div className="max-w-[85%] md:max-w-[75%]">
              <div className="imessage-receive-bubble"><span>Hey {userName}!</span></div>
            </div>
          </div>
          <div className="flex justify-end w-full group mb-4">
            <div className="max-w-[85%] md:max-w-[75%]">
              <div className="flex flex-col items-end gap-0">
                <div className="imessage-send-bubble"><span>Hey</span></div>
                <div className="text-[10px] text-neutral-500 mt-1 pr-1">{formatMessageTime(new Date())}</div>
              </div>
            </div>
          </div>
          {DailyPrompts.length > 0 && (
            <div className="flex flex-col items-end gap-1 w-full">
              {DailyPrompts.map((prompt, index) => (
                <div key={index} className="flex items-center justify-end gap-2 w-full group/prompt" onMouseEnter={() => setHoveredPromptIndex(index)} onMouseLeave={() => setHoveredPromptIndex(-1)}>
                  {isEditing && editingPromptIndex === index ? (
                    <div className="flex items-center gap-2 w-full">
                      <button onClick={handleEditCancel} className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" title="Cancel" disabled={isSaving}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                      <div className="relative flex-1">
                        <div className="imessage-edit-bubble">
                          <textarea ref={textareaRef} value={editingContent} onChange={(e) => { setEditingContent(e.target.value); const t = e.currentTarget; t.style.height = 'auto'; const sh = t.scrollHeight; if (typeof window !== 'undefined') { const mh = parseInt(window.getComputedStyle(t).maxHeight, 10); t.style.height = `${Math.min(sh, mh)}px`; } else { t.style.height = `${sh}px`; } }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(); } }} className="imessage-edit-textarea scrollbar-thin" placeholder="Edit your prompt..." disabled={isSaving} style={{ width: '100%', resize: 'none' }} />
                        </div>
                      </div>
                      <button onClick={handleEditSave} className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" title="Save" disabled={isSaving || !editingContent.trim()}>
                        {isSaving ? (
                          <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-2 w-full">
                      <div className="flex items-center justify-end gap-4 w-full">
                        <button className="imessage-send-bubble follow-up-question max-w-md opacity-100 transition-all duration-200 ease-out hover:scale-105 cursor-pointer" onClick={() => { if (!isEditMode) { onPromptClick(prompt); } }}>
                          {renderPromptWithLinks(prompt)}
                        </button>
                        {isEditMode && (
                          <div className="cursor-pointer" onClick={() => handleSelectPrompt(index)}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedPromptIds.includes(`prompt-${index}`) ? 'bg-[#007AFF] border-[#007AFF]' : 'border-(--muted) opacity-50'}`}>
                              {selectedPromptIds.includes(`prompt-${index}`) && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {isEditMode ? (
            <div className="flex items-center justify-end gap-2 w-full mt-4">
              <div className="flex items-center gap-2">
                <button onClick={() => { if (selectedPromptIds.length === 1) { const promptIndex = parseInt(selectedPromptIds[0].split('-')[1]); handleEditStart(promptIndex); if (onEditModeToggle) onEditModeToggle(); else setInternalIsEditMode(false); } }} disabled={selectedPromptIds.length !== 1} className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" title="Edit selected" type="button" aria-label="Edit selected">
                  <Edit size={18} />
                </button>
                <button onClick={handleAddPromptStart} className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" title="Add frequently used prompts" type="button" aria-label="Add frequently used prompts">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button onClick={handleDeleteSelected} disabled={selectedPromptIds.length === 0} className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" title="Delete selected" type="button" aria-label="Delete selected">
                  <Trash2 size={18} />
                </button>
                <button onClick={handleEditModeToggle} className="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer" style={{ color: 'white', backgroundColor: '#007AFF', border: '1px solid #007AFF', boxShadow: '0 8px 40px rgba(0, 122, 255, 0.3), 0 4px 20px rgba(0, 122, 255, 0.2), 0 2px 8px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)' }} title="Done editing" type="button" aria-label="Done editing">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
              </div>
            </div>
          ) : null}
          {isAdding ? (
            <div className="flex items-center gap-2 w-full py-2">
              <button onClick={handleAddPromptCancel} className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" title="Cancel">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <div className="relative flex-1">
                <div className="imessage-edit-bubble">
                  <textarea ref={newPromptTextareaRef} value={newPromptContent} onChange={(e) => { setNewPromptContent(e.target.value); const t = e.currentTarget; t.style.height = 'auto'; const sh = t.scrollHeight; if (typeof window !== 'undefined') { const mh = parseInt(window.getComputedStyle(t).maxHeight, 10); t.style.height = `${Math.min(sh, mh)}px`; } else { t.style.height = `${sh}px`; } }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddPromptSave(); } }} className="imessage-edit-textarea scrollbar-thin" placeholder="Add frequently used prompt..." style={{ width: '100%', resize: 'none' }} />
                </div>
              </div>
              <button onClick={handleAddPromptSave} className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" title="Add prompt" disabled={!newPromptContent.trim()}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}


