import React from 'react'

// URL을 자동으로 감지하여 링크로 변환하는 유틸리티 함수
export function linkifyText(text: string): React.ReactNode[] {
  // URL 패턴 (http, https로 시작하는 URL 감지)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  const parts = text.split(urlRegex);
  const result: React.ReactNode[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.match(urlRegex)) {
      // URL인 경우 a 태그로 감싸기
      result.push(
        <a 
          key={i} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="underline break-all"
        >
          {part}
        </a>
      );
    } else if (part) {
      // 일반 텍스트인 경우 그대로 추가
      result.push(<React.Fragment key={i}>{part}</React.Fragment>);
    }
  }
  
  return result;
} 