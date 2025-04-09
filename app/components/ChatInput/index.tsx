// app/components/chat/ChatInput/index.tsx
import { FormEvent, useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getModelById } from '@/lib/models/config';
import { ChatInputProps, PromptShortcut } from './types';
import { useChatInputStyles } from './ChatInputStyles';
import { FileUploadButton, FilePreview, fileHelpers } from './FileUpload';
import { PromptShortcuts } from './PromptShortcuts';
import { DragDropOverlay, ErrorToast } from './DragDropOverlay';
import { Brain } from 'lucide-react';
// import { InlineTrendingTerms } from './InlineTrendingTerms';

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  disabled,
  placeholder = "Type @ for shortcuts ...",
  user,
  modelId,
  popupPosition = 'top',
  isAgentEnabled,
  setisAgentEnabled
}: ChatInputProps) {
  // 기본 상태 및 참조
  const inputRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shortcutsListRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  
  // 상태 관리
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shortcuts, setShortcuts] = useState<PromptShortcut[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPosition, setMentionStartPosition] = useState<number | null>(null);
  const [mentionEndPosition, setMentionEndPosition] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileMap, setFileMap] = useState<Map<string, { file: File, url: string }>>(new Map());
  const [dragActive, setDragActive] = useState(false);
  const [lastTypedChar, setLastTypedChar] = useState<string | null>(null);
  const [mentionQueryActive, setMentionQueryActive] = useState(false);
  const [showPDFError, setShowPDFError] = useState(false);
  const [showFolderError, setShowFolderError] = useState(false);
  const [showVideoError, setShowVideoError] = useState(false);
  
  // Supabase 클라이언트
  const supabase = createClient();
  
  // 모델 설정
  const modelConfig = getModelById(modelId);
  const supportsVision = modelConfig?.supportsVision ?? false;
  const supportsPDFs = modelConfig?.supportsPDFs ?? false;

  // 멘션 감지를 위한 정규식
  const mentionRegex = /@(\w*)$/;

  // 스타일 적용
  useChatInputStyles();

  // 초기 렌더링 시 자동 포커스
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 붙여넣기 이벤트 핸들러
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (!inputRef.current) return;
    
    // 클립보드에서 일반 텍스트 가져오기
    const text = e.clipboardData.getData('text/plain');
    
    // 현재 선택 영역 가져오기
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // 커서 위치에 텍스트 삽입
    range.deleteContents();
    const textNode = document.createTextNode(text.replace(/\n/g, ' '));
    range.insertNode(textNode);
    
    // 원치 않는 서식 정리 및 콘텐츠 정규화
    const content = inputRef.current.innerHTML;
    inputRef.current.innerHTML = content
      .replace(/<div>/g, '')
      .replace(/<\/div>/g, '')
      .replace(/<br\s*\/?>/g, ' ')
      .replace(/\s+/g, ' ');
    
    // 공백 및 텍스트 노드 정규화
    inputRef.current.normalize();
    
    // 붙여넣은 텍스트 끝으로 커서 이동
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      
      const selection = window.getSelection();
      const range = document.createRange();
      
      // 현재 커서 위치의 텍스트 노드 찾기
      const walker = document.createTreeWalker(
        inputRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let lastNode: Text | null = null;
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.nodeType === Node.TEXT_NODE) {
          lastNode = node as Text;
        }
      }
      
      if (lastNode) {
        range.setStart(lastNode, lastNode.length);
        range.setEnd(lastNode, lastNode.length);
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        // 입력 필드에 포커스 유지
        inputRef.current.focus();
      }
    });
    
    // 멘션 처리를 위해 짧은 지연 후 입력 핸들러 호출
    setTimeout(() => {
      handleInputWithShortcuts();
    }, 0);
  };
  
  // 커서 위치 얻기 함수
  const getCursorPosition = (element: HTMLElement): number => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return 0;
    
    const range = document.createRange();
    range.selectNodeContents(element);
    range.setEnd(selection.anchorNode!, selection.anchorOffset);
    return range.toString().length;
  };

  // 사용자 입력 모니터링 및 멘션 감지
  const handleInputWithShortcuts = async () => {
    if (!inputRef.current || isSubmittingRef.current) return;
    
    // 디바운스 설정
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // 현재 입력 상태 가져오기
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    // 컨텐츠 정규화
    inputRef.current.normalize();
    
    const cursorPosition = getCursorPosition(inputRef.current);
    const content = inputRef.current.textContent || '';
    
    // placeholder를 위한 empty 클래스 설정
    if (content.trim() === '') {
      inputRef.current.classList.add('empty');
    } else {
      inputRef.current.classList.remove('empty');
    }
    
    // 부모 컴포넌트 상태 업데이트
    const event = {
      target: { value: content }
    } as React.ChangeEvent<HTMLTextAreaElement>;
    handleInputChange(event);
    
    // 커서 위치까지의 텍스트 추출
    const textBeforeCursor = content.substring(0, cursorPosition);
    
    // 멘션 패턴 감지 (@단어)
    const mentionMatch = textBeforeCursor.match(mentionRegex);
    
    if (mentionMatch) {
      // 멘션 쿼리 상태 활성화
      setMentionQueryActive(true);
      
      // 멘션 시작 위치 (@ 기호 위치) 저장
      const mentionStartPos = textBeforeCursor.lastIndexOf('@');
      setMentionStartPosition(mentionStartPos);
      
      // 검색어 추출 (@ 다음 텍스트)
      const query = mentionMatch[1] || '';
      setSearchTerm(query);
      
      // 디바운스 적용하여 검색 실행
      debounceTimerRef.current = setTimeout(async () => {
        // 숏컷 검색 API 호출
        const { data, error } = await supabase.rpc('search_prompt_shortcuts', {
          p_user_id: user.id,
          p_search_term: query
        });
        
        if (error) {
          console.error('Error searching shortcuts:', error);
          return;
        }
        
        // 검색 결과 업데이트 및 표시
        setShortcuts(data || []);
        setShowShortcuts(true);
        setSelectedIndex(0); // 첫 번째 항목 선택
      }, 100); // 100ms 디바운스
    } else {
      // 멘션 패턴이 없으면 팝업 닫기
      closeShortcutsPopup();
    }
  };

  // 멘션 팝업 닫기 함수
  const closeShortcutsPopup = () => {
    setShowShortcuts(false);
    setMentionStartPosition(null);
    setMentionEndPosition(null);
    setMentionQueryActive(false);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  // 숏컷 선택 처리
  const handleShortcutSelect = (shortcut: PromptShortcut) => {
    if (!inputRef.current || mentionStartPosition === null) return;
    
    // 현재 컨텐츠와 커서 상태 가져오기
    const content = inputRef.current.textContent || '';
    const beforeMention = content.slice(0, mentionStartPosition);
    const afterMention = content.slice(mentionQueryActive ? getCursorPosition(inputRef.current) : mentionStartPosition);
    
    // 멘션 삽입 전 DOM 상태 저장
    const range = document.createRange();
    const selection = window.getSelection();
    
    // 멘션 태그 생성 (트위터 스타일)
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
    mentionInner.contentEditable = 'false';
    mentionInner.dataset.shortcutId = shortcut.id;
    mentionInner.dataset.mentionData = JSON.stringify(mentionData);
    mentionInner.textContent = `@${shortcut.name}`;
    
    // 멘션 태그에 추가
    mentionTag.appendChild(mentionInner);
    
    // 새 컨텐츠 구성
    inputRef.current.innerHTML = '';
    
    // 멘션 이전 텍스트 추가
    if (beforeMention) {
      inputRef.current.appendChild(document.createTextNode(beforeMention));
    }
    
    // 멘션 태그 추가
    inputRef.current.appendChild(mentionTag);
    
    // 공백 추가 (멘션 후 띄어쓰기)
    inputRef.current.appendChild(document.createTextNode(' '));
    
    // 나머지 텍스트 추가
    if (afterMention && !mentionQueryActive) {
      inputRef.current.appendChild(document.createTextNode(afterMention));
    }
    
    // 부모 컴포넌트 상태 업데이트
    const updatedText = inputRef.current.textContent || '';
    handleInputChange({
      target: { value: updatedText }
    } as React.ChangeEvent<HTMLTextAreaElement>);
    
    // 커서 위치 조정 (멘션 태그 뒤로)
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      
      // 멘션 태그 다음 노드 찾기
      const mentionElement = inputRef.current.querySelector('.mention-tag-wrapper');
      if (mentionElement && mentionElement.nextSibling) {
        const nextNode = mentionElement.nextSibling;
        if (nextNode.nodeType === Node.TEXT_NODE) {
          // 텍스트 노드면 커서를 텍스트 시작 위치에 설정
          range.setStart(nextNode, 1); // 공백 다음으로 이동
          range.collapse(true);
          
          // 새 선택 영역 적용
          selection?.removeAllRanges();
          selection?.addRange(range);
          
          // 입력 필드에 포커스 유지
          inputRef.current.focus();
        }
      }
    });
    
    // 팝업 닫기
    closeShortcutsPopup();
  };

  // 입력 필드 클리어
  const clearInput = () => {
    if (inputRef.current) {
      // 모든 콘텐츠 및 빈 노드 제거
      inputRef.current.innerHTML = '';
      
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
      inputRef.current.focus();
    }
  }, []);

  // 고유 ID 생성 함수 추가
  const generateUniqueId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  // 메시지 제출 처리
  const handleMessageSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isSubmittingRef.current || isLoading) return;
    
    if (!inputRef.current) return;
    
    const content = inputRef.current?.textContent || '';
    if (!content.trim() && files.length === 0) return;

    try {
      isSubmittingRef.current = true;

      // 제출 전 콘텐츠 저장
      const messageContent = content.trim();

      // 새 메소드로 입력 필드 클리어
      clearInput();

      // 부모 상태 업데이트
      const event = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      handleInputChange(event);

      // 저장된 콘텐츠로 새 제출 이벤트 생성
      const submitEvent = {
        preventDefault: () => {},
        target: {
          value: messageContent
        }
      } as unknown as FormEvent<HTMLFormElement>;

      // 제출을 위해 File[]를 FileList로 변환
      const dataTransfer = new DataTransfer();
      files.forEach(file => {
        dataTransfer.items.add(file);
      });

      // 파일 첨부 정보 생성
      const attachments = Array.from(files).map(file => {
        // 파일 타입 결정
        let fileType: 'image' | 'code' | 'pdf' | 'file' = 'file';
        if (file.type.startsWith('image/')) {
          fileType = 'image';
        } else if (file.type.includes('text') || 
                  /\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs)$/i.test(file.name)) {
          fileType = 'code';
        } else if (file.name.endsWith('.pdf')) {
          fileType = 'pdf';
        }
        
        const fileId = (file as any).id;
        const fileData = fileMap.get(fileId);
        
        return {
          name: file.name,
          contentType: file.type,
          url: fileData?.url || '',
          fileType: fileType,
          id: fileId // ID 정보도 전달
        };
      });

      // 파일 정보를 submitEvent에 추가
      (submitEvent as any).experimental_attachments = attachments;
      
      // 저장된 콘텐츠와 파일로 폼 제출
      await handleSubmit(submitEvent, dataTransfer.files);
      
      // 제출 후 파일 리셋
      setFiles([]);
      setFileMap(new Map());
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // 미리보기 URL 정리
      fileMap.forEach(({ url }) => URL.revokeObjectURL(url));

    } finally {
      isSubmittingRef.current = false;
      // 제출 후에도 입력 필드 클리어 확인
      clearInput();
    }
  };

  // 스크롤 함수 개선 - 부드러운 스크롤 지원
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
        top: scrollDistance + 8, // 여유 공간 추가
        behavior: 'smooth'       // 부드러운 스크롤
      });
    } else if (itemRect.top < listRect.top) {
      // 위로 스크롤 필요
      const scrollDistance = listRect.top - itemRect.top;
      listElement.scrollBy({ 
        top: -scrollDistance - 8, // 여유 공간 추가
        behavior: 'smooth'        // 부드러운 스크롤
      });
    }
  };

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 숏컷 목록이 열려있고 항목이 있는 경우
    if (showShortcuts && shortcuts.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => {
            const newIndex = (prev + 1) % shortcuts.length;
            // 부드러운 스크롤로 선택 항목 표시
            scrollToItem(newIndex);
            return newIndex;
          });
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => {
            const newIndex = (prev - 1 + shortcuts.length) % shortcuts.length;
            // 부드러운 스크롤로 선택 항목 표시
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
          
        default:
          // 다른 키는 기본 동작 유지
          setLastTypedChar(e.key);
          break;
      }
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter: 사파리 호환성을 위한 명시적 줄바꿈 처리
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
          const event = new Event('input', { bubbles: true });
          inputRef.current.dispatchEvent(event);
        }
      } else {
        // 일반 Enter: 메시지 제출
        e.preventDefault();
        if (!isSubmittingRef.current && !isLoading) {
          formRef.current?.dispatchEvent(
            new Event('submit', { cancelable: true, bubbles: true })
          );
        }
      }
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

  // 파일 처리
  const handleFiles = (newFiles: FileList) => {
    // FileList를 Array로 변환하고 필터링
    const newFileArray = Array.from(newFiles).filter(file => {
      // PDF 파일 처리 - 지원하는 모델이면 허용
      if (fileHelpers.isPDFFile(file)) {
        if (!supportsPDFs) {
          setShowPDFError(true);
          setTimeout(() => setShowPDFError(false), 3000);
          return false;
        }
        return true;
      }
      
      // Vision을 지원하지 않는 경우 이미지 파일 필터링
      if (!supportsVision && file.type.startsWith('image/')) {
        setShowPDFError(true); // 기존 에러 토스트 재활용
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
    
    // 필터링 후 유효한 파일이 없으면 조기 반환
    if (newFileArray.length === 0) return;
    
    // 새 파일 항목 생성 (각 파일에 고유 ID 부여)
    const newFileEntries = newFileArray.map(file => {
      const fileId = generateUniqueId();
      const url = URL.createObjectURL(file);
      // 각 파일에 고유 ID와 원본 경로 정보 추가
      return [fileId, { file, url, id: fileId, originalName: file.name }] as [string, { file: File, url: string, id: string, originalName: string }];
    });

    // 새 항목으로 파일 맵 업데이트 (ID 기반)
    setFileMap(prevMap => {
      const newMap = new Map(prevMap);
      newFileEntries.forEach(([id, data]) => {
        newMap.set(id, data);
      });
      return newMap;
    });

    // 파일 배열 업데이트 (이름 대신 전체 파일 추가)
    setFiles(prevFiles => {
      return [...prevFiles, ...newFileArray.map((file, index) => {
        // 파일 객체에 ID 속성을 추가
        Object.defineProperty(file, 'id', {
          value: newFileEntries[index][0],
          writable: false,
          enumerable: true
        });
        return file;
      })];
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
          URL.revokeObjectURL(fileData.url);
          newMap.delete(fileId);
        }
      }
      return newMap;
    });

    // files 배열에서 제거 (ID로 비교)
    setFiles(prevFiles => prevFiles.filter(file => (file as any).id !== fileId));
  };

  // Add a new method to handle trending term clicks
  const handleTrendingTermClick = (term: string) => {
    if (!inputRef.current) return;
    
    // Set the input content to the trending term
    inputRef.current.textContent = term;
    inputRef.current.classList.remove('empty');
    
    // Update parent component's state
    const event = {
      target: { value: term }
    } as React.ChangeEvent<HTMLTextAreaElement>;
    handleInputChange(event);
    
    // Ensure agent mode is enabled
    if (setisAgentEnabled && !isAgentEnabled) {
      setisAgentEnabled(true);
    }
    
    // Focus the input field
    inputRef.current.focus();
  };

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
        {/* Only show trending terms when agent is enabled. do not erase this code even if it is not used yet */}
        {/* {isAgentEnabled && (
          <InlineTrendingTerms 
            isVisible={isAgentEnabled === true} 
            onTermClick={handleTrendingTermClick} 
          />
        )} */}
        
        {/* File preview section */}
        <FilePreview 
          files={files} 
          fileMap={fileMap} 
          removeFile={removeFile} 
        />

        {/* Error toast */}
        <ErrorToast show={showPDFError} message={
          supportsPDFs 
            ? "This file type is not supported" 
            : (supportsVision 
              ? "This model does not support PDF files" 
              : "This model does not support PDF and image files")} />
        <ErrorToast show={showFolderError} message="Folders cannot be uploaded" />
        <ErrorToast show={showVideoError} message="Video files are not supported" />

        {/* Drag & drop area */}
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
              ? "image/*,text/*,application/pdf" 
              : (supportsVision ? "image/*,text/*" : "text/*")}
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(e.target.files);
              }
            }}
            ref={fileInputRef}
            className="hidden"
            multiple
          />
          
          <div 
            ref={inputContainerRef}
            className="flex gap-1 items-center rounded-lg transition-all duration-300 px-2 py-1 bg-[color-mix(in_srgb,var(--foreground)_100%,transparent)]"
          >
            {/* Web Search Toggle - improved for visibility */}
            {setisAgentEnabled && (
              <button
                type="button"
                onClick={() => setisAgentEnabled(!isAgentEnabled)}
                className={`input-btn transition-all duration-300 flex items-center justify-center relative rounded-md w-9 h-9 ${
                  isAgentEnabled ? 
                    'input-btn-active' : 
                    'text-background'
                }`}
                title={isAgentEnabled ? "Disable Agent" : "Enable Agent"}
              >
                <Brain className="h-5 w-5 transition-transform duration-300" strokeWidth={1.2} />
                {isAgentEnabled && (
                  <span className="absolute top-1 right-1 bg-[var(--foreground)] rounded-sm w-1.5 h-1.5"></span>
                )}
              </button>
            )}

            {/* File upload button */}
            <FileUploadButton 
              filesCount={files.length} 
              onClick={() => fileInputRef.current?.click()} 
            />

            <div
              ref={inputRef}
              contentEditable
              onInput={handleInputWithShortcuts}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              className="futuristic-input empty flex-1 transition-colors duration-300 py-3 px-3 rounded-md outline-none text-sm sm:text-base bg-transparent"
              data-placeholder={placeholder}
              suppressContentEditableWarning
            ></div>

            {isLoading ? (
              <button 
                onClick={(e) => { e.preventDefault(); stop(); }} 
                type="button"
                className="input-btn input-btn-active flex items-center justify-center w-9 h-9 rounded-md transition-all duration-300 mx-1"
                aria-label="Stop generation"
              >
                <span className="flex items-center justify-center w-2.5 h-2.5">■</span>
              </button>
            ) : (
              <button 
                type="submit" 
                className={`input-btn w-9 h-9 rounded-md flex items-center justify-center transition-all duration-300 mx-1 ${
                  disabled || !input.trim() ? 
                    'text-background' : 
                    'input-btn-active'
                }`}
                disabled={disabled || !input.trim()}
                aria-label="Send message"
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="transition-transform duration-300"
                >
                  <path d="M22 2L11 13"></path>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Drag & drop overlay */}
        <DragDropOverlay dragActive={dragActive} supportsPDFs={supportsPDFs} />

        {/* Shortcuts popup */}
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