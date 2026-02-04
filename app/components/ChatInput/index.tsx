// app/components/chat/ChatInput/index.tsx
import React, { FormEvent, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { flushSync, createPortal } from 'react-dom';
import { createClient } from '@/utils/supabase/client';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { getModelById } from '@/lib/models/config';
import { ChatInputProps } from './types';
import { useChatInputStyles } from './ChatInputStyles';
import { FilePreview, fileHelpers } from './FileUpload';
import { ErrorToast } from './DragDropOverlay';
import { Search, Calculator, Link, Image, FileText, Plus, BarChart3, Building, BookOpen, Github, User, Youtube, Palette, Video, Info, Wrench } from 'lucide-react';
import { SiGoogle, SiLinkedin } from 'react-icons/si';
import { BiSolidBank } from 'react-icons/bi';
import NextImage from 'next/image'; 
import { FileMetadata } from '@/lib/types';
import { 
  extractImageMetadata, 
  extractPDFMetadata, 
  extractTextMetadata, 
  extractDefaultMetadata
} from '@/app/chat/[id]/utils';
import { getChatInputTranslations } from '@/app/lib/translations/chatInput';
import { estimateTokenCount, estimateMultiModalTokens, estimateFileTokens, estimateAttachmentTokens } from '@/utils/context-manager';
import { getAdaptiveGlassStyleClean, getAdaptiveGlassStyleBlur, getAdaptiveGlassBackgroundColor, getIconClassName as getIconClassNameUtil, getTextStyle } from '@/app/lib/adaptiveGlassStyle';
import { getChatflixLogo } from '@/lib/models/logoUtils';
import { OnboardingRenderer } from '@/app/components/Onboarding/OnboardingRenderer';
import { XLogo, WanAiLogo, SeedreamLogo, XaiLogo } from '../CanvasFolder/CanvasLogo';
import { useContentEditableImage } from '@/app/hooks/useContentEditableImage';
import { FileSelectionPopover } from './FileSelectionPopover';
import { PhotoSelectionModal } from './PhotoSelectionModal';
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage';

// 비구독자 컨텍스트 윈도우 제한 제거됨

type ToolCategory = 'search' | 'ai-generation' | 'utility';

type ToolDefinition = {
  id: string;
  icon: React.ReactElement<any>;
  name: React.ReactNode;
  description: string;
  category: ToolCategory;
  background: string;
  placeholder: { mobile: string; desktop: string };
  hasInfoIcon?: boolean;
  smallIcon?: boolean;
};

// 도구 정의 - Google Search가 일반 검색의 기본 도구, Exa는 특별한 콘텐츠용
export const TOOLS: ToolDefinition[] = [
  { id: 'google_search', icon: <SiGoogle strokeWidth={0.5} className="h-[0.375rem] w-[0.375rem]" />, name: 'Google Search', description: 'Search Google for comprehensive results', category: 'search', background: 'linear-gradient(0deg, #2980B9 0%, #6DD5FA 100%)', placeholder: { mobile: 'Search Google', desktop: 'Search Google' }, hasInfoIcon: true, smallIcon: true },
  { id: 'google-images', icon: <SiGoogle strokeWidth={0.5} className="h-[0.375rem] w-[0.375rem]" />, name: 'Google Images', description: 'Search Google Images for visual content', category: 'search', background: 'linear-gradient(0deg, #2980B9 0%, #6DD5FA 100%)', placeholder: { mobile: 'Search images on Google', desktop: 'Search images on Google' }, hasInfoIcon: true, smallIcon: true },
  { id: 'google-videos', icon: <SiGoogle strokeWidth={0.5} className="h-[0.375rem] w-[0.375rem]" />, name: 'Google Videos', description: 'Search Google Videos for video content', category: 'search', background: 'linear-gradient(0deg, #2980B9 0%, #6DD5FA 100%)', placeholder: { mobile: 'Search videos on Google', desktop: 'Search videos on Google' }, hasInfoIcon: true, smallIcon: true },
  { id: 'twitter_search', icon: <XLogo size={18} />, name: (<span className="inline-flex items-center gap-1"><XLogo size={14} /><span>Search</span></span>), description: 'Use X advanced operators to find tweets', category: 'search', background: 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 100%)', placeholder: { mobile: 'Search tweets', desktop: 'What are people saying about AI?' } },
  { id: 'gemini_image_tool', icon: <SiGoogle strokeWidth={0.5} className="h-4 w-4" />, name: '🍌 Nano Banana Pro', description: '1K/2K/4K; generate or edit, up to 14 images.', category: 'ai-generation', background: 'linear-gradient(0deg, #9333EA 0%, #C084FC 100%)', placeholder: { mobile: 'Generate, edit images, or create infographics', desktop: 'Generate, edit images, or create infographics' }, hasInfoIcon: true, smallIcon: true },
  { id: 'seedream_image_tool', icon: <SeedreamLogo size={18} />, name: 'Seedream 4.5', description: 'Uncensored; generate or edit, 1K/2K/4K, up to 10 images.', category: 'ai-generation', background: 'linear-gradient(0deg, #355691 0%, #83D0CB 100%)', placeholder: { mobile: 'Generate or edit images in 4K', desktop: 'Generate or edit images in 4K' }, hasInfoIcon: true },
  { id: 'wan25_text_to_video', icon: <WanAiLogo size={18} />, name: 'Wan 2.5 Text to Video', description: 'Uncensored; 5 or 10s, 480p/720p/1080p, up to 1632×1248.', category: 'ai-generation', background: 'linear-gradient(0deg, #654ea3 0%, #eaafc8 100%)', placeholder: { mobile: 'Describe a video to generate', desktop: 'Describe a video to generate' }, hasInfoIcon: true },
  { id: 'wan25_image_to_video', icon: <WanAiLogo size={18} />, name: 'Wan 2.5 Image to Video', description: 'Uncensored; 5 or 10s, 480p/720p/1080p.', category: 'ai-generation', background: 'linear-gradient(0deg, #654ea3 0%, #eaafc8 100%)', placeholder: { mobile: 'Bring this image to life', desktop: 'Bring this image to life' }, hasInfoIcon: true },
  { id: 'grok_text_to_video', icon: <XaiLogo size={18} />, name: 'Grok Text to Video', description: 'xAI Grok Imagine; 1–15s, 480p or 720p.', category: 'ai-generation', background: 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 100%)', placeholder: { mobile: 'Describe a video to generate', desktop: 'Describe a video to generate' }, hasInfoIcon: true },
  { id: 'grok_image_to_video', icon: <XaiLogo size={18} />, name: 'Grok Image to Video', description: 'xAI Grok Imagine; 1–15s, 480p or 720p.', category: 'ai-generation', background: 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 100%)', placeholder: { mobile: 'Bring this image to life', desktop: 'Bring this image to life' }, hasInfoIcon: true },
  { id: 'grok_video_edit', icon: <XaiLogo size={18} />, name: 'Grok Video to Video', description: 'xAI Grok Imagine; edit only videos generated in the conversation (input up to 8.7s, 480p or 720p).', category: 'ai-generation', background: 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 100%)', placeholder: { mobile: 'Describe changes to the video', desktop: 'Describe changes to the video' }, hasInfoIcon: true },
  { id: 'link_reader', icon: <Link strokeWidth={1.8} />, name: 'Link Reader', description: 'Read web page content', category: 'utility', background: 'linear-gradient(0deg, #56ab2f 0%, #a8e063 100%)', placeholder: { mobile: 'Paste a URL to read', desktop: 'Paste a URL to read' } },
  { id: 'youtube_search', icon: <Youtube strokeWidth={1.8} />, name: 'YouTube Search', description: 'Search YouTube videos', category: 'search', background: 'linear-gradient(0deg, #DC2626 0%, #F87171 100%)', placeholder: { mobile: 'Search YouTube videos', desktop: 'Search cooking tutorials for beginners' } },
  { id: 'youtube_link_analyzer', icon: <Youtube strokeWidth={1.8} />, name: 'YouTube Analyzer', description: 'Analyze YouTube videos', category: 'utility', background: 'linear-gradient(0deg, #DC2626 0%, #F87171 100%)', placeholder: { mobile: 'Paste YouTube URL to analyze', desktop: 'Paste YouTube URL to analyze' } },
  { id: 'web_search:github', icon: <Github strokeWidth={1.8} />, name: 'GitHub Search', description: 'Search GitHub repositories', category: 'search', background: 'linear-gradient(0deg, #1a1a1a 0%, #2a2a2a 100%)', placeholder: { mobile: 'Search GitHub repositories', desktop: 'Find OpenAPI to Rust converter repo' } },
  { id: 'web_search:personal site', icon: <User strokeWidth={1.8} />, name: 'Personal Site Search', description: 'Find personal websites and blogs', category: 'search', background: 'linear-gradient(0deg, #1CD8D2 0%, #93EDC7 100%)', placeholder: { mobile: 'Search personal websites', desktop: 'Find life coach for work stress' } },
  { id: 'web_search:linkedin profile', icon: <SiLinkedin strokeWidth={0.5} className="h-[0.375rem] w-[0.375rem]" />, name: 'LinkedIn Profile Search', description: 'Search LinkedIn profiles', category: 'search', background: 'linear-gradient(0deg, #0072ff 0%, #00c6ff 100%)', placeholder: { mobile: 'Search LinkedIn profiles', desktop: 'Find best computer scientist at Berkeley' }, smallIcon: true },
  { id: 'web_search:company', icon: <Building strokeWidth={1.8} />, name: 'Company Search', description: 'Find company information', category: 'search', background: 'linear-gradient(0deg, #8a92a5 0%, #b8c0d0 100%)', placeholder: { mobile: 'Search companies', desktop: 'Find company making space travel cheaper' } },
  { id: 'web_search:financial report', icon: <BiSolidBank size={18} />, name: 'Financial Report Search', description: 'Search financial data and reports', category: 'search', background: 'linear-gradient(0deg, #11998e 0%, #38ef7d 100%)', placeholder: { mobile: 'Search financial reports', desktop: 'Search Apple\'s revenue growth reports' } },
  { id: 'web_search:research paper', icon: <BookOpen strokeWidth={1.8} />, name: 'Research Paper Search', description: 'Find academic research papers', category: 'search', background: 'linear-gradient(0deg, #9333EA 0%, #C084FC 100%)', placeholder: { mobile: 'Search research papers', desktop: 'Find papers about embeddings' } },
  { id: 'web_search:pdf', icon: <FileText strokeWidth={1.8} />, name: 'PDF Search', description: 'Search PDF documents', category: 'search', background: 'linear-gradient(0deg, #991B1B 0%, #DC2626 100%)', placeholder: { mobile: 'Search PDF documents', desktop: 'Search government UFO documents' } },
  { id: 'calculator', icon: <Calculator strokeWidth={1.8} />, name: 'Calculator', description: 'Mathematical calculations', category: 'utility', background: 'linear-gradient(0deg, #F2994A 0%, #F2C94C 100%)', placeholder: { mobile: 'Calculate mortgage payment 500k 30yr 4.5%', desktop: 'Calculate mortgage payment 500k 30yr 4.5%' } },
];

// 카테고리별 도구 분류 자동 생성
const TOOL_CATEGORIES: Record<ToolCategory, { label: string; toolIds: string[] }> = {
  'search': { label: 'Search', toolIds: TOOLS.filter(t => t.category === 'search').map(t => t.id) },
  'ai-generation': { label: 'AI Generation', toolIds: TOOLS.filter(t => t.category === 'ai-generation').map(t => t.id) },
  'utility': { label: 'Utility', toolIds: TOOLS.filter(t => t.category === 'utility').map(t => t.id) }
};

// 도구 아이콘 배경 스타일 결정 함수
const getToolIconBackground = (toolId: string): string => {
  return TOOLS.find(t => t.id === toolId)?.background || 'linear-gradient(0deg, #9ca3a8 0%, #4a5568 100%)';
};

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
  setSelectedTool,
  hasBackgroundImage = false
}: ChatInputProps) {
  // 테마 감지 상태
  const [isDark, setIsDark] = useState(false);

  const {
    insertedImages,
    setInsertedImages,
    contentEditableRef: inputRef,
    insertImageIntoContentEditable,
    syncImagesWithDOM,
    extractContentFromEditable
  } = useContentEditableImage();

  // 기본 상태 및 참조
  // const inputRef = useRef<HTMLDivElement>(null);
  
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const lastTextContentRef = useRef<string>(''); // 마지막 텍스트 콘텐츠 저장
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const toolSelectorRef = useRef<HTMLDivElement>(null);
  const fileUploadButtonRef = useRef<HTMLButtonElement>(null);
  const fileSelectionPopoverRef = useRef<HTMLDivElement>(null);
  
  // 상태 관리
  const [files, setFiles] = useState<File[]>([]);
  const [fileMap, setFileMap] = useState<Map<string, { file: File, url: string }>>(new Map());
  const [showPDFError, setShowPDFError] = useState(false);
  const [showFolderError, setShowFolderError] = useState(false);
  const [showVideoError, setShowVideoError] = useState(false);
  const [showAgentError, setShowAgentError] = useState(false);
  const [showToolSelector, setShowToolSelector] = useState(false);
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null); // 모바일에서 열린 tooltip 추적
  const [showFileSelectionPopover, setShowFileSelectionPopover] = useState(false);
  const [showPhotoSelectionModal, setShowPhotoSelectionModal] = useState(false);
  const [translations, setTranslations] = useState({
    uploadFile: 'Upload file'
  });
  // 실제 DOM 내용을 추적하여 placeholder 겹침 문제 해결
  const [domContent, setDomContent] = useState<string>('');
  
  // Supabase 클라이언트
  const supabase = createClient();
  
  // 모델 설정
  const modelConfig = getModelById(modelId);
  const supportsVision = modelConfig?.supportsVision ?? false;
  const supportsPDFs = modelConfig?.supportsPDFs ?? false;

  // 배경 정보 가져오기 (PhotoSelectionModal용)
  const {
    currentBackground,
    backgroundType,
    backgroundId,
    isBackgroundLoading,
    refreshBackground
  } = useBackgroundImage(user?.id, {
    refreshOnMount: true,
    preload: false,
    useSupabase: false
  });
  



  // 스타일 적용
  useChatInputStyles();

  useEffect(() => {
    setTranslations(getChatInputTranslations());
  }, []);

  // 테마 감지 useEffect
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      const isDarkMode = theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDark(isDarkMode);
    };
    
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkTheme);
    
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkTheme);
    };
  }, []);

  // Placeholder 색상은 CSS에서 var(--muted)를 사용하므로 별도 설정 불필요

  // Device detection hook
  const [isMobile, setIsMobile] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Safari 감지
    const checkSafari = () => {
      const userAgent = navigator.userAgent;
      const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(userAgent);
      setIsSafari(isSafariBrowser);
      
      // Safari 감지 시 body에 클래스 추가 (CSS에서 사용)
      if (isSafariBrowser) {
        document.body.classList.add('safari-browser');
      } else {
        document.body.classList.remove('safari-browser');
      }
    };
    
    checkDevice();
    checkSafari();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const placeholder = propPlaceholder ?? (selectedTool 
    ? (() => {
        const tool = TOOLS.find(t => t.id === selectedTool);
        return tool ? (isMobile ? tool.placeholder.mobile : tool.placeholder.desktop) : "Talk to the model directly";
      })()
    : isAgentEnabled 
      ? 'One ring to rule them all' 
      : "Talk to the model directly"
  );

  // 입력 처리 함수 (최대 단순화)
  const debouncedInputHandler = useCallback(() => {
    if (!inputRef.current || isSubmittingRef.current) return;

    // Sync images with DOM
    syncImagesWithDOM();

    // 최소한의 처리만 - 복잡한 로직 모두 제거
    let content = inputRef.current.innerText || '';

    // 사용자가 모든 내용을 지웠을 때, 브라우저가 남기는 불필요한 줄바꿈을 제거
    if (content === '\n') {
      content = '';
    }

    // DOM 내용 state 업데이트
    setDomContent(content);

    // 중복 처리 방지만 유지 (이미지 변경 시에도 업데이트 필요하므로 조건 완화)
    // if (content === lastTextContentRef.current) return;
    lastTextContentRef.current = content;

    // 상위 컴포넌트로 변경 사항 전파 (empty 클래스는 className에서 자동 처리)
    handleInputChange({
      target: { value: content }
    } as any);
  }, [handleInputChange, syncImagesWithDOM]);

  // 붙여넣기 이벤트 핸들러 - 성능 최적화 버전 + 이미지 지원
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!inputRef.current) return;
    
    // Check for images in clipboard
    const items = e.clipboardData.items;
    let hasImage = false;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          if (!supportsVision) {
             // Vision not supported, show error
             const errorMessageElement = document.createElement('div');
             errorMessageElement.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 text-center max-w-md';
             errorMessageElement.textContent = 'This model does not support images.';
             document.body.appendChild(errorMessageElement);
             setTimeout(() => errorMessageElement.remove(), 3000);
             continue;
          }
          
          insertImageIntoContentEditable(file);
          hasImage = true;
        }
      }
    }
    
    if (hasImage) return;

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
    if (!inputRef.current) return;
    
    // DOM 내용을 즉시 확인하여 placeholder 겹침 방지
    // isLoading 상태에서도 placeholder가 사라지도록 항상 업데이트
    const currentContent = inputRef.current.innerText || '';
    const normalizedContent = currentContent === '\n' ? '' : currentContent;
    setDomContent(normalizedContent);
    
    // isSubmittingRef 체크는 debouncedInputHandler에서만 수행
    // isLoading일 때는 입력만 하고 제출은 하지 않음
    if (!isSubmittingRef.current) {
      debouncedInputHandler();
    }
  };

  // 입력 필드 클리어 - 완전한 클리어 함수 (동기적 DOM 업데이트 보장)
  const clearInput = () => {
    if (inputRef.current) {
      // flushSync를 사용하여 동기적 DOM 업데이트 보장
      flushSync(() => {
        // 모든 콘텐츠 및 빈 노드 제거
        inputRef.current!.innerHTML = '';
        lastTextContentRef.current = ''; // 참조 업데이트
        setDomContent(''); // DOM 내용 state도 클리어
        
        // 빈 상태 클래스 추가 (강제로)
        inputRef.current!.classList.add('empty');
        
        // placeholder 속성 재설정
        inputRef.current!.setAttribute('data-placeholder', placeholder || "Talk to the model directly");
      });
      
      // Clear inserted images state
      setInsertedImages(new Map());

      // 부모 상태 업데이트 (즉시)
      handleInputChange({
        target: { value: '' }
      } as React.ChangeEvent<HTMLTextAreaElement>);
      
      // 모바일에서 추가 보장 - requestAnimationFrame으로 한 번 더 체크
      if (isMobile) {
        requestAnimationFrame(() => {
          if (inputRef.current) {
            // innerText가 정말 비어있는지 체크
            if (inputRef.current.innerText && inputRef.current.innerText.trim() !== '') {
              // 아직 내용이 남아있다면 강제로 다시 클리어
              flushSync(() => {
                inputRef.current!.innerHTML = '';
                inputRef.current!.classList.add('empty');
                inputRef.current!.setAttribute('data-placeholder', placeholder || "Talk to the model directly");
                setDomContent('');
              });
            }
          }
        });
      }
    }
  };

  // placeholder 변경 시 입력 필드 초기화 (자동 포커스는 하지 않음)
  useEffect(() => {
    if (inputRef.current) {
      // placeholder 속성만 업데이트 (empty 클래스는 className에서 자동 처리)
      inputRef.current.setAttribute('data-placeholder', placeholder || "Talk to the model directly");
    }
  }, [placeholder]);

  // 고유 ID 생성 함수 추가
  const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  // 기존 채팅창의 uploaded_image_N 인덱스 계산
  // 서버(tools.ts)의 buildImageMapsFromDBMessages 로직과 동기화: 텍스트 파싱 대신 이미지 개수 카운트
  const nextImageIndex = useMemo(() => {
    if (!allMessages || allMessages.length === 0) return 1;

    let imageCount = 0;
    
    allMessages.forEach(msg => {
      // 메시지당 parts vs experimental_attachments 중 더 많은 쪽 사용 (불일치 시 undercount 방지)
      let partsCount = 0;
      let expCount = 0;
      if (msg.parts && Array.isArray(msg.parts)) {
        msg.parts.forEach((part: any) => {
          if (part.type === 'file' && part.mediaType?.startsWith('image/')) partsCount++;
          else if (part.type === 'image') partsCount++;
        });
      }
      if (msg.experimental_attachments && Array.isArray(msg.experimental_attachments)) {
        msg.experimental_attachments.forEach((attachment: any) => {
          if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') expCount++;
        });
      }
      let contentCount = 0;
      if (msg.content && Array.isArray(msg.content)) {
        msg.content.forEach((contentItem: any) => {
          if (contentItem.type === 'file' && contentItem.mediaType?.startsWith('image/')) contentCount++;
          else if (contentItem.type === 'image') contentCount++;
        });
      }
      imageCount += Math.max(partsCount, expCount, contentCount);
    });

    return imageCount + 1;
  }, [allMessages]);

  // 공통 메시지 제출 로직 (extractContentFromEditable 사용)
  const prepareMessageSubmission = useCallback(() => {
    // Extract content with uploaded_image_N placeholders
    // Pass nextImageIndex to ensure continuity with existing images
    const { text: messageContent, imageFiles: extractedImageFiles } = extractContentFromEditable(nextImageIndex);
    
    // 올바른 FileList 생성: extractedImageFiles (순서 보장) + 기존 files (PDF 등)
    const snapshotFiles = [...extractedImageFiles, ...files];
    
    const fileList = {
      length: snapshotFiles.length,
      item: (index: number) => snapshotFiles[index],
      [Symbol.iterator]: function* () {
        for (let i = 0; i < snapshotFiles.length; i++) {
          yield snapshotFiles[i];
        }
      }
    } as FileList;

    // 파일 상태 정리 (미리 스냅샷으로 전달했으므로 안전)
    const urls = Array.from(fileMap.values()).map(({ url }) => url).filter(url => url.startsWith('blob:'));
    const inlineUrls = Array.from(insertedImages.values()).map(v => v.blobUrl);
    
    // 상태 클리어
    setFiles([]);
    setFileMap(new Map());
    setInsertedImages(new Map());
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // URL 리소스 해제
    [...urls, ...inlineUrls].forEach(url => {
      try { URL.revokeObjectURL(url); } catch {}
    });

    // 입력 및 UI 클리어
    clearInput();

    return { messageContent, fileList };
  }, [extractContentFromEditable, files, fileMap, insertedImages, clearInput, nextImageIndex]);

  // 단순화된 메시지 제출 함수
  const submitMessage = useCallback(async () => {
    if (isSubmittingRef.current || isLoading || !inputRef.current) return;

    // 🚀 비전 모델 검증: 전송 전에 이미지가 있는데 비전 모델이 아닌 경우 에러 표시
    // 새로 업로드한 파일과 기존 메시지 모두 확인
    const hasInlineImages = insertedImages.size > 0;
    const hasNewImages = files.some(file => file.type.startsWith('image/')) || hasInlineImages;
    const hasExistingImages = allMessages && allMessages.length > 0 ? allMessages.some(msg => {
      // AI SDK v5: parts 배열 구조 체크
      if (Array.isArray(msg.parts)) {
        return msg.parts.some((part: any) => part.type === 'image');
      }
      // 기존 experimental_attachments도 체크 (하위 호환성)
      if (msg.experimental_attachments && Array.isArray(msg.experimental_attachments)) {
        return msg.experimental_attachments.some((attachment: any) => 
          attachment.contentType?.startsWith('image/')
        );
      }
      return false;
    }) : false;
    const hasImages = hasNewImages || hasExistingImages;
    
    
    if (hasImages && !supportsVision) {
      // 비전 모델 에러 메시지를 사용자에게 표시
      const errorMessageElement = document.createElement('div');
      errorMessageElement.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 text-center max-w-md';
      errorMessageElement.textContent = 'This conversation contains images. Please select a vision-enabled model to continue.';
      document.body.appendChild(errorMessageElement);
      
      // 5초 후 에러 메시지 제거
      setTimeout(() => {
        if (errorMessageElement.parentNode) {
          errorMessageElement.parentNode.removeChild(errorMessageElement);
        }
      }, 5000);
      return;
    }

    isSubmittingRef.current = true;
    
    try {
      const { messageContent, fileList } = prepareMessageSubmission();
      
      // 제출 이벤트 생성 (메시지 내용을 target.value로 전달)
      const submitEvent = {
        preventDefault: () => {},
        target: { value: messageContent }
      } as unknown as FormEvent<HTMLFormElement>;

      // 메시지 제출 (선택된 도구 정보 포함)
      const submitEventWithTool = { ...submitEvent, selectedTool: selectedTool || null } as any;
      await handleSubmit(submitEventWithTool, fileList);
    } catch (error) {
      console.error('Error during message submission setup:', error);
    } finally {
      isSubmittingRef.current = false;
    }
  }, [handleSubmit, isLoading, selectedTool, supportsVision, allMessages, prepareMessageSubmission]);

  // 간단한 내용 확인 - input prop 기반으로 통일
  const hasContent = input.length > 0 || files.length > 0 || insertedImages.size > 0;

  // isInputExpanded 관련 코드 제거 - 전송 버튼 항상 하단 고정

  // ResizeObserver 제거 - 전송 버튼 위치 고정으로 불필요

  // 메시지 제출 핸들러 (폼 제출 이벤트)
  const handleMessageSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isLoading || !hasContent) return;

    const { messageContent, fileList } = prepareMessageSubmission();

    // 선택된 도구 정보를 이벤트에 추가 (preventDefault 메서드 보존)
    const eventWithTool = {
      ...e,
      preventDefault: e.preventDefault.bind(e),
      target: { value: messageContent },
      selectedTool: selectedTool || null
    } as any;
    
    // 메시지 제출
    handleSubmit(eventWithTool, fileList);
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
        console.error('Error optimizing selection:', error);
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
          
          // DOM 내용 state 업데이트
          const newContent = inputRef.current.innerText || '';
          const normalizedContent = newContent === '\n' ? '' : newContent;
          setDomContent(normalizedContent);
          
          // 입력 필드 상태 업데이트
          if (inputRef.current.innerText?.trim() === '') {
            inputRef.current.classList.add('empty');
          }
          
          // 부모 컴포넌트 상태 업데이트
          const event = {
            target: { value: normalizedContent }
          } as React.ChangeEvent<HTMLTextAreaElement>;
          handleInputChange(event);
          
          // 포커스 유지
          inputRef.current.focus();
        });
      }).catch(err => {
        console.error('Clipboard operation failed:', err);
        // 실패시 표준 잘라내기 명령으로 폴백
        document.execCommand('cut');
      });
    } catch (error) {
      console.error('Error in optimized cut:', error);
      // 오류 발생시 표준 잘라내기로 폴백
      document.execCommand('cut');
    }
  };

  // Helpers for image removal: remove image container and adjacent br tags (cursor placeholders)
  // Note: This function is now only used for selection-based deletion
  // For collapsed range deletion, we use Range API directly to preserve undo stack
  const removeImageAndAdjacentEmptyNodes = (imageContainer: HTMLElement) => {
    const prev = imageContainer.previousSibling;
    const next = imageContainer.nextSibling;
    // Remove empty text nodes or br tags used for cursor positioning
    if (prev && prev.nodeType === Node.TEXT_NODE && (prev as Text).textContent === '') {
      prev.remove();
    }
    if (next) {
      const shouldRemove = (next.nodeType === Node.TEXT_NODE && (next as Text).textContent === '') || 
                           (next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).tagName === 'BR');
      if (shouldRemove) {
        next.remove();
      }
    }
    imageContainer.remove();
  };

  const placeCursorAfterRemoval = (
    el: HTMLDivElement | null,
    selection: Selection,
    _removedContainer: HTMLElement,
    nextNode?: Node | null,
    prevNode?: Node | null
  ) => {
    if (!el || !selection) return;
    const newRange = document.createRange();
    if (nextNode && el.contains(nextNode)) {
      if (nextNode.nodeType === Node.TEXT_NODE) newRange.setStart(nextNode, 0);
      else newRange.setStartBefore(nextNode);
      newRange.collapse(true);
    } else if (prevNode && el.contains(prevNode)) {
      if (prevNode.nodeType === Node.TEXT_NODE) newRange.setStart(prevNode, prevNode.textContent?.length || 0);
      else newRange.setStartAfter(prevNode);
      newRange.collapse(true);
    } else {
      const first = el.firstChild;
      if (first) newRange.setStartBefore(first);
      else newRange.selectNodeContents(el);
      newRange.collapse(true);
    }
    selection.removeAllRanges();
    selection.addRange(newRange);
    el.focus();
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

          // 스크롤 최하단으로 이동 (줄바꿈 시)
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.scrollTop = inputRef.current.scrollHeight;
            }
          });
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
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      // Check for Select All + Delete scenario
      const selection = window.getSelection();
      
      if (inputRef.current && selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Check if the entire content is selected (inputRef.current as container)
        // This commonly happens with Cmd+A (optimizedSelectAll uses selectNodeContents)
        const isAllSelected = 
          range.commonAncestorContainer === inputRef.current &&
          range.startOffset === 0 &&
          range.endOffset === inputRef.current.childNodes.length;

        // Also check if selection covers effectively all content (text length match)
        const textLength = inputRef.current.innerText.replace(/\n/g, '').length;
        const selectedLength = selection.toString().replace(/\n/g, '').length;
        const isTextAllSelected = textLength > 0 && textLength === selectedLength;

        // If there are images and selection length is 0 but it's a range selection inside input, 
        // it might be selecting just the image wrapper.
        const hasImages = insertedImages.size > 0;
        
        if (isAllSelected || isTextAllSelected || (hasImages && isAllSelected)) {
          e.preventDefault();
          clearInput();
          return;
        }

        // Handle image deletion when cursor is before/after image or image is selected
        if (!range.collapsed) {
          // Check if selection contains an image
          const container = range.commonAncestorContainer;
          let imageContainer: HTMLElement | null = null;
          
          if (container.nodeType === Node.ELEMENT_NODE) {
            const element = container as HTMLElement;
            // Check if the container itself is an image container
            if (element.hasAttribute('data-image-container-id')) {
              imageContainer = element;
            } else {
              // Check if selection contains an image container
              imageContainer = element.closest('[data-image-container-id]') as HTMLElement;
            }
          } else {
            // For text nodes, check parent
            const parent = container.parentElement;
            if (parent) {
              if (parent.hasAttribute('data-image-container-id')) {
                imageContainer = parent;
              } else {
                imageContainer = parent.closest('[data-image-container-id]') as HTMLElement;
              }
            }
          }
          
          if (imageContainer) {
            e.preventDefault();
            const imageId = imageContainer.getAttribute('data-image-container-id');
            const img = imageContainer.querySelector('img[data-image-id]') as HTMLImageElement;
            const actualImageId = img?.getAttribute('data-image-id') || imageId;
            
            if (actualImageId) {
              const nextNode = imageContainer.nextSibling;
              const prevNode = imageContainer.previousSibling;
              
              // Use Range API to delete image container and adjacent nodes atomically (single undo entry)
              // This ensures the deletion is recorded as one operation in undo history
              const deleteRange = document.createRange();
              
              // Include empty text node before image if it exists
              let startNode: Node = imageContainer;
              if (prevNode && prevNode.nodeType === Node.TEXT_NODE && (prevNode as Text).textContent === '') {
                startNode = prevNode;
              }
              deleteRange.setStartBefore(startNode);
              
              // Include BR tag after image if it exists
              let endNode: Node = imageContainer;
              if (nextNode && nextNode.nodeType === Node.ELEMENT_NODE && (nextNode as HTMLElement).tagName === 'BR') {
                endNode = nextNode;
              } else if (nextNode && nextNode.nodeType === Node.TEXT_NODE && (nextNode as Text).textContent === '') {
                endNode = nextNode;
              }
              deleteRange.setEndAfter(endNode);
              
              // Single atomic deletion (preserves undo stack)
              deleteRange.deleteContents();
              
              setInsertedImages(prev => {
                const next = new Map(prev);
                const imageData = next.get(actualImageId);
                if (imageData) {
                  URL.revokeObjectURL(imageData.blobUrl);
                  next.delete(actualImageId);
                }
                return next;
              });
              syncImagesWithDOM();
              debouncedInputHandler();
              placeCursorAfterRemoval(inputRef.current, selection, imageContainer, nextNode, prevNode);
              return;
            }
          }
        } else {
          // Collapsed range: Backspace should delete what's immediately before cursor
          // Priority: 1) Text before cursor in same node, 2) Previous sibling (BR/text), 3) Image before BR
          
          const container = range.commonAncestorContainer;
          let imageContainer: HTMLElement | null = null;
          
          if (e.key === 'Backspace') {
            // Rule 1: If cursor is inside a text node with offset > 0, delete text (let browser handle it)
            if (container.nodeType === Node.TEXT_NODE) {
              const offset = range.startOffset;
              if (offset > 0) {
                // There's text before cursor in same node - let browser delete it naturally
                // Don't preventDefault, don't delete image
                return; // Let browser handle text deletion
              }
              // Cursor is at start of text node (offset 0) - check what's before this text node
              const parent = container.parentElement;
              if (parent && parent === inputRef.current) {
                const siblings = Array.from(parent.childNodes);
                const idx = siblings.indexOf(container as ChildNode);
                // Look for image before this text node
                for (let i = idx - 1; i >= 0; i--) {
                  const s = siblings[i];
                  if (s.nodeType === Node.ELEMENT_NODE) {
                    const el = s as HTMLElement;
                    if (el.hasAttribute('data-image-container-id')) {
                      imageContainer = el;
                      break;
                    }
                    if (el.tagName === 'BR') continue; // Skip BR, continue looking
                    break; // Other element, stop
                  }
                  if (s.nodeType === Node.TEXT_NODE && ((s as Text).textContent || '').trim().length > 0) {
                    break; // Text node with content, stop
                  }
                }
              }
            } 
            // Rule 2: If cursor is right after BR tag, check if previous sibling is image
            else if (container.nodeType === Node.ELEMENT_NODE && (container as HTMLElement).tagName === 'BR') {
              const br = container as HTMLElement;
              const prev = br.previousSibling;
              if (prev && prev.nodeType === Node.ELEMENT_NODE) {
                const el = prev as HTMLElement;
                if (el.hasAttribute('data-image-container-id')) {
                  imageContainer = el;
                }
              }
            }
            // Rule 3: If cursor is at boundary of input div, check last child
            else if (container === inputRef.current) {
              const offset = range.startOffset;
              if (offset > 0 && offset <= container.childNodes.length) {
                const nodeBefore = container.childNodes[offset - 1];
                if (nodeBefore.nodeType === Node.ELEMENT_NODE) {
                  const el = nodeBefore as HTMLElement;
                  if (el.hasAttribute('data-image-container-id')) {
                    imageContainer = el;
                  } else if (el.tagName === 'BR') {
                    // Cursor is right after BR, check BR's previous sibling
                    const prev = el.previousSibling;
                    if (prev && prev.nodeType === Node.ELEMENT_NODE) {
                      const prevEl = prev as HTMLElement;
                      if (prevEl.hasAttribute('data-image-container-id')) {
                        imageContainer = prevEl;
                      }
                    }
                  }
                }
              } else if (container.childNodes.length > 0) {
                const lastChild = container.lastChild;
                if (lastChild && lastChild.nodeType === Node.ELEMENT_NODE) {
                  const el = lastChild as HTMLElement;
                  if (el.hasAttribute('data-image-container-id')) {
                    imageContainer = el;
                  } else if (el.tagName === 'BR') {
                    const prev = el.previousSibling;
                    if (prev && prev.nodeType === Node.ELEMENT_NODE) {
                      const prevEl = prev as HTMLElement;
                      if (prevEl.hasAttribute('data-image-container-id')) {
                        imageContainer = prevEl;
                      }
                    }
                  }
                }
              }
            }
            
            // Final check: Only delete image if there's NO text immediately after cursor
            if (imageContainer) {
              // Check if there's any text after cursor that should be deleted first
              let hasTextAfter = false;
              
              // Check current node if it's a text node
              if (container.nodeType === Node.TEXT_NODE && range.startOffset < (container as Text).textContent!.length) {
                hasTextAfter = true;
              }
              // Check if cursor is after BR and there's text node after BR
              else if (container.nodeType === Node.ELEMENT_NODE && (container as HTMLElement).tagName === 'BR') {
                const br = container as HTMLElement;
                const next = br.nextSibling;
                if (next && next.nodeType === Node.TEXT_NODE && ((next as Text).textContent || '').trim().length > 0) {
                  hasTextAfter = true;
                }
              }
              // Check if container is input div and there's text at cursor position
              else if (container === inputRef.current) {
                const offset = range.startOffset;
                if (offset < container.childNodes.length) {
                  const nodeAtOffset = container.childNodes[offset];
                  if (nodeAtOffset && nodeAtOffset.nodeType === Node.TEXT_NODE) {
                    hasTextAfter = true;
                  }
                }
              }
              
              if (hasTextAfter) {
                imageContainer = null; // Don't delete image, let browser delete text first
              }
            }
          } else if (e.key === 'Delete') {
            // Delete key: delete what's immediately after cursor
            if (container.nodeType === Node.TEXT_NODE) {
              const offset = range.startOffset;
              const textNode = container as Text;
              if (offset < textNode.textContent!.length) {
                // There's text after cursor - let browser handle it
                return;
              }
            }
            // Find image after cursor
            const parent = container.parentElement;
            if (parent && parent === inputRef.current) {
              const siblings = Array.from(parent.childNodes);
              const idx = siblings.indexOf(container as ChildNode);
              for (let i = idx + 1; i < siblings.length; i++) {
                const s = siblings[i];
                if (s.nodeType === Node.ELEMENT_NODE) {
                  const el = s as HTMLElement;
                  if (el.hasAttribute('data-image-container-id')) {
                    imageContainer = el;
                    break;
                  }
                  if (el.tagName === 'BR') continue;
                  break;
                }
                if (s.nodeType === Node.TEXT_NODE && ((s as Text).textContent || '').trim().length > 0) {
                  break;
                }
              }
            }
          }

          if (imageContainer) {
            e.preventDefault();
            const img = imageContainer.querySelector('img[data-image-id]') as HTMLImageElement;
            const actualImageId = img?.getAttribute('data-image-id') || imageContainer.getAttribute('data-image-container-id');
            if (actualImageId) {
              const nextNode = imageContainer.nextSibling;
              const prevNode = imageContainer.previousSibling;
              
              // Use Range API to delete image container and adjacent nodes atomically (single undo entry)
              // This ensures the deletion is recorded as one operation in undo history
              const deleteRange = document.createRange();
              
              // Include empty text node before image if it exists
              let startNode: Node = imageContainer;
              if (prevNode && prevNode.nodeType === Node.TEXT_NODE && (prevNode as Text).textContent === '') {
                startNode = prevNode;
              }
              deleteRange.setStartBefore(startNode);
              
              // Include BR tag after image if it exists
              let endNode: Node = imageContainer;
              if (nextNode && nextNode.nodeType === Node.ELEMENT_NODE && (nextNode as HTMLElement).tagName === 'BR') {
                endNode = nextNode;
              } else if (nextNode && nextNode.nodeType === Node.TEXT_NODE && (nextNode as Text).textContent === '') {
                endNode = nextNode;
              }
              deleteRange.setEndAfter(endNode);
              
              // Single atomic deletion (preserves undo stack)
              deleteRange.deleteContents();
              
              setInsertedImages(prev => {
                const next = new Map(prev);
                const imageData = next.get(actualImageId);
                if (imageData) {
                  URL.revokeObjectURL(imageData.blobUrl);
                  next.delete(actualImageId);
                }
                return next;
              });
              syncImagesWithDOM();
              debouncedInputHandler();
              placeCursorAfterRemoval(inputRef.current, selection, imageContainer, nextNode, prevNode);
              return;
            }
          }
        }
      }

      const currentContent = inputRef.current?.innerText ?? '';
      // Backspace로 모든 내용 지웠을 때 placeholder 다시 보이게
      if (currentContent === '' || currentContent === '\n') {
        // DOM 내용 state 즉시 업데이트
        setDomContent('');
        // When clearing input with backspace, ensure handler is called
        debouncedInputHandler();
      }
    }
  };



  // 언마운트 시 URL 정리 및 Safari 클래스 정리
  useEffect(() => {
    return () => {
      // 모든 URL 정리
      fileMap.forEach(({ url }) => URL.revokeObjectURL(url));
      
      // Safari 클래스 정리
      document.body.classList.remove('safari-browser');
    };
  }, []);

  // 추가: 성능 모니터링을 위한 입력 필드 이벤트 핸들러
  useEffect(() => {
    if (!inputRef.current) return;
    
    // 드래그 선택 중인지 추적하는 변수
    let isDragging = false;
    let mouseDownTime = 0;
    let mouseDownX = 0;
    let mouseDownY = 0;
    
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
    
    // 마우스 다운 핸들러: 드래그 시작 감지
    const handleMouseDown = (e: MouseEvent) => {
      isDragging = false;
      mouseDownTime = Date.now();
      mouseDownX = e.clientX;
      mouseDownY = e.clientY;
    };
    
    // 마우스 이동 핸들러: 드래그 중인지 확인
    const handleMouseMove = (e: MouseEvent) => {
      if (mouseDownTime > 0) {
        const deltaX = Math.abs(e.clientX - mouseDownX);
        const deltaY = Math.abs(e.clientY - mouseDownY);
        // 마우스가 3픽셀 이상 이동하면 드래그로 간주
        if (deltaX > 3 || deltaY > 3) {
          isDragging = true;
        }
      }
    };
    
    // 마우스 업 핸들러: 드래그 종료
    const handleMouseUp = () => {
      mouseDownTime = 0;
      // 약간의 지연 후 isDragging 초기화 (클릭 핸들러가 실행되기 전에)
      setTimeout(() => {
        isDragging = false;
      }, 10);
    };
    
    // 클릭 핸들러: 이미지 사이를 클릭했을 때 커서를 배치할 수 있도록 함
    // 단, 드래그 선택 중일 때는 실행하지 않음
    const handleClick = (e: MouseEvent) => {
      if (!inputRef.current) return;
      
      // 드래그 선택 중이면 클릭 핸들러 실행하지 않음 (브라우저 기본 선택 동작 사용)
      if (isDragging) {
        return;
      }
      
      // 클릭 시간이 너무 짧으면 드래그가 아닌 클릭으로 간주
      const clickDuration = Date.now() - mouseDownTime;
      if (clickDuration > 200) {
        // 클릭이 너무 길면 드래그로 간주
        return;
      }
      
      const target = e.target as HTMLElement;
      const selection = window.getSelection();
      if (!selection) return;
      
      // 선택된 텍스트가 있으면 클릭 핸들러 실행하지 않음 (선택 유지)
      if (selection.toString().length > 0) {
        return;
      }
      
      // 이미지 컨테이너를 직접 클릭한 경우는 이미지 컨테이너의 핸들러가 처리하도록 함
      if (target.closest('[data-image-container-id]') === target) {
        return;
      }
      
      // contentEditable div 자체나 그 내부를 클릭한 경우
      if (target === inputRef.current || inputRef.current.contains(target)) {
        // caretRangeFromPoint를 사용하여 정확한 클릭 위치에 커서 배치
        try {
          const range = document.caretRangeFromPoint(e.clientX, e.clientY);
          if (range && inputRef.current.contains(range.commonAncestorContainer)) {
            const container = range.commonAncestorContainer;
            
            // 이미지 컨테이너를 클릭한 경우는 이미지 컨테이너의 핸들러가 처리하도록 함
            if (container.nodeType === Node.ELEMENT_NODE && 
                (container as HTMLElement).hasAttribute('data-image-container-id')) {
              return;
            }
            
            // 텍스트 노드를 클릭한 경우 - 커서 배치
            if (container.nodeType === Node.TEXT_NODE) {
              selection.removeAllRanges();
              selection.addRange(range);
              return;
            }
            
            // contentEditable div 자체를 클릭한 경우
            if (container === inputRef.current) {
              const offset = range.startOffset;
              const parent = inputRef.current;
              
              // 클릭한 위치가 두 이미지 사이인지 확인
              if (offset > 0 && offset < parent.childNodes.length) {
                const nodeBefore = parent.childNodes[offset - 1];
                const nodeAfter = parent.childNodes[offset];
                
                const isBeforeImage = nodeBefore && nodeBefore.nodeType === Node.ELEMENT_NODE && 
                  (nodeBefore as HTMLElement).hasAttribute('data-image-container-id');
                const isAfterImage = nodeAfter && nodeAfter.nodeType === Node.ELEMENT_NODE && 
                  (nodeAfter as HTMLElement).hasAttribute('data-image-container-id');
                
                // 이미지 사이를 클릭한 경우
                if (isBeforeImage && isAfterImage) {
                  // 이미지 사이에 zero-width space 텍스트 노드가 있는지 확인
                  let textNodeBetween: Text | null = null;
                  for (let i = 0; i < parent.childNodes.length; i++) {
                    const node = parent.childNodes[i];
                    if (node === nodeBefore) {
                      // nodeBefore 다음 노드를 확인
                      if (i + 1 < parent.childNodes.length) {
                        const nextNode = parent.childNodes[i + 1];
                        if (nextNode.nodeType === Node.TEXT_NODE && 
                            (nextNode as Text).textContent === '\u200B') {
                          textNodeBetween = nextNode as Text;
                          break;
                        }
                      }
                    }
                  }
                  
                  if (!textNodeBetween) {
                    // zero-width space 텍스트 노드가 없으면 생성
                    textNodeBetween = document.createTextNode('\u200B');
                    parent.insertBefore(textNodeBetween, nodeAfter);
                  }
                  
                  // 커서를 텍스트 노드에 배치
                  const newRange = document.createRange();
                  newRange.setStart(textNodeBetween, 0);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                  return;
                }
              }
              
              // 일반적인 경우 - 브라우저 기본 동작 사용
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }
        } catch (err) {
          // caretRangeFromPoint가 지원되지 않는 경우 무시
        }
      }
    };
    
    // 이벤트 리스너 등록
    inputRef.current.addEventListener('selectstart', handleSelectionStart);
    inputRef.current.addEventListener('mousedown', handleMouseDown);
    inputRef.current.addEventListener('mousemove', handleMouseMove);
    inputRef.current.addEventListener('mouseup', handleMouseUp);
    inputRef.current.addEventListener('click', handleClick);
    
    // 클린업 함수
    return () => {
      inputRef.current?.removeEventListener('selectstart', handleSelectionStart);
      inputRef.current?.removeEventListener('mousedown', handleMouseDown);
      inputRef.current?.removeEventListener('mousemove', handleMouseMove);
      inputRef.current?.removeEventListener('mouseup', handleMouseUp);
      inputRef.current?.removeEventListener('click', handleClick);
    };
  }, []);


  // 파일 처리 - 메타데이터 추출 추가
  const handleFiles = async (newFiles: FileList) => {
    const imagesToInsert: File[] = [];
    const filesToUpload: File[] = [];

    // FileList를 Array로 변환하고 기본 필터링만 수행
    Array.from(newFiles).forEach(file => {
      // PDF 파일 지원 확인
      if (fileHelpers.isPDFFile(file)) {
        if (!supportsPDFs) {
          setShowPDFError(true);
          setTimeout(() => setShowPDFError(false), 3000);
          return;
        }
        filesToUpload.push(file);
        return;
      }      
      
      // 이미지 파일 지원 확인
      if (file.type.startsWith('image/')) {
        if (!supportsVision) {
          setShowPDFError(true);
          setTimeout(() => setShowPDFError(false), 3000);
          return;
        }
        imagesToInsert.push(file);
        return;
      }

      // 비디오 파일 필터링
      if (file.type.startsWith('video/') || /\.(mp4|mov|avi|wmv|flv|mkv|webm)$/i.test(file.name)) {
        setShowVideoError(true);
        setTimeout(() => setShowVideoError(false), 3000);
        return;
      }
      
      // Default to file upload
      filesToUpload.push(file);
    });

    // Handle images inline
    for (const file of imagesToInsert) {
       await insertImageIntoContentEditable(file);
    }
    
    if (filesToUpload.length === 0) return;
    
    // 메타데이터 추출 및 파일 처리 (For filesToUpload only)
    const processedFiles = await Promise.all(
      filesToUpload.map(async (file) => {
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



  // 외부 클릭/터치 시 도구 선택창 및 파일 선택 팝오버 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (showToolSelector && agentDropdownRef.current) {
        const target = event.target as Node;
        if (!agentDropdownRef.current.contains(target)) {
          setShowToolSelector(false);
        }
      }

      // 파일 선택 팝오버 닫기
      if (showFileSelectionPopover) {
        const target = event.target as Node;
        const buttonContainer = fileUploadButtonRef.current?.parentElement;
        if (buttonContainer && !buttonContainer.contains(target)) {
          setShowFileSelectionPopover(false);
        }
      }

      // 모바일에서 tooltip이 열려있을 때 외부 클릭 시 닫기
      if (isMobile && openTooltipId) {
        const target = event.target as HTMLElement;
        // tooltip 요소나 정보 아이콘이 아닌 곳을 클릭한 경우
        if (!target.closest('[data-tooltip-id="tool-selector-tooltip"]') && 
            !target.closest('[data-tooltip-is-open]')) {
          setOpenTooltipId(null);
        }
      }
    };

    if (showToolSelector || showFileSelectionPopover || (isMobile && openTooltipId)) {
      // 마우스와 터치 이벤트 모두 처리
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [showToolSelector, showFileSelectionPopover, isMobile, openTooltipId]);

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

  // 선택된 도구 정보 가져오기
  const selectedToolInfo = selectedTool ? TOOLS.find(tool => tool.id === selectedTool) : null;

  // 온보딩 컨텍스트 준비
  const onboardingContext = useMemo(() => ({
    isAgentEnabled,
    showToolSelector,
    selectedTool,
    hasInput: input.length > 0,
  }), [isAgentEnabled, showToolSelector, selectedTool, input]);

  // 온보딩 타겟 ref 관리 (런치패드 패턴)
  const onboardingTooltipTargetsRef = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (agentDropdownRef.current) {
      const buttonElement = agentDropdownRef.current.querySelector('button');
      if (buttonElement) {
        onboardingTooltipTargetsRef.current.set('agent-mode-button', buttonElement);
      }
    }
  }, []);

  return (
    <div className="relative">
      
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
            {/* Agent(챗플릭스 아이콘) 버튼 */}
            {setisAgentEnabled && (
              <div 
                className="relative flex-shrink-0" 
                ref={agentDropdownRef}
                data-onboarding-target="agent-mode-button"
              >
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
                      // 도구가 선택된 상태에서 챗플릭스 아이콘을 누르면 기본 상태로 복귀
                      flushSync(() => {
                        setSelectedTool?.(null);
                        setisAgentEnabled?.(false);
                        setShowToolSelector(false);
                      });
                    } else if (isAgentEnabled) {
                      // 에이전트 모드에서 챗플릭스 아이콘을 누르면 기본 상태로 복귀
                      flushSync(() => {
                        setisAgentEnabled?.(false);
                        setShowToolSelector(false);
                      });
                    } else {
                      // 일반 모드에서 챗플릭스 아이콘을 누를 때
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
                  style={(() => {
                    const glassStyle = getAdaptiveGlassStyleBlur();
              //     const glassStyle = getAdaptiveGlassStyleClean(hasBackgroundImage);
                    let backgroundColor;
                    if (!isAgentEnabled && !selectedTool) {
                      backgroundColor = getAdaptiveGlassBackgroundColor().backgroundColor;
                    } else if (selectedTool) {
                      backgroundColor = getToolIconBackground(selectedTool);
                    } else {
                      backgroundColor = 'var(--chat-input-primary)';
                    }
                    return {
                      ...glassStyle,
                      background: backgroundColor,
                      color: (isAgentEnabled || selectedTool)
                        ? 'var(--chat-input-primary-foreground)'
                        : 'var(--foreground)',
                      opacity: user?.hasAgentModels === false && !isAgentEnabled ? 0.4 : 1,
                      // border 완전 제거
                      border: 'none',
                    };
                  })()}
                  disabled={user?.hasAgentModels === false && !isAgentEnabled}
                  title={
                        user?.hasAgentModels === false && !isAgentEnabled 
                          ? "Agent mode not available" 
                          : ""
                      }
                    >
                  {selectedTool && selectedToolInfo?.icon ? (
                    React.cloneElement(selectedToolInfo.icon, { 
                      className: `transition-transform duration-300 text-white ${selectedToolInfo.smallIcon ? "h-3.5 w-3.5" : "h-4 w-4"}`,
                      size: selectedToolInfo.smallIcon ? 14 : 16
                    })
                  ) : (
                    <NextImage
                      src={getChatflixLogo({ 
                        isAgentEnabled, 
                        selectedTool, 
                        hasBackgroundImage, 
                        isDark: isDark || (typeof window !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'system' && 
                          window.matchMedia('(prefers-color-scheme: dark)').matches)
                      })}
                      alt="Chatflix"
                      width={20}
                      height={20}
                      className={`transition-transform duration-300 ${(isAgentEnabled || selectedTool || hasBackgroundImage) 
                        ? '[filter:drop-shadow(0_0px_4px_rgba(255,255,255,0.7))]'
                        : ''}`}
                    />
                  )}
                </button>

                {/* Tool selector */}
                {showToolSelector && (
                  <div 
                    ref={toolSelectorRef}
                    className="absolute top-0 -translate-y-full -mt-3 sm:-mt-3.5 -left-1 w-[calc(100vw-2rem)] sm:w-96 md:w-[420px] rounded-[24px] z-[35] overflow-hidden tool-selector"
                    style={{
                      // 모델 선택창과 동일한 글라스 효과 적용
                      ...getAdaptiveGlassStyleBlur(),
                      backgroundColor: getAdaptiveGlassBackgroundColor().backgroundColor,
                      backdropFilter: 'blur(40px)',
                      WebkitBackdropFilter: 'blur(40px)',
                      maxHeight: 'calc(100vh - 150px)', // 모바일: 화면 높이에서 입력창과 여백 제외
                    }}
                  >
                    <div className="p-4">
                      <div className="max-h-[calc(100vh-220px)] sm:max-h-[500px] md:max-h-[500px] overflow-y-auto no-scrollbar">
                        {/* Tool Explanation Section */}
                        <div 
                          className="mb-6 rounded-[12px] p-4"
                          style={{
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f7f7f7',
                            backdropFilter: 'blur(30px)',
                            WebkitBackdropFilter: 'blur(30px)',
                          }}
                        >
                          <div className="flex items-start gap-3 mb-4">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                              style={{ 
                                ...getAdaptiveGlassStyleBlur(),
                                backgroundColor: (isAgentEnabled && !selectedTool)
                                  ? 'var(--chat-input-primary)'
                                  : selectedTool
                                    ? getToolIconBackground(selectedTool)
                                    : getAdaptiveGlassBackgroundColor().backgroundColor,
                                border: 'none',
                              }}
                            >
                              <NextImage
                                src={getChatflixLogo({ 
                                  isAgentEnabled, 
                                  selectedTool, 
                                  hasBackgroundImage, 
                                  isDark: isDark || (typeof window !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'system' && 
                                    window.matchMedia('(prefers-color-scheme: dark)').matches)
                                })}
                                alt="Chatflix"
                                width={28}
                                height={28}
                                className="transition-transform duration-300"
                              />
                            </div>
                            <div className="flex-1">
                              <div className="text-[14px] leading-[1.2] font-normal mb-1" style={{ color: 'var(--foreground)' }}>
                                Chatflix Tools
                              </div>
                              <div className="text-[12px] leading-tight" style={{ color: 'color-mix(in srgb, var(--foreground) 50%, transparent)' }}>
                                Enhance your conversations with powerful tools.
                              </div>
                            </div>
                          </div>

                          {/* Toggle Section */}
                          <div className="flex items-center justify-between pt-3 mt-3 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                            <div className="flex items-center gap-2">
                              <span className="text-[15px] font-normal" style={{ color: 'var(--foreground)' }}>
                                Agent Mode
                              </span>
                              <div 
                                data-tooltip-id="tool-selector-tooltip"
                                data-tool-id="auto-mode-info"
                                data-tooltip-content="AI automatically selects and uses the best tools for your request"
                                data-tooltip-is-open={isMobile && openTooltipId === 'auto-mode-info'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isMobile) {
                                    setOpenTooltipId(prev => prev === 'auto-mode-info' ? null : 'auto-mode-info');
                                  }
                                }}
                                className="rounded-full p-0.5 cursor-pointer flex items-center justify-center"
                                style={{ backgroundColor: 'transparent' }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" style={{ color: 'color-mix(in srgb, var(--foreground) 40%, transparent)' }}>
                                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newAgentEnabled = !isAgentEnabled;
                                if (setSelectedTool && selectedTool !== null) {
                                  setSelectedTool(null);
                                }
                                if (setisAgentEnabled) {
                                  setisAgentEnabled(newAgentEnabled);
                                }
                              }}
                              className={`relative inline-flex h-[18px] w-[38px] items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                                isAgentEnabled && !selectedTool
                                  ? 'bg-[#007AFF]'
                                  : isDark ? 'bg-[#39393d]' : 'bg-[#e9e9ea]'
                              }`}
                              style={{ willChange: 'background-color' }}
                              role="switch"
                              aria-checked={isAgentEnabled && !selectedTool}
                            >
                              <span
                                className={`inline-block h-[14px] w-[23px] transform rounded-full bg-white shadow-md transition-all duration-200 ease-in-out ${
                                  isAgentEnabled && !selectedTool ? 'translate-x-[13px]' : 'translate-x-[2px]'
                                }`}
                                style={{ willChange: 'transform, width' }}
                              />
                            </button>
                          </div>
                        </div>

                        {(Object.entries(TOOL_CATEGORIES) as [ToolCategory, { label: string; toolIds: string[] }][]).map(([category, categoryData]) => {
                          const categoryTools = TOOLS.filter(tool => categoryData.toolIds.includes(tool.id));
                          if (categoryTools.length === 0) return null;
                          
                          return (
                            <div key={category} className="mb-7 last:mb-0">
                              {/* Category Title */}
                              <div className="px-3 mb-1.5 text-[14px] font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
                                {categoryData.label}
                              </div>
                              {/* Category Group - iOS Style */}
                              <div 
                                className="overflow-hidden rounded-[12px]"
                                style={{
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f7f7f7',
                                  backdropFilter: 'blur(30px)',
                                  WebkitBackdropFilter: 'blur(30px)',
                                }}
                              >
                                <div>
                                  {categoryTools.map((tool, index) => (
                                    <div key={tool.id}>
                                      {index > 0 && (
                                        <div 
                                          className={`${isDark ? 'border-t border-white/5' : 'border-t border-black/5'}`}
                                          style={{ marginLeft: '12px', marginRight: '12px' }}
                                        />
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleToolSelect(tool.id)}
                                        className="w-full flex items-center justify-between px-3 py-3 transition-colors text-left cursor-pointer"
                                        style={{
                                          '--tw-active-bg': isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                        } as React.CSSProperties}
                                        onMouseDown={(e) => {
                                          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
                                        }}
                                        onMouseUp={(e) => {
                                          e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                      >
                                        <div className="flex items-center gap-3">
                                        <div 
                                          className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0 relative overflow-visible"
                                          style={{ 
                                            ...getAdaptiveGlassStyleBlur(),
                                            background: getToolIconBackground(tool.id),
                                            border: 'none',
                                          }}
                                        >
                                          {React.cloneElement(tool.icon, { 
                                            className: `text-white ${tool.smallIcon ? "h-3 w-3" : "h-3.5 w-3.5"}`,
                                            size: tool.smallIcon ? 12 : 14
                                          })}
                                          {(tool.id === 'wan25_text_to_video' || tool.id === 'wan25_image_to_video' || tool.id === 'grok_text_to_video' || tool.id === 'grok_image_to_video' || tool.id === 'grok_video_edit') && (
                                            <div 
                                              className="absolute -bottom-1 -right-2 text-[7.5px] font-bold px-1 py-0.5 rounded-full leading-none whitespace-nowrap"
                                              style={{
                                                backgroundColor: 'var(--foreground)',
                                                color: 'var(--background)'
                                              }}
                                            >
                                              BETA
                                            </div>
                                          )}
                                        </div>
                                        <span className="text-[14px] leading-[1.2] font-normal" style={{ color: 'var(--foreground)', display: 'flex', alignItems: 'center', height: '28px', transform: 'translateY(1px)' }}>
                                          {tool.name}
                                        </span>
                                      </div>

                                      {/* 정보 아이콘 - 이미지/비디오 관련 도구 및 Google 검색에 표시 */}
                                      {tool.hasInfoIcon && (
                                        <div 
                                          data-tooltip-id="tool-selector-tooltip"
                                          data-tool-id={tool.id}
                                          data-tooltip-content={
                                            tool.id.startsWith('google') 
                                              ? 'Safe search is disabled by default to allow unrestricted search results'
                                              : tool.description
                                          }
                                          data-tooltip-is-open={isMobile && openTooltipId === tool.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (isMobile) {
                                              // 모바일에서 클릭 시 토글
                                              setOpenTooltipId(prev => prev === tool.id ? null : tool.id);
                                            }
                                          }}
                                          className="rounded-full p-0.5 cursor-pointer flex items-center justify-center"
                                          style={{ backgroundColor: 'transparent' }}
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" style={{ color: 'color-mix(in srgb, var(--foreground) 40%, transparent)' }}>
                                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                                          </svg>
                                        </div>
                                      )}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Onboarding Renderer */}
                <OnboardingRenderer
                  location="chat"
                  context={onboardingContext}
                  target={onboardingTooltipTargetsRef.current}
                  displayTypes={['tooltip']}
                />

              </div>
            )}
  
            {/* File upload button */}
            <div className="relative flex-shrink-0">
              <button
                ref={fileUploadButtonRef}
                type="button"
                onClick={() => setShowFileSelectionPopover(true)}
                className="flex items-center justify-center w-8 h-8 rounded-full transition-colors flex-shrink-0 text-[var(--foreground)] cursor-pointer"
                  style={{
                    ...(() => {
                      const glassStyle = getAdaptiveGlassStyleBlur();
              //     const glassStyle = getAdaptiveGlassStyleClean(hasBackgroundImage);
                      return {
                        ...glassStyle,
                        border: 'none',
                        ...getAdaptiveGlassBackgroundColor(),
                      };
                    })(),
                  }}
                title={translations.uploadFile}
              >
                <Plus 
                  className="h-4 w-4 text-[var(--foreground)]"
                  strokeWidth={2} 
                />
              </button>

              {/* File Selection Popover */}
              {showFileSelectionPopover && (
                <FileSelectionPopover
                  isOpen={showFileSelectionPopover}
                  onClose={() => setShowFileSelectionPopover(false)}
                  onSelectPhoto={() => setShowPhotoSelectionModal(true)}
                  onSelectLocalFile={() => fileInputRef.current?.click()}
                  buttonRef={fileUploadButtonRef}
                  isDark={isDark}
                />
              )}
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
                className={`futuristic-input ${(input === '' && domContent === '' && insertedImages.size === 0) ? 'empty' : ''} w-full transition-colors duration-300 py-1.5 rounded-full outline-none text-sm sm:text-base overflow-y-auto min-h-[32px]`}
                data-placeholder={placeholder}
                data-ignore-bg-color-for-brightness="true"
                  suppressContentEditableWarning
                  style={{ 
                    maxHeight: '300px', 
                    wordBreak: 'break-word', 
                    overflowWrap: 'break-word', 
                    whiteSpace: 'pre-wrap', 
                    lineHeight: '1.3',
                    resize: 'none',
                    // caretColor: 'var(--chat-input-primary)',
                    paddingLeft: '1rem', // CSS에서 paddingRight 처리
                    ...(('caretWidth' in document.documentElement.style) && { caretWidth: '2px' }),
                    // 사이드바 배경색과 동일하게 설정
                    ...(() => {
                      const glassStyle = getAdaptiveGlassStyleBlur();
              //     const glassStyle = getAdaptiveGlassStyleClean(hasBackgroundImage);
                      return {
                        ...glassStyle,
                        backgroundColor: getAdaptiveGlassBackgroundColor().backgroundColor,
                        // border: 'none',
                      };
                    })(),
                    color: 'var(--foreground)'
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
                        style={{ border: 'none' }}
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
                        style={{ border: 'none' }}
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

      {/* Tool Selector Tooltip */}
      {typeof document !== 'undefined' && createPortal(
        <Tooltip
          key={`tool-tip-${openTooltipId || 'none'}`}
          id="tool-selector-tooltip"
          anchorSelect={isMobile && openTooltipId ? `[data-tool-id="${openTooltipId}"]` : '[data-tooltip-id="tool-selector-tooltip"]'}
          place="right"
          offset={15}
          delayShow={isMobile ? 0 : 200}
          delayHide={100}
          noArrow={true}
          opacity={1}
          clickable={true}
          isOpen={isMobile ? openTooltipId !== null : undefined}
          // 모바일에서는 기본 이벤트를 끄고 상태로만 제어
          openEvents={isMobile ? {} : undefined}
          style={{
            backgroundColor: (isDark || hasBackgroundImage) ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            border: (isDark || hasBackgroundImage) ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
            boxShadow: (isDark || hasBackgroundImage) ? '0 8px 32px rgba(0, 0, 0, 0.6)' : '0 8px 32px rgba(0, 0, 0, 0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: 500,
            maxWidth: '240px',
            color: (isDark || hasBackgroundImage) ? '#ffffff' : '#000000',
            zIndex: 99999999,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            lineHeight: '1.5',
          }}
        />,
        document.body
      )}

      {/* Photo Selection Modal */}
      <PhotoSelectionModal
        isOpen={showPhotoSelectionModal}
        onClose={() => setShowPhotoSelectionModal(false)}
        user={user}
        currentBackground={currentBackground}
        backgroundType={backgroundType}
        backgroundId={backgroundId}
        onBackgroundChange={() => {}}
        onSelectImages={async (selectedFiles) => {
          // Convert File[] to FileList
          const fileList = {
            length: selectedFiles.length,
            item: (index: number) => selectedFiles[index],
            [Symbol.iterator]: function* () {
              for (let i = 0; i < selectedFiles.length; i++) {
                yield selectedFiles[i];
              }
            }
          } as FileList;
          
          // Process files using existing handleFiles function
          await handleFiles(fileList);
        }}
      />
    </div>
  );
  }





