import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/utils/supabase/client';
import { fetchUserName } from '../AccountDialog';
import { formatMessageTime } from '@/app/lib/messageTimeUtils';
import { SquarePencil } from 'react-ios-icons';



// 기본 프롬프트 배열 (2개)
export const DEFAULT_PROMPTS = [
  "tell me the latest news.",
  "send me funny cat gifs"
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
  const [userName, setUserName] = useState<string>('');
  const [isUserNameLoading, setIsUserNameLoading] = useState<boolean>(true);
  const [isMobile, setIsMobile] = useState(false);
  
  // 롱프레스 관련 상태
  const [longPressIndex, setLongPressIndex] = useState<number>(-1);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  const [bubbleViewportRect, setBubbleViewportRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const newPromptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
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
        // 사용자가 의도적으로 빈 배열을 저장한 경우도 포함
        setSuggestedPrompts(data.prompts);
        setCachedPrompts(uid, data.prompts); // 캐시 업데이트
        console.log('✅ Custom prompts loaded from DB');
      } else {
        console.log('📝 No custom prompts found, starting with empty array');
        setSuggestedPrompts([]);
      }
    } catch (err) {
      // 에러 발생 시 조용히 빈 배열 사용
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

  // 롱프레스 타이머 정리
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // 롱프레스 활성화 시 버블 위치 계산 및 스크롤 잠금
  useEffect(() => {
    if (isLongPressActive && longPressIndex >= 0) {
      if (bubbleRef.current) {
        const rect = bubbleRef.current.getBoundingClientRect();
        
        // 간단한 위치 계산 - 좌측으로 살짝 이동하여 말풍선 꼬리 잘림 방지
        setBubbleViewportRect({ 
          top: rect.top, 
          left: rect.left, // 원본과 동일한 위치
          width: rect.width, 
          height: rect.height 
        });
      }
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleScrollCancel = () => {
        setLongPressIndex(-1);
        setShowMobileActions(false);
        setIsLongPressActive(false);
        setBubbleViewportRect(null);
      };
      window.addEventListener('scroll', handleScrollCancel, { passive: true });
      window.addEventListener('resize', handleScrollCancel);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('scroll', handleScrollCancel);
        window.removeEventListener('resize', handleScrollCancel);
      };
    } else {
      setBubbleViewportRect(null);
    }
  }, [isLongPressActive, longPressIndex]);

  // 전역 터치 이벤트로 모바일 액션 취소 (버튼 영역 제외)
  useEffect(() => {
    const handleGlobalTouch = (e: TouchEvent) => {
      if (isMobile && isLongPressActive) {
        // 컨텍스트 메뉴 영역이 아닌 경우에만 취소
        const target = e.target as HTMLElement;
        const isContextMenu = target.closest('[role="dialog"]') || target.closest('.backdrop-blur-xl');
        
        if (!isContextMenu) {
          handleMobileCancel();
        }
      }
    };

    if (isMobile && isLongPressActive) {
      // 약간의 지연을 두어 롱프레스가 완전히 활성화된 후에 이벤트 리스너 추가
      const timer = setTimeout(() => {
        document.addEventListener('touchstart', handleGlobalTouch, { passive: true });
      }, 100);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('touchstart', handleGlobalTouch);
      };
    }
  }, [isMobile, isLongPressActive]);

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
    setBubbleViewportRect(null);
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

  // 프롬프트 삭제
  const handleDeletePrompt = async (promptIndex: number) => {
    // 🚀 익명 사용자 지원: 익명 사용자는 삭제 불가
    if (userId === 'anonymous') {
      alert('Please sign in to delete prompts');
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
    <div className={`relative flex flex-col items-end ${className} group `}>
      {(suggestedPrompts.length > 0 || userId !== 'anonymous') && (
        <>
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
              <div className="flex justify-end w-full group mb-2">
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
              <div className="flex justify-end w-full group mb-2">
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
          <div className="flex flex-col items-end gap-1 w-full">
            {suggestedPrompts.length > 0 && suggestedPrompts.map((prompt, index) => (
              <div 
                key={index} 
                className="flex items-center justify-end gap-2 w-full group/prompt"
                onMouseEnter={() => handleMouseEnter(index)}
                onMouseLeave={handleMouseLeave}
              >
                {isEditing && editingPromptIndex === index ? (
                  <div className="flex flex-col items-end gap-2 w-full animate-edit-in-view">
                    <div className="relative w-full max-w-md">
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
                    <div className="flex w-full items-center justify-between gap-2 mt-2 relative z-20">
                      <div className="flex items-center gap-2">
                        {/* 빈 공간 - 실제 채팅창과 동일한 레이아웃 */}
                      </div>
                      <div className="flex items-center gap-2">
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
                    </div>
                  </div>
                ) : (
                  <div 
                    className="relative flex flex-col items-end gap-2 w-full"
                    onClick={(e) => {
                      // 모바일에서 롱프레스 액션이 활성화된 상태에서 외부 영역 클릭 시 취소
                      if (isMobile && showMobileActions && longPressIndex === index && e.target === e.currentTarget) {
                        handleMobileCancel();
                      }
                    }}
                  >
                    <div className="flex items-center justify-end gap-2 w-full">
                      {/* 데스크탑 호버 버튼들 - 좌측에 표시 */}
                      {!isMobile && (
                        <div className={`flex items-center gap-2 transition-opacity duration-300 mr-2 ${
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
                        </div>
                      )}
                      
                      <button
                        ref={longPressIndex === index ? bubbleRef : null}
                        className={`imessage-send-bubble follow-up-question max-w-md ${isMobile ? 'touch-manipulation' : 'transition-all duration-200 ease-out hover:scale-105'} cursor-pointer`}
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
                          userSelect: 'none',
                          transition: isMobile ? 'transform 0.2s ease-out, box-shadow 0.2s ease-out' : 'none',
                          transform: isMobile && isLongPressActive && longPressIndex === index ? 'scale(1.05)' : 'scale(1)',
                          boxShadow: isMobile && isLongPressActive && longPressIndex === index ? '0 8px 32px rgba(0, 122, 255, 0.15), 0 4px 16px rgba(0, 122, 255, 0.1)' : 'none',
                          // 롱프레스 상태일 때 일반 메시지처럼 파란 배경에 흰 글씨
                          ...(isMobile && isLongPressActive && longPressIndex === index && {
                            backgroundColor: '#007AFF',
                            color: 'white',
                            borderColor: 'transparent'
                          })
                        }}
                      >
                        {renderPromptWithLinks(prompt)}
                      </button>
                    </div>
                    
                  </div>
                )}
              </div>
            ))}

            {/* 새 프롬프트 추가 UI - 프롬프트가 0개일 때도 표시 */}
            {isAdding ? (
              <div className="flex flex-col items-end gap-2 w-full animate-edit-in-view">
                <div className="relative w-full max-w-md">
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
                      placeholder="Save your daily requests (e.g., Summarize today's news)"
                      style={{ width: '100%', resize: 'none' }}
                    />
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-2 mt-2 relative z-20">
                  <div className="flex items-center gap-2">
                    {/* 빈 공간 - 실제 채팅창과 동일한 레이아웃 */}
                  </div>
                  <div className="flex items-center gap-2">
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
                </div>
              </div>
            ) : (
              /* 새 프롬프트 추가 버튼 - 편집 모드가 아닐 때만 표시 */
              !isEditing && (
                <div className="flex items-center justify-end gap-2 w-full">
                  <div className={`flex items-center gap-2 transition-opacity duration-300 ${
                    isMobile || suggestedPrompts.length === 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    <button
                      onClick={handleAddPromptStart}
                      className="imessage-control-btn text-green-500 hover:text-green-700 transition-all duration-200 ease-out hover:scale-110"
                      title="Save your daily requests (e.g., Summarize today's news)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
          )}
        </>
      )}
      
      {/* 롱프레스 오버레이: 전체 화면 블러 + 포커스된 메시지 클론 */}
      {isMobile && isLongPressActive && longPressIndex >= 0 && bubbleViewportRect && createPortal(
        <div 
          className="fixed inset-0 z-[9999]"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            // 오버레이 배경을 클릭한 경우에만 취소
            if (e.target === e.currentTarget) {
              handleMobileCancel();
            }
          }}
        >
          {/* SVG 필터 정의: 유리 질감 왜곡 효과 */}
          {/* <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <filter id="glass-distortion" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="7" result="noise" />
                <feImage result="radialMask" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g' cx='50%25' cy='50%25' r='70%25'><stop offset='0%25' stop-color='black'/><stop offset='100%25' stop-color='white'/></radialGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>" />
                <feComposite in="noise" in2="radialMask" operator="arithmetic" k1="0" k2="0" k3="1" k4="0" result="modulatedNoise" />
                <feGaussianBlur in="modulatedNoise" stdDeviation="0.3" edgeMode="duplicate" result="smoothNoise" />
                <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="18" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
          </svg> */}
          
          {/* 반투명 오버레이 */}
          <div 
            className="absolute inset-0 bg-black/2"
            onClick={handleMobileCancel}
          />

          {/* 도구 선택창 스타일의 액션 메뉴 - 메시지 길이에 따라 위치 조정 */}
          <div 
            className="absolute right-5"
            style={{
              // 메시지가 화면 하단 근처에 있거나 너무 길면 화면 하단에 고정, 아니면 메시지 바로 아래
              ...((() => {
                const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
                const messageBottom = bubbleViewportRect.top + (bubbleViewportRect.height * 1.05);
                const buttonHeight = 80; // 버튼 영역 높이
                const padding = 20; // 하단 여백
                
                // 메시지 아래에 버튼을 놓을 공간이 충분한지 확인
                if (messageBottom + buttonHeight + padding < viewportH) {
                  // 공간이 충분하면 메시지 바로 아래
                  return { top: `${messageBottom + 16}px` };
                } else {
                  // 공간이 부족하면 화면 하단에 고정
                  return { bottom: '80px' };
                }
              })())
            }}
          >
              <div 
                className="rounded-2xl drop-shadow-sm backdrop-blur-sm overflow-hidden border min-w-[200px] chat-input-tooltip-backdrop"
                // style={{ 
                //   // 라이트모드 기본 스타일 (도구 선택창과 동일)
                //   backgroundColor: 'rgba(255, 255, 255, 0.5)',
                //   backdropFilter: 'blur(10px)',
                //   WebkitBackdropFilter: 'blur(10px)',
                //   border: '1px solid rgba(255, 255, 255, 0.2)',
                //   boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                //   // 다크모드 전용 스타일
                //   ...(typeof window !== 'undefined' && (
                //     document.documentElement.getAttribute('data-theme') === 'dark' || 
                //     (document.documentElement.getAttribute('data-theme') === 'system' && 
                //      window.matchMedia('(prefers-color-scheme: dark)').matches)
                //   ) ? {
                //     backgroundColor: 'rgba(0, 0, 0, 0.05)',
                //     backdropFilter: 'url(#glass-distortion-dark) blur(24px)',
                //     WebkitBackdropFilter: 'url(#glass-distortion-dark) blur(24px)',
                //     border: '1px solid rgba(255, 255, 255, 0.1)',
                //     boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                //   } : {})
                // }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="flex flex-col gap-1 space-y-1">
                {/* 편집 버튼 - 도구 선택창 배경 스타일만 적용 */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    handleMobileEdit(longPressIndex);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    handleMobileEdit(longPressIndex);
                  }}
                  className="flex items-center gap-2 px-4 pt-3 transition-colors duration-150 rounded-xl"
                  // style={{
                  //   '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                  //   '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                  //   WebkitTapHighlightColor: 'transparent',
                  //   WebkitTouchCallout: 'none',
                  //   WebkitUserSelect: 'none',
                  //   userSelect: 'none'
                  // } as any}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                  onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    <SquarePencil className="w-5.5 h-5.5 text-[var(--foreground)]" />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Edit</span>
                </button>

                {/* 삭제 버튼 - 도구 선택창 배경 스타일만 적용 */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    handleMobileDelete(longPressIndex);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    handleMobileDelete(longPressIndex);
                  }}
                  className="flex items-center gap-2 px-4 pb-3 transition-colors duration-150 rounded-xl"
                  // style={{
                  //   '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                  //   '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                  //   WebkitTapHighlightColor: 'transparent',
                  //   WebkitTouchCallout: 'none',
                  //   WebkitUserSelect: 'none',
                  //   userSelect: 'none'
                  // } as any}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                  onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#FF3B30' }}>
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium" style={{ color: '#FF3B30' }}>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        typeof window !== 'undefined' ? document.body : (null as any)
      )}
    </div>
  );
}