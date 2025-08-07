// app/components/chat/ChatInput/index.tsx
import { FormEvent, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getModelById } from '@/lib/models/config';
import { ChatInputProps, PromptShortcut } from './types';
import { useChatInputStyles } from './ChatInputStyles';
import { FileUploadButton, FilePreview, fileHelpers } from './FileUpload';
import { PromptShortcuts } from './PromptShortcuts';
import { DragDropOverlay, ErrorToast } from './DragDropOverlay';
import { Brain, Gauge, AlertTriangle, CheckCircle } from 'lucide-react';
import { Brain as BrainIOS, LightBulb, Apple, Folder, Send } from 'react-ios-icons'; 
import { FileMetadata } from '@/lib/types';
import { 
  extractImageMetadata, 
  extractPDFMetadata, 
  extractTextMetadata, 
  extractDefaultMetadata
} from '@/app/chat/[id]/utils';
import { getChatInputTranslations } from '@/app/lib/chatInputTranslations';
import { checkSubscriptionClient } from '@/lib/subscription-client';

// 상수 정의
const MENTION_CONTEXT_RANGE = 200; // 커서 주변 검색 범위 (앞뒤로)
const DEBOUNCE_TIME = 200; // 디바운스 시간 (ms)
const CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER = 60000; // 비구독자 컨텍스트 윈도우 제한 (60K tokens)

// 토큰 추정 함수
function estimateTokenCount(text: string): number {
  // 대략적인 토큰 수 계산 (영어 기준 4자당 1토큰, 한글은 1-2자당 1토큰)
  const isMainlyKorean = /[\uAC00-\uD7AF]/.test(text) && 
                         (text.match(/[\uAC00-\uD7AF]/g)?.length || 0) / text.length > 0.3;
  
  if (isMainlyKorean) {
    return Math.ceil(text.length / 1.5); // 한글은 더 많은 토큰 사용
  }
  return Math.ceil(text.length / 4); // 영어 기준
}

// 백엔드와 동일한 멀티모달 토큰 추정 함수
function estimateMultiModalTokens(msg: any): number {
  // 실제 토큰 사용량을 우선적으로 사용
  if (msg.token_usage?.totalTokens) {
    return msg.token_usage.totalTokens;
  }

  if (msg.tool_results?.token_usage?.totalTokens) {
    return msg.tool_results.token_usage.totalTokens;
  }
  
  let total = 0;
  
  // 텍스트 콘텐츠
  if (typeof msg.content === 'string') {
    total += estimateTokenCount(msg.content);
  } else if (Array.isArray(msg.content)) {
    // 멀티모달 콘텐츠 (이미지, 파일 등)
    for (const part of msg.content) {
      if (part.type === 'text') {
        total += estimateTokenCount(part.text || '');
      } else if (part.type === 'image') {
        total += 1000; // 이미지는 약 1000 토큰으로 추정
      } else if (part.type === 'file') {
        total += estimateFileTokens(part.file);
      }
    }
  } else if (msg.content) { // msg.content가 null이 아닌 객체일 경우
    total += estimateTokenCount(JSON.stringify(msg.content));
  }

  // tool_results 콘텐츠 토큰 추정 (token_usage가 없을 경우)
  if (msg.tool_results && !msg.tool_results.token_usage) {
    total += estimateTokenCount(JSON.stringify(msg.tool_results));
  }
  
  // experimental_attachments 처리 (메타데이터 기반 정확한 추정)
  if (Array.isArray(msg.experimental_attachments)) {
    for (const attachment of msg.experimental_attachments) {
      // 메타데이터가 있으면 정확한 토큰 수 사용
      if (attachment.metadata && attachment.metadata.estimatedTokens) {
        total += attachment.metadata.estimatedTokens;
      } else {
        total += estimateAttachmentTokens(attachment);
      }
    }
  }
  
  return total;
}

// 파일 토큰 추정 함수
function estimateFileTokens(file: any): number {
  if (!file) return 0;
  
  const filename = file.name?.toLowerCase() || '';
  const contentType = file.contentType || file.type || '';
  
  if (filename.endsWith('.pdf') || contentType === 'application/pdf') {
    return 5000; // PDF
  } else if (filename.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
    return 3000; // 코드 파일
  } else if (contentType?.startsWith('image/') || filename.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
    return 1000; // 이미지
  } else {
    return 2000; // 기타 파일
  }
}

// 첨부파일 토큰 추정 함수
function estimateAttachmentTokens(attachment: any): number {
  if (attachment.fileType === 'image' || 
      (attachment.contentType && attachment.contentType.startsWith('image/'))) {
    return 1000;
  } else if (attachment.fileType === 'pdf' || 
             attachment.contentType === 'application/pdf') {
    return 5000;
  } else if (attachment.fileType === 'code') {
    return 3000;
  } else {
    return 2000; // 기타 파일
  }
}

// 개선된 토큰 계산 함수
function calculateTokens(
  text: string,
  allMessages: any[],
  attachments: any[],
  isHomePage: boolean = false
): { conversation: number; input: number; files: number; total: number } {
  // 현재 입력 토큰 수 계산
  const input = estimateTokenCount(text);
  
  // 파일 토큰 수 계산
  let files = 0;
  
  // 새로 업로드된 파일들의 토큰 수 계산
  for (const attachment of attachments) {
    if (attachment.file) {
      files += estimateFileTokens(attachment.file);
    } else if (attachment.metadata?.estimatedTokens) {
      files += attachment.metadata.estimatedTokens;
    } else {
      files += estimateAttachmentTokens(attachment);
    }
  }
  
  // 대화 히스토리 토큰 수 계산 (홈페이지가 아닌 경우)
  let conversation = 0;
  if (!isHomePage && allMessages && allMessages.length > 0) {
    conversation = allMessages.reduce((total, message) => {
      return total + estimateMultiModalTokens(message);
    }, 0);
  }
  
  const total = conversation + input + files;
  
  return { conversation, input, files, total };
}

// 모델별 토큰 임계값 계산 함수
function getTokenThresholds(contextWindow?: number, isSubscribed?: boolean): { warning: number; danger: number; limit: number } {
  if (!contextWindow) {
    // Default values (128K tokens)
    return {
      warning: 64000,  // 50%
      danger: 89600,   // 70%
      limit: 128000    // 100%
    };
  }
  
  // 비구독자인 경우 60K로 제한
  const effectiveContextWindow = isSubscribed ? contextWindow : Math.min(contextWindow, CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER);
  
  return {
    warning: Math.floor(effectiveContextWindow * 0.50),  // 50%
    danger: Math.floor(effectiveContextWindow * 0.70),   // 70%
    limit: effectiveContextWindow
  };
}

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  disabled,
  placeholder: propPlaceholder,
  user,
  modelId,
  popupPosition = 'top',
  isAgentEnabled,
  setisAgentEnabled,
  allMessages = []
}: ChatInputProps) {
  // 기본 상태 및 참조
  const inputRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shortcutsListRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const lastTextContentRef = useRef<string>(''); // 마지막 텍스트 콘텐츠 저장
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  
  // 상태 관리
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shortcuts, setShortcuts] = useState<PromptShortcut[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPosition, setMentionStartPosition] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileMap, setFileMap] = useState<Map<string, { file: File, url: string }>>(new Map());
  const [dragActive, setDragActive] = useState(false);
  const [mentionQueryActive, setMentionQueryActive] = useState(false);
  const [showPDFError, setShowPDFError] = useState(false);
  const [showFolderError, setShowFolderError] = useState(false);
  const [showVideoError, setShowVideoError] = useState(false);
  const [showAgentTooltip, setShowAgentTooltip] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [textTokens, setTextTokens] = useState(0);
  const [fileTokens, setFileTokens] = useState(0);
  const [conversationTokens, setConversationTokens] = useState(0);
  const [showTokenTooltip, setShowTokenTooltip] = useState(false);
  const [isHoveringTokenCounter, setIsHoveringTokenCounter] = useState(false);
  const [isHoveringTokenTooltip, setIsHoveringTokenTooltip] = useState(false);
  const tokenTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
  const [isHoveringUpgrade, setIsHoveringUpgrade] = useState(false);
  const [translations, setTranslations] = useState({
    usesTools: 'Uses tools for better answers',
    talkToModel: 'Talk to the model directly',
    placeholder: 'Chat is this real?',
    processing: 'Processing...',
    tokenDanger: 'May not remember parts of the previous conversation, and may fail to respond.',
    tokenWarning: 'May not remember parts of the previous conversation.',
    tokenSafe: 'All of the conversation is included in the context.',
    contextUsage: 'Context Usage',
    upgradeToPro: 'Upgrade to Pro',
    getFullContext: 'Get full {contextWindow} context window',
    upgrade: 'Upgrade'
  });
  
  // Supabase 클라이언트
  const supabase = createClient();
  
  // 모델 설정
  const modelConfig = getModelById(modelId);
  const supportsVision = modelConfig?.supportsVision ?? false;
  const supportsPDFs = modelConfig?.supportsPDFs ?? false;
  
  // 모델별 토큰 임계값 계산
  const tokenThresholds = getTokenThresholds(modelConfig?.contextWindow, isSubscribed ?? false);

  // 멘션 감지를 위한 정규식
  const mentionRegex = /@(\w*)$/;

  // 스타일 적용
  useChatInputStyles();

  useEffect(() => {
    setTranslations(getChatInputTranslations());
  }, []);

  // 구독 상태 확인
  useEffect(() => {
    let ignore = false;
    async function checkSubscriptionStatus() {
      setIsSubscriptionLoading(true);
      if (!user?.id) {
        setIsSubscribed(false);
        setIsSubscriptionLoading(false);
        return;
      }
      try {
        const hasSubscription = await checkSubscriptionClient();
        if (!ignore) setIsSubscribed(hasSubscription);
      } catch (error) {
        if (!ignore) setIsSubscribed(false);
      } finally {
        if (!ignore) setIsSubscriptionLoading(false);
      }
    }
    
    checkSubscriptionStatus();
    return () => { ignore = true; };
  }, [user?.id]);

  // 토큰 수 계산 업데이트 - 대화, 텍스트, 파일 토큰 포함
  const tokenCounts = useMemo(() => {
    return calculateTokens(
      input,
      allMessages,
      files.map(file => ({ file })),
      false
    );
  }, [input, allMessages, files]);

  useEffect(() => {
    setTextTokens(tokenCounts.input);
    setFileTokens(tokenCounts.files);
    setConversationTokens(tokenCounts.conversation);
    setTokenCount(tokenCounts.total);
  }, [tokenCounts]);

  const placeholder = propPlaceholder ?? translations.placeholder;

  // 초기 렌더링 시 자동 포커스
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, []);

  // 최적화된 멘션 검색 함수
  const findMention = useCallback((text: string, cursorPosition: number): { match: RegExpMatchArray | null, startPos: number | null } => {
    // 커서 위치 주변 컨텍스트 검색 (앞뒤로 MENTION_CONTEXT_RANGE만큼)
    const startIndex = Math.max(0, cursorPosition - MENTION_CONTEXT_RANGE);
    
    // 커서 앞부분의 텍스트만 검색 (@ 기호부터 커서까지)
    const searchText = text.substring(startIndex, cursorPosition);
    
    // @로 시작하는 마지막 단어 찾기
    const lastAtSymbolPos = searchText.lastIndexOf('@');
    
    if (lastAtSymbolPos === -1) {
      return { match: null, startPos: null };
    }
    
    // @ 기호 이후의 텍스트 추출
    const mentionText = searchText.substring(lastAtSymbolPos);
    const match = mentionText.match(mentionRegex);
    
    if (!match) {
      return { match: null, startPos: null };
    }
    
    // 실제 전체 텍스트에서의 시작 위치 계산
    const globalStartPos = startIndex + lastAtSymbolPos;
    
    return { match, startPos: globalStartPos };
  }, []);

  // 디바운스된 입력 처리 함수
  const debouncedInputHandler = useCallback(() => {
    if (!inputRef.current || isSubmittingRef.current) return;
    
    // 현재 텍스트 콘텐츠 가져오기 (innerText로 변경하여 공백 유지)
    const content = inputRef.current.innerText || '';
    
    // 이전 텍스트와 동일하면 처리 스킵 (불필요한 처리 방지)
    if (content === lastTextContentRef.current) return;
    lastTextContentRef.current = content;
    
    // 동적 border-radius 조절
    const inputHeight = inputRef.current.scrollHeight;
    const minHeight = 36; // min-h-[36px]
    
    if (inputHeight <= minHeight + 5) {
      // 한 줄일 때: 완전히 둥글게
      inputRef.current.style.borderRadius = '9999px';
    } else if (inputHeight <= minHeight + 20) {
      // 두 줄 정도일 때: 약간 둥글게
      inputRef.current.style.borderRadius = '20px';
    } else {
      // 여러 줄일 때: 더 사각형에 가깝게
      inputRef.current.style.borderRadius = '16px';
    }
    
    // 상위 컴포넌트로 변경 사항 전파
    handleInputChange({
      target: { value: content }
    } as any);
  }, [handleInputChange]);

  // 붙여넣기 이벤트 핸들러 - 성능 최적화 버전
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!inputRef.current) return;
    
    // 클립보드에서 일반 텍스트 가져오기
    const text = e.clipboardData.getData('text/plain');
    
    // 매우 큰 텍스트인 경우 처리 방식 최적화
    if (text.length > 10000) {
      // 현재 선택 영역 가져오기
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      // 사용자에게 처리 중임을 알림
      const processingNode = document.createElement('span');
      processingNode.textContent = translations.processing;
      processingNode.style.opacity = '0.7';
      range.insertNode(processingNode);
      
      // 큰 텍스트 비동기 처리를 위해 setTimeout 사용
      setTimeout(() => {
        if (!inputRef.current) return;
        
        // 중간 처리 메시지 제거
        if (processingNode.parentNode) {
          processingNode.parentNode.removeChild(processingNode);
        }
        
        // 한 번의 DOM 조작으로 처리하기 위한 HTML 생성
        const fragment = document.createDocumentFragment();
        const lines = text.split('\n');
        const chunkSize = 100; // 한 번에 처리할 줄 수
        
        // 청크 처리 함수
        const processChunk = (startIndex: number) => {
          const endIndex = Math.min(startIndex + chunkSize, lines.length);
          
          for (let i = startIndex; i < endIndex; i++) {
            if (lines[i].length > 0) {
              fragment.appendChild(document.createTextNode(lines[i]));
            }
            
            if (i < lines.length - 1) {
              fragment.appendChild(document.createElement('br'));
            }
          }
          
          // 다음 청크가 있으면 비동기적으로 처리
          if (endIndex < lines.length) {
            // 현재 처리된 내용을 DOM에 추가
            range.insertNode(fragment);
            range.collapse(false);
            
            // 다음 청크 예약 (낮은 우선순위로)
            requestIdleCallback(() => {
              processChunk(endIndex);
            }, { timeout: 500 });
          } else {
            // 마지막 청크 처리 완료
            range.insertNode(fragment);
            range.collapse(false);
            
            // 선택 영역 업데이트 및 커서 위치 설정
            selection.removeAllRanges();
            selection.addRange(range);
            
            // 모든 처리가 끝난 후 입력 핸들러 호출
            debouncedInputHandler();
            
            // 포커스 유지
            inputRef.current?.focus();
          }
        };
        
        // 첫 번째 청크 처리 시작
        processChunk(0);
      }, 0);
      
      return;
    }
    
    // 일반적인 크기의 텍스트는 기존 방식으로 처리
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    // 단일 문서 조각으로 모든 내용을 한 번에 구성
    const fragment = document.createDocumentFragment();
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 0) {
        fragment.appendChild(document.createTextNode(lines[i]));
      }
      
      if (i < lines.length - 1) {
        fragment.appendChild(document.createElement('br'));
      }
    }
    
    // 한 번의 DOM 조작으로 모든 내용 삽입
    range.insertNode(fragment);
    range.collapse(false);
    
    // 선택 영역 업데이트
    selection.removeAllRanges();
    selection.addRange(range);
    
    // 입력 핸들러 호출
    debouncedInputHandler();
    
    // 포커스 유지
    inputRef.current.focus();
  };

  // requestIdleCallback 폴리필 (일부 브라우저 호환성을 위해)
  const requestIdleCallback = 
    window.requestIdleCallback ||
    function(cb: IdleRequestCallback, options?: IdleRequestOptions) {
      const start = Date.now();
      return window.setTimeout(function() {
        cb({
          didTimeout: false,
          timeRemaining: function() {
            return Math.max(0, 50 - (Date.now() - start));
          }
        });
      }, options?.timeout || 1);
    };

  // 커서 위치 얻기 함수 (성능 최적화)
  const getCursorPosition = (element: HTMLElement): number => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return 0;
    
    // 범위 내 문자열 길이로 위치 계산 (최적화)
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(element);
    range.setEnd(selection.anchorNode!, selection.anchorOffset);
    return range.toString().length;
  };

  // 사용자 입력 모니터링 및 멘션 감지 (성능 최적화)
  const handleInputWithShortcuts = () => {
    if (!inputRef.current || isSubmittingRef.current) return;
    
    // 디바운스 설정 - 성능 개선을 위해 타이머 시간 증가
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // DOM 업데이트 완료 후 입력 처리 (placeholder 타이밍 이슈 해결)
    requestAnimationFrame(() => {
    debouncedInputHandler();
    });
    
    // 멘션 검색은 디바운스 적용 (비용이 많이 드는 작업)
    debounceTimerRef.current = setTimeout(() => {
      if (!inputRef.current) return;
      
      const content = inputRef.current.innerText || '';
      const cursorPosition = getCursorPosition(inputRef.current);
      
      // 최적화된 멘션 검색 - 커서 위치 주변 컨텍스트 활용
      const { match: mentionMatch, startPos: mentionStartPos } = findMention(content, cursorPosition);
      
      if (mentionMatch) {
        // 멘션 쿼리 상태 활성화
        setMentionQueryActive(true);
        
        // 멘션 시작 위치 저장
        setMentionStartPosition(mentionStartPos);
        
        // 검색어 추출 (@ 다음 텍스트)
        const query = mentionMatch[1] || '';
        setSearchTerm(query);
        
        // 숏컷 검색 API 호출
        supabase.rpc('search_prompt_shortcuts', {
          p_user_id: user.id,
          p_search_term: query
        }).then(({ data, error }) => {
          if (error) {
            console.error('Error searching shortcuts:', error);
            return;
          }
          
          // 검색 결과 업데이트 및 표시
          setShortcuts(data || []);
          setShowShortcuts(true);
          setSelectedIndex(0); // 첫 번째 항목 선택
        });
      } else {
        // 멘션 패턴이 없으면 팝업 닫기
        closeShortcutsPopup();
      }
    }, DEBOUNCE_TIME);
  };

  // 멘션 팝업 닫기 함수
  const closeShortcutsPopup = () => {
    setShowShortcuts(false);
    setMentionStartPosition(null);
    setMentionQueryActive(false);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  // 숏컷 선택 처리
  const handleShortcutSelect = (shortcut: PromptShortcut) => {
    if (!inputRef.current || mentionStartPosition === null) return;
    
    try {
      // 현재 선택 상태 가져오기
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      
      // 멘션 삽입을 위한 범위 계산
      const cursorPos = getCursorPosition(inputRef.current);
      
      // @ 부분부터 현재 커서까지의 콘텐츠 삭제
      if (mentionQueryActive) {
        // 전체 DOM 구조를 고려한 안전한 범위 설정 방법 사용
        // textNode 찾기 및 범위 설정을 위한 새로운 접근법
        
        // 텍스트 노드 위치 찾기 및 범위 설정을 위한 새로운 접근법
        const nodeStack: Node[] = [inputRef.current];
        let currentTextPosition = 0;
        let startNode: Node | null = null;
        let startOffset = 0;
        let endNode: Node | null = null;
        let endOffset = 0;
        
        // 모든 텍스트 노드를 순회하며 시작 및 끝 위치 찾기
        while (nodeStack.length > 0) {
          const currentNode = nodeStack.pop()!;
          
          if (currentNode.nodeType === Node.TEXT_NODE) {
            const textLength = currentNode.textContent?.length || 0;
            
            // 시작 노드 설정
            if (startNode === null && currentTextPosition + textLength > mentionStartPosition) {
              startNode = currentNode;
              startOffset = mentionStartPosition - currentTextPosition;
            }
            
            // 끝 노드 설정
            if (endNode === null && currentTextPosition + textLength >= cursorPos) {
              endNode = currentNode;
              endOffset = cursorPos - currentTextPosition;
              // 시작과 끝 노드를 모두 찾았으면 중단
              break;
            }
            
            currentTextPosition += textLength;
          } else {
            // 자식 노드를 역순으로 스택에 추가 (깊이 우선 탐색)
            const children = Array.from(currentNode.childNodes);
            for (let i = children.length - 1; i >= 0; i--) {
              nodeStack.push(children[i]);
            }
          }
        }
        
        // 노드를 찾지 못한 경우의 안전장치
        if (!startNode || !endNode) {
          console.log('범위를 설정할 적절한 텍스트 노드를 찾지 못했습니다.');
          
          // 안전하게 현재 커서 위치에 삽입
          range.collapse(true);
        } else {
          // 범위 설정
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          
          // @와 이후 쿼리 텍스트 삭제
          range.deleteContents();
        }
      }
      
      // 멘션 태그 생성
      const mentionTag = document.createElement('span');
      mentionTag.className = 'mention-tag-wrapper';
      
      // 멘션 데이터 저장
      const mentionData = {
        id: shortcut.id,
        name: shortcut.name,
        content: shortcut.content
      };
      
      // 멘션 내부 구조 생성
      const mentionInner = document.createElement('span');
      mentionInner.className = 'mention-tag';
      mentionInner.dataset.shortcutId = shortcut.id;
      mentionInner.dataset.mentionData = JSON.stringify(mentionData);
      mentionInner.textContent = `@${shortcut.name}`;
      
      // contentEditable 제거 - CSS로만 스타일링
      // mentionInner.contentEditable = 'false'; <- 이 속성 제거
      
      // 멘션 태그에 추가
      mentionTag.appendChild(mentionInner);
      
      // 멘션 삽입
      range.insertNode(mentionTag);
      
      // 멘션 뒤에 공백 추가
      const spaceNode = document.createTextNode(' ');
      range.setStartAfter(mentionTag);
      range.insertNode(spaceNode);
      
      // 커서 위치 조정 (공백 뒤로)
      range.setStartAfter(spaceNode);
      range.collapse(true);
      
      // 새 선택 영역 적용
      selection.removeAllRanges();
      selection.addRange(range);
      
      // 입력 필드에 포커스 유지
      inputRef.current.focus();
      
      // 부모 상태 업데이트
      const updatedText = inputRef.current.innerText || '';
      lastTextContentRef.current = updatedText; // 참조 업데이트
      
      handleInputChange({
        target: { value: updatedText }
      } as React.ChangeEvent<HTMLTextAreaElement>);
    } catch (error) {
      console.error('Error inserting shortcut:', error);
      
      // 오류 발생 시 대체 방법: 마지막 카트 위치에 간단히 삽입
      try {
        if (inputRef.current) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.collapse(true);
            
            // 단순히 내용 추가
            const mentionText = document.createTextNode(`@${shortcut.name} `);
            range.insertNode(mentionText);
            
            // 커서 위치 조정
            range.setStartAfter(mentionText);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            
            // 입력 필드 업데이트
            const updatedText = inputRef.current.innerText || '';
            lastTextContentRef.current = updatedText;
            handleInputChange({
              target: { value: updatedText }
            } as React.ChangeEvent<HTMLTextAreaElement>);
          }
        }
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
      }
    }
    
    // 팝업 닫기
    closeShortcutsPopup();
  };

  // 입력 필드 클리어
  const clearInput = () => {
    if (inputRef.current) {
      // 모든 콘텐츠 및 빈 노드 제거
      inputRef.current.innerHTML = '';
      lastTextContentRef.current = ''; // 참조 업데이트
      
      // 빈 상태 클래스 추가
      inputRef.current.classList.add('empty');
      
      // 부모 상태 업데이트
      const event = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      handleInputChange(event);
      
      // 입력 필드에 포커스
      inputRef.current.focus();
    }
  };

  // 컴포넌트가 마운트될 때 빈 입력 필드 초기화
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.classList.add('empty');
      inputRef.current.focus({ preventScroll: true });
    }
  }, []);

  // 고유 ID 생성 함수 추가
  const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  // 단순화된 메시지 제출 함수
  const submitMessage = useCallback(async () => {
    if (isSubmittingRef.current || isLoading || !inputRef.current) return;
    
    const content = inputRef.current?.innerText || '';
    if (!content.trim() && files.length === 0) return;
    
    try {
      isSubmittingRef.current = true;
      
      // 텍스트 내용 저장 후 입력 클리어
      const messageContent = content;
      clearInput();
      
      // UI 반응성을 위한 부모 상태 즉시 업데이트
      handleInputChange({
        target: { value: '' }
      } as React.ChangeEvent<HTMLTextAreaElement>);
      
      // 메시지 처리
      setTimeout(async () => {
        try {
          // 제출 이벤트 생성
          const submitEvent = {
            preventDefault: () => {},
            target: { value: messageContent }
          } as unknown as FormEvent<HTMLFormElement>;
          
          // 파일 처리
          const dataTransfer = new DataTransfer();
          files.forEach(file => {
            if (file && file.size >= 0 && file.name) {
              dataTransfer.items.add(file);
            }
          });
          
          // 파일 첨부 정보 생성
          const attachments = files.map(file => {
            // 파일 타입 결정
            let fileType: 'image' | 'code' | 'pdf' | 'file' = 'file';
            if (file.type.startsWith('image/')) {
              fileType = 'image';
            } else if (file.type.includes('text') || 
                      /\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs)$/i.test(file.name)) {
              fileType = 'code';
            } else if (fileHelpers.isPDFFile(file)) {
              fileType = 'pdf';
            }
            
            const fileId = (file as any).id;
            const fileData = fileMap.get(fileId);
            
            return {
              name: file.name,
              contentType: file.type,
              url: fileData?.url || '',
              fileType: fileType,
              id: fileId
            };
          });
          
          // 파일 정보 추가
          (submitEvent as any).experimental_attachments = attachments;
          
          // 메시지 제출
          await handleSubmit(submitEvent, dataTransfer.files);
          
          // 파일 상태 정리
          const urls = Array.from(fileMap.values()).map(({ url }) => url).filter(url => url.startsWith('blob:'));
          
          setFiles([]);
          setFileMap(new Map());
          
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          
          // URL 리소스 해제
          setTimeout(() => {
            urls.forEach(url => {
              try {
                URL.revokeObjectURL(url);
              } catch (error) {
                // 에러 무시 - 이미 해제된 URL일 수 있음
              }
            });
          }, 100);
          
        } catch (submitError) {
          console.error('Error during message submission:', submitError);
        } finally {
          isSubmittingRef.current = false;
        }
      }, 0);
      
    } catch (error) {
      console.error('Error during message submission setup:', error);
      isSubmittingRef.current = false;
    }
  }, [handleInputChange, handleSubmit, files, fileMap, isLoading]);

  // 메시지 제출 핸들러 (폼 제출 이벤트)
  const handleMessageSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitMessage();
  };

  // 스크롤 함수 - 부드러운 스크롤 지원
  const scrollToItem = (index: number) => {
    if (!shortcutsListRef.current) return;
    
    const listElement = shortcutsListRef.current;
    const items = listElement.getElementsByTagName('button');
    if (!items[index]) return;

    const item = items[index];
    const itemRect = item.getBoundingClientRect();
    const listRect = listElement.getBoundingClientRect();

    // 스크롤 필요 여부 계산
    if (itemRect.bottom > listRect.bottom) {
      // 아래로 스크롤 필요
      const scrollDistance = itemRect.bottom - listRect.bottom;
      listElement.scrollBy({ 
        top: scrollDistance + 8,
        behavior: 'smooth'
      });
    } else if (itemRect.top < listRect.top) {
      // 위로 스크롤 필요
      const scrollDistance = listRect.top - itemRect.top;
      listElement.scrollBy({ 
        top: -scrollDistance - 8,
        behavior: 'smooth'
      });
    }
  };

  // 개선된 키보드 이벤트 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 숏컷 목록이 열려있고 항목이 있는 경우
    if (showShortcuts && shortcuts.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => {
            const newIndex = (prev + 1) % shortcuts.length;
            scrollToItem(newIndex);
            return newIndex;
          });
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => {
            const newIndex = (prev - 1 + shortcuts.length) % shortcuts.length;
            scrollToItem(newIndex);
            return newIndex;
          });
          break;
          
        case 'Enter':
          // 시프트 키와 함께 누르지 않은 경우에만 숏컷 선택
          if (!e.shiftKey) {
            e.preventDefault();
            handleShortcutSelect(shortcuts[selectedIndex]);
          }
          break;
          
        case 'Escape':
          // ESC로 팝업 닫기
          e.preventDefault();
          closeShortcutsPopup();
          break;
          
        case 'Tab':
          // 탭으로 선택 후 닫기
          e.preventDefault();
          handleShortcutSelect(shortcuts[selectedIndex]);
          break;
      }
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter: 줄바꿈 적용
        e.preventDefault();
        
        // 현재 선택 범위 및 커서 위치 가져오기
        const selection = window.getSelection();
        const range = selection?.getRangeAt(0);
        
        if (range && inputRef.current) {
          // 줄바꿈 요소 생성
          const br = document.createElement('br');
          range.deleteContents();
          range.insertNode(br);
          
          // 커서 위치 조정
          range.setStartAfter(br);
          range.setEndAfter(br);
          selection?.removeAllRanges();
          selection?.addRange(range);
          
          // 입력 변경 이벤트 발생
          debouncedInputHandler();
        }
      } else {
        // 일반 Enter: 메시지 제출 - 직접 함수 호출로 이벤트 큐 건너뛰기
        e.preventDefault();
        if (!isSubmittingRef.current && !isLoading) {
          // 중요: requestAnimationFrame 사용하여 다음 렌더링 프레임에 제출 처리
          requestAnimationFrame(() => {
            submitMessage();
          });
        }
      }
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      // Command+A (전체 선택) 최적화
      e.preventDefault();
      optimizedSelectAll();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
      // Command+X (잘라내기) 최적화
      handleOptimizedCut();
    } else if (e.key === 'Backspace') {
      const currentContent = inputRef.current?.innerText ?? '';
      // Backspace로 모든 내용 지웠을 때 placeholder 다시 보이게
      if (currentContent === '' || currentContent === '\n') {
        // When clearing input with backspace, ensure handler is called
        debouncedInputHandler();
      }
    }
  };

  // 전체 선택 최적화 함수
  const optimizedSelectAll = () => {
    if (!inputRef.current) return;
    
    // 브라우저 성능 최적화를 위해 requestAnimationFrame 사용
    requestAnimationFrame(() => {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        
        // 입력 필드가 비어있으면 조기 종료
        if (!inputRef.current?.firstChild) return;
        
        // 내용이 많은 경우 네이티브 선택 메서드 사용
        if (inputRef.current.innerText && inputRef.current.innerText.length > 1000) {
          // DOM 조작 최소화를 위해 네이티브 메서드 사용
          if ('createTextRange' in document.body) {
            // IE에서의 텍스트 선택 (타입스크립트 오류 수정)
            const textRange = (document.body as any).createTextRange();
            textRange.moveToElementText(inputRef.current);
            textRange.select();
          } else {
            // 모던 브라우저
            range.selectNodeContents(inputRef.current);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        } else {
          // 간단한 컨텐츠의 경우 표준 범위 선택 사용
          range.selectNodeContents(inputRef.current);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      } catch (error) {
        console.error('선택 최적화 중 오류:', error);
        // 오류 발생 시 표준 선택 명령으로 폴백
        document.execCommand('selectAll', false);
      }
    });
  };

  // 최적화된 잘라내기 처리 함수
  const handleOptimizedCut = () => {
    if (!inputRef.current) return;
    
    // 선택된 텍스트가 있는지 확인
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    
    // 아무것도 선택되지 않은 경우 전체 선택
    if (range.collapsed) {
      optimizedSelectAll();
    }
    
    // 시스템 클립보드에 선택 내용 복사
    try {
      // 선택 영역을 트래킹하기 위한 범위 클론
      const selectionRange = selection.getRangeAt(0).cloneRange();
      const selectedContent = selectionRange.toString();
      
      // 클립보드에 복사
      navigator.clipboard.writeText(selectedContent).then(() => {
        // 성공적으로 복사된 후 선택 영역 삭제
        requestAnimationFrame(() => {
          if (!inputRef.current) return;
          
          // 선택 영역 삭제 (단일 DOM 연산으로)
          selection.getRangeAt(0).deleteContents();
          
          // 입력 필드 상태 업데이트
          if (inputRef.current.innerText?.trim() === '') {
            inputRef.current.classList.add('empty');
          }
          
          // 부모 컴포넌트 상태 업데이트
          const event = {
            target: { value: inputRef.current.innerText || '' }
          } as React.ChangeEvent<HTMLTextAreaElement>;
          handleInputChange(event);
          
          // 포커스 유지
          inputRef.current.focus();
        });
      }).catch(err => {
        console.error('클립보드 작업 실패:', err);
        // 실패시 표준 잘라내기 명령으로 폴백
        document.execCommand('cut');
      });
    } catch (error) {
      console.error('최적화된 잘라내기 중 오류:', error);
      // 오류 발생시 표준 잘라내기로 폴백
      document.execCommand('cut');
    }
  };

  // 선택된 인덱스 리셋 (숏컷 변경 시)
  useEffect(() => {
    setSelectedIndex(0);
  }, [shortcuts]);

  // 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      // 모든 URL 정리
      fileMap.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, []);

  // 추가: 성능 모니터링을 위한 입력 필드 이벤트 핸들러
  useEffect(() => {
    if (!inputRef.current) return;
    
    // 선택 시작 시 대용량 텍스트 처리에 최적화된 동작
    const handleSelectionStart = () => {
      if (inputRef.current && inputRef.current.innerText && 
          inputRef.current.innerText.length > 5000) {
        // 대용량 텍스트에서 선택 시작될 때 스타일 최적화
        inputRef.current.classList.add('optimizing-selection');
      }
    };
    
    // 선택 종료 시 원래 상태로 복구
    const handleSelectionEnd = () => {
      if (inputRef.current) {
        inputRef.current.classList.remove('optimizing-selection');
      }
    };
    
    // 이벤트 리스너 등록
    inputRef.current.addEventListener('selectstart', handleSelectionStart);
    inputRef.current.addEventListener('mouseup', handleSelectionEnd);
    
    // 클린업 함수
    return () => {
      inputRef.current?.removeEventListener('selectstart', handleSelectionStart);
      inputRef.current?.removeEventListener('mouseup', handleSelectionEnd);
    };
  }, []);

  // 드래그 처리
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 드래그가 파일을 포함하는지 확인
    if (e.dataTransfer.types.includes('Files')) {
      if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
      }
    }
  };

  // 드래그 떠남 처리
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 폼 요소를 떠날 때만 비활성화
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setDragActive(false);
  };

  // 드롭 처리
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const items = e.dataTransfer.items;
    if (!items) return;

    // 폴더 확인
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry?.isDirectory) {
        setShowFolderError(true);
        setTimeout(() => setShowFolderError(false), 3000);
        return; // 폴더가 감지되면 처리 중단
      }
    }

    // 폴더가 없으면 파일 처리
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // 파일 처리 - 메타데이터 추출 추가
  const handleFiles = async (newFiles: FileList) => {
    // FileList를 Array로 변환하고 기본 필터링만 수행
    const newFileArray = Array.from(newFiles).filter(file => {
      // PDF 파일 지원 확인
      if (fileHelpers.isPDFFile(file)) {
        if (!supportsPDFs) {
          setShowPDFError(true);
          setTimeout(() => setShowPDFError(false), 3000);
          return false;
        }
        return true;
      }      
      
      // 이미지 파일 지원 확인
      if (!supportsVision && file.type.startsWith('image/')) {
        setShowPDFError(true);
        setTimeout(() => setShowPDFError(false), 3000);
        return false;
      }

      // 비디오 파일 필터링
      if (file.type.startsWith('video/') || /\.(mp4|mov|avi|wmv|flv|mkv|webm)$/i.test(file.name)) {
        setShowVideoError(true);
        setTimeout(() => setShowVideoError(false), 3000);
        return false;
      }
      
      return true;
    });
    
    if (newFileArray.length === 0) return;
    
    // 메타데이터 추출 및 파일 처리
    const processedFiles = await Promise.all(
      newFileArray.map(async (file) => {
        const fileId = generateUniqueId();
        const url = URL.createObjectURL(file);
        
        // 파일 타입 결정
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        let fileType: 'image' | 'code' | 'pdf' | 'file' = 'file';
        
        if (file.type.startsWith('image/')) {
          fileType = 'image';
        } else if (file.type.includes('text') || 
                   ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'py', 'java', 
                    'c', 'cpp', 'cs', 'go', 'rb', 'php', 'swift', 'kt', 'rs'].includes(fileExt || '')) {
          fileType = 'code';
        } else if (file.type === 'application/pdf' || fileExt === 'pdf') {
          fileType = 'pdf';
        }
        
        // 메타데이터 추출
        let metadata: FileMetadata;
        try {
          switch (fileType) {
            case 'image':
              metadata = await extractImageMetadata(file);
              break;
            case 'pdf':
              metadata = await extractPDFMetadata(file);
              break;
            case 'code':
              metadata = await extractTextMetadata(file);
              break;
            default:
              metadata = extractDefaultMetadata(file);
              break;
          }
        } catch (error) {
          console.warn('Metadata extraction failed for file:', file.name, error);
          metadata = extractDefaultMetadata(file);
        }
        
        // 파일 객체에 메타데이터 첨부
        Object.defineProperty(file, 'metadata', {
          value: metadata,
          writable: false,
          enumerable: true
        });
        
        Object.defineProperty(file, 'id', {
          value: fileId,
          writable: false,
          enumerable: true
        });
        
        return {
          file,
          fileId,
          url,
          metadata
        };
      })
    );
    
    // 파일 맵 업데이트
    setFileMap(prevMap => {
      const newMap = new Map(prevMap);
      processedFiles.forEach(({ fileId, file, url }) => {
        newMap.set(fileId, { file, url, id: fileId, originalName: file.name } as any);
      });
      return newMap;
    });

    // 파일 배열 업데이트
    setFiles(prevFiles => {
      return [...prevFiles, ...processedFiles.map(({ file }) => file)];
    });
  };

  // 파일 제거
  const removeFile = (fileToRemove: File) => {
    // ID로 접근할 수 있도록 타입 확장
    const fileId = (fileToRemove as any).id;
    
    // fileMap에서 제거하고 URL 해제
    setFileMap(prevMap => {
      const newMap = new Map(prevMap);
      if (fileId && newMap.has(fileId)) {
        const fileData = newMap.get(fileId);
        if (fileData) {
          // 성능 개선: URL.revokeObjectURL은 상태 업데이트 후 별도 실행
          const urlToRevoke = fileData.url;
          setTimeout(() => URL.revokeObjectURL(urlToRevoke), 0);
          newMap.delete(fileId);
        }
      }
      return newMap;
    });

    // files 배열에서 제거 (ID로 비교)
    setFiles(prevFiles => prevFiles.filter(file => (file as any).id !== fileId));
  };

  // Agent 툴팁 호버 상태 관리
  const [isHoveringTooltip, setIsHoveringTooltip] = useState(false);
  const [isHoveringButton, setIsHoveringButton] = useState(false);

  useEffect(() => {
    if (!isHoveringButton && !isHoveringTooltip) {
      const hideTimer = setTimeout(() => {
        setShowAgentTooltip(false);
      }, 200); // 짧은 딜레이로 마우스 이동 시간 제공

      return () => clearTimeout(hideTimer);
    }
  }, [isHoveringButton, isHoveringTooltip]);

  // Token 툴팁 호버 상태 관리
  const showTokenTooltipFunc = () => {
    if (tokenTooltipTimeoutRef.current) {
      clearTimeout(tokenTooltipTimeoutRef.current);
      tokenTooltipTimeoutRef.current = null;
    }
    setShowTokenTooltip(true);
  };

  const hideTokenTooltipFunc = () => {
    tokenTooltipTimeoutRef.current = setTimeout(() => {
      if (!isHoveringTokenCounter && !isHoveringTokenTooltip) {
        setShowTokenTooltip(false);
      }
    }, 200); // 200ms 딜레이
  };

  useEffect(() => {
    if (!isHoveringTokenCounter && !isHoveringTokenTooltip) {
      hideTokenTooltipFunc();
    } else if (isHoveringTokenCounter || isHoveringTokenTooltip) {
      showTokenTooltipFunc();
    }
  }, [isHoveringTokenCounter, isHoveringTokenTooltip]);

  useEffect(() => {
    return () => {
      if (tokenTooltipTimeoutRef.current) {
        clearTimeout(tokenTooltipTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <form 
        ref={formRef} 
        onSubmit={handleMessageSubmit} 
        className={`flex flex-col gap-2 sticky bottom-0 bg-transparent p-1
          ${dragActive ? 'drag-target-active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        
        <FilePreview files={files} fileMap={fileMap} removeFile={removeFile} />
  
        <ErrorToast show={showPDFError} message={
          supportsPDFs 
            ? "This file type is not supported" 
            : (supportsVision 
              ? "This model does not support PDF files" 
              : "This model does not support PDF and image files")
        } />
        <ErrorToast show={showFolderError} message="Folders cannot be uploaded" />
        <ErrorToast show={showVideoError} message="Video files are not supported" />
  
        <div 
          className={`relative transition-transform duration-300 ${dragActive ? 'scale-[1.01]' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDragLeave}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={supportsPDFs
              ? "image/*,text/*,application/json,application/javascript,application/typescript,application/xml,application/yaml,application/x-yaml,application/markdown,application/x-python,application/x-java,application/x-c,application/x-cpp,application/x-csharp,application/x-go,application/x-ruby,application/x-php,application/x-swift,application/x-kotlin,application/x-rust" 
              : (supportsVision 
                ? "image/*,text/*,application/json,application/javascript,application/typescript,application/xml,application/yaml,application/x-yaml,application/markdown,application/x-python,application/x-java,application/x-c,application/x-cpp,application/x-csharp,application/x-go,application/x-ruby,application/x-php,application/x-swift,application/x-kotlin,application/x-rust" 
                : "text/*,application/json,application/javascript,application/typescript,application/xml,application/yaml,application/x-yaml,application/markdown,application/x-python,application/x-java,application/x-c,application/x-cpp,application/x-csharp,application/x-go,application/x-ruby,application/x-php,application/x-swift,application/x-kotlin,application/x-rust")}            
            onChange={(e) => { if (e.target.files) { handleFiles(e.target.files); } }}
            ref={fileInputRef}
            className="hidden"
            multiple
          />
          
          <div ref={inputContainerRef} className="flex gap-1 sm:gap-3 items-center py-0">
            {/* Agent(뇌) 버튼 */}
            {setisAgentEnabled && (
              <div className="relative" ref={agentDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (user?.hasAgentModels !== false || isAgentEnabled) {
                      setisAgentEnabled(!isAgentEnabled);
                    }
                  }}
                  onMouseEnter={() => {
                    setShowAgentTooltip(true);
                    setIsHoveringButton(true);
                  }}
                  onMouseLeave={() => {
                    setIsHoveringButton(false);
                  }}
                  className={`input-btn transition-all duration-300 flex items-center justify-center relative rounded-full w-8 h-8 ${
                    isAgentEnabled ?
                      'bg-[var(--chat-input-primary)] text-[var(--chat-input-primary-foreground)]' :
                      user?.hasAgentModels === false && !isAgentEnabled ?
                        'opacity-40 cursor-not-allowed bg-[var(--chat-input-button-bg)]' :
                        'bg-[var(--chat-input-button-bg)] hover:bg-[var(--chat-input-button-hover-bg)] text-[var(--muted)]'
                  }`}
                  disabled={user?.hasAgentModels === false && !isAgentEnabled}
                  title={
                    user?.hasAgentModels === false && !isAgentEnabled 
                      ? "Agent mode not available" 
                      : ""
                  }
                >
                  <BrainIOS className="h-5 w-5 transition-transform duration-300" />
                  {/* <Brain className="h-5 w-5 transition-transform duration-300" strokeWidth={1.2} /> */}
                  {isAgentEnabled && (
                    <span className="absolute top-1 right-1 bg-white rounded-full w-1.5 h-1.5"></span>
                  )}
                </button>
  
                {/* Agent Tooltip */}
                                  {showAgentTooltip && (
                    <div 
                      className="absolute bottom-full mb-4 -left-2 w-80 bg-white/90 dark:bg-black/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl z-50 p-4 shadow-2xl shadow-black/20 dark:shadow-black/60 animate-in fade-in duration-200 slide-in-from-bottom-2"
                      onMouseEnter={() => setIsHoveringTooltip(true)}
                      onMouseLeave={() => setIsHoveringTooltip(false)}
                      style={{
                        transform: 'translateY(-4px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        backdropFilter: 'blur(24px)'
                      }}
                    >
                    {/* Apple-style arrow */}
                    <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-white/90 dark:bg-black/80 border-r border-b border-black/5 dark:border-white/10 rotate-45 backdrop-blur-2xl -z-10"></div>
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--accent)]/30">
                        <div className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isAgentEnabled ? 'bg-[var(--chat-input-primary)] text-[var(--chat-input-primary-foreground)]' : 'bg-[var(--chat-input-button-bg)] text-[var(--muted)]'}`}>
                          <BrainIOS className="h-5 w-5" />
                          {/* <Brain className="h-5 w-5" strokeWidth={1.2} /> */}
                          {isAgentEnabled && <span className="absolute top-1 right-1 bg-white rounded-full w-1.5 h-1.5"></span>}
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">{isAgentEnabled ? 'Agent' : 'Direct Chat'}</span>
                      </div>
                      <svg className="h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      <div className="flex items-center gap-2 p-2 rounded-lg">
                        <div className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${!isAgentEnabled ? 'bg-[var(--chat-input-primary)] text-[var(--chat-input-primary-foreground)]' : 'bg-[var(--chat-input-button-bg)] text-[var(--muted)]'}`}>
                          <BrainIOS className="h-5 w-5" />
                          {/* <Brain className="h-5 w-5" strokeWidth={1.2} /> */}
                          {!isAgentEnabled && <span className="absolute top-1 right-1 bg-white rounded-full w-1.5 h-1.5"></span>}
                        </div>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{isAgentEnabled ? 'Direct Chat' : 'Agent'}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{isAgentEnabled ? translations.talkToModel : translations.usesTools}</p>
                      <a href="/agent-mode" target="_blank" rel="noopener noreferrer" className="w-4 h-4 rounded-full bg-[#007AFF]/10 hover:bg-[#007AFF]/20 flex items-center justify-center transition-colors group flex-shrink-0" title="Learn more about Agent Mode">
                        <svg className="w-2.5 h-2.5 text-[#007AFF] group-hover:text-[#007AFF]/80" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                      </a>
                    </div>
                    {user?.hasAgentModels === false && !isAgentEnabled && (
                                              <div className="mt-2 p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                        <div className="flex items-center gap-2">
                          <svg className="h-3 w-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L3.16 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                          <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">Agent mode requires non-rate-limited models</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
  
            {/* File upload button */}
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--chat-input-button-bg)] hover:bg-[var(--chat-input-button-hover-bg)] transition-colors flex-shrink-0 text-[var(--muted)]"
              >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
  
            <div className="flex-1 relative">
              <div
                ref={inputRef}
                contentEditable
                onInput={handleInputWithShortcuts}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                className={`futuristic-input ${input.trim() === '' ? 'empty' : ''} w-full transition-colors duration-300 py-1 px-4 rounded-full outline-none text-sm sm:text-base bg-[var(--chat-input-bg)] text-[var(--chat-input-text)] overflow-y-auto min-h-[32px] flex items-center ${
                  tokenCount > 0 ? 'has-token-counter' : ''
                }`}
                data-placeholder={placeholder}
                suppressContentEditableWarning
                style={{ 
                  maxHeight: '300px', 
                  wordBreak: 'break-word', 
                  overflowWrap: 'break-word', 
                  whiteSpace: 'pre-wrap', 
                  lineHeight: '1.3',
                  resize: 'none',
                  caretColor: 'var(--chat-input-primary)',
                  border: '1px solid var(--chat-input-border)',
                  ...(('caretWidth' in document.documentElement.style) && { caretWidth: '2px' })
                } as React.CSSProperties}
              ></div>
              
              {/* Token Counter and Tooltip Container */}
              {tokenCount > 0 && !modelId?.includes('chatflix') && (
                <div 
                  className="absolute top-1/2 -translate-y-1/2 right-2"
                  onMouseEnter={() => {
                    setIsHoveringTokenCounter(true);
                    showTokenTooltipFunc();
                  }}
                  onMouseLeave={() => {
                    setIsHoveringTokenCounter(false);
                    hideTokenTooltipFunc();
                  }}
                >
                  {/* Token Counter Badge */}
                  <div 
                    className={`token-counter ${
                      tokenCount > tokenThresholds.danger ? 'error' : 
                      tokenCount > tokenThresholds.warning ? 'warning' : ''
                    }`}
                  >
                    {`${Math.round((tokenCount / tokenThresholds.limit) * 100)}%`}
                  </div>
                  
                  {/* Apple-style Token Usage Tooltip */}
                  {showTokenTooltip && (() => {
                    const proThresholds = getTokenThresholds(modelConfig?.contextWindow, true);
                    const nonProThresholds = tokenThresholds;
            
                    const isPreviewingUpgrade = !isSubscribed && isHoveringUpgrade;
                    const displayThresholds = isPreviewingUpgrade ? proThresholds : nonProThresholds;
                    
                    const currentUsageColor = tokenCount > displayThresholds.danger ? 'text-red-500' : 
                                              tokenCount > displayThresholds.warning ? 'text-orange-500' : 'text-green-500';
            
                    const progressBarColor = tokenCount > displayThresholds.danger ? 'bg-red-500' : 
                                             tokenCount > displayThresholds.warning ? 'bg-orange-400' : 'bg-green-500';
                    
                    const progressPercentage = Math.min(100, (tokenCount / displayThresholds.limit) * 100);
            
                    const statusMessage = tokenCount > displayThresholds.danger ? translations.tokenDanger :
                                          tokenCount > displayThresholds.warning ? translations.tokenWarning :
                                          translations.tokenSafe;

                    return (
                      <div 
                        className="absolute bottom-full mb-3 -right-2 w-64 bg-white/90 dark:bg-black/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl z-50 p-4 shadow-2xl shadow-black/20 dark:shadow-black/60 animate-in fade-in duration-200 slide-in-from-bottom-2"
                        onMouseEnter={() => {
                          setIsHoveringTokenTooltip(true);
                          showTokenTooltipFunc();
                        }}
                        onMouseLeave={() => {
                          setIsHoveringTokenTooltip(false);
                          hideTokenTooltipFunc();
                        }}
                        style={{
                          transform: 'translateY(-4px)',
                          WebkitBackdropFilter: 'blur(24px)',
                          backdropFilter: 'blur(24px)'
                        }}
                      >
                        {/* Apple-style arrow */}
                        <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white/90 dark:bg-black/80 border-r border-b border-black/5 dark:border-white/10 rotate-45 backdrop-blur-2xl -z-10"></div>
                        
                        <div className="flex flex-col gap-3">
                          {/* Header with icon */}
                          <div className="flex items-center gap-2.5">
                            <div className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center">
                              <Gauge className="w-3 h-3 text-blue-600 dark:text-blue-400" strokeWidth={2} />
                            </div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
                              {translations.contextUsage}
                            </span>
                          </div>

                          {/* Usage stats with better typography */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              Usage
                            </span>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-sm font-bold tabular-nums ${currentUsageColor}`}>
                                {tokenCount > 1000 ? `${(tokenCount/1000).toFixed(1)}k` : tokenCount}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {' of '}
                              </span>
                              <span className={`text-sm font-bold tabular-nums ${isPreviewingUpgrade ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                {(displayThresholds.limit / 1000).toFixed(0)}K
                              </span>
                            </div>
                          </div>
    
                          {/* Apple-style progress bar */}
                          <div className="relative">
                            <div className="w-full bg-gray-200/60 dark:bg-gray-700/40 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ease-out ${progressBarColor} shadow-sm`}
                                style={{ width: `${progressPercentage}%` }}
                              ></div>
                            </div>
                            {/* Progress percentage */}
                            <div className="flex justify-end mt-1">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 tabular-nums">
                                {Math.round(progressPercentage)}%
                              </span>
                            </div>
                          </div>
                          
                          {/* Status message with better styling */}
                          <div className="flex items-start gap-2">
                            {tokenCount > displayThresholds.danger ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" strokeWidth={2} />
                            ) : tokenCount > displayThresholds.warning ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-orange-500 mt-0.5 flex-shrink-0" strokeWidth={2} />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" strokeWidth={2} />
                            )}
                            <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300 font-medium">
                              {statusMessage}
                            </p>
                          </div>
                          
                          {/* Pro upgrade with Apple-style button */}
                          {!isSubscribed && modelConfig?.contextWindow && modelConfig.contextWindow > CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER && (
                            <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                              <a 
                                href="/pricing" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="group w-full inline-flex items-center justify-center gap-2.5 text-sm bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                                onClick={(e) => e.stopPropagation()}
                                onMouseEnter={() => setIsHoveringUpgrade(true)}
                                onMouseLeave={() => setIsHoveringUpgrade(false)}
                              >
                                {/* <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg> */}
                                {translations.upgrade}
                                <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
  
            {/* Submit Button */}
            {isLoading ? (
              <button onClick={(e) => { e.preventDefault(); stop(); }} type="button" className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 bg-[var(--chat-input-primary)] text-[var(--chat-input-primary-foreground)] flex-shrink-0" aria-label="Stop generation">
                <div className="w-2.5 h-2.5 bg-current rounded-sm"></div>
              </button>
            ) : (
              <button type="submit" className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${disabled || !input.trim() ? 'bg-[var(--chat-input-button-bg)] text-[var(--muted)] cursor-not-allowed' : 'bg-[var(--chat-input-primary)] text-[var(--chat-input-primary-foreground)]'}`} disabled={disabled || !input.trim()} aria-label="Send message">
                <svg width="16" height="16" viewBox="0 0 24 24" className="transition-transform duration-300"><path d="M12 2L12 22M5 9L12 2L19 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              </button>
            )}
          </div>
        </div>
  
        <DragDropOverlay dragActive={dragActive} supportsPDFs={supportsPDFs} />
  
        <PromptShortcuts
          showShortcuts={showShortcuts}
          shortcuts={shortcuts}
          selectedIndex={selectedIndex}
          searchTerm={searchTerm}
          handleShortcutSelect={handleShortcutSelect}
          closeShortcutsPopup={closeShortcutsPopup}
          popupPosition={popupPosition}
          shortcutsListRef={shortcutsListRef}
        />
      </form>
    </div>
  );
  }