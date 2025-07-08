import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { estimateTokenCount } from '@/utils/context-manager';
import { estimateMultiModalTokens } from '../services/modelSelector';

interface TokenEstimationRequest {
  messages?: any[];
  currentInput?: string;
  files?: {
    name: string;
    type: string;
    size: number;
    metadata?: {
      estimatedTokens?: number;
    };
  }[];
}

interface TokenEstimationResponse {
  conversationTokens: number;
  inputTokens: number;
  fileTokens: number;
  totalTokens: number;
  breakdown: {
    textTokens: number;
    imageTokens: number;
    pdfTokens: number;
    codeFileTokens: number;
    otherFileTokens: number;
    fileDetails: {
      name: string;
      type: string;
      estimatedTokens: number;
    }[];
  };
}

// 파일 타입별 토큰 추정 함수
function estimateFileTokens(file: {
  name: string;
  type: string;
  size: number;
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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 사용자 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: TokenEstimationRequest = await request.json();
    const { messages = [], currentInput = '', files = [] } = body;

    // 1. 대화 히스토리 토큰 수 계산
    const conversationTokens = messages.reduce((total, message) => {
      return total + estimateMultiModalTokens(message);
    }, 0);

    // 2. 현재 입력 토큰 수 계산
    const inputTokens = estimateTokenCount(currentInput);

    // 3. 파일 토큰 수 계산 및 세부 정보
    let fileTokens = 0;
    let imageTokens = 0;
    let pdfTokens = 0;
    let codeFileTokens = 0;
    let otherFileTokens = 0;
    
    const fileDetails = files.map(file => {
      const tokens = estimateFileTokens(file);
      fileTokens += tokens;

      // 파일 타입별 분류
      if (file.type.startsWith('image/')) {
        imageTokens += tokens;
      } else if (file.type === 'application/pdf') {
        pdfTokens += tokens;
      } else if (file.name.toLowerCase().match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
        codeFileTokens += tokens;
      } else {
        otherFileTokens += tokens;
      }

      return {
        name: file.name,
        type: file.type,
        estimatedTokens: tokens
      };
    });

    // 4. 총 토큰 수 계산
    const totalTokens = conversationTokens + inputTokens + fileTokens;

    const response: TokenEstimationResponse = {
      conversationTokens,
      inputTokens,
      fileTokens,
      totalTokens,
      breakdown: {
        textTokens: conversationTokens + inputTokens,
        imageTokens,
        pdfTokens,
        codeFileTokens,
        otherFileTokens,
        fileDetails
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Token estimation error:', error);
    return NextResponse.json(
      { error: 'Failed to estimate tokens' },
      { status: 500 }
    );
  }
} 