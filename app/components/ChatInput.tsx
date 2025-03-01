// // 멀티모달 지원 안 되는 모델 파일 업로드 안하도록 하는 코드 없음. 


// import { FormEvent, useEffect, useRef, useState, ReactNode } from 'react';
// import { createClient } from '@/utils/supabase/client';
// import { openShortcutsDialog } from './PromptShortcutsDialog'

// interface PromptShortcut {
//   id: string;
//   name: string;
//   content: string;
//   created_at: string;
//   // 새 필드 추가: 검색 결과 관련 정보
//   match_type?: string;
//   highlight_ranges?: Array<{start: number, end: number}>;
// }

// import { getModelById } from '@/lib/models/config';

// interface ChatInputProps {
//   input: string;
//   handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
//   handleSubmit: (e: FormEvent<HTMLFormElement>, files?: FileList) => void;
//   isLoading: boolean;
//   stop: () => void;
//   disabled?: boolean;
//   placeholder?: string;
//   user: any;
//   modelId: string;
//   popupPosition?: 'top' | 'bottom';  // 추가: 팝업 위치 설정
// }

// export function ChatInput({
//   input,
//   handleInputChange,
//   handleSubmit,
//   isLoading,
//   stop,
//   disabled,
//   placeholder = "Type @ for shortcuts ...",
//   user,
//   modelId,
//   popupPosition = 'top'  // 기본값은 top
// }: ChatInputProps) {
//   const inputRef = useRef<HTMLDivElement>(null);
//   const formRef = useRef<HTMLFormElement>(null);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const shortcutsListRef = useRef<HTMLDivElement>(null);
//   const isSubmittingRef = useRef(false);
//   const [showShortcuts, setShowShortcuts] = useState(false);
//   const [shortcuts, setShortcuts] = useState<PromptShortcut[]>([]);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [selectedIndex, setSelectedIndex] = useState(0);
//   const [mentionStartPosition, setMentionStartPosition] = useState<number | null>(null);
//   const [mentionEndPosition, setMentionEndPosition] = useState<number | null>(null);
//   const [files, setFiles] = useState<File[]>([]);
//   const [fileMap, setFileMap] = useState<Map<string, { file: File, url: string }>>(new Map());
//   const [dragActive, setDragActive] = useState(false);
//   const [isFocused, setIsFocused] = useState(false);
//   const [isThemeChanging, setIsThemeChanging] = useState(false);
//   const [lastTypedChar, setLastTypedChar] = useState<string | null>(null);
//   const [mentionQueryActive, setMentionQueryActive] = useState(false);
//   const [showPDFError, setShowPDFError] = useState(false);
//   const [showFolderError, setShowFolderError] = useState(false);
//   const supabase = createClient();
  
//   // 타이핑 디바운스 설정
//   const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
//   // 모델 설정
//   const modelConfig = getModelById(modelId);
//   const supportsVision = modelConfig?.supportsVision ?? false;

//   // 추가: 멘션 감지를 위한 정규식
//   const mentionRegex = /@(\w*)$/;

//   // Add autofocus effect on initial render
//   useEffect(() => {
//     if (inputRef.current) {
//       inputRef.current.focus();
//     }
//   }, []);

//   // Add focus effect when model changes
//   useEffect(() => {
//     if (inputRef.current) {
//       inputRef.current.focus();
//       setIsFocused(true);
//     }
//   }, [modelId]);

//   // Add theme change detection
//   useEffect(() => {
//     // Function to detect theme changes
//     const detectThemeChange = () => {
//       // Briefly trigger the input focus animation
//       setIsThemeChanging(true);
      
//       // Reset after animation completes
//       setTimeout(() => {
//         setIsThemeChanging(false);
//       }, 500); // Animation duration + small buffer
//     };

//     // Create a MutationObserver to watch for theme changes
//     const observer = new MutationObserver((mutations) => {
//       for (const mutation of mutations) {
//         if (
//           mutation.type === 'attributes' && 
//           (mutation.attributeName === 'class' || mutation.attributeName === 'data-theme')
//         ) {
//           detectThemeChange();
//           break;
//         }
//       }
//     });

//     // Start observing document.documentElement for class or data-theme changes
//     observer.observe(document.documentElement, { 
//       attributes: true,
//       attributeFilter: ['class', 'data-theme']
//     });

//     // Also observe body for class changes (some themes apply changes here)
//     observer.observe(document.body, { 
//       attributes: true,
//       attributeFilter: ['class']
//     });

//     return () => {
//       observer.disconnect();
//     };
//   }, []);

//   // Add paste event handler
//   const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
//     e.preventDefault();
    
//     if (!inputRef.current) return;
    
//     // Get plain text from clipboard
//     const text = e.clipboardData.getData('text/plain');
    
//     // Get current selection
//     const selection = window.getSelection();
//     if (!selection?.rangeCount) return;
    
//     const range = selection.getRangeAt(0);
    
//     // Insert text at cursor position
//     range.deleteContents();
//     const textNode = document.createTextNode(text.replace(/\n/g, ' '));
//     range.insertNode(textNode);
    
//     // Clean up any unwanted formatting and normalize content
//     const content = inputRef.current.innerHTML;
//     inputRef.current.innerHTML = content
//       .replace(/<div>/g, '')
//       .replace(/<\/div>/g, '')
//       .replace(/<br\s*\/?>/g, ' ')
//       .replace(/\s+/g, ' ');
    
//     // Normalize spaces and text nodes
//     inputRef.current.normalize();
    
//     // Restore selection and move cursor to end of pasted text
//     requestAnimationFrame(() => {
//       if (!inputRef.current) return;
      
//       const selection = window.getSelection();
//       const range = document.createRange();
      
//       // Find the text node at the current cursor position
//       const walker = document.createTreeWalker(
//         inputRef.current,
//         NodeFilter.SHOW_TEXT,
//         null
//       );
      
//       let lastNode: Text | null = null;
//       let node: Node | null;
//       while ((node = walker.nextNode())) {
//         if (node.nodeType === Node.TEXT_NODE) {
//           lastNode = node as Text;
//         }
//       }
      
//       if (lastNode) {
//         range.setStart(lastNode, lastNode.length);
//         range.setEnd(lastNode, lastNode.length);
//         selection?.removeAllRanges();
//         selection?.addRange(range);
        
//         // Ensure input maintains focus
//         inputRef.current.focus();
//       }
//     });
    
//     // Trigger input handler to process mentions after a short delay
//     setTimeout(() => {
//       handleInputWithShortcuts();
//     }, 0);
//   };
  
//  // 커서 위치 얻기 함수
//  const getCursorPosition = (element: HTMLElement): number => {
//   const selection = window.getSelection();
//   if (!selection?.rangeCount) return 0;
  
//   const range = document.createRange();
//   range.selectNodeContents(element);
//   range.setEnd(selection.anchorNode!, selection.anchorOffset);
//   return range.toString().length;
// };

  
//  // 커서 위치 설정 함수
//  const setCursorPosition = (element: HTMLElement, position: number) => {
//   const range = document.createRange();
//   const selection = window.getSelection();
  
//   // 텍스트 노드와 오프셋 찾기
//   let currentPos = 0;
//   let targetNode: Node | null = null;
//   let targetOffset = 0;
  
//   const walker = document.createTreeWalker(
//     element,
//     NodeFilter.SHOW_TEXT,
//     null
//   );
  
//   let node: Node | null = walker.nextNode();
//   while (node) {
//     const nodeLength = node.textContent?.length || 0;
//     if (currentPos + nodeLength >= position) {
//       targetNode = node;
//       targetOffset = position - currentPos;
//       break;
//     }
//     currentPos += nodeLength;
//     node = walker.nextNode();
//   }
  
//   if (targetNode) {
//     range.setStart(targetNode, targetOffset);
//     range.setEnd(targetNode, targetOffset);
//     selection?.removeAllRanges();
//     selection?.addRange(range);
//   }
// };


// // 사용자 입력 모니터링 및 멘션 감지
// const handleInputWithShortcuts = async () => {
//   if (!inputRef.current || isSubmittingRef.current) return;
  
//   // 디바운스 설정 (타이핑 시 실시간 검색이 너무 자주 일어나지 않도록)
//   if (debounceTimerRef.current) {
//     clearTimeout(debounceTimerRef.current);
//   }
  
//   // 현재 입력 상태 가져오기
//   const selection = window.getSelection();
//   if (!selection || !selection.rangeCount) return;
  
//   // 컨텐츠 정규화
//   inputRef.current.normalize();
  
//   const cursorPosition = getCursorPosition(inputRef.current);
//   const content = inputRef.current.textContent || '';
  
//   // 부모 컴포넌트 상태 업데이트
//   const event = {
//     target: { value: content }
//   } as React.ChangeEvent<HTMLTextAreaElement>;
//   handleInputChange(event);
  
//   // 커서 위치까지의 텍스트 추출
//   const textBeforeCursor = content.substring(0, cursorPosition);
  
//   // 멘션 패턴 감지 (@단어)
//   const mentionMatch = textBeforeCursor.match(mentionRegex);
  
//   if (mentionMatch) {
//     // 멘션 쿼리 상태 활성화
//     setMentionQueryActive(true);
    
//     // 멘션 시작 위치 (@ 기호 위치) 저장
//     const mentionStartPos = textBeforeCursor.lastIndexOf('@');
//     setMentionStartPosition(mentionStartPos);
    
//     // 검색어 추출 (@ 다음 텍스트)
//     const query = mentionMatch[1] || '';
//     setSearchTerm(query);
    
//     // 디바운스 적용하여 검색 실행
//     debounceTimerRef.current = setTimeout(async () => {
//       // 숏컷 검색 API 호출
//       const { data, error } = await supabase.rpc('search_prompt_shortcuts', {
//         p_user_id: user.id,
//         p_search_term: query
//       });
      
//       if (error) {
//         console.error('Error searching shortcuts:', error);
//         return;
//       }
      
//       // 검색 결과 업데이트 및 표시
//       setShortcuts(data || []);
//       setShowShortcuts(true);
//       setSelectedIndex(0); // 첫 번째 항목 선택
//     }, 100); // 100ms 디바운스
//   } else {
//     // 멘션 패턴이 없으면 팝업 닫기
//     closeShortcutsPopup();
//   }
// };
// // 멘션 팝업 닫기 함수
// const closeShortcutsPopup = () => {
//   setShowShortcuts(false);
//   setMentionStartPosition(null);
//   setMentionEndPosition(null);
//   setMentionQueryActive(false);
  
//   if (debounceTimerRef.current) {
//     clearTimeout(debounceTimerRef.current);
//   }
// };
//  // 숏컷 선택 처리 개선
//  const handleShortcutSelect = (shortcut: PromptShortcut) => {
//   if (!inputRef.current || mentionStartPosition === null) return;
  
//   // 현재 컨텐츠와 커서 상태 가져오기
//   const content = inputRef.current.textContent || '';
//   const beforeMention = content.slice(0, mentionStartPosition);
//   const afterMention = content.slice(mentionQueryActive ? getCursorPosition(inputRef.current) : mentionStartPosition);
  
//   // 멘션 삽입 전 DOM 상태 저장
//   const range = document.createRange();
//   const selection = window.getSelection();
  
//   // 멘션 태그 생성 (트위터 스타일)
//   const mentionTag = document.createElement('span');
//   mentionTag.className = 'mention-tag-wrapper';
  
//   // 멘션 데이터 저장
//   const mentionData = {
//     id: shortcut.id,
//     name: shortcut.name,
//     content: shortcut.content
//   };
  
//   // 멘션 내부 구조 생성
//   const mentionInner = document.createElement('span');
//   mentionInner.className = 'mention-tag';
//   mentionInner.contentEditable = 'false';
//   mentionInner.dataset.shortcutId = shortcut.id;
//   mentionInner.dataset.mentionData = JSON.stringify(mentionData);
//   mentionInner.textContent = `@${shortcut.name}`;
  
//   // 멘션 태그에 추가
//   mentionTag.appendChild(mentionInner);
  
//   // 새 컨텐츠 구성
//   inputRef.current.innerHTML = '';
  
//   // 멘션 이전 텍스트 추가
//   if (beforeMention) {
//     inputRef.current.appendChild(document.createTextNode(beforeMention));
//   }
  
//   // 멘션 태그 추가
//   inputRef.current.appendChild(mentionTag);
  
//   // 공백 추가 (멘션 후 띄어쓰기)
//   inputRef.current.appendChild(document.createTextNode(' '));
  
//   // 나머지 텍스트 추가
//   if (afterMention && !mentionQueryActive) {
//     inputRef.current.appendChild(document.createTextNode(afterMention));
//   }
  
//   // 부모 컴포넌트 상태 업데이트
//   const updatedText = inputRef.current.textContent || '';
//   handleInputChange({
//     target: { value: updatedText }
//   } as React.ChangeEvent<HTMLTextAreaElement>);
  
//   // 커서 위치 조정 (멘션 태그 뒤로)
//   requestAnimationFrame(() => {
//     if (!inputRef.current) return;
    
//     // 멘션 태그 다음 노드 찾기
//     const mentionElement = inputRef.current.querySelector('.mention-tag-wrapper');
//     if (mentionElement && mentionElement.nextSibling) {
//       const nextNode = mentionElement.nextSibling;
//       if (nextNode.nodeType === Node.TEXT_NODE) {
//         // 텍스트 노드면 커서를 텍스트 시작 위치에 설정
//         range.setStart(nextNode, 1); // 공백 다음으로 이동
//         range.collapse(true);
        
//         // 새 선택 영역 적용
//         selection?.removeAllRanges();
//         selection?.addRange(range);
        
//         // 입력 필드에 포커스 유지
//         inputRef.current.focus();
//       }
//     }
//   });
  
//   // 팝업 닫기
//   closeShortcutsPopup();
// };


//   const clearInput = () => {
//     if (inputRef.current) {
//       // Clear all content including empty nodes
//       inputRef.current.innerHTML = '';
      
//       // Ensure parent state is updated
//       const event = {
//         target: { value: '' }
//       } as React.ChangeEvent<HTMLTextAreaElement>;
//       handleInputChange(event);
      
//       // Focus the input
//       inputRef.current.focus();
//     }
//   };

//   const handleMessageSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
    
//     if (isSubmittingRef.current || isLoading) return;
    
//     const content = inputRef.current?.textContent || '';
//     if (!content.trim() && files.length === 0) return;

//     try {
//       isSubmittingRef.current = true;

//       // Store the content before clearing
//       const messageContent = content.trim();

//       // Clear input using the new method
//       clearInput();

//       // Update parent state
//       const event = {
//         target: { value: '' }
//       } as React.ChangeEvent<HTMLTextAreaElement>;
//       handleInputChange(event);

//       // Create a new submit event with the stored content
//       const submitEvent = {
//         preventDefault: () => {},
//         target: {
//           value: messageContent
//         }
//       } as unknown as FormEvent<HTMLFormElement>;

//       // Convert File[] to FileList for submission
//       const dataTransfer = new DataTransfer();
//       files.forEach(file => {
//         dataTransfer.items.add(file);
//       });

//       // Submit the form with the stored content and files
//       await handleSubmit(submitEvent, dataTransfer.files);
      
//       // Reset files after submission
//       setFiles([]);
//       setFileMap(new Map());
//       if (fileInputRef.current) {
//         fileInputRef.current.value = '';
//       }
      
//       // Clear preview URLs
//       fileMap.forEach(({ url }) => URL.revokeObjectURL(url));

//     } finally {
//       isSubmittingRef.current = false;
//       // Ensure input is cleared even after submission
//       clearInput();
//     }
//   };

//   // 스크롤 함수 개선 - 부드러운 스크롤 지원
//   const scrollToItem = (index: number) => {
//     if (!shortcutsListRef.current) return;
    
//     const listElement = shortcutsListRef.current;
//     const items = listElement.getElementsByTagName('button');
//     if (!items[index]) return;

//     const item = items[index];
//     const itemRect = item.getBoundingClientRect();
//     const listRect = listElement.getBoundingClientRect();

//     // 스크롤 필요 여부 계산
//     if (itemRect.bottom > listRect.bottom) {
//       // 아래로 스크롤 필요
//       const scrollDistance = itemRect.bottom - listRect.bottom;
//       listElement.scrollBy({ 
//         top: scrollDistance + 8, // 여유 공간 추가
//         behavior: 'smooth'       // 부드러운 스크롤
//       });
//     } else if (itemRect.top < listRect.top) {
//       // 위로 스크롤 필요
//       const scrollDistance = listRect.top - itemRect.top;
//       listElement.scrollBy({ 
//         top: -scrollDistance - 8, // 여유 공간 추가
//         behavior: 'smooth'        // 부드러운 스크롤
//       });
//     }
//   };

//  // 키보드 네비게이션 개선
//  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
//   // 숏컷 목록이 열려있고 항목이 있는 경우
//   if (showShortcuts && shortcuts.length > 0) {
//     switch (e.key) {
//       case 'ArrowDown':
//         e.preventDefault();
//         setSelectedIndex((prev) => {
//           const newIndex = (prev + 1) % shortcuts.length;
//           // 부드러운 스크롤로 선택 항목 표시
//           scrollToItem(newIndex);
//           return newIndex;
//         });
//         break;
        
//       case 'ArrowUp':
//         e.preventDefault();
//         setSelectedIndex((prev) => {
//           const newIndex = (prev - 1 + shortcuts.length) % shortcuts.length;
//           // 부드러운 스크롤로 선택 항목 표시
//           scrollToItem(newIndex);
//           return newIndex;
//         });
//         break;
        
//       case 'Enter':
//         // 시프트 키와 함께 누르지 않은 경우에만 숏컷 선택
//         if (!e.shiftKey) {
//           e.preventDefault();
//           handleShortcutSelect(shortcuts[selectedIndex]);
//         }
//         break;
        
//       case 'Escape':
//         // ESC로 팝업 닫기
//         e.preventDefault();
//         closeShortcutsPopup();
//         break;
        
//       case 'Tab':
//         // 탭으로 선택 후 닫기
//         e.preventDefault();
//         handleShortcutSelect(shortcuts[selectedIndex]);
//         break;
        
//       default:
//         // 다른 키는 기본 동작 유지
//         setLastTypedChar(e.key);
//         break;
//     }
//   } else if (e.key === 'Enter' && !e.shiftKey) {
//     // 숏컷 목록이 닫혀있는 경우 엔터로 메시지 제출
//     e.preventDefault();
//     if (!isSubmittingRef.current && !isLoading) {
//       formRef.current?.dispatchEvent(
//         new Event('submit', { cancelable: true, bubbles: true })
//       );
//     }
//   }
// };

//   // Reset selected index when shortcuts change
//   useEffect(() => {
//     setSelectedIndex(0);
//   }, [shortcuts]);

//   // Add styles to the document head
//   useEffect(() => {
//     const style = document.createElement('style');
//     style.textContent = `
//       /* 멘션 태그 스타일 개선 */
//       .mention-tag-wrapper {
//         display: inline-block;
//         position: relative;
//         margin: 0 2px;
//         white-space: nowrap;
//       }
      
//       .mention-tag {
//         display: inline-flex !important;
//         align-items: center;
//         white-space: nowrap !important;
//         padding: 1px 6px 1px 4px;
//         margin: 0;
//         border-radius: 4px;
//         background-color: rgba(239, 68, 68, 0.15);
//         color: rgb(239, 68, 68);
//         font-weight: 500;
//         user-select: none;
//         transition: all 0.2s ease;
//         position: relative;
//         z-index: 1;
//       }
      
//       .mention-tag::before {
//         content: '';
//         position: absolute;
//         left: 0;
//         top: 0;
//         width: 100%;
//         height: 100%;
//         background: linear-gradient(to right, rgba(239, 68, 68, 0.15), transparent);
//         opacity: 0;
//         transition: opacity 0.3s ease;
//         border-radius: 4px;
//         z-index: -1;
//       }
      
//       .mention-tag:hover {
//         background-color: rgba(239, 68, 68, 0.25);
//       }
      
//       .mention-tag:hover::before {
//         opacity: 0.6;
//         animation: shimmer 1.5s infinite;
//       }
      
//       @keyframes shimmer {
//         0% {
//           transform: translateX(-100%);
//         }
//         100% {
//           transform: translateX(100%);
//         }
//       }
      
//       /* 검색 결과 스타일 개선 */
//       .shortcut-item {
//         width: 100%;
//         padding: 16px 24px;
//         text-align: left;
//         transition: all 0.2s ease;
//         position: relative;
//         overflow: hidden;
//       }
      
//       .shortcut-item.selected {
//         background: rgba(var(--accent-rgb), 0.3);
//       }
      
//       .shortcut-item:hover {
//         background: rgba(var(--accent-rgb), 0.2);
//       }
      
//       .shortcut-item .highlight {
//         color: var(--foreground);
//         font-weight: 500;
//         position: relative;
//       }
      
//       .shortcut-item .highlight::after {
//         content: '';
//         position: absolute;
//         bottom: 0;
//         left: 0;
//         width: 100%;
//         height: 2px;
//         background: rgba(var(--accent-rgb), 0.5);
//       }
      
//       .shortcut-item.selected .indicator {
//         position: absolute;
//         left: 0;
//         top: 0;
//         bottom: 0;
//         width: 3px;
//         background: var(--foreground);
//         animation: fadeIn 0.2s ease-out;
//       }
      
//       .shortcuts-container {
//         max-height: 300px;
//         overflow-y: auto;
//         scrollbar-width: thin;
//         scrollbar-color: rgba(var(--foreground-rgb), 0.2) transparent;
//         border-radius: 8px;
//         box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
//         backdrop-filter: blur(16px);
//         border: 1px solid rgba(var(--foreground-rgb), 0.1);
//         animation: slideDown 0.2s ease-out;
//         transform-origin: top center;
//       }
      
//       .shortcuts-container::-webkit-scrollbar {
//         width: 4px;
//       }
      
//       .shortcuts-container::-webkit-scrollbar-track {
//         background: transparent;
//       }
      
//       .shortcuts-container::-webkit-scrollbar-thumb {
//         background: rgba(var(--foreground-rgb), 0.2);
//         border-radius: 4px;
//       }
      
//       @keyframes slideDown {
//         from {
//           opacity: 0;
//           transform: translateY(-10px) scale(0.98);
//         }
//         to {
//           opacity: 1;
//           transform: translateY(0) scale(1);
//         }
//       }
      
//       /* 기존 스타일 유지 */
//       .futuristic-input {
//         position: relative;
//         transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
//         background: transparent;
//         outline: none !important;
//       }
      
      
//       .futuristic-input:focus,
//       .futuristic-input:focus-visible {
//         outline: none !important;
//         box-shadow: none !important;
//         background: transparent !important;
//       }

//       .futuristic-input::after,
//       .futuristic-input.theme-changing::after {
//         content: "";
//         position: absolute;
//         bottom: 0;
//         left: 0;
//         width: 100%;
//         height: 2px;
//         background: linear-gradient(to right, var(--muted), transparent);
//         opacity: 0;
//         transform-origin: left center;
//         transform: scaleX(0.95) scaleY(0.8) translateY(-0.5px);
//         transition: opacity 0.3s ease;
//       }

//       .futuristic-input.focused::after,
//       .futuristic-input.theme-changing::after {
//         opacity: 0.7;
//         animation: pencilStroke 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
//       }
      
//       @keyframes pencilStroke {
//         0% {
//           transform: scaleX(0) scaleY(0.8) translateY(-0.5px);
//         }
//         100% {
//           transform: scaleX(0.95) scaleY(0.8) translateY(-0.5px);
//         }
//       }

//       .futuristic-button {
//         position: relative;
//         overflow: hidden;
//         transition: all 0.3s ease;
//       }

//       .futuristic-button:before {
//         content: '';
//         position: absolute;
//         top: 50%;
//         left: 50%;
//         width: 0;
//         height: 0;
//         background: rgba(255, 255, 255, 0.05);
//         transform: translate(-50%, -50%);
//         transition: width 0.6s ease, height 0.6s ease;
//       }

//       .futuristic-button:hover:before {
//         width: 120%;
//         height: 120%;
//       }

//       .image-preview-container {
//         backdrop-filter: blur(12px);
//         transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
//         border-radius: 12px;
//         box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
//         overflow: hidden;
//         z-index: 30;
//       }
      
//       .image-preview-scroll {
//         overflow-x: auto;
//         scrollbar-width: thin;
//         scrollbar-color: var(--muted) transparent;
//       }
      
//       .image-preview-scroll::-webkit-scrollbar {
//         height: 4px;
//       }
      
//       .image-preview-scroll::-webkit-scrollbar-track {
//         background: transparent;
//       }
      
//       .image-preview-scroll::-webkit-scrollbar-thumb {
//         background: var(--muted);
//         border-radius: 4px;
//         opacity: 0.5;
//       }

//       .file-preview-item {
//         position: relative;
//         overflow: hidden;
//         transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
//         border-radius: 8px;
//         box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
//         background: var(--accent);
//         width: 160px;
//         height: 100px;
//         display: flex;
//         flex-direction: column;
//         justify-content: center;
//         align-items: center;
//       }
      
//       .file-preview-item:hover {
//         transform: scale(1.03);
//         box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
//       }
      
//       .file-preview-item .file-icon {
//         font-size: 24px;
//         margin-bottom: 8px;
//         opacity: 0.8;
//       }
      
//       .file-preview-item .file-name {
//         font-size: 12px;
//         max-width: 140px;
//         overflow: hidden;
//         text-overflow: ellipsis;
//         white-space: nowrap;
//         opacity: 0.9;
//       }
      
//       .file-preview-item .file-size {
//         font-size: 10px;
//         opacity: 0.7;
//         margin-top: 4px;
//       }

//       .image-preview-item {
//         position: relative;
//         overflow: hidden;
//         transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
//         border-radius: 8px;
//         box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
//       }
      
//       .image-preview-item:hover {
//         transform: scale(1.03);
//         box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
//       }

//       .preview-img {
//         transition: all 0.3s ease;
//         filter: contrast(1.05);
//       }

//       .image-preview-item:hover .preview-img {
//         filter: contrast(1.1) brightness(1.05);
//       }

//       .remove-file-btn {
//         position: absolute;
//         top: 6px;
//         right: 6px;
//         width: 22px;
//         height: 22px;
//         border-radius: 50%;
//         background: rgba(0, 0, 0, 0.5);
//         color: white;
//         display: flex;
//         align-items: center;
//         justify-content: center;
//         opacity: 0;
//         transform: translateY(-6px);
//         transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
//         backdrop-filter: blur(4px);
//         border: 1px solid rgba(255, 255, 255, 0.1);
//         font-size: 14px;
//         z-index: 10;
//       }

//       .file-preview-item:hover .remove-file-btn,
//       .image-preview-item:hover .remove-file-btn {
//         opacity: 1;
//         transform: translateY(0);
//       }

//       .preview-overlay {
//         position: absolute;
//         inset: 0;
//         background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0) 50%);
//         opacity: 0;
//         transition: opacity 0.3s ease;
//       }

//       .image-preview-item:hover .preview-overlay {
//         opacity: 1;
//       }

//       .drag-upload-overlay {
//         backdrop-filter: blur(12px);
//         background: rgba(var(--background-rgb), 0.85);
//         border: 2px dashed rgba(var(--foreground-rgb), 0.2);
//         border-radius: 12px;
//         box-shadow: 0 0 0 6px rgba(var(--background-rgb), 0.5);
//         animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
//       }

//       @keyframes pulse {
//         0%, 100% {
//           border-color: rgba(var(--foreground-rgb), 0.2);
//           box-shadow: 0 0 0 6px rgba(var(--background-rgb), 0.5);
//         }
//         50% {
//           border-color: rgba(var(--foreground-rgb), 0.4);
//           box-shadow: 0 0 0 12px rgba(var(--background-rgb), 0.3);
//         }
//       }

//       .drag-upload-icon {
//         background: rgba(var(--accent-rgb), 0.15);
//         border-radius: 50%;
//         display: flex;
//         align-items: center;
//         justify-content: center;
//         padding: 16px;
//         transition: all 0.3s ease;
//         animation: bounce 1s infinite;
//       }

//       @keyframes bounce {
//         0%, 100% {
//           transform: translateY(0);
//         }
//         50% {
//           transform: translateY(-6px);
//         }
//       }

//       .drag-upload-text {
//         font-size: 16px;
//         font-weight: 500;
//         letter-spacing: 0.02em;
//         color: var(--foreground);
//         opacity: 0.9;
//         text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
//       }

//       /* Placeholder implementation */
//       .yeezy-input:empty:before {
//         content: attr(data-placeholder);
//         color: var(--muted);
//         opacity: 0.7;
//         pointer-events: none;
//       }
      
//       .input-container {
//         padding-left: 1px;
//         padding-right: 1px;
//       }
      
//       @media (max-width: 640px) {
//         .input-container {
//           padding-left: 1px;
//           padding-right: 1px;
//         }
//       }

//       .upload-button {
//         position: relative;
//         overflow: hidden;
//         display: flex;
//         align-items: center;
//         justify-content: center;
//         transition: all 0.3s ease;
//       }

//       .upload-button-indicator {
//         position: absolute;
//         width: 8px;
//         height: 8px;
//         border-radius: 50%;
//         background: var(--accent);
//         bottom: 8px;
//         right: 8px;
//         opacity: 0;
//         transform: scale(0);
//         transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
//         box-shadow: 0 0 8px var(--accent);
//       }

//       .upload-button-active .upload-button-indicator {
//         opacity: 1;
//         transform: scale(1);
//       }

//       .upload-icon {
//         transition: all 0.3s ease;
//       }

//       .upload-button:hover .upload-icon {
//         transform: scale(1.1);
//         opacity: 0.9;
//       }
      
//       .code-preview {
//         background: var(--code-bg);
//         color: var(--code-text);
//         font-family: monospace;
//         font-size: 12px;
//         padding: 8px;
//         border-radius: 6px;
//         max-height: 80px;
//         overflow: hidden;
//         position: relative;
//         width: 100%;
//       }
      
//       .code-preview::after {
//         content: '';
//         position: absolute;
//         bottom: 0;
//         left: 0;
//         right: 0;
//         height: 24px;
//         background: linear-gradient(to bottom, transparent, var(--code-bg));
//       }
      
//       .file-type-badge {
//         position: absolute;
//         top: 6px;
//         left: 6px;
//         font-size: 10px;
//         padding: 2px 6px;
//         border-radius: 4px;
//         background: rgba(0, 0, 0, 0.5);
//         color: white;
//         backdrop-filter: blur(4px);
//         z-index: 5;
//       }

//       .drag-target-active {
//         position: relative;
//         z-index: 40;
//       }

//       .drag-target-active::before {
//         content: '';
//         position: absolute;
//         inset: -20px;
//         background: transparent;
//         z-index: 30;
//       }

//       @keyframes fadeIn {
//         from {
//           opacity: 0;
//           transform: scaleY(0.8);
//         }
//         to {
//           opacity: 1;
//           transform: scaleY(1);
//         }
//       }
      
//       .animate-fadeIn {
//         animation: fadeIn 0.2s ease-out forwards;
//         transform-origin: center left;
//       }
//     `;
//     document.head.appendChild(style);
//     return () => {
//       document.head.removeChild(style);
//     };
//   }, []);

//   // Update handleDrag to be more reliable
//   const handleDrag = (e: React.DragEvent) => {
//     e.preventDefault();
//     e.stopPropagation();
    
//     // Check if the drag contains files
//     if (e.dataTransfer.types.includes('Files')) {
//       if (e.type === "dragenter" || e.type === "dragover") {
//         setDragActive(true);
//       }
//     }
//   };

//   // Add new dragLeave handler
//   const handleDragLeave = (e: React.DragEvent) => {
//     e.preventDefault();
//     e.stopPropagation();

//     // Only deactivate if we're leaving the form element
//     if (e.currentTarget.contains(e.relatedTarget as Node)) {
//       return;
//     }
//     setDragActive(false);
//   };

//   const handleDrop = async (e: React.DragEvent) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setDragActive(false);
    
//     const items = e.dataTransfer.items;
//     if (!items) return;

//     // Check for folders first
//     for (let i = 0; i < items.length; i++) {
//       const entry = items[i].webkitGetAsEntry();
//       if (entry?.isDirectory) {
//         setShowFolderError(true);
//         setTimeout(() => setShowFolderError(false), 1000);
//         return; // Stop processing if any folder is detected
//       }
//     }

//     // If no folders, process files
//     if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
//       handleFiles(e.dataTransfer.files);
//     }
//   };

//   // Add helper function to check if file is PDF
//   const isPDFFile = (file: File): boolean => {
//     return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
//   };

//   const handleFiles = (newFiles: FileList) => {
//     // Convert FileList to Array and filter out PDF files
//     const newFileArray = Array.from(newFiles).filter(file => {
//       if (isPDFFile(file)) {
//         setShowPDFError(true);
//         setTimeout(() => setShowPDFError(false), 1000);
//         return false;
//       }
//       return true;
//     });
    
//     // If no valid files after filtering, return early
//     if (newFileArray.length === 0) return;
    
//     // Create new file entries
//     const newFileEntries = newFileArray.map(file => {
//       const url = URL.createObjectURL(file);
//       return [file.name, { file, url }] as [string, { file: File, url: string }];
//     });

//     // Update file map with new entries
//     setFileMap(prevMap => {
//       const newMap = new Map(prevMap);
//       newFileEntries.forEach(([name, data]) => {
//         // If file with same name exists, revoke its old URL
//         if (prevMap.has(name)) {
//           URL.revokeObjectURL(prevMap.get(name)!.url);
//         }
//         newMap.set(name, data);
//       });
//       return newMap;
//     });

//     // Update files array
//     setFiles(prevFiles => {
//       const existingNames = new Set(prevFiles.map(f => f.name));
//       const uniqueNewFiles = newFileArray.filter(file => !existingNames.has(file.name));
//       return [...prevFiles, ...uniqueNewFiles];
//     });
//   };

//   const removeFile = (fileToRemove: File) => {
//     // Remove from fileMap and revoke URL
//     setFileMap(prevMap => {
//       const newMap = new Map(prevMap);
//       const fileData = newMap.get(fileToRemove.name);
//       if (fileData) {
//         URL.revokeObjectURL(fileData.url);
//         newMap.delete(fileToRemove.name);
//       }
//       return newMap;
//     });

//     // Remove from files array
//     setFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
//   };

//   // Cleanup URLs on unmount
//   useEffect(() => {
//     return () => {
//       // Cleanup all URLs
//       fileMap.forEach(({ url }) => URL.revokeObjectURL(url));
//     };
//   }, []);

//   // Format file size
//   const formatFileSize = (bytes: number): string => {
//     if (bytes < 1024) return bytes + ' B';
//     if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
//     return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
//   };

//   // Get file icon based on file type
//   const getFileIcon = (file: File): ReactNode => {
//     const fileType = file.type;
//     const fileName = file.name.toLowerCase();
//     const fileExt = fileName.split('.').pop() || '';
    
//     // Code files
//     if (fileType.includes('text') || 
//         ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'py', 'java', 
//          'c', 'cpp', 'cs', 'go', 'rb', 'php', 'swift', 'kt', 'rs'].includes(fileExt)) {
//       return (
//         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
//           <polyline points="16 18 22 12 16 6"></polyline>
//           <polyline points="8 6 2 12 8 18"></polyline>
//         </svg>
//       );
//     }
    
//     // PDF files
//     if (fileType === 'application/pdf' || fileExt === 'pdf') {
//       return (
//         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
//           <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
//           <polyline points="14 2 14 8 20 8"></polyline>
//           <line x1="16" y1="13" x2="8" y2="13"></line>
//           <line x1="16" y1="17" x2="8" y2="17"></line>
//           <polyline points="10 9 9 9 8 9"></polyline>
//         </svg>
//       );
//     }
    
//     // Default file icon
//     return (
//       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
//         <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
//         <polyline points="13 2 13 9 20 9"></polyline>
//       </svg>
//     );
//   };

//   // Get file type badge text
//   const getFileTypeBadge = (file: File): string => {
//     const fileType = file.type;
//     const fileName = file.name.toLowerCase();
//     const fileExt = fileName.split('.').pop() || '';
    
//     if (fileType.startsWith('image/')) {
//       return fileType.split('/')[1].toUpperCase();
//     }
    
//     if (fileExt) {
//       return fileExt.toUpperCase();
//     }
    
//     return 'FILE';
//   };

//   // Check if file is an image
//   const isImageFile = (file: File): boolean => {
//     return file.type.startsWith('image/');
//   };

//   // Check if file is a text/code file
//   const isTextFile = (file: File): boolean => {
//     const fileType = file.type;
//     const fileName = file.name.toLowerCase();
//     const fileExt = fileName.split('.').pop() || '';
    
//     return fileType.includes('text') || 
//            ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'py', 'java', 
//             'c', 'cpp', 'cs', 'go', 'rb', 'php', 'swift', 'kt', 'rs'].includes(fileExt);
//   };

//   // Read text file content for preview
//   const readTextFileContent = async (file: File): Promise<string> => {
//     return new Promise((resolve) => {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const content = e.target?.result as string || '';
//         // Return first few lines
//         const lines = content.split('\n').slice(0, 10).join('\n');
//         resolve(lines);
//       };
//       reader.onerror = () => resolve('Error reading file');
//       reader.readAsText(file);
//     });
//   };

//    // 수정된 숏컷 팝업 UI - 하이라이팅, 애니메이션 추가
//    const renderShortcutsPopup = () => {
//     if (!showShortcuts) return null;
    
//     const positionClass = popupPosition === 'top' 
//       ? 'bottom-full mb-2' 
//       : 'top-full mt-2';
    
//     return (
//       <div className={`absolute ${positionClass} left-0 right-0 z-40`}>
//         <div className="bg-[var(--background)]/95 backdrop-blur-xl shortcuts-container">
//           {/* 커스터마이징 버튼 */}
//           <button
//             onClick={() => {
//               closeShortcutsPopup();
//               openShortcutsDialog();
//             }}
//             className="w-full px-4 py-3 text-left transition-all duration-300 group relative overflow-hidden bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20"
//           >
//             <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/10 to-transparent opacity-100 transition-opacity duration-300" />
//             <div className="flex items-center justify-between relative">
//               <div className="flex items-center gap-3">
//                 <div className="w-6 h-6 rounded-md bg-[var(--accent)]/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
//                   <svg 
//                     width="14" 
//                     height="14" 
//                     viewBox="0 0 24 24" 
//                     fill="none" 
//                     stroke="currentColor" 
//                     strokeWidth="1.5" 
//                     strokeLinecap="round" 
//                     className="text-[var(--foreground)] transition-colors transform rotate-0 duration-300"
//                   >
//                     <line x1="12" y1="5" x2="12" y2="19" />
//                     <line x1="5" y1="12" x2="19" y2="12" />
//                   </svg>
//                 </div>
//                 <div className="flex flex-col items-start gap-0.5">
//                   <span className="text-xs tracking-wide text-[var(--foreground)] transition-colors font-medium">
//                   CLICK TO CUSTOMIZE SHORTCUTS
//                   </span>
//                   <span className="text-[10px] text-[var(--muted)] transition-colors">
//                     Add or modify your custom prompts
//                   </span>
//                 </div>
//               </div>
//             </div>
//           </button>
          
//           {/* 스크롤 가능한 숏컷 목록 */}
//           <div 
//             ref={shortcutsListRef}
//             className="max-h-60 overflow-y-auto"
//           >
//             {shortcuts.length > 0 ? (
//               shortcuts.map((shortcut, index) => {
//                 // 이름 하이라이팅 처리
//                 const name = shortcut.name;
//                 const highlightRanges = shortcut.highlight_ranges || [];
                
//                 // 하이라이트된 이름 생성
//                 let highlightedName;
                
//                 if (highlightRanges.length > 0 && searchTerm) {
//                   // DB에서 전달받은 하이라이트 범위 사용
//                   const parts: React.ReactNode[] = [];
//                   let lastEnd = 0;
                  
//                   highlightRanges.forEach(range => {
//                     // 하이라이트 전 텍스트
//                     if (range.start > lastEnd) {
//                       parts.push(name.substring(lastEnd, range.start));
//                     }
                    
//                     // 하이라이트된 부분
//                     parts.push(
//                       <span key={`${range.start}-${range.end}`} className="highlight">
//                         {name.substring(range.start, range.end)}
//                       </span>
//                     );
                    
//                     lastEnd = range.end;
//                   });
                  
//                   // 남은 부분
//                   if (lastEnd < name.length) {
//                     parts.push(name.substring(lastEnd));
//                   }
                  
//                   highlightedName = <>{parts}</>;
//                 } else {
//                   // 기본 이름 표시
//                   highlightedName = name;
//                 }
                
//                 return (
//                   <button
//                     key={shortcut.id}
//                     onClick={() => handleShortcutSelect(shortcut)}
//                     className={`shortcut-item ${index === selectedIndex ? 'selected' : ''}`}
//                   >
//                     {index === selectedIndex && <div className="indicator" />}
//                     <div className="flex flex-col gap-1">
//                       <span className="text-sm font-medium tracking-wide">
//                         @{highlightedName}
//                       </span>
//                       <span className="text-xs line-clamp-2 text-[var(--muted)]">
//                         {shortcut.content.substring(0, 80)}{shortcut.content.length > 80 ? '...' : ''}
//                       </span>
//                     </div>
//                   </button>
//                 );
//               })
//             ) : (
//               <div className="px-4 py-3 text-sm text-[var(--muted)] text-center">
//                 No shortcuts found
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     );
//   };


//   return (
//     <div className="relative">
//       <form 
//         ref={formRef} 
//         onSubmit={handleMessageSubmit} 
//         className={`flex flex-col gap-2 sticky bottom-0 bg-transparent p-1 md:p-0
//           ${dragActive ? 'drag-target-active' : ''}`}
//         onDragEnter={handleDrag}
//         onDragOver={handleDrag}
//         onDragLeave={handleDragLeave}
//         onDrop={handleDrop}
//       >
//         {/* File Preview Section - Updated for all file types */}
//         {files.length > 0 && (
//           <div className="absolute bottom-full right-0 mb-4 bg-[var(--background)]/80 image-preview-container p-4 max-w-[80%] max-h-[200px] ml-auto">
//             <div className="flex gap-4 image-preview-scroll" style={{ maxWidth: '100%' }}>
//               {files.map((file) => {
//                 const fileData = fileMap.get(file.name);
//                 if (!fileData) return null;

//                 return isImageFile(file) ? (
//                   // Image preview
//                   <div key={file.name} className="relative group image-preview-item flex-shrink-0">
//                     <div className="preview-overlay"></div>
//                     <span className="file-type-badge">{getFileTypeBadge(file)}</span>
//                     <img
//                       src={fileData.url}
//                       alt={`Preview ${file.name}`}
//                       className="w-24 h-24 object-cover preview-img"
//                     />
//                     <button
//                       onClick={() => removeFile(file)}
//                       className="remove-file-btn"
//                       type="button"
//                       aria-label="Remove file"
//                     >
//                       ×
//                     </button>
//                   </div>
//                 ) : (
//                   // Non-image file preview
//                   <div key={file.name} className="relative group file-preview-item flex-shrink-0">
//                     <span className="file-type-badge">{getFileTypeBadge(file)}</span>
//                     <div className="file-icon">
//                       {getFileIcon(file)}
//                     </div>
//                     <div className="file-name">{file.name}</div>
//                     <div className="file-size">{formatFileSize(file.size)}</div>
//                     <button
//                       onClick={() => removeFile(file)}
//                       className="remove-file-btn"
//                       type="button"
//                       aria-label="Remove file"
//                     >
//                       ×
//                     </button>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         )}

//         {/* Error Toasts */}
//         {showPDFError && (
//           <div className="absolute bottom-full mb-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fadeIn z-50">
//             <div className="flex items-center gap-2">
//               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                 <circle cx="12" cy="12" r="10" />
//                 <line x1="12" y1="8" x2="12" y2="12" />
//                 <line x1="12" y1="16" x2="12.01" y2="16" />
//               </svg>
//               <span>PDF files are not supported</span>
//             </div>
//           </div>
//         )}

//         {showFolderError && (
//           <div className="absolute bottom-full mb-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fadeIn z-50">
//             <div className="flex items-center gap-2">
//               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                 <circle cx="12" cy="12" r="10" />
//                 <line x1="12" y1="8" x2="12" y2="12" />
//                 <line x1="12" y1="16" x2="12.01" y2="16" />
//               </svg>
//               <span>Folders cannot be uploaded</span>
//             </div>
//           </div>
//         )}

//         {/* Drag & Drop Zone */}
//         <div 
//           className={`relative transition-all duration-300 ${dragActive ? 'scale-[1.01]' : ''}`}
//           onDragEnter={handleDrag}
//           onDragLeave={handleDragLeave}
//           onDragOver={handleDrag}
//           onDrop={handleDrop}
//         >
//           <input
//             type="file"
//             accept="image/*,text/*" // Remove PDF from accepted types
//             onChange={(e) => {
//               if (e.target.files) {
//                 handleFiles(e.target.files);
//               }
//             }}
//             ref={fileInputRef}
//             className="hidden"
//             multiple
//           />
          
//           <div className="flex gap-0 items-center input-container py-2">
//             {/* File upload button - Updated for all file types */}
//             <button
//               type="button"
//               onClick={() => fileInputRef.current?.click()}
//               className={`upload-button futuristic-button w-10 h-10 flex items-center justify-center transition-all hover:bg-[var(--accent)]/20 ${files.length ? 'upload-button-active' : ''}`}
//               title="Upload files"
//             >
//               <div className="upload-button-indicator"></div>
//               {files.length ? (
//                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon opacity-80">
//                   <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
//                 </svg>
//               ) : (
//                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon opacity-50 hover:opacity-80 transition-opacity">
//                   <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
//                 </svg>
//               )}
//             </button>

//             <div
//               ref={inputRef}
//               contentEditable
//               onInput={handleInputWithShortcuts}
//               onPaste={handlePaste}
//               onKeyDown={handleKeyDown}
//               onFocus={() => setIsFocused(true)}
//               onBlur={() => setIsFocused(false)}
//               className={`yeezy-input futuristic-input flex-1 transition-all duration-300 py-2 px-2
//                 ${isFocused ? 'focused' : ''}
//                 ${isThemeChanging ? 'theme-changing' : ''}
//                 ${!isFocused && !isThemeChanging ? 'bg-transparent' : ''}`}
//               style={{ 
//                 minHeight: '44px',
//                 maxHeight: window.innerWidth <= 768 ? '120px' : '200px',
//                 lineHeight: '1.5',
//                 wordBreak: 'break-word',
//                 overflowWrap: 'break-word'
//               }}
//               data-placeholder={placeholder}
//               suppressContentEditableWarning
//             />

//             {isLoading ? (
//               <button 
//                 onClick={(e) => { e.preventDefault(); stop(); }} 
//                 type="button"
//                 className="futuristic-button w-10 h-10 flex items-center justify-center transition-all hover:bg-[var(--accent)]/30"
//                 aria-label="Stop generation"
//               >
//                 <span className="text-red-500 flex items-center justify-center w-3 h-3">■</span>
//               </button>
//             ) : (
//               <button 
//                 type="submit" 
//                 className={`futuristic-button w-10 h-10 flex items-center justify-center transition-all hover:bg-[var(--accent)]/30`}
//                 disabled={disabled || isLoading}
//                 aria-label="Send message"
//               >
//                 <span className="flex items-center justify-center leading-none">↑</span>
//               </button>
//             )}
//           </div>
//         </div>

//         {/* Drag & Drop Overlay - Updated with folder restriction */}
//         {dragActive && (
//           <div 
//             className="absolute inset-0 drag-upload-overlay
//                      flex items-center justify-center transition-all duration-300 z-50"
//           >
//             <div className="flex flex-col items-center gap-3 transform transition-transform duration-300 scale-100 hover:scale-105">
//               <div className="drag-upload-icon">
//                 <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
//                   <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
//                   <polyline points="17 8 12 3 7 8" />
//                   <line x1="12" y1="3" x2="12" y2="15" />
//                 </svg>
//               </div>
//               <div className="flex flex-col items-center text-center">
//                 <span className="drag-upload-text">Drop files here</span>
//                 <span className="text-xs text-red-400 mt-0.5">(PDF files and folders not supported)</span>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Shortcuts Popup - Added higher z-index */}
//         {renderShortcutsPopup()}
//       </form>
//     </div>
//   );
// } 