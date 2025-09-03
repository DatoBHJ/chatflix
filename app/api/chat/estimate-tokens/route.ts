import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { estimateTokenCount, estimateMultiModalTokens, estimateFileTokens } from '@/utils/context-manager';

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