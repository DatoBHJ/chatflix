/**
 * 토큰 수 추정 함수 - 서버 사이드에서는 tiktoken, 클라이언트에서는 추정
 */
export function estimateTokenCount(text: string, model: string = 'gpt-4'): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // 서버 사이드에서만 tiktoken 사용 (Node.js 환경)
  if (typeof window === 'undefined') {
    try {
      // 동적 import로 tiktoken 로드 (서버 사이드에서만)
      const { encoding_for_model } = require('tiktoken');
      
      // 1단계: 기본 모델로 시도
      try {
        const encoding = encoding_for_model(model as any);
        const tokens = encoding.encode(text);
        return tokens.length;
      } catch (error) {
        console.warn(`tiktoken failed for model ${model}, trying gpt-4:`, error);
        
        // 2단계: gpt-4로 시도
        try {
          const encoding = encoding_for_model('gpt-4' as any);
          const tokens = encoding.encode(text);
          return tokens.length;
        } catch (error2) {
          console.warn('tiktoken failed for gpt-4, using fallback estimation:', error2);
          // 3단계로 진행
        }
      }
    } catch (importError) {
      console.warn('tiktoken import failed, using fallback estimation:', importError);
      // 3단계로 진행
    }
  }

  // 3단계: 옛날 방식 (텍스트 길이 기반 추정) - 클라이언트 사이드 또는 tiktoken 실패 시
  const isMainlyKorean = /[\uAC00-\uD7AF]/.test(text) && 
                         (text.match(/[\uAC00-\uD7AF]/g)?.length || 0) / text.length > 0.3;
  
  if (isMainlyKorean) {
    return Math.ceil(text.length / 1.5); // 한글은 더 많은 토큰 사용
  }
  return Math.ceil(text.length / 4); // 영어 기준
}

export interface Message {
  // v4/v5 mixed support: either content (legacy) or parts (AI SDK v5)
  content?: string | Array<any>;
  parts?: Array<any>;
  experimental_attachments?: Array<{
    fileType?: string;
    contentType?: string;
    name?: string;
    url: string;
    path?: string;
    metadata?: {
      estimatedTokens: number;
    };
  }>;
}

// 🆕 개선된 멀티모달 토큰 추정 함수 (실제 토큰 사용량 우선 사용)
export function estimateMultiModalTokens(msg: Message): number {
  // 🆕 새로운 token_usage 구조에서 실제 토큰 사용량 우선 확인
  if ((msg as any).token_usage) {
    const tokenUsage = (msg as any).token_usage;
    
    // usage와 totalUsage 분리 저장 구조에 맞게 처리
    if (tokenUsage.totalUsage?.totalTokens) {
      return tokenUsage.totalUsage.totalTokens;
    } else if (tokenUsage.usage?.totalTokens) {
      return tokenUsage.usage.totalTokens;
    } else if (tokenUsage.totalTokens) {
      // 기존 단일 구조 호환성
      return tokenUsage.totalTokens;
    }
  }

  // 🆕 백워드 호환성: 기존 tool_results에서도 확인 (마이그레이션 전 데이터)
  if ((msg as any).tool_results?.token_usage) {
    const tokenUsage = (msg as any).tool_results.token_usage;
    
    if (tokenUsage.totalUsage?.totalTokens) {
      return tokenUsage.totalUsage.totalTokens;
    } else if (tokenUsage.usage?.totalTokens) {
      return tokenUsage.usage.totalTokens;
    } else if (tokenUsage.totalTokens) {
      return tokenUsage.totalTokens;
    }
  }
  
  // 🔧 실제 토큰 사용량이 없는 경우에만 예측 로직 사용 (백업용)
  // 실제 토큰 사용량을 우선 사용하므로 이 부분은 거의 사용되지 않음
  /*
  let total = 0;

  // v5 parts 우선 처리
  if (Array.isArray(msg.parts)) {
    for (const part of msg.parts) {
      if (part.type === 'text') {
        total += estimateTokenCount(part.text || '');
      } else if (part.type === 'image') {
        total += 1000;
      } else if (part.type === 'file') {
        const filename = (part.filename || '').toLowerCase();
        const contentType = part.mediaType || '';
        if (filename.endsWith('.pdf') || contentType === 'application/pdf') {
          total += 5000;
        } else if (filename.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
          total += 3000;
        } else if (contentType?.startsWith('image/') || filename.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
          total += 1000;
        } else {
          total += 2000;
        }
      }
    }
  } else if (typeof msg.content === 'string') {
    // 텍스트 콘텐츠
    total += estimateTokenCount(msg.content);
  } else if (Array.isArray(msg.content)) {
    // 멀티모달 콘텐츠 (이미지, 파일 등) - 레거시 content 배열
    for (const part of msg.content) {
      if (part.type === 'text') {
        total += estimateTokenCount(part.text || '');
      } else if (part.type === 'image') {
        total += 1000;
      } else if (part.type === 'file') {
        const filename = part.file?.name?.toLowerCase() || '';
        const contentType = part.file?.contentType || '';
        if (filename.endsWith('.pdf') || contentType === 'application/pdf') {
          total += 5000;
        } else if (filename.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
          total += 3000;
        } else if (contentType?.startsWith('image/') || filename.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
          total += 1000;
        } else {
          total += 2000;
        }
      }
    }
  } else if (msg.content !== undefined) {
    // 기타 형식
    total += estimateTokenCount(JSON.stringify(msg.content));
  }
  
  // experimental_attachments 처리 (메타데이터 기반 정확한 추정)
  if (Array.isArray(msg.experimental_attachments)) {
    for (const attachment of msg.experimental_attachments) {
      // 메타데이터가 있으면 정확한 토큰 수 사용
      if (attachment.metadata && attachment.metadata.estimatedTokens) {
        total += attachment.metadata.estimatedTokens;
      } else {
        // 메타데이터가 없으면 기존 방식 사용
        if (attachment.fileType === 'image' || 
            (attachment.contentType && attachment.contentType.startsWith('image/'))) {
          total += 1000;
        } else if (attachment.fileType === 'pdf' || 
                   attachment.contentType === 'application/pdf') {
          total += 5000;
        } else if (attachment.fileType === 'code') {
          total += 3000;
        } else {
          total += 2000; // 기타 파일
        }
      }
    }
  }
  
  return total;
  */
  
  // 🔧 실제 토큰 사용량이 없는 경우 기본값 반환 (예측 로직 대신)
  return 0;
}

// 파일 타입별 토큰 추정 함수
export function estimateFileTokens(file: {
  name: string;
  type: string;
  size?: number;
  metadata?: { estimatedTokens?: number };
}): number {
  // 메타데이터에 정확한 토큰 수가 있으면 사용
  if (file.metadata?.estimatedTokens) {
    return file.metadata.estimatedTokens;
  }

  const filename = file.name.toLowerCase();
  const contentType = file.type;

  // 파일 타입별 토큰 추정 (백엔드 로직과 동일)
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

// 첨부파일 토큰 추정 함수 (attachment 객체용)
export function estimateAttachmentTokens(attachment: {
  fileType?: string;
  contentType?: string;
  name?: string;
  metadata?: { estimatedTokens?: number };
}): number {
  // 메타데이터에 정확한 토큰 수가 있으면 사용
  if (attachment.metadata?.estimatedTokens) {
    return attachment.metadata.estimatedTokens;
  }

  // 파일 타입별 토큰 추정
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