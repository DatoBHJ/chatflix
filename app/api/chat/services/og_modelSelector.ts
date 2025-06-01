
// - 멀티모달 요소: 이미지/PDF 포함 여부
// - 복잡도: 단순/중간/복잡
// - 카테고리: 코드/기술(논리, 과학, 추론 … )/수학/기타(글쓰기, 소설, 시…)

// —
// # chatflix-ultimate : 

// # 카테고리가 코딩인지 최우선 고려 (최우선 라우팅) 
// 비멀티모달 + 복잡도 무상관  + 코딩 -> gpt-4.1

// 멀티모달 + 단순 + 코딩 -> gpt-4.1
// 멀티모달 + 중간 + 코딩 -> gpt-4.1
// 멀티모달 + 복잡 + 코딩 -> gemini 2.5 pro


// # 멀티모달 인경우 
// 이미지 + 단순 + 기타→  gemini 2.0 flash
// 이미지 + 중간 + 기타 -> gemini 2.5 flash
// 이미지 + 복잡 + 기타 -> gemini 2.5 pro

// 이미지 + 복잡도 무상관 + 기술/수학 → gemini 2.5 pro

// PDF + 단순 + 카테고리 무상관→  gemini 2.0 flash
// PDF + 중간 + 카테고리 무상관 -> gemini 2.5 flash
// PDF + 복잡 + 카테고리 무상관 -> gemini 2.5 pro

// # 멀티모달 없는 경우 (이미지/pdf 없는경우) 
// 비멀티모달 + 복잡도 무상관 + 수학 -> deepseek-ai/DeepSeek-R1

// 비멀티모달 + 단순 + 기술 -> grok-3-fast
// 비멀티모달 + 복잡/중간 + 기술 -> grok-3-mini-fast

// 비멀티모달 + 단순 + 기타 -> gpt-4.1-mini
// 비멀티모달 + 중간/복잡 + 기타 -> gpt-4.1

// # 카테고리
// 이미지 + 기술/수학 -> gemini 2.5 pro

// —
// # chatflix-ultimate-pro (새모델): 

// # 카테고리가 코딩인지 최우선 고려 (최우선 라우팅) 
// 비멀티모달 + 단순 + 코딩 -> sonnet 4 
// 비멀티모달 + 중간 + 코딩 -> sonnet 4 
// 비멀티모달 + 복잡 + 코딩 -> sonnet 4 thinking

// 멀티모달 + 단순 + 코딩 -> sonnet 4 
// 멀티모달 + 중간 + 코딩 -> gemini 2.5 pro
// 멀티모달 + 복잡 + 코딩 -> gemini 2.5 pro


// # 멀티모달 인경우 
// 이미지 + 단순 + 기타→  gemini 2.5 flash
// 이미지 + 중간 + 기타 -> gemini 2.5 flash
// 이미지 + 복잡 + 기타 -> gemini 2.5 pro

// 이미지 + 복잡도 무상관 + 기술/수학 → gemini 2.5 pro

// PDF + 단순 + 카테고리 무상관→  gemini 2.5 flash
// PDF + 중간 + 카테고리 무상관 -> gemini 2.5 flash
// PDF + 복잡 + 카테고리 무상관 -> gemini 2.5 pro

// # 멀티모달 없는 경우 (이미지/pdf 없는경우) 
// 비멀티모달 + 복잡도 무상관 + 수학 -> deepseek-ai/DeepSeek-R1

// 비멀티모달 + 단순 + 기술 -> grok-3-fast
// 비멀티모달 + 복잡/중간 + 기술 -> grok-3-mini-fast

// 비멀티모달 + 단순/중간 + 기타 -> sonnet 4 
// 비멀티모달 + 복잡 + 기타 -> sonnet 4 thinking

// # 카테고리
// 이미지 + 기술/수학 -> gemini 2.5 pro

// —


import { generateObject } from 'ai';
import { providers } from '@/lib/providers';
import { z } from 'zod';

interface Message {
  content: string | Array<any>;
  experimental_attachments?: Array<{
    fileType?: string;
    contentType?: string;
    name?: string;
    url: string;
    path?: string;
  }>;
}

interface ModelSelectionResult {
  selectedModel: string;
  analysis: {
    category: 'coding' | 'technical' | 'math' | 'other';
    complexity: 'simple' | 'medium' | 'complex';
    hasImage: boolean;
    hasPDF: boolean;
    hasCodeAttachment: boolean;
  };
}

export async function selectOptimalModel(
  messages: Message[], 
  modelType: 'chatflix-ultimate' | 'chatflix-ultimate-pro' = 'chatflix-ultimate'
): Promise<ModelSelectionResult> {
  // 사용자의 마지막 메시지 추출
  const lastUserMessage = messages[messages.length - 1];
  let lastUserContent = '';
  
  // 텍스트 콘텐츠 추출
  if (typeof lastUserMessage.content === 'string') {
    lastUserContent = lastUserMessage.content;
  } else if (Array.isArray(lastUserMessage.content)) {
    // 멀티모달 메시지에서 텍스트 부분 추출
    const textParts = lastUserMessage.content
      .filter((part: { type: string }) => part.type === 'text')
      .map((part: { text: string }) => part.text);
    lastUserContent = textParts.join('\n');
  }
  
  // 멀티모달 요소 감지
  const hasImageInMessage = detectImages(lastUserMessage);
  const hasPDFInMessage = detectPDFs(lastUserMessage);
  const hasImageInHistory = messages.slice(0, -1).some(msg => detectImages(msg));
  const hasPDFInHistory = messages.slice(0, -1).some(msg => detectPDFs(msg));
  
  const hasImage = hasImageInMessage || hasImageInHistory;
  const hasPDF = hasPDFInMessage || hasPDFInHistory;
  
  try {
    // Gemini 2.0 Flash로 쿼리 분석
    const analysisResult = await generateObject({
      model: providers.languageModel('gemini-2.0-flash'),
      schema: z.object({
        category: z.enum(['coding', 'technical', 'math', 'other']),
        complexity: z.enum(['simple', 'medium', 'complex']),
      }),
      prompt: `Analyze this query and classify it:
        
        Query: "${lastUserContent}"
        
        1. Category: 
          - 'coding' if it's about programming, code review, debugging, etc.
          - 'technical' if it's about science, logic, reasoning
          - 'math' if it's about mathematics, calculations, statistics, etc.
          - 'other' for creative writing, stories, or general knowledge
        
        2. Complexity:
          - 'simple' for straightforward questions with clear answers
          - 'medium' for questions requiring some analysis
          - 'complex' for questions requiring deep reasoning or expertise

        Provide a brief reasoning for your classification.`
    });
    
    const analysis = analysisResult.object;
    
    // 코드 파일 첨부 감지
    const hasCodeAttachment = detectCodeAttachments(lastUserMessage);
    
    // 코드 첨부 파일이 있으면 코딩 카테고리로 강제 설정
    if (hasCodeAttachment) {
      analysis.category = 'coding';
    }
    
    // 모델 선택 로직
    const selectedModel = selectModelBasedOnAnalysis(analysis, hasImage, hasPDF, modelType);
    
    console.log('Model Selection Result:', {
      selectedModel,
      category: analysis.category,
      complexity: analysis.complexity,
      hasImage,
      hasPDF,
      hasCodeAttachment
    });
    
    return {
      selectedModel,
      analysis: {
        category: analysis.category,
        complexity: analysis.complexity,
        hasImage,
        hasPDF,
        hasCodeAttachment
      }
    };
    
  } catch (error) {
    console.error('Error in Chatflix Ultimate routing:', error);
    // 오류 발생 시 기본 모델 사용
    return {
      selectedModel: 'gemini-2.5-pro-preview-05-06',
      analysis: {
        category: 'other',
        complexity: 'medium',
        hasImage,
        hasPDF,
        hasCodeAttachment: false
      }
    };
  }
}

function detectImages(message: Message): boolean {
  // experimental_attachments 배열을 확인
  if (Array.isArray(message.experimental_attachments)) {
    return message.experimental_attachments.some((attachment) => 
      attachment.fileType === 'image' || 
      (attachment.contentType && attachment.contentType.startsWith('image/')) ||
      (attachment.name && attachment.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i))
    );
  }
  
  // 기존 방식 (content 배열) 확인도 유지
  if (Array.isArray(message.content)) {
    return message.content.some((part: { type: string }) => part.type === 'image') ||
      message.content.some((part: any) => 
        part.type === 'file' && 
        (part.file?.contentType?.startsWith('image/') || 
        part.file?.name?.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i))
      );
  }
  
  return false;
}

function detectPDFs(message: Message): boolean {
  // experimental_attachments 배열을 확인
  if (Array.isArray(message.experimental_attachments)) {
    return message.experimental_attachments.some((attachment) => 
      attachment.fileType === 'pdf' || 
      attachment.contentType === 'application/pdf' ||
      (attachment.name && attachment.name.toLowerCase().endsWith('.pdf'))
    );
  }
  
  // 기존 방식 (content 배열) 확인도 유지
  if (Array.isArray(message.content)) {
    return message.content.some((part: any) => 
      (part.type === 'file' && part.file?.name?.toLowerCase().endsWith('.pdf')) ||
      (part.type === 'file' && part.file?.contentType === 'application/pdf')
    );
  }
  
  return false;
}

function detectCodeAttachments(message: Message): boolean {
  return Array.isArray(message.experimental_attachments) && 
    message.experimental_attachments.some((attachment) => 
      attachment.fileType === 'code' || 
      (attachment.name && attachment.name.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml)$/i))
    );
}

function selectModelBasedOnAnalysis(
  analysis: { category: 'coding' | 'technical' | 'math' | 'other'; complexity: 'simple' | 'medium' | 'complex' },
  hasImage: boolean,
  hasPDF: boolean,
  modelType: 'chatflix-ultimate' | 'chatflix-ultimate-pro' = 'chatflix-ultimate'
): string {
  // 1단계: 코딩 카테고리 최우선 처리
  if (analysis.category === 'coding') {
    if (modelType === 'chatflix-ultimate-pro') {
      // Pro 버전 코딩 로직
      if (hasImage || hasPDF) {
        // 멀티모달 + 코딩
        if (analysis.complexity === 'simple') {
          return 'claude-sonnet-4-20250514'; // sonnet 4
        } else { // medium/complex
          return 'gemini-2.5-pro-preview-05-06'; // gemini 2.5 pro
        }
      } else {
        // 비멀티모달 + 코딩
        if (analysis.complexity === 'complex') {
          return 'claude-sonnet-4-20250514-thinking'; // sonnet 4 thinking
        } else { // simple/medium
          return 'claude-sonnet-4-20250514'; // sonnet 4
        }
      }
    } else {
      // 일반 버전 코딩 로직
      if (hasImage || hasPDF) {
        // 멀티모달 + 코딩
        if (analysis.complexity === 'complex') {
          return 'gemini-2.5-pro-preview-05-06'; // gemini 2.5 pro
        } else { // simple/medium
          return 'gpt-4.1'; // gpt-4.1
        }
      } else {
        // 비멀티모달 + 코딩: 복잡도 무상관 gpt-4.1
        return 'gpt-4.1';
      }
    }
  }
  
  // 2단계: 멀티모달 요소 처리
  else if (hasImage) {
    if (analysis.category === 'technical' || analysis.category === 'math') {
      // 이미지 + 기술/수학은 무조건 gemini 2.5 pro
      return 'gemini-2.5-pro-preview-05-06';
    } else {
      // 이미지 + 기타 카테고리
      if (modelType === 'chatflix-ultimate-pro') {
        // Pro 버전: 단순/중간은 gemini 2.5 flash, 복잡은 gemini 2.5 pro
        if (analysis.complexity === 'complex') {
          return 'gemini-2.5-pro-preview-05-06';
        } else { // simple/medium
          return 'gemini-2.5-flash-preview-04-17';
        }
      } else {
        // 일반 버전
        if (analysis.complexity === 'simple') {
          return 'gemini-2.0-flash';
        } else if (analysis.complexity === 'medium') {
          return 'gemini-2.5-flash-preview-04-17';
        } else { // complex
          return 'gemini-2.5-pro-preview-05-06';
        }
      }
    }
  }
  else if (hasPDF) {
    // PDF 처리 (카테고리 무관)
    if (modelType === 'chatflix-ultimate-pro') {
      // Pro 버전: 모든 복잡도에서 gemini 2.5 flash (단순/중간), gemini 2.5 pro (복잡)
      if (analysis.complexity === 'complex') {
        return 'gemini-2.5-pro-preview-05-06';
      } else { // simple/medium
        return 'gemini-2.5-flash-preview-04-17';
      }
    } else {
      // 일반 버전
      if (analysis.complexity === 'simple') {
        return 'gemini-2.0-flash';
      } else if (analysis.complexity === 'medium') {
        return 'gemini-2.5-flash-preview-04-17';
      } else { // complex
        return 'gemini-2.5-pro-preview-05-06';
      }
    }
  }
  
  // 3단계: 텍스트만 있는 경우 (비멀티모달)
  else {
    if (analysis.category === 'math') {
      // 수학 카테고리는 복잡도 무관 DeepSeek-R1
      return 'deepseek-ai/DeepSeek-R1';
    }
    else if (analysis.category === 'technical') {
      // 기술 카테고리는 복잡도에 따라 분기
      if (analysis.complexity === 'simple') {
        return 'grok-3-fast';
      } else { // medium/complex
        return 'grok-3-mini-fast';
      }
    }
    else {
      // 기타 카테고리
      if (modelType === 'chatflix-ultimate-pro') {
        // Pro 버전: 단순/중간은 sonnet 4, 복잡은 sonnet 4 thinking
        if (analysis.complexity === 'complex') {
          return 'claude-sonnet-4-20250514-thinking';
        } else { // simple/medium
          return 'claude-sonnet-4-20250514';
        }
      } else {
        // 일반 버전
        if (analysis.complexity === 'simple') {
          return 'gpt-4.1-mini';
        } else { // medium/complex
          return 'gpt-4.1';
        }
      }
    }
  }
}



