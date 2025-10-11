import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { fetchUserName } from '../AccountDialog';
import { formatMessageTime } from '@/app/lib/messageTimeUtils';
import { Edit, Trash2 } from 'lucide-react';



// 기본 프롬프트 배열 (3개)
export const DEFAULT_PROMPTS = [
  "What is today's biggest global news?",
  "Send me funny minions gifs",
  // "what do u know about me"
];

export interface SuggestedPromptProps {
  userId: string;
  onPromptClick: (prompt: string) => void;
  className?: string;
  isVisible?: boolean;
  isEditMode?: boolean;
  onEditModeToggle?: () => void;
}

export function SuggestedPrompt({ userId, onPromptClick, className = '', isVisible = true, isEditMode: externalIsEditMode, onEditModeToggle }: SuggestedPromptProps) {
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(DEFAULT_PROMPTS);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // 🔧 FIX: 로컬 캐시를 통한 빠른 로딩
  const getCachedPrompts = useCallback((uid: string) => {
    if (uid === 'anonymous' || !uid) return null;
    try {
      const cached = localStorage.getItem(`prompts_${uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        // 캐시가 24시간 이내인지 확인
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
      localStorage.setItem(`prompts_${uid}`, JSON.stringify({
        prompts,
        timestamp: Date.now()
      }));
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



  // URL 정규식 (http, https, www)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

  // 링크를 감지해서 React 요소로 변환
  function renderPromptWithLinks(text: string) {
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        let href = part;
        if (!href.startsWith('http')) {
          href = 'https://' + href;
        }
        // 너무 긴 링크는 20자까지만 보여주고 ... 처리
        const displayText = part.length > 20 ? part.slice(0, 20) + '...' : part;
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted underline break-all hover:text-blue-800"
            onClick={e => e.stopPropagation()} // 링크 클릭 시 부모 클릭 방지
            title={part}
          >
            {displayText}
          </a>
        );
      } else {
        return <React.Fragment key={i}>{part}</React.Fragment>;
      }
    });
  }

  // Supabase에서 사용자 프롬프트 불러오기 (실패 시 조용히 기본값 사용)
  const loadUserPrompts = async () => {
    if (!userId) {
      setSuggestedPrompts([]);
      setIsInitialLoading(false);
      return;
    }
    
    // 🚀 익명 사용자는 바로 기본 프롬프트 사용
    if (userId === 'anonymous') {
      setSuggestedPrompts(DEFAULT_PROMPTS);
      setIsInitialLoading(false);
      return;
    }
    
    // 🔧 FIX: 캐시된 프롬프트 먼저 확인하여 즉시 로딩
    const cachedPrompts = getCachedPrompts(userId);
    if (cachedPrompts && Array.isArray(cachedPrompts)) {
      setSuggestedPrompts(cachedPrompts);
      setIsInitialLoading(false);
      console.log('⚡ Loaded prompts from cache');
      
      // 백그라운드에서 최신 데이터 확인 (캐시 업데이트용)
      loadUserPromptsFromDB(userId, false);
      return;
    }
    
    // 캐시가 없으면 DB에서 로드
    await loadUserPromptsFromDB(userId, true);
  };
  
  // DB에서 프롬프트 로드하는 별도 함수
  const loadUserPromptsFromDB = async (uid: string, updateLoading: boolean = true) => {
    try {
      // 🔧 FIX: 타임아웃과 재시도 로직 추가
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );
      
      const queryPromise = supabase
        .from('initial_prompts')
        .select('prompts')
        .eq('user_id', uid)
        .maybeSingle();
      
      const { data } = await Promise.race([queryPromise, timeoutPromise]) as any;
      
      if (data?.prompts && Array.isArray(data.prompts)) {
        setSuggestedPrompts(data.prompts);
        setCachedPrompts(uid, data.prompts); // 캐시 업데이트
        console.log('✅ Custom prompts loaded from DB');
      } else {
        // 데이터가 없거나 null인 경우 빈 배열 사용 (가입한 사용자는 기본값 없음)
        console.log('📝 No custom prompts found, using empty array');
        setSuggestedPrompts([]);
      }
    } catch (err) {
      // 에러 발생 시 조용히 빈 배열 사용 (가입한 사용자는 기본값 없음)
      console.log('⚠️ Using empty array due to load error:', err);
      setSuggestedPrompts([]);
    } finally {
      if (updateLoading) {
        setIsInitialLoading(false);
      }
    }
  };

  // Supabase에 사용자 프롬프트 저장하기 (실패 시 조용히 무시)
  const saveUserPrompts = async (prompts: string[]) => {
    if (!userId) return;
    
    try {
      setIsSaving(true);
      
      await supabase
        .from('initial_prompts')
        .upsert({
          user_id: userId,
          prompts: prompts
        }, {
          onConflict: 'user_id'
        });
      
      // 🔧 FIX: 저장 성공 시 캐시도 업데이트
      setCachedPrompts(userId, prompts);
      console.log('✅ Prompts saved and cached');
      
    } catch (err) {
      // 에러 발생 시 조용히 무시
      console.log('Failed to save prompts, but continuing');
    } finally {
      setIsSaving(false);
    }
  };

  // 사용자 이름 로드 함수
  const loadUserName = async () => {
    if (!userId) {
      setIsUserNameLoading(false);
      return;
    }
    
    // 🚀 익명 사용자 지원: 익명 사용자는 "Guest"로 설정
    if (userId === 'anonymous') {
      setUserName('Guest');
      setIsUserNameLoading(false);
      return;
    }
    
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

  // 🔧 FIX: 사용자 ID 변경 시 프롬프트와 이름 불러오기 - 디바운스 적용
  useEffect(() => {
    // 🚀 디바운스: userId가 빠르게 변경되는 경우 마지막 변경만 처리
    const timeoutId = setTimeout(() => {
      setIsInitialLoading(true);
      setIsUserNameLoading(true); // 사용자 이름 로딩 시작
      Promise.all([
        loadUserPrompts(),
        loadUserName()
      ]).finally(() => {
        // 두 작업이 모두 완료된 후 로딩 상태 해제는 각 함수에서 개별 처리
      });
    }, 100); // 100ms 디바운스
    
    return () => clearTimeout(timeoutId);
  }, [userId]);

  // 모바일 감지
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);


  // 편집 모드 토글
  const handleEditModeToggle = () => {
    // 🚀 익명 사용자 지원: 익명 사용자는 편집 불가
    if (userId === 'anonymous') {
      alert('Please sign in to edit prompts');
      return;
    }
    
    if (onEditModeToggle) {
      onEditModeToggle();
    } else {
      setInternalIsEditMode(!internalIsEditMode);
    }
    
    if (isEditMode) {
      setSelectedPromptIds([]);
      setIsAdding(false);
      setNewPromptContent('');
    }
  };

  // 편집 시작
  const handleEditStart = (promptIndex: number) => {
    // 🚀 익명 사용자 지원: 익명 사용자는 편집 불가
    if (userId === 'anonymous') {
      alert('Please sign in to edit prompts');
      return;
    }
    
    setIsEditing(true);
    setEditingPromptIndex(promptIndex);
    setEditingContent(suggestedPrompts[promptIndex]);
  };

  // 편집 취소
  const handleEditCancel = () => {
    setIsEditing(false);
    setEditingPromptIndex(-1);
    setEditingContent('');
  };

  // 편집 저장
  const handleEditSave = async () => {
    if (!editingContent.trim() || editingPromptIndex === -1) {
      return;
    }
    
    const updatedPrompts = [...suggestedPrompts];
    updatedPrompts[editingPromptIndex] = editingContent.trim();
    setSuggestedPrompts(updatedPrompts);
    setIsEditing(false);
    setEditingPromptIndex(-1);
    setEditingContent('');
    
    // 백그라운드에서 저장 (실패해도 UI는 이미 업데이트됨)
    await saveUserPrompts(updatedPrompts);
  };

  // 프롬프트 선택 토글
  const handleSelectPrompt = (promptIndex: number) => {
    const promptId = `prompt-${promptIndex}`;
    setSelectedPromptIds(prev =>
      prev.includes(promptId)
        ? prev.filter(id => id !== promptId)
        : [...prev, promptId]
    );
  };

  // 선택된 프롬프트들 삭제
  const handleDeleteSelected = async () => {
    if (selectedPromptIds.length === 0) return;
    
    const indicesToDelete = selectedPromptIds.map(id => parseInt(id.split('-')[1]));
    const updatedPrompts = suggestedPrompts.filter((_, index) => !indicesToDelete.includes(index));
    setSuggestedPrompts(updatedPrompts);
    setSelectedPromptIds([]);
    
    // 백그라운드에서 저장
    await saveUserPrompts(updatedPrompts);
  };
  // 새 프롬프트 추가 시작
  const handleAddPromptStart = () => {
    // 🚀 익명 사용자 지원: 익명 사용자는 추가 불가
    if (userId === 'anonymous') {
      alert('Please sign in to add prompts');
      return;
    }
    
    setIsAdding(true);
    setNewPromptContent('');
    
    // 다음 렌더링 후 포커스
    setTimeout(() => {
      if (newPromptTextareaRef.current) {
        newPromptTextareaRef.current.focus();
      }
    }, 0);
  };

  // 새 프롬프트 추가 취소
  const handleAddPromptCancel = () => {
    setIsAdding(false);
    setNewPromptContent('');
  };

  // 새 프롬프트 추가 저장
  const handleAddPromptSave = async () => {
    if (!newPromptContent.trim()) {
      return;
    }
    
    const updatedPrompts = [...suggestedPrompts, newPromptContent.trim()];
    setSuggestedPrompts(updatedPrompts);
    setIsAdding(false);
    setNewPromptContent('');
    
    // 백그라운드에서 저장
    await saveUserPrompts(updatedPrompts);
  };

  // 텍스트 영역 자동 리사이즈
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;

      const resizeTextarea = () => {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        // Ensure getComputedStyle runs only in browser
        if (typeof window !== 'undefined') {
          const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10);
          
          if (scrollHeight > maxHeight) {
            textarea.style.height = `${maxHeight}px`;
          } else {
            textarea.style.height = `${scrollHeight}px`;
          }
        } else {
           textarea.style.height = `${scrollHeight}px`;
        }
      };

      resizeTextarea();
      textarea.focus();
      const len = textarea.value.length;
      textarea.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // 새 프롬프트 텍스트 영역 자동 리사이즈
  useEffect(() => {
    if (isAdding && newPromptTextareaRef.current) {
      const textarea = newPromptTextareaRef.current;

      const resizeTextarea = () => {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        // Ensure getComputedStyle runs only in browser
        if (typeof window !== 'undefined') {
          const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10);
          
          if (scrollHeight > maxHeight) {
            textarea.style.height = `${maxHeight}px`;
          } else {
            textarea.style.height = `${scrollHeight}px`;
          }
        } else {
           textarea.style.height = `${scrollHeight}px`;
        }
      };

      resizeTextarea();
    }
  }, [isAdding, newPromptContent]);

  // 마우스 이벤트 핸들러
  const handleMouseEnter = (promptIndex: number) => {
    if (!isMobile) {
      setHoveredPromptIndex(promptIndex);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPromptIndex(-1);
  };

  const handleClick = (prompt: string) => {
    if (prompt && !isEditing && !isAdding && !isInitialLoading) {
      onPromptClick(prompt);
    }
  };

  // 초기 로딩 중이거나 사용자 정보 로딩 중에는 아무것도 보여주지 않음
  if (isInitialLoading || isUserNameLoading) {
    return <div className={`relative flex items-center justify-end ${className}`}></div>;
  }

  return (
    <div className={`relative flex flex-col items-end ${className} group text-sm sm:text-base `}>
          {userId === 'anonymous' ? (
            // 익명 사용자용 미니멀한 대화 흐름
            <>
              {/* AI 메시지 - Chatflix 인사 */}
              <div className="flex justify-start w-full group mb-2">
                <div className="max-w-[85%] md:max-w-[75%]">
                  <div className="imessage-receive-bubble">
                    <span>Hey there</span>
                  </div>
                </div>
              </div>

              {/* 사용자 메시지 - hey */}
          <div className="flex justify-end w-full group mb-4">
                <div className="max-w-[85%] md:max-w-[75%]">
                  <div className="flex flex-col items-end gap-0">
                    <div className="imessage-send-bubble">
                      <span>Hey</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-1 pr-1">
                      {formatMessageTime(new Date())}
                    </div>
                  </div>
                </div>
              </div>

              {/* 익명 사용자용 예약 메시지들 */}
              <div className="flex flex-col items-end gap-1 w-full mb-2">
                <button
                  onClick={() => handleClick("What is today's biggest global news?")}
                  className="imessage-send-bubble follow-up-question max-w-md opacity-100 transition-all duration-200 ease-out hover:scale-105 cursor-pointer"
                >
                  <span>What is today's biggest global news?</span>
                </button>
                <button
                  onClick={() => handleClick("Send me funny minions gifs")}
                  className="imessage-send-bubble follow-up-question max-w-md opacity-100 transition-all duration-200 ease-out hover:scale-105 cursor-pointer"
                >
                  <span>Send me funny minions gifs</span>
                </button>
              </div>

              {/* AI 메시지 - 로그인 유도 */}
              <div className="flex justify-start w-full group">
                <div className="max-w-[85%] md:max-w-[75%]">
                  <div className="imessage-receive-bubble">
                    <span><a href="/login" className="text-blue-500 underline hover:text-blue-700">Sign in</a> to save conversations and unlock more features!</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // 가입한 사용자용 간단한 인사 후 바로 예약 메시지 유도
            <>
              {/* AI 메시지 - 간단한 인사 */}
              <div className="flex justify-start w-full group mb-2">
                <div className="max-w-[85%] md:max-w-[75%]">
                  <div className="imessage-receive-bubble">
                    <span>Hey {userName}!</span>
                  </div>
                </div>
              </div>

              {/* 사용자 메시지 - hey */}
          <div className="flex justify-end w-full group mb-4">
                <div className="max-w-[85%] md:max-w-[75%]">
                  <div className="flex flex-col items-end gap-0">
                    <div className="imessage-send-bubble">
                      <span>Hey</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-1 pr-1">
                      {formatMessageTime(new Date())}
                    </div>
                  </div>
                </div>
              </div>

          {/* 모든 프롬프트를 개별적으로 표시 - 로그인 사용자만 */}
          {suggestedPrompts.length > 0 && (
            <div className="flex flex-col items-end gap-1 w-full">
              {suggestedPrompts.map((prompt, index) => (
              <div 
                key={index} 
                className="flex items-center justify-end gap-2 w-full group/prompt"
                onMouseEnter={() => handleMouseEnter(index)}
                onMouseLeave={handleMouseLeave}
              >
                {isEditing && editingPromptIndex === index ? (
                  <div className="flex items-center gap-2 w-full">
                    <button 
                      onClick={handleEditCancel} 
                      className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      style={{
                        // 다크모드 전용 스타일
                        ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                            (document.documentElement.getAttribute('data-theme') === 'system' && 
                             window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                          backgroundColor: 'rgba(0, 0, 0, 0.5)',
                          backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                          WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                        } : {
                          backgroundColor: 'rgba(255, 255, 255, 0.6)',
                          backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                          WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                        })
                      }}
                      title="Cancel"
                      disabled={isSaving}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <div className="relative flex-1">
                      <div className="imessage-edit-bubble">
                        <textarea
                          ref={textareaRef}
                          value={editingContent}
                          onChange={(e) => {
                            setEditingContent(e.target.value);
                            const textarea = e.currentTarget;
                            textarea.style.height = 'auto';
                            const scrollHeight = textarea.scrollHeight;
                            if (typeof window !== 'undefined') {
                              const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10);
                              if (scrollHeight > maxHeight) {
                                textarea.style.height = `${maxHeight}px`;
                              } else {
                                textarea.style.height = `${scrollHeight}px`;
                              }
                            } else {
                              textarea.style.height = `${scrollHeight}px`;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleEditSave();
                            }
                          }}
                          className="imessage-edit-textarea scrollbar-thin"
                          placeholder="Edit your prompt..."
                          disabled={isSaving}
                          style={{ width: '100%', resize: 'none' }}
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleEditSave} 
                      className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      style={{
                        // 다크모드 전용 스타일
                        ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                            (document.documentElement.getAttribute('data-theme') === 'system' && 
                             window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                          backgroundColor: 'rgba(0, 0, 0, 0.5)',
                          backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                          WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                        } : {
                          backgroundColor: 'rgba(255, 255, 255, 0.6)',
                          backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                          WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                        })
                      }}
                      title="Save"
                      disabled={isSaving || !editingContent.trim()}
                    >
                      {isSaving ? (
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                          <polyline points="17 21 17 13 7 13 7 21"/>
                          <polyline points="7 3 7 8 15 8"/>
                        </svg>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-2 w-full">
                    <div className="flex items-center justify-end gap-4 w-full">
                          <button
                        className="imessage-send-bubble follow-up-question max-w-md opacity-100 transition-all duration-200 ease-out hover:scale-105 cursor-pointer"
                        onClick={() => {
                          if (!isEditMode) {
                            handleClick(prompt);
                          }
                        }}
                      >
                        {renderPromptWithLinks(prompt)}
                          </button>
                      
                      {/* 편집 모드에서 선택 원 표시 - 메시지 우측에 배치 */}
                      {isEditMode && (
                        <div className="cursor-pointer" onClick={() => handleSelectPrompt(index)}>
                           <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                             selectedPromptIds.includes(`prompt-${index}`) 
                               ? 'bg-[#007AFF] border-[#007AFF]' 
                               : 'border-[var(--muted)] opacity-50'
                           }`}>
                            {selectedPromptIds.includes(`prompt-${index}`) && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
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
                      
          {/* 편집 모드 버튼들 */}
            {isEditMode ? (
              <div className="flex items-center justify-end gap-2 w-full mt-4">
                <div className="flex items-center gap-2">
                      <button
                    onClick={handleAddPromptStart}
                    className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    style={{
                      // 다크모드 전용 스타일
                      ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                          (document.documentElement.getAttribute('data-theme') === 'system' && 
                           window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      } : {
                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                      })
                    }}
                    title="Add frequently used prompts"
                    type="button"
                    aria-label="Add frequently used prompts"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                  <button
                        onClick={() => {
                      if (selectedPromptIds.length === 1) {
                        const promptIndex = parseInt(selectedPromptIds[0].split('-')[1]);
                        handleEditStart(promptIndex);
                        if (onEditModeToggle) {
                          onEditModeToggle(); // 외부에서 편집 모드 종료
                        } else {
                          setInternalIsEditMode(false);
                        }
                      }
                    }}
                    disabled={selectedPromptIds.length !== 1}
                    className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        style={{
                      // 다크모드 전용 스타일
                      ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                          (document.documentElement.getAttribute('data-theme') === 'system' && 
                           window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      } : {
                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                      })
                    }}
                    title="Edit selected"
                    type="button"
                    aria-label="Edit selected"
                  >
                    <Edit size={18} />
                      </button>
                          <button
                    onClick={handleDeleteSelected}
                    disabled={selectedPromptIds.length === 0}
                    className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            style={{
                      // 다크모드 전용 스타일
                      ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                          (document.documentElement.getAttribute('data-theme') === 'system' && 
                           window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      } : {
                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                      })
                    }}
                    title="Delete selected"
                    type="button"
                    aria-label="Delete selected"
                  >
                    <Trash2 size={18} />
                          </button>
                            <button
                    onClick={handleEditModeToggle}
                    className="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer"
                              style={{
                      color: 'white',
                      backgroundColor: '#007AFF',
                      border: '1px solid #007AFF',
                      boxShadow: '0 8px 40px rgba(0, 122, 255, 0.3), 0 4px 20px rgba(0, 122, 255, 0.2), 0 2px 8px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    }}
                    title="Done editing"
                    type="button"
                    aria-label="Done editing"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </button>
                </div>
              </div>
            ) : null}

            {/* 새 프롬프트 추가 UI */}
            {isAdding ? (
              <div className="flex items-center gap-2 w-full py-2">
                <button 
                  onClick={handleAddPromptCancel} 
                  className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    // 다크모드 전용 스타일
                    ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                        (document.documentElement.getAttribute('data-theme') === 'system' && 
                         window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    } : {
                      backgroundColor: 'rgba(255, 255, 255, 0.6)',
                      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                    })
                  }}
                  title="Cancel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <div className="relative flex-1">
                  <div className="imessage-edit-bubble">
                    <textarea
                      ref={newPromptTextareaRef}
                      value={newPromptContent}
                      onChange={(e) => {
                        setNewPromptContent(e.target.value);
                        const textarea = e.currentTarget;
                        textarea.style.height = 'auto';
                        const scrollHeight = textarea.scrollHeight;
                        if (typeof window !== 'undefined') {
                          const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10);
                          if (scrollHeight > maxHeight) {
                            textarea.style.height = `${maxHeight}px`;
                          } else {
                            textarea.style.height = `${scrollHeight}px`;
                          }
                        } else {
                          textarea.style.height = `${scrollHeight}px`;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddPromptSave();
                        }
                      }}
                      className="imessage-edit-textarea scrollbar-thin"
                      placeholder="Add frequently used prompt..."
                      style={{ width: '100%', resize: 'none' }}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddPromptSave} 
                  className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    // 다크모드 전용 스타일
                    ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                        (document.documentElement.getAttribute('data-theme') === 'system' && 
                         window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    } : {
                      backgroundColor: 'rgba(255, 255, 255, 0.6)',
                      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                    })
                  }}
                  title="Add prompt"
                  disabled={!newPromptContent.trim()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>
            ) : null}
        </>
      )}
    </div>
  );
}