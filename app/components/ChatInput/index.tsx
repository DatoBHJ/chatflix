// app/components/chat/ChatInput/index.tsx
import { FormEvent, useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getModelById } from '@/lib/models/config';
import { ChatInputProps, PromptShortcut } from './types';
import { useChatInputStyles } from './ChatInputStyles';
import { FileUploadButton, FilePreview, fileHelpers } from './FileUpload';
import { PromptShortcuts } from './PromptShortcuts';
import { DragDropOverlay, ErrorToast } from './DragDropOverlay';
import { Brain } from 'lucide-react';

// 상수 정의
const MENTION_CONTEXT_RANGE = 200; // 커서 주변 검색 범위 (앞뒤로)
const DEBOUNCE_TIME = 200; // 디바운스 시간 (ms)

export function ChatInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  disabled,
  placeholder = "Chat is this real?",
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
  const lastTextContentRef = useRef<string>(''); // 마지막 텍스트 콘텐츠 저장
  
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
      processingNode.textContent = '처리 중...';
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
    
    // 기본 입력 처리는 즉시 수행 (반응성 유지)
    debouncedInputHandler();
    
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

  // 성능 최적화된 메시지 제출 함수
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
      
      // 본격적인 메시지 처리는 다음 틱으로 지연
      setTimeout(async () => {
        try {
          // 제출 이벤트 생성
          const submitEvent = {
            preventDefault: () => {},
            target: { value: messageContent }
          } as unknown as FormEvent<HTMLFormElement>;
          
          // 파일 처리
          const dataTransfer = new DataTransfer();
          const CHUNK_SIZE = 10;
          
          // 파일이 많은 경우 청크로 처리
          for (let i = 0; i < files.length; i += CHUNK_SIZE) {
            const chunk = files.slice(i, i + CHUNK_SIZE);
            chunk.forEach(file => dataTransfer.items.add(file));
            
            // 큰 청크를 처리한 후 다음 틱 대기
            if (i + CHUNK_SIZE < files.length) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
          
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
              id: fileId
            };
          });
          
          // 파일 정보 추가
          (submitEvent as any).experimental_attachments = attachments;
          
          // 메시지 제출
          await handleSubmit(submitEvent, dataTransfer.files);
          
          // 파일 상태 정리
          const urls = new Set<string>();
          fileMap.forEach(({ url }) => urls.add(url));
          
          setFiles([]);
          setFileMap(new Map());
          
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          
          // URL 리소스 해제
          setTimeout(() => {
            urls.forEach(url => URL.revokeObjectURL(url));
          }, 0);
          
        } finally {
          isSubmittingRef.current = false;
        }
      }, 0);
      
    } catch (error) {
      console.error('Error during message submission:', error);
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

  // 파일 처리 - 성능 최적화 버전
  const handleFiles = (newFiles: FileList) => {
    // FileList를 Array로 변환하고 필터링
    const newFileArray = Array.from(newFiles).filter(file => {
      // PDF 파일 처리 - Agent 모드가 켜졌을 때 또는 지원하지 않는 모델이면 차단
      if (fileHelpers.isPDFFile(file)) {
        if (isAgentEnabled || !supportsPDFs) {
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
    
    // 성능 최적화: 파일이 많은 경우 처리를 나누어 수행
    const processFiles = (start: number, end: number) => {
      // 처리할 파일 배열의 일부
      const chunk = newFileArray.slice(start, end);
      
      // 새 파일 항목 생성 (각 파일에 고유 ID 부여)
      const newFileEntries = chunk.map(file => {
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
        return [...prevFiles, ...chunk.map((file, index) => {
          // 파일 객체에 ID 속성을 추가
          Object.defineProperty(file, 'id', {
            value: newFileEntries[index][0],
            writable: false,
            enumerable: true
          });
          return file;
        })];
      });
      
      // 청크 처리가 남아있으면 다음 청크 예약
      if (end < newFileArray.length) {
        setTimeout(() => {
          processFiles(end, Math.min(end + CHUNK_SIZE, newFileArray.length));
        }, 0);
      }
    };
    
    // 한 번에 처리할 최대 파일 수
    const CHUNK_SIZE = 5;
    
    // 첫 번째 청크 처리 시작
    processFiles(0, Math.min(CHUNK_SIZE, newFileArray.length));
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
        
        {/* File preview section */}
        <FilePreview 
          files={files} 
          fileMap={fileMap} 
          removeFile={removeFile} 
        />

        {/* Error toast */}
        <ErrorToast show={showPDFError} message={
          isAgentEnabled 
            ? "PDF files are not supported in Agent mode" 
            : (supportsPDFs 
              ? "This file type is not supported" 
              : (supportsVision 
                ? "This model does not support PDF files" 
                : "This model does not support PDF and image files"))} />
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
            accept={supportsPDFs && !isAgentEnabled
              ? "image/*,text/*,application/json,application/javascript,application/typescript,application/xml,application/yaml,application/x-yaml,application/markdown,application/x-python,application/x-java,application/x-c,application/x-cpp,application/x-csharp,application/x-go,application/x-ruby,application/x-php,application/x-swift,application/x-kotlin,application/x-rust,application/pdf" 
              : (supportsVision 
                ? "image/*,text/*,application/json,application/javascript,application/typescript,application/xml,application/yaml,application/x-yaml,application/markdown,application/x-python,application/x-java,application/x-c,application/x-cpp,application/x-csharp,application/x-go,application/x-ruby,application/x-php,application/x-swift,application/x-kotlin,application/x-rust" 
                : "text/*,application/json,application/javascript,application/typescript,application/xml,application/yaml,application/x-yaml,application/markdown,application/x-python,application/x-java,application/x-c,application/x-cpp,application/x-csharp,application/x-go,application/x-ruby,application/x-php,application/x-swift,application/x-kotlin,application/x-rust")}
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
            {setisAgentEnabled && (
              <button
                type="button"
                onClick={() => setisAgentEnabled(!isAgentEnabled)}
                className={`input-btn transition-all duration-300 flex items-center justify-center relative rounded-md w-9 h-9 ${
                  isAgentEnabled ? 
                    'input-btn-active' : 
                    user?.hasAgentModels === false && !isAgentEnabled ? 
                      'opacity-40 cursor-not-allowed' : 
                      'text-background'
                }`}
                disabled={user?.hasAgentModels === false && !isAgentEnabled}
                title={
                  user?.hasAgentModels === false && !isAgentEnabled 
                    ? "Agent mode not available - No non-rate-limited agent models available" 
                    : isAgentEnabled ? "Disable Agent" : "Enable Agent"
                }
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
              className="futuristic-input empty flex-1 transition-colors duration-300 py-3 px-3 rounded-md outline-none text-sm sm:text-base bg-transparent overflow-y-auto overflow-x-hidden"
              data-placeholder={placeholder}
              suppressContentEditableWarning
              style={{ maxHeight: '300px', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}
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