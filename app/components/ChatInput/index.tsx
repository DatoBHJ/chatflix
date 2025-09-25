// app/components/chat/ChatInput/index.tsx
import React, { FormEvent, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { createClient } from '@/utils/supabase/client';
import { getModelById } from '@/lib/models/config';
import { ChatInputProps } from './types';
import { useChatInputStyles } from './ChatInputStyles';
import { FileUploadButton, FilePreview, fileHelpers } from './FileUpload';
import { ErrorToast } from './DragDropOverlay';
import { Search, Calculator, Link, Image, Video, FileText, Plus, BarChart3, Building, BookOpen, Github, User, Briefcase, FileVideo, Paperclip, Youtube } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';
import { Brain as BrainIOS } from 'react-ios-icons'; 
import { FileMetadata } from '@/lib/types';
import { 
  extractImageMetadata, 
  extractPDFMetadata, 
  extractTextMetadata, 
  extractDefaultMetadata
} from '@/app/chat/[id]/utils';
import { getChatInputTranslations } from '@/app/lib/chatInputTranslations';
import { estimateTokenCount, estimateMultiModalTokens, estimateFileTokens, estimateAttachmentTokens } from '@/utils/context-manager';

// 비구독자 컨텍스트 윈도우 제한 제거됨

// 도구 정의 - Google Search가 일반 검색의 기본 도구, Exa는 특별한 콘텐츠용
const TOOLS = [
  { id: 'google_search', icon: <SiGoogle size={18} />, name: 'Google Search', description: 'Search Google for comprehensive results' },
  { id: 'google-images', icon: <SiGoogle size={18} />, name: 'Google Images', description: 'Search Google Images for visual content' },
  { id: 'google-videos', icon: <SiGoogle size={18} />, name: 'Google Videos', description: 'Search Google Videos for video content' },
  { id: 'web_search:general', icon: <Search strokeWidth={1.8} />, name: 'Advanced Search', description: 'AI-powered search for images, research, and specialized content' },
  // 뉴스는 Google Search로 통합 (Exa news 제거됨)
  // { id: 'web_search:news', icon: <Newspaper strokeWidth={1.8} />, name: 'News Search', description: 'Find latest news and articles' },
  { id: 'youtube_search', icon: <Youtube strokeWidth={1.8} />, name: 'YouTube Search', description: 'Search YouTube videos' },
  { id: 'youtube_link_analyzer', icon: <Youtube strokeWidth={1.8} />, name: 'YouTube Analyzer', description: 'Analyze YouTube videos' },
  { id: 'image_generator', icon: <Image strokeWidth={1.8} />, name: 'Image Generator', description: 'Generate images from text' },
  { id: 'web_search:github', icon: <Github strokeWidth={1.8} />, name: 'GitHub Search', description: 'Search GitHub repositories' },
  { id: 'web_search:personal site', icon: <User strokeWidth={1.8} />, name: 'Personal Sites', description: 'Find personal websites and blogs' },
  { id: 'web_search:linkedin profile', icon: <Briefcase strokeWidth={1.8} />, name: 'LinkedIn Profiles', description: 'Search LinkedIn profiles' },
  { id: 'web_search:company', icon: <Building strokeWidth={1.8} />, name: 'Company Search', description: 'Find company information' },
  { id: 'web_search:financial report', icon: <BarChart3 strokeWidth={1.8} />, name: 'Financial Reports', description: 'Search financial data and reports' },
  { id: 'web_search:research paper', icon: <BookOpen strokeWidth={1.8} />, name: 'Academic Papers', description: 'Find academic research papers' },
  { id: 'web_search:pdf', icon: <FileText strokeWidth={1.8} />, name: 'PDF Search', description: 'Search PDF documents' },
  { id: 'calculator', icon: <Calculator strokeWidth={1.8} />, name: 'Calculator', description: 'Mathematical calculations' },
  { id: 'link_reader', icon: <Link strokeWidth={1.8} />, name: 'Link Reader', description: 'Read web page content' },
];







// 개선된 토큰 계산 함수 - 보수적 계수 적용
function calculateTokens(
  text: string,
  allMessages: any[],
  attachments: any[],
  isHomePage: boolean = false
): { conversation: number; input: number; files: number; total: number } {
  // 보수적 계수 (1.3배로 증가)
  const CONSERVATIVE_FACTOR = 1.3;
  
  // 현재 입력 토큰 수 계산
  const input = Math.ceil(estimateTokenCount(text) * CONSERVATIVE_FACTOR);
  
  // 파일 토큰 수 계산
  let files = 0;
  
  // 새로 업로드된 파일들의 토큰 수 계산
  for (const attachment of attachments) {
    if (attachment.file) {
      files += Math.ceil(estimateFileTokens({
      name: attachment.file.name,
      type: attachment.file.type,
      metadata: attachment.file.metadata
    }) * CONSERVATIVE_FACTOR);
    } else if (attachment.metadata?.estimatedTokens) {
      files += Math.ceil(attachment.metadata.estimatedTokens * CONSERVATIVE_FACTOR);
    } else {
      files += Math.ceil(estimateAttachmentTokens(attachment) * CONSERVATIVE_FACTOR);
    }
  }
  
  // 대화 히스토리 토큰 수 계산 (홈페이지가 아닌 경우)
  let conversation = 0;
  if (!isHomePage && allMessages && allMessages.length > 0) {
    conversation = allMessages.reduce((total, message) => {
      return total + Math.ceil(estimateMultiModalTokens(message) * CONSERVATIVE_FACTOR);
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
  
  // 컨텍스트 윈도우 제한 제거됨 - 모든 사용자가 전체 컨텍스트 윈도우 사용 가능
  const effectiveContextWindow = contextWindow;
  
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
  allMessages = [],
  globalDragActive = false,
  globalShowPDFError = false,
  globalShowFolderError = false,
  globalShowVideoError = false,
  selectedTool,
  setSelectedTool
}: ChatInputProps) {
  // 기본 상태 및 참조
  const inputRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const lastTextContentRef = useRef<string>(''); // 마지막 텍스트 콘텐츠 저장
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  
  // 상태 관리
  const [files, setFiles] = useState<File[]>([]);
  const [fileMap, setFileMap] = useState<Map<string, { file: File, url: string }>>(new Map());
  const [showPDFError, setShowPDFError] = useState(false);
  const [showFolderError, setShowFolderError] = useState(false);
  const [showVideoError, setShowVideoError] = useState(false);
  const [showAgentError, setShowAgentError] = useState(false);
  const [showToolSelector, setShowToolSelector] = useState(false);
  const [translations, setTranslations] = useState({
    uploadFile: 'Upload file'
  });
  
  // Supabase 클라이언트
  const supabase = createClient();
  
  // 모델 설정
  const modelConfig = getModelById(modelId);
  const supportsVision = modelConfig?.supportsVision ?? false;
  const supportsPDFs = modelConfig?.supportsPDFs ?? false;
  



  // 스타일 적용
  useChatInputStyles();

  useEffect(() => {
    setTranslations(getChatInputTranslations());
  }, []);



  // Device detection hook
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const placeholder = propPlaceholder ?? (selectedTool 
    ? (() => {        
        // Mobile placeholders (concise)
        const mobilePlaceholders: { [key: string]: string } = {
          'web_search:general': 'Search for images or niche content',
          // 'web_search:news': 'Search the news', // 제거됨 - Google Search로 대체
          'web_search:financial report': 'Search financial reports',
          'web_search:company': 'Search companies',
          'web_search:research paper': 'Search research papers',
          'web_search:pdf': 'Search PDF documents',
          'web_search:github': 'Search GitHub repositories',
          'web_search:personal site': 'Search personal websites',
          'web_search:linkedin profile': 'Search LinkedIn profiles',

          'google_search': 'Search Google',
          'google-images': 'Search images on Google',
          'google-videos': 'Search videos on Google',
          'calculator': 'Enter a calculation',
          'link_reader': 'Paste a URL to read',
          'image_generator': 'Describe an image to generate',
          'youtube_search': 'Search YouTube videos',
          'youtube_link_analyzer': 'Paste YouTube URL to analyze'
        };

        // Desktop placeholders (detailed examples)
        const desktopPlaceholders: { [key: string]: string } = {
          'web_search:general': 'Search for images or niche content',
          // 'web_search:news': 'Find breaking news about AI war', // 제거됨 - Google Search로 대체
          'web_search:financial report': 'Search Apple\'s revenue growth reports',
          'web_search:company': 'Find company making space travel cheaper',
          'web_search:research paper': 'Find papers about embeddings',
          'web_search:pdf': 'Search government UFO documents',
          'web_search:github': 'Find OpenAPI to Rust converter repo',
          'web_search:personal site': 'Find life coach for work stress',
          'web_search:linkedin profile': 'Find best computer scientist at Berkeley',

          'google_search': 'Search Google',
          'google-images': 'Search images on Google',
          'google-videos': 'Search videos on Google',
          'calculator': 'Calculate mortgage payment 500k 30yr 4.5%',
          'link_reader': 'https://www.showstudio.com/projects/in_camera/kanye_west',
          'image_generator': 'Draw a futuristic city skyline at sunset',
          'youtube_search': 'Search cooking tutorials for beginners',
          'youtube_link_analyzer': 'https://www.youtube.com/watch?v=60RFIF9y8fY'
        };
        
        return isMobile ? mobilePlaceholders[selectedTool] : desktopPlaceholders[selectedTool];
      })()
    : isAgentEnabled 
      ? 'One ring to rule them all...' 
      : "Chatflix.app"
  );

  // 입력 처리 함수 (최대 단순화)
  const debouncedInputHandler = useCallback(() => {
    if (!inputRef.current || isSubmittingRef.current) return;

    // 최소한의 처리만 - 복잡한 로직 모두 제거
    let content = inputRef.current.innerText || '';

    // 사용자가 모든 내용을 지웠을 때, 브라우저가 남기는 불필요한 줄바꿈을 제거
    if (content === '\n') {
      content = '';
    }

    // 중복 처리 방지만 유지
    if (content === lastTextContentRef.current) return;
    lastTextContentRef.current = content;

    // 상위 컴포넌트로 변경 사항 전파 (empty 클래스는 className에서 자동 처리)
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
    
    // 긴 텍스트인 경우 (1000자 이상) 중간 과정 숨김 처리
    if (text.length > 1000) {
      // 입력창을 임시로 숨김 처리
      const originalOpacity = inputRef.current.style.opacity;
      const originalPointerEvents = inputRef.current.style.pointerEvents;
      inputRef.current.style.opacity = '0.3';
      inputRef.current.style.pointerEvents = 'none';
      
      // 현재 선택 영역 가져오기
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      // 백그라운드에서 전체 텍스트를 한 번에 처리
      setTimeout(() => {
        if (!inputRef.current) return;
        
        // 전체 텍스트를 한 번의 DOM 조작으로 처리
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
        
        // 한 번에 모든 내용 삽입
        range.insertNode(fragment);
        range.collapse(false);
        
        // 선택 영역 업데이트
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 입력창 복원 및 처리 완료
        inputRef.current.style.opacity = originalOpacity || '1';
        inputRef.current.style.pointerEvents = originalPointerEvents || 'auto';
        
        // 모든 처리가 끝난 후 입력 핸들러 호출
        debouncedInputHandler();
        
        // 최하단으로 스크롤
        inputRef.current.scrollTop = inputRef.current.scrollHeight;
        
        // 포커스 유지
        inputRef.current?.focus();
      }, 100); // 약간의 지연으로 부드러운 전환
      
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



  // 입력 이벤트 핸들러
  const handleInput = () => {
    if (!inputRef.current || isSubmittingRef.current) return;
    
    // 타이핑은 항상 즉시 반영 - 디바운싱 제거
    debouncedInputHandler();
  };

  // 입력 필드 클리어 - 완전한 클리어 함수 (모바일 최적화)
  const clearInput = () => {
    if (inputRef.current) {
      // 모든 콘텐츠 및 빈 노드 제거
      inputRef.current.innerHTML = '';
      lastTextContentRef.current = ''; // 참조 업데이트
      
      // 모바일에서 DOM 업데이트를 보장하기 위해 requestAnimationFrame 사용
      requestAnimationFrame(() => {
        if (inputRef.current) {
          // 빈 상태 클래스 추가 (강제로)
          inputRef.current.classList.add('empty');
          
          // placeholder 속성 재설정
          inputRef.current.setAttribute('data-placeholder', placeholder);
          
          // 모바일에서 추가 확인 - innerText가 정말 비어있는지 체크
          if (inputRef.current.innerText && inputRef.current.innerText.trim() !== '') {
            // 아직 내용이 남아있다면 강제로 다시 클리어
            inputRef.current.innerHTML = '';
            inputRef.current.classList.add('empty');
          }
        }
      });
      
      // 부모 상태 업데이트 (즉시)
      handleInputChange({
        target: { value: '' }
      } as React.ChangeEvent<HTMLTextAreaElement>);
      
    }
  };

  // placeholder 변경 시 입력 필드 초기화 (자동 포커스는 하지 않음)
  useEffect(() => {
    if (inputRef.current) {
      // placeholder 속성만 업데이트 (empty 클래스는 className에서 자동 처리)
      inputRef.current.setAttribute('data-placeholder', placeholder);
    }
  }, [placeholder]);

  // 고유 ID 생성 함수 추가
  const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  // 단순화된 메시지 제출 함수
  const submitMessage = useCallback(async () => {
    if (isSubmittingRef.current || isLoading || !inputRef.current) return;

    isSubmittingRef.current = true;
    
    try {
      const messageContent = inputRef.current.innerText || '';
      // 제출 이벤트 생성 (메시지 내용을 target.value로 전달)
      const submitEvent = {
        preventDefault: () => {},
        target: { value: messageContent }
      } as unknown as FormEvent<HTMLFormElement>;

      // 올바른 FileList 생성 (현재 files 스냅샷 고정)
      const snapshotFiles = [...files];
      const fileList = {
        length: snapshotFiles.length,
        item: (index: number) => snapshotFiles[index],
        [Symbol.iterator]: function* () {
          for (let i = 0; i < snapshotFiles.length; i++) {
            yield snapshotFiles[i];
          }
        }
      } as FileList;

      // 입력 및 UI를 즉시 클리어하여 즉각적 UX 제공 (clearInput 사용으로 placeholder 재설정 보장)
      clearInput();
      
      // 모바일에서 추가 보장 - 이중 체크로 확실히 클리어
      if (isMobile) {
        setTimeout(() => {
          if (inputRef.current && inputRef.current.innerText && inputRef.current.innerText.trim() !== '') {
            inputRef.current.innerHTML = '';
            inputRef.current.classList.add('empty');
            inputRef.current.setAttribute('data-placeholder', placeholder);
          }
        }, 50); // 50ms 후 한 번 더 체크
      }

      // 파일 상태는 제출 직후 정리 (미리 스냅샷으로 전달했으므로 안전)
      const urls = Array.from(fileMap.values()).map(({ url }) => url).filter(url => url.startsWith('blob:'));
      setFiles([]);
      setFileMap(new Map());
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      urls.forEach(url => {
        try { URL.revokeObjectURL(url); } catch {}
      });

      // 메시지 제출 (선택된 도구 정보 포함)
      const submitEventWithTool = { ...submitEvent, selectedTool: selectedTool || null } as any;
      await handleSubmit(submitEventWithTool, fileList);
    } catch (error) {
      console.error('Error during message submission setup:', error);
    } finally {
      isSubmittingRef.current = false;
    }
  }, [handleInputChange, handleSubmit, files, fileMap, isLoading, selectedTool]);

  // 간단한 내용 확인 - input prop 기반으로 통일
  const hasContent = input.length > 0 || files.length > 0;

  // isInputExpanded 관련 코드 제거 - 전송 버튼 항상 하단 고정

  // ResizeObserver 제거 - 전송 버튼 위치 고정으로 불필요

  // 메시지 제출 핸들러 (폼 제출 이벤트)
  const handleMessageSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isLoading || !hasContent) return;

    // AI SDK 5 형식: parts 배열 구조 사용
    const uiParts: any[] = [];
    
    // 텍스트 부분 추가
    if (input.trim()) {
      uiParts.push({ type: 'text', text: input.trim() });
    }
    
    // 첨부파일을 file parts로 변환
    files.forEach(file => {
      const fileInfo = fileMap.get(file.name);
      if (fileInfo) {
        if (file.type.startsWith('image/')) {
          uiParts.push({
            type: 'image',
            image: fileInfo.url
          });
        } else {
          uiParts.push({
            type: 'file',
            url: fileInfo.url,
            mediaType: file.type,
            filename: file.name
          });
        }
      }
    });

    // 기존 experimental_attachments 제거 (v5에서는 사용하지 않음)
    // (submitEvent as any).experimental_attachments = attachments;

    // FileList로 변환하여 전달
    const fileList = {
      length: files.length,
      item: (index: number) => files[index],
      [Symbol.iterator]: function* () {
        for (let i = 0; i < files.length; i++) {
          yield files[i];
        }
      }
    } as FileList;

    // 선택된 도구 정보를 이벤트에 추가 (preventDefault 메서드 보존)
    const eventWithTool = {
      ...e,
      preventDefault: e.preventDefault.bind(e),
      selectedTool: selectedTool || null
    } as any;
    
    // 파일 상태 정리 (완전한 클리어) - handleSubmit 호출 전에 실행
    const urls = Array.from(fileMap.values()).map(({ url }) => url).filter(url => url.startsWith('blob:'));
    
    // 즉시 상태 클리어
    setFiles([]);
    setFileMap(new Map());
    
    // 파일 입력 필드 클리어
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // URL 리소스 즉시 해제 (지연 없이)
    urls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        // 에러 무시 - 이미 해제된 URL일 수 있음
      }
    });
    
    // 메시지 제출 및 입력 클리어
    handleSubmit(eventWithTool, fileList);
    handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>);
    
    // 모바일에서 추가 보장 - 입력창이 확실히 클리어되도록
    if (isMobile && inputRef.current) {
      // 즉시 클리어
      inputRef.current.innerHTML = '';
      inputRef.current.classList.add('empty');
      inputRef.current.setAttribute('data-placeholder', placeholder);
      
      // 50ms 후 한 번 더 체크하여 확실히 클리어
      setTimeout(() => {
        if (inputRef.current && inputRef.current.innerText && inputRef.current.innerText.trim() !== '') {
          inputRef.current.innerHTML = '';
          inputRef.current.classList.add('empty');
          inputRef.current.setAttribute('data-placeholder', placeholder);
        }
      }, 50);
    }
  };



  // 개선된 키보드 이벤트 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
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
          
          // 모바일에서 추가 보장 - Enter 키 후 즉시 클리어
          if (isMobile && inputRef.current) {
            setTimeout(() => {
              if (inputRef.current && inputRef.current.innerText && inputRef.current.innerText.trim() !== '') {
                inputRef.current.innerHTML = '';
                inputRef.current.classList.add('empty');
                inputRef.current.setAttribute('data-placeholder', placeholder);
              }
            }, 10); // 10ms 후 즉시 체크
          }
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

        // 🚀 URL 정보를 파일 객체에 추가 (중복 업로드 방지)
        Object.defineProperty(file, 'url', {
          value: url,
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



  // 외부 클릭/터치 시 도구 선택창 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (showToolSelector && agentDropdownRef.current) {
        const target = event.target as Node;
        if (!agentDropdownRef.current.contains(target)) {
          setShowToolSelector(false);
        }
      }
    };

    if (showToolSelector) {
      // 마우스와 터치 이벤트 모두 처리
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [showToolSelector]);

  // 도구 선택 핸들러
  const handleToolSelect = (toolId: string) => {
    flushSync(() => {
      if (setSelectedTool) {
        setSelectedTool(toolId);
      }
      if (setisAgentEnabled) {
        setisAgentEnabled(true);
      }
      setShowToolSelector(false);
    });
  };

  // 도구 선택 해제 핸들러
  const handleToolDeselect = () => {
    flushSync(() => {
      if (setSelectedTool) {
        setSelectedTool(null);
      }
      if (setisAgentEnabled) {
        setisAgentEnabled(false);
      }
    });
  };

  // 선택된 도구 정보 가져오기
  const selectedToolInfo = selectedTool ? TOOLS.find(tool => tool.id === selectedTool) : null;


  return (
    <div className="relative">
      {/* SVG 필터 정의: 유리 질감 왜곡 효과 */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="glass-distortion" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="7" result="noise" />
            <feImage result="radialMask" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g' cx='50%25' cy='50%25' r='70%25'><stop offset='0%25' stop-color='black'/><stop offset='100%25' stop-color='white'/></radialGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>" />
            <feComposite in="noise" in2="radialMask" operator="arithmetic" k1="0" k2="0" k3="1" k4="0" result="modulatedNoise" />
            <feGaussianBlur in="modulatedNoise" stdDeviation="0.3" edgeMode="duplicate" result="smoothNoise" />
            <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="18" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* 다크모드 전용 글라스 필터 */}
          <filter id="glass-distortion-dark" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.03" numOctaves="4" seed="7" result="noise" />
            <feImage result="radialMask" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g-dark' cx='50%25' cy='50%25' r='80%25'><stop offset='0%25' stop-color='white'/><stop offset='100%25' stop-color='black'/></radialGradient></defs><rect width='100%25' height='100%25' fill='url(%23g-dark)'/></svg>" />
            <feComposite in="noise" in2="radialMask" operator="arithmetic" k1="0" k2="0" k3="0.8" k4="0" result="modulatedNoise" />
            <feGaussianBlur in="modulatedNoise" stdDeviation="0.4" edgeMode="duplicate" result="smoothNoise" />
            <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="12" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      
      <form 
        ref={formRef} 
        onSubmit={handleMessageSubmit} 
        className="flex flex-col gap-2 sticky bottom-0 bg-transparent p-1"
      >
        
        <FilePreview files={files} fileMap={fileMap} removeFile={removeFile} />
  
        <ErrorToast show={showPDFError || globalShowPDFError} message={
          supportsPDFs 
            ? "This file type is not supported" 
            : (supportsVision 
              ? "This model does not support PDF files" 
              : "This model does not support PDF and image files")
        } />
        <ErrorToast show={showFolderError || globalShowFolderError} message="Folders cannot be uploaded" />
        <ErrorToast show={showVideoError || globalShowVideoError} message="Video files are not supported" />
  
        <div 
          className="relative transition-transform duration-300"
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
          
          <div ref={inputContainerRef} className="flex gap-2 sm:gap-3 items-end py-0">
            {/* Agent(뇌) 버튼 */}
            {setisAgentEnabled && (
              <div className="relative flex-shrink-0" ref={agentDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    // 모바일에서 입력창이 이미 포커스된 경우에만 블러하여 키보드 숨김
                    if (isMobile && inputRef.current && document.activeElement === inputRef.current) {
                      inputRef.current.blur();
                    }
                    // 현재 모델이 에이전트를 지원하는지 확인
                    const currentModel = getModelById(modelId);
                    const isCurrentModelAgentEnabled = currentModel?.isAgentEnabled === true;
                    
                    if (selectedTool) {
                      // 도구가 선택된 상태에서 뇌 버튼을 누르면 기본 상태로 복귀
                      flushSync(() => {
                        setSelectedTool?.(null);
                        setisAgentEnabled?.(false);
                        setShowToolSelector(false);
                      });
                    } else if (isAgentEnabled) {
                      // 에이전트 모드에서 뇌 버튼을 누르면 기본 상태로 복귀
                      flushSync(() => {
                        setisAgentEnabled?.(false);
                        setShowToolSelector(false);
                      });
                    } else {
                      // 일반 모드에서 뇌 버튼을 누를 때
                      if (!isCurrentModelAgentEnabled) {
                        // 현재 모델이 에이전트를 지원하지 않으면 에러 표시
                        setShowAgentError(true);
                        setTimeout(() => setShowAgentError(false), 3000); // 3초 후 에러 숨김
                        return;
                      }
                      // 에이전트 모드 활성화 + 도구 선택창 표시 (동기 처리)
                      flushSync(() => {
                        if (setisAgentEnabled) {
                          setisAgentEnabled(true);
                        }
                        setShowToolSelector(true);
                      });
                    }
                  }}
                  className={`input-btn transition-all duration-300 flex items-center justify-center relative rounded-full w-8 h-8 cursor-pointer`}
                  style={{
                    backgroundColor: selectedTool 
                      ? 'rgba(255, 255, 255, 0.1)' 
                      : isAgentEnabled 
                        ? 'var(--chat-input-primary)' 
                        : user?.hasAgentModels === false && !isAgentEnabled 
                          ? 'rgba(255, 255, 255, 0.1)' 
                          : 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'url(#glass-distortion) blur(1px)',
                    WebkitBackdropFilter: 'url(#glass-distortion) blur(1px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                    color: selectedTool 
                      ? 'var(--foreground)' 
                      : isAgentEnabled 
                        ? 'var(--chat-input-primary-foreground)' 
                        : user?.hasAgentModels === false && !isAgentEnabled 
                          ? 'var(--foreground)' 
                          : 'var(--foreground)',
                    opacity: user?.hasAgentModels === false && !isAgentEnabled ? 0.4 : 1,
                    // 다크모드 전용 스타일
                    ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                        (document.documentElement.getAttribute('data-theme') === 'system' && 
                         window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                      backgroundColor: selectedTool 
                        ? 'rgba(0, 0, 0, 0.05)' 
                        : isAgentEnabled 
                          ? 'var(--chat-input-primary)' 
                          : user?.hasAgentModels === false && !isAgentEnabled 
                            ? 'rgba(0, 0, 0, 0.05)' 
                            : 'rgba(0, 0, 0, 0.05)',
                      backdropFilter: 'url(#glass-distortion-dark) blur(1px)',
                      WebkitBackdropFilter: 'url(#glass-distortion-dark) blur(1px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    } : {})
                  }}
                  disabled={user?.hasAgentModels === false && !isAgentEnabled}
                  title={
                    user?.hasAgentModels === false && !isAgentEnabled 
                      ? "Agent mode not available" 
                      : ""
                  }
                >
                  {selectedTool && selectedToolInfo?.icon ? (
                    React.cloneElement(selectedToolInfo.icon, { 
                      className: "h-4 w-4 text-[var(--muted)] transition-transform duration-300",
                      strokeWidth: 2
                    })
                  ) : (
                    <BrainIOS className="h-5 w-5 transition-transform duration-300" />
                  )}
                  {/* <Brain className="h-5 w-5 transition-transform duration-300" strokeWidth={1.2} /> */}
                  {isAgentEnabled && !selectedTool && (
                    <span className="absolute top-1 right-1 bg-white rounded-full w-1.5 h-1.5"></span>
                  )}
                  {selectedTool && (
                    <span className="absolute top-1 right-1 bg-[var(--chat-input-primary)] rounded-full w-1.5 h-1.5"></span>
                  )}
                </button>

                {/* Tool selector */}
                {showToolSelector && (
                  <div 
                    className="absolute top-0 -translate-y-full -mt-2 -left-1 w-56 chat-input-tooltip-backdrop rounded-2xl z-50 overflow-hidden tool-selector"
                    style={{
                      // 라이트모드 기본 스타일 (모델 선택창과 동일)
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                      backdropFilter: 'url(#glass-distortion) blur(10px) saturate(180%)',
                      WebkitBackdropFilter: 'url(#glass-distortion) blur(10px) saturate(180%)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                      // 다크모드 전용 스타일
                      ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                          (document.documentElement.getAttribute('data-theme') === 'system' && 
                           window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                        backdropFilter: 'url(#glass-distortion-dark) blur(24px)',
                        WebkitBackdropFilter: 'url(#glass-distortion-dark) blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      } : {})
                    }}
                  >
                                  {/* Apple-style arrow removed */}
                    


                    {/* Agent mode tools section */}
                    <div className="p-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)] px-2 py-1 mb-1">
                        <span>Tools</span>
                        {/* <a href="/agent-mode" target="_blank" rel="noopener noreferrer" className="w-4 h-4 rounded-full bg-[#007AFF]/10 hover:bg-[#007AFF]/20 flex items-center justify-center transition-colors group flex-shrink-0" title="Learn more about Agent Mode">
                          <svg className="w-2.5 h-2.5 text-[#007AFF] group-hover:text-[#007AFF]/80" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </a> */}
                      </div>
                      <div className="max-h-50 overflow-y-auto scrollbar-minimal">
                        {TOOLS.map((tool) => (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => handleToolSelect(tool.id)}
                            className={`flex items-center gap-2 w-full p-2 transition-colors text-left tool-button rounded-lg ${
                              selectedTool === tool.id
                                ? 'bg-[#007AFF] text-white'
                                : 'hover:bg-[var(--accent)]'
                            }`}
                          >
                            <div className={`flex items-center justify-center w-7 h-7 flex-shrink-0 ${
                              selectedTool === tool.id
                                ? 'text-white'
                                : 'text-[var(--muted)]'
                            }`}>
                              {React.cloneElement(tool.icon, { 
                                className: "h-3.5 w-3.5",
                                strokeWidth: 2
                              })}
                            </div>
                            <span className={`text-sm font-medium ${
                              selectedTool === tool.id
                                ? 'text-white'
                                : 'text-[var(--foreground)]'
                            }`}>
                              {tool.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Clear selection */}
                    {selectedTool && (
                      <>
                        <div className="h-px bg-[var(--subtle-divider)] mx-3"></div>
                        <div className="p-2">
                          <button
                            type="button"
                            onClick={handleToolDeselect}
                            className="flex items-center gap-2 w-full p-2 hover:bg-[var(--accent)] transition-colors text-left tool-button rounded-lg"
                          >
                            <div className="flex items-center justify-center w-7 h-7 flex-shrink-0">
                              <svg className="h-3.5 w-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            <span className="text-sm font-medium text-[var(--muted)]">
                              Cancel Selection
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

              </div>
            )}
  
            {/* File upload button */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center w-8 h-8 rounded-full transition-colors flex-shrink-0 text-[var(--foreground)] cursor-pointer"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'url(#glass-distortion) blur(1px)',
                    WebkitBackdropFilter: 'url(#glass-distortion) blur(1px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                  // 다크모드 전용 스타일
                  ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                      (document.documentElement.getAttribute('data-theme') === 'system' && 
                       window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    backdropFilter: 'url(#glass-distortion-dark) blur(1px)',
                    WebkitBackdropFilter: 'url(#glass-distortion-dark) blur(1px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  } : {})
                }}
                title={translations.uploadFile}
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
  
            <div className="flex-1 relative flex-shrink-0">
              {/* Agent Error Message */}
              <ErrorToast show={showAgentError} message="This model doesn't support Agent mode. Please select an Agent-enabled model." />
              
              <div className="relative">
                <div
                  ref={inputRef}
                  contentEditable
                  onInput={handleInput}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  className={`futuristic-input ${input === '' ? 'empty' : ''} w-full transition-colors duration-300 py-1.5 rounded-full outline-none text-sm sm:text-base text-[var(--chat-input-text)] overflow-y-auto min-h-[32px]`}
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
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'url(#glass-distortion) blur(1px)',
                    WebkitBackdropFilter: 'url(#glass-distortion) blur(1px)', // Safari 지원
                    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                    paddingLeft: '1rem', // CSS에서 paddingRight 처리
                    ...(('caretWidth' in document.documentElement.style) && { caretWidth: '2px' }),
                    // 다크모드 전용 스타일
                    ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                        (document.documentElement.getAttribute('data-theme') === 'system' && 
                         window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: 'rgba(0, 0, 0, 0.05)',
                      backdropFilter: 'url(#glass-distortion-dark) blur(1px)',
                      WebkitBackdropFilter: 'url(#glass-distortion-dark) blur(1px)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    } : {})
                  } as React.CSSProperties}
                ></div>
                
                {/* 입력창 내부 전송 버튼 */}
                {(hasContent || isLoading) && (
                  <div className="absolute right-1 bottom-1 sm:bottom-1.5">
                    {isLoading ? (
                      <button 
                        onClick={(e) => { e.preventDefault(); stop(); }} 
                        type="button" 
                        className="flex items-center justify-center w-8 h-6 rounded-full transition-all duration-300 bg-[var(--chat-input-primary)] text-[var(--chat-input-primary-foreground)] flex-shrink-0 cursor-pointer" 
                        aria-label="Stop generation"
                      >
                        <div className="w-2 h-2 bg-current rounded-sm"></div>
                      </button>
                    ) : (
                      <button 
                        type="submit" 
                        className={`w-8 h-6 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 cursor-pointer ${
                          disabled || !hasContent 
                            ? 'bg-[var(--chat-input-button-bg)] text-[var(--muted)] cursor-not-allowed' 
                            : 'bg-[var(--chat-input-primary)] text-[var(--chat-input-primary-foreground)]'
                        }`} 
                        disabled={disabled || !hasContent} 
                        aria-label="Send message"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" className="transition-transform duration-300">
                          <path d="M12 2L12 22M5 9L12 2L19 9" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
              
            </div>
          </div>
        </div>
      </form>
    </div>
  );
  }




