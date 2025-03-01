// app/components/chat/ChatInput/index.tsx
import { FormEvent, useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getModelById } from '@/lib/models/config';
import { ChatInputProps, PromptShortcut } from './types';
import { useChatInputStyles } from './ChatInputStyles';
import { FileUploadButton, FilePreview, fileHelpers } from './FileUpload';
import { PromptShortcuts } from './PromptShortcuts';
import { DragDropOverlay, ErrorToast } from './DragDropOverlay';

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
  popupPosition = 'top'
}: ChatInputProps) {
  // 기본 상태 및 참조
  const inputRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shortcutsListRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
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
  const [isFocused, setIsFocused] = useState(false);
  const [isThemeChanging, setIsThemeChanging] = useState(false);
  const [lastTypedChar, setLastTypedChar] = useState<string | null>(null);
  const [mentionQueryActive, setMentionQueryActive] = useState(false);
  const [showPDFError, setShowPDFError] = useState(false);
  const [showFolderError, setShowFolderError] = useState(false);
  const [showImageError, setShowImageError] = useState(false);
  
  // Supabase 클라이언트
  const supabase = createClient();
  
  // 모델 설정
  const modelConfig = getModelById(modelId);
  const supportsVision = modelConfig?.supportsVision ?? false;

  // 멘션 감지를 위한 정규식
  const mentionRegex = /@(\w*)$/;

  // 스타일 적용
  useChatInputStyles();

  // 파일 타입 확인 함수
  const isTextOrCodeFile = (file: File): boolean => {
    // 텍스트 파일 또는 코드 파일인지 확인
    const textTypes = ['text/', 'application/json', 'application/javascript', 'application/xml'];
    
    // 확장자로 코드 파일 확인
    const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.md', 
                           '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rb', '.php', 
                           '.swift', '.kt', '.rs', '.sh', '.yml', '.yaml', '.toml', '.ini'];
    
    // MIME 타입으로 체크
    const isTextMimeType = textTypes.some(type => file.type.startsWith(type));
    
    // 확장자로 체크
    const isCodeExtension = codeExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    return isTextMimeType || isCodeExtension;
  };

  // 초기 렌더링 시 자동 포커스
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 모델 변경 시 포커스 효과
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      setIsFocused(true);
    }
    
    // 비전을 지원하지 않는 모델로 변경 시 이미지 파일 필터링
    if (!supportsVision && files.length > 0) {
      // 텍스트/코드 파일만 유지
      const textFiles = files.filter(file => isTextOrCodeFile(file));
      
      // 이미지 파일이 제거되었다면 fileMap 업데이트
      if (textFiles.length !== files.length) {
        const filteredMap = new Map();
        textFiles.forEach(file => {
          if (fileMap.has(file.name)) {
            filteredMap.set(file.name, fileMap.get(file.name));
          }
        });
        
        // 제거된 파일의 URL 해제
        fileMap.forEach(({ url }, filename) => {
          if (!filteredMap.has(filename)) {
            URL.revokeObjectURL(url);
          }
        });
        
        setFiles(textFiles);
        setFileMap(filteredMap);
      }
    }
  }, [modelId, supportsVision, files.length]);

  // 테마 변경 감지
  useEffect(() => {
    // 테마 변경 감지 함수
    const detectThemeChange = () => {
      setIsThemeChanging(true);
      
      setTimeout(() => {
        setIsThemeChanging(false);
      }, 500);
    };

    // MutationObserver로 테마 변경 감시
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' && 
          (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme')
        ) {
          detectThemeChange();
          break;
        }
      }
    });

    // document.documentElement의 class 또는 data-theme 변경 감시
    observer.observe(document.documentElement, { 
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    // body의 class 변경도 감시
    observer.observe(document.body, { 
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      observer.disconnect();
    };
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

//   // 커서 위치 설정 함수
//   const setCursorPosition = (element: HTMLElement, position: number) => {
//     const range = document.createRange();
//     const selection = window.getSelection();
    
//     // 텍스트 노드와 오프셋 찾기
//     let currentPos = 0;
//     let targetNode: Node | null = null;
//     let targetOffset = 0;
    
//     const walker = document.createTreeWalker(
//       element,
//       NodeFilter.SHOW_TEXT,
//       null
//     );
    
//     let node: Node | null = walker.nextNode();
//     while (node) {
//       const nodeLength = node.textContent?.length || 0;
//       if (currentPos + nodeLength >= position) {
//         targetNode = node;
//         targetOffset = position - currentPos;
//         break;
//       }
//       currentPos += nodeLength;
//       node = walker.nextNode();
//     }
    
//     if (targetNode) {
//       range.setStart(targetNode, targetOffset);
//       range.setEnd(targetNode, targetOffset);
//       selection?.removeAllRanges();
//       selection?.addRange(range);
//     }
//   };

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
      
      // 부모 상태 업데이트
      const event = {
        target: { value: '' }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      handleInputChange(event);
      
      // 입력 필드에 포커스
      inputRef.current.focus();
    }
  };

  // 메시지 제출 처리
  const handleMessageSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isSubmittingRef.current || isLoading) return;
    
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
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // 숏컷 목록이 닫혀있는 경우 엔터로 메시지 제출
      e.preventDefault();
      if (!isSubmittingRef.current && !isLoading) {
        formRef.current?.dispatchEvent(
          new Event('submit', { cancelable: true, bubbles: true })
        );
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
    // FileList를 Array로 변환
    const newFileArray = Array.from(newFiles).filter(file => {
      // PDF 파일 필터링
      if (fileHelpers.isPDFFile(file)) {
        setShowPDFError(true);
        setTimeout(() => setShowPDFError(false), 3000);
        return false;
      }
      
      // 비전을 지원하지 않는 모델에서는 텍스트/코드 파일만 허용
      if (!supportsVision && !isTextOrCodeFile(file)) {
        setShowImageError(true);
        setTimeout(() => setShowImageError(false), 3000);
        return false;
      }
      
      return true;
    });
    
    // 필터링 후 유효한 파일이 없으면 조기 반환
    if (newFileArray.length === 0) return;
    
    // 새 파일 항목 생성
    const newFileEntries = newFileArray.map(file => {
      const url = URL.createObjectURL(file);
      return [file.name, { file, url }] as [string, { file: File, url: string }];
    });

    // 새 항목으로 파일 맵 업데이트
    setFileMap(prevMap => {
      const newMap = new Map(prevMap);
      newFileEntries.forEach(([name, data]) => {
        // 같은 이름의 파일이 있으면 이전 URL 해제
        if (prevMap.has(name)) {
          URL.revokeObjectURL(prevMap.get(name)!.url);
        }
        newMap.set(name, data);
      });
      return newMap;
    });

    // 파일 배열 업데이트
    setFiles(prevFiles => {
      const existingNames = new Set(prevFiles.map(f => f.name));
      const uniqueNewFiles = newFileArray.filter(file => !existingNames.has(file.name));
      return [...prevFiles, ...uniqueNewFiles];
    });
  };

  // 파일 제거
  const removeFile = (fileToRemove: File) => {
    // fileMap에서 제거하고 URL 해제
    setFileMap(prevMap => {
      const newMap = new Map(prevMap);
      const fileData = newMap.get(fileToRemove.name);
      if (fileData) {
        URL.revokeObjectURL(fileData.url);
        newMap.delete(fileToRemove.name);
      }
      return newMap;
    });

    // files 배열에서 제거
    setFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
  };

  return (
    <div className="relative">
      <form 
        ref={formRef} 
        onSubmit={handleMessageSubmit} 
        className={`flex flex-col gap-2 sticky bottom-0 bg-transparent p-1 md:p-0
          ${dragActive ? 'drag-target-active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 파일 미리보기 섹션 */}
        <FilePreview 
          files={files} 
          fileMap={fileMap} 
          removeFile={removeFile} 
        />

        {/* 에러 토스트 */}
        <ErrorToast show={showPDFError} message="PDF files are not supported" />
        <ErrorToast show={showFolderError} message="Folders cannot be uploaded" />
        <ErrorToast show={showImageError} message="This model only supports text and code files" />

        {/* 드래그 & 드롭 영역 */}
        <div 
          className={`relative transition-all duration-300 ${dragActive ? 'scale-[1.01]' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDragLeave}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={supportsVision ? "image/*,text/*" : "text/*,.js,.jsx,.ts,.tsx,.html,.css,.json,.md,.py,.java,.c,.cpp,.cs,.go,.rb,.php,.swift,.kt,.rs"}
            onChange={(e) => {
              if (e.target.files) {
                handleFiles(e.target.files);
              }
            }}
            ref={fileInputRef}
            className="hidden"
            multiple
          />
          
          <div className="flex gap-0 items-center input-container py-2">
            {/* 파일 업로드 버튼 - 모든 모델에 표시 */}
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
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={`yeezy-input futuristic-input flex-1 transition-all duration-300 py-2 px-2
                ${isFocused ? 'focused' : ''}
                ${isThemeChanging ? 'theme-changing' : ''}
                ${!isFocused && !isThemeChanging ? 'bg-transparent' : ''}`}
              style={{ 
                minHeight: '44px',
                maxHeight: window.innerWidth <= 768 ? '120px' : '200px',
                lineHeight: '1.5',
                wordBreak: 'break-word',
                overflowWrap: 'break-word'
              }}
              data-placeholder={placeholder}
              suppressContentEditableWarning
            />

            {isLoading ? (
              <button 
                onClick={(e) => { e.preventDefault(); stop(); }} 
                type="button"
                className="futuristic-button w-10 h-10 flex items-center justify-center transition-all hover:bg-[var(--accent)]/30"
                aria-label="Stop generation"
              >
                <span className="text-red-500 flex items-center justify-center w-3 h-3">■</span>
              </button>
            ) : (
              <button 
                type="submit" 
                className={`futuristic-button w-10 h-10 flex items-center justify-center transition-all hover:bg-[var(--accent)]/30`}
                disabled={disabled || isLoading}
                aria-label="Send message"
              >
                <span className="flex items-center justify-center leading-none">↑</span>
              </button>
            )}
          </div>
        </div>

        {/* 드래그 & 드롭 오버레이 */}
        <DragDropOverlay dragActive={dragActive} />

        {/* 숏컷 팝업 */}
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