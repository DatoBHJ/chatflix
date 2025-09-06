import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { fetchUserName } from '../AccountDialog';
import { formatMessageTime } from '@/app/lib/messageTimeUtils';



// 기본 프롬프트 배열 (3개)
export const DEFAULT_PROMPTS = [
  "tell me the latest news.",
  "send me funny cat gifs",
  "what do u know about me"
];

export interface SuggestedPromptProps {
  userId: string;
  onPromptClick: (prompt: string) => void;
  className?: string;
  isVisible?: boolean;
}

export function SuggestedPrompt({ userId, onPromptClick, className = '', isVisible = true }: SuggestedPromptProps) {
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
  const [userName, setUserName] = useState<string>('You');
  const [isMobile, setIsMobile] = useState(false);
  
  // 롱프레스 관련 상태
  const [longPressIndex, setLongPressIndex] = useState<number>(-1);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  
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
      setSuggestedPrompts(DEFAULT_PROMPTS);
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
    if (cachedPrompts && Array.isArray(cachedPrompts) && cachedPrompts.length > 0) {
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
      
      if (data?.prompts && Array.isArray(data.prompts) && data.prompts.length > 0) {
        setSuggestedPrompts(data.prompts);
        setCachedPrompts(uid, data.prompts); // 캐시 업데이트
        console.log('✅ Custom prompts loaded from DB');
      } else {
        console.log('📝 No custom prompts found, using defaults');
        setSuggestedPrompts(DEFAULT_PROMPTS);
      }
    } catch (err) {
      // 에러 발생 시 조용히 기본값 사용
      console.log('⚠️ Using default prompts due to load error:', err);
      setSuggestedPrompts(DEFAULT_PROMPTS);
    } finally {
      if (updateLoading) {
        setIsInitialLoading(false);
      }
    }
  };

  // Supabase에 사용자 프롬프트 저장하기 (실패 시 조용히 무시)
  const saveUserPrompts = async (prompts: string[]) => {
    if (!userId || prompts.length === 0) return;
    
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
      return;
    }
    
    // 🚀 익명 사용자 지원: 익명 사용자는 "Guest"로 설정
    if (userId === 'anonymous') {
      setUserName('Guest');
      return;
    }
    
    try {
      const nameResult = await fetchUserName(userId, supabase).catch(() => 'You');
      setUserName(nameResult);
    } catch (error) {
      console.error('Error loading user name:', error);
      setUserName('You');
    }
  };

  // 🔧 FIX: 사용자 ID 변경 시 프롬프트와 이름 불러오기 - 디바운스 적용
  useEffect(() => {
    // 🚀 디바운스: userId가 빠르게 변경되는 경우 마지막 변경만 처리
    const timeoutId = setTimeout(() => {
      setIsInitialLoading(true);
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

  // 롱프레스 타이머 정리
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // 터치 시작 핸들러
  const handleTouchStart = (e: React.TouchEvent, promptIndex: number) => {
    if (!isMobile) return;
    
    e.preventDefault();
    setTouchStartTime(Date.now());
    setTouchStartY(e.touches[0].clientY);
    setIsLongPressActive(false);
    
    // 롱프레스 타이머 시작 (500ms)
    const timer = setTimeout(() => {
      setLongPressIndex(promptIndex);
      setShowMobileActions(true);
      setIsLongPressActive(true);
    }, 500);
    
    setLongPressTimer(timer);
  };

  // 터치 종료 핸들러
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    e.preventDefault();
    
    // 타이머 정리
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    
    // 롱프레스가 활성화된 상태에서는 일반 클릭 방지
    if (isLongPressActive) {
      return;
    }
    
    // 짧은 터치인 경우 일반 클릭으로 처리
    if (touchDuration < 500 && longPressIndex === -1) {
      const promptIndex = parseInt(e.currentTarget.getAttribute('data-prompt-index') || '-1');
      if (promptIndex >= 0) {
        handleClick(suggestedPrompts[promptIndex]);
      }
    }
    
    // 롱프레스 상태 초기화
    setLongPressIndex(-1);
    setShowMobileActions(false);
    setIsLongPressActive(false);
  };

  // 터치 이동 핸들러 (스크롤 방지)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = Math.abs(currentY - touchStartY);
    
    // 수직 이동이 10px 이상이면 롱프레스 취소
    if (deltaY > 10) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      setLongPressIndex(-1);
      setShowMobileActions(false);
      setIsLongPressActive(false);
    }
  };

  // 모바일 액션 핸들러들
  const handleMobileEdit = (promptIndex: number) => {
    setShowMobileActions(false);
    setLongPressIndex(-1);
    setIsLongPressActive(false);
    handleEditStart(promptIndex);
  };

  const handleMobileDelete = (promptIndex: number) => {
    setShowMobileActions(false);
    setLongPressIndex(-1);
    setIsLongPressActive(false);
    handleDeletePrompt(promptIndex);
  };

  const handleMobileCancel = () => {
    setShowMobileActions(false);
    setLongPressIndex(-1);
    setIsLongPressActive(false);
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
    
    // 다음 렌더링 후 초기 너비 설정
    setTimeout(() => {
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const container = textarea.closest('.relative') as HTMLElement;
        if (container) {
          const textWidth = textarea.scrollWidth;
          const minWidth = 200;
          const maxWidth = 600;
          const newWidth = Math.max(minWidth, Math.min(maxWidth, textWidth + 40));
          container.style.width = `${newWidth}px`;
        }
      }
    }, 0);
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

  // 프롬프트 삭제
  const handleDeletePrompt = async (promptIndex: number) => {
    // 🚀 익명 사용자 지원: 익명 사용자는 삭제 불가
    if (userId === 'anonymous') {
      alert('Please sign in to delete prompts');
      return;
    }
    
    if (suggestedPrompts.length <= 1) {
      // 최소 1개는 유지
      return;
    }
    
    const updatedPrompts = suggestedPrompts.filter((_, index) => index !== promptIndex);
    setSuggestedPrompts(updatedPrompts);
    
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
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, [isEditing]);

  // 새 프롬프트 텍스트 영역 자동 리사이즈
  useEffect(() => {
    if (isAdding && newPromptTextareaRef.current) {
      const textarea = newPromptTextareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
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
  if (isInitialLoading) {
    return <div className={`min-h-16 relative flex items-center justify-end ${className}`}></div>;
  }

  return (
    <div className={`min-h-16 relative flex flex-col items-end ${className} group `}>
      {suggestedPrompts.length > 0 && (
        <>
          {userId === 'anonymous' ? (
            // 익명 사용자용 미니멀한 대화 흐름
            <>
              {/* AI 메시지 - Chatflix 인사 */}
              <div className="flex justify-start w-full group mb-4">
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
              <div className="flex flex-col items-end gap-2 w-full mb-4">
                {/* <button
                  onClick={() => handleClick("what makes chatflix better than chatgpt?")}
                  className={`imessage-send-bubble follow-up-question max-w-md ${
                    isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  } transition-all duration-200 ease-out hover:scale-105 cursor-pointer`}
                >
                  <span>⚡ what makes chatflix better than chatgpt?</span>
                </button> */}
                {/* <button
                  onClick={() => handleClick("how is chatflix different from other ai?")}
                  className={`imessage-send-bubble follow-up-question max-w-md ${
                    isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  } transition-all duration-200 ease-out hover:scale-105 cursor-pointer`}
                >
                  <span>🚀 how is chatflix different from other platforms?</span>
                </button> */}
                <button
                  onClick={() => handleClick("tell me the latest news.")}
                  className="imessage-send-bubble follow-up-question max-w-md opacity-100 transition-all duration-200 ease-out hover:scale-105 cursor-pointer"
                >
                  <span>tell me the latest news.</span>
                </button>
                <button
                  onClick={() => handleClick("send me funny cat gifs")}
                  className="imessage-send-bubble follow-up-question max-w-md opacity-100 transition-all duration-200 ease-out hover:scale-105 cursor-pointer"
                >
                  <span>send me funny cat gifs</span>
                </button>
                <button
                  onClick={() => handleClick("what do u know about me")}
                  className="imessage-send-bubble follow-up-question max-w-md opacity-100 transition-all duration-200 ease-out hover:scale-105 cursor-pointer"
                >
                  <span>what do u know about me</span>
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
              <div className="flex justify-start w-full group mb-4">
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

              {/* AI 메시지 - 질문 */}
              {/* <div className="flex justify-start w-full group mb-4">
                <div className="max-w-[85%] md:max-w-[75%]">
                  <div className="imessage-receive-bubble">
                    <span>What's on your mind today?</span>
                  </div>
                </div>
              </div> */}
            </>
          )}

          {/* 모든 프롬프트를 개별적으로 표시 - 로그인 사용자만 */}
          {userId !== 'anonymous' && (
          <div className="flex flex-col items-end gap-2 w-full">
            {suggestedPrompts.map((prompt, index) => (
              <div 
                key={index} 
                className="flex items-center justify-end gap-2 w-full group/prompt"
                onMouseEnter={() => handleMouseEnter(index)}
                onMouseLeave={handleMouseLeave}
              >
                {isEditing && editingPromptIndex === index ? (
                  <div className="flex items-center justify-end gap-2 w-full">
                    <div className="relative" style={{ width: 'fit-content', minWidth: '200px' }}>
                      <div className="imessage-edit-bubble">
                        <textarea
                          ref={textareaRef}
                          value={editingContent}
                          onChange={(e) => {
                            setEditingContent(e.target.value);
                            const textarea = e.currentTarget;
                            textarea.style.height = 'auto';
                            textarea.style.height = `${textarea.scrollHeight}px`;
                            // 너비도 동적으로 조정
                            const container = textarea.closest('.relative') as HTMLElement;
                            if (container) {
                              const textWidth = textarea.scrollWidth;
                              const minWidth = 200;
                              const maxWidth = 600;
                              const newWidth = Math.max(minWidth, Math.min(maxWidth, textWidth + 40));
                              container.style.width = `${newWidth}px`;
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
                      onClick={handleEditCancel} 
                      className="imessage-edit-control-btn cancel" 
                      title="Cancel"
                      disabled={isSaving}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <button 
                      onClick={handleEditSave} 
                      className="imessage-edit-control-btn save" 
                      title="Save"
                      disabled={isSaving || !editingContent.trim()}
                    >
                      {isSaving ? (
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                          <polyline points="17 21 17 13 7 13 7 21"/>
                          <polyline points="7 3 7 8 15 8"/>
                        </svg>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-2 w-full">
                    <div className="flex items-center justify-end gap-2 w-full">
                      {/* 데스크탑 호버 버튼들 - 좌측에 표시 */}
                      {!isMobile && (
                        <div className={`flex items-center gap-2 transition-opacity duration-300 ${
                          hoveredPromptIndex === index ? 'opacity-100' : 'opacity-0'
                        }`}>
                          <button
                            onClick={() => handleEditStart(index)}
                            className="imessage-control-btn"
                            title="Edit prompt"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          {suggestedPrompts.length > 1 && (
                            <button
                              onClick={() => handleDeletePrompt(index)}
                              className="imessage-control-btn text-red-500 hover:text-red-700"
                              title="Delete prompt"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                      
                      <button
                        className={`imessage-send-bubble follow-up-question max-w-md opacity-100 ${isMobile ? 'touch-manipulation' : ''} ${
                          isMobile && showMobileActions && longPressIndex === index 
                            ? 'scale-105 shadow-lg transform transition-all duration-200 ease-out' 
                            : 'transition-all duration-200 ease-out hover:scale-105 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (!isLongPressActive) {
                            handleClick(prompt);
                          }
                        }}
                        onTouchStart={(e) => handleTouchStart(e, index)}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchMove}
                        data-prompt-index={index}
                        style={{
                          WebkitTapHighlightColor: 'transparent',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none'
                        }}
                      >
                        {renderPromptWithLinks(prompt)}
                      </button>
                    </div>
                    
                    {/* 모바일 롱프레스 버튼들 - 각 메시지 바로 아래에 표시 */}
                    {isMobile && showMobileActions && longPressIndex === index && (
                      <div className="flex items-center justify-end gap-2 w-full">
                        <div className={`flex items-center gap-2 opacity-100 transition-all duration-200 ease-out ${
                          isMobile && showMobileActions && longPressIndex === index 
                            ? 'scale-105 transform' 
                            : ''
                        }`}>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleMobileEdit(index);
                            }}
                            className="imessage-control-btn"
                            title="Edit prompt"
                            style={{
                              WebkitTapHighlightColor: 'transparent',
                              WebkitTouchCallout: 'none',
                              WebkitUserSelect: 'none',
                              userSelect: 'none'
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          {suggestedPrompts.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleMobileDelete(index);
                              }}
                              className="imessage-control-btn text-red-500 hover:text-red-700"
                              title="Delete prompt"
                              style={{
                                WebkitTapHighlightColor: 'transparent',
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                userSelect: 'none'
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleMobileCancel();
                            }}
                            className="imessage-control-btn text-gray-500 hover:text-gray-700"
                            title="Cancel"
                            style={{
                              WebkitTapHighlightColor: 'transparent',
                              WebkitTouchCallout: 'none',
                              WebkitUserSelect: 'none',
                              userSelect: 'none'
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* 새 프롬프트 추가 UI */}
            {isAdding ? (
              <div className="flex items-center justify-end gap-2 w-full">
                <div className="relative" style={{ width: 'fit-content', minWidth: '200px' }}>
                  <div className="imessage-edit-bubble">
                    <textarea
                      ref={newPromptTextareaRef}
                      value={newPromptContent}
                      onChange={(e) => {
                        setNewPromptContent(e.target.value);
                        const textarea = e.currentTarget;
                        textarea.style.height = 'auto';
                        textarea.style.height = `${textarea.scrollHeight}px`;
                        // 너비도 동적으로 조정
                        const container = textarea.closest('.relative') as HTMLElement;
                        if (container) {
                          const textWidth = textarea.scrollWidth;
                          const minWidth = 200;
                          const maxWidth = 600;
                          const newWidth = Math.max(minWidth, Math.min(maxWidth, textWidth + 40));
                          container.style.width = `${newWidth}px`;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddPromptSave();
                        }
                      }}
                      className="imessage-edit-textarea scrollbar-thin"
                      placeholder="Add new prompt..."
                      style={{ width: '100%', resize: 'none' }}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddPromptCancel} 
                  className="imessage-edit-control-btn cancel" 
                  title="Cancel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <button 
                  onClick={handleAddPromptSave} 
                  className="imessage-edit-control-btn save" 
                  title="Add prompt"
                  disabled={!newPromptContent.trim()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>
            ) : (
              /* 새 프롬프트 추가 버튼 */
              <div className="flex items-center justify-end gap-2 w-full">
                <div className={`flex items-center gap-2 transition-opacity duration-300 ${
                  isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <button
                    onClick={handleAddPromptStart}
                    className="imessage-control-btn text-green-500 hover:text-green-700 transition-all duration-200 ease-out hover:scale-110"
                    title="Add new prompt"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </>
      )}
    </div>
  );
}
