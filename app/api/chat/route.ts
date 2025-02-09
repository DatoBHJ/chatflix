import { Message, streamText } from 'ai';
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { providers } from '@/lib/providers'
import { ChatRequest, MessagePart, CompletionResult } from '@/lib/types'

export const runtime = 'edge';

// 메시지 형식을 정규화하는 함수
function normalizeMessages(messages: Message[], targetModel: string) {
  return messages.map(msg => {
    // assistant 메시지만 처리
    if (msg.role === 'assistant') {
      // content가 비어있고 parts가 있는 경우 (중단된 DeepSeek 응답)
      if (!msg.content && msg.parts) {
        // parts에서 텍스트만 추출하여 content로 변환
        const textParts = msg.parts
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join('\n');
        
        // reasoning이 있는 경우 (DeepSeek -> 다른 모델)
        const reasoningParts = msg.parts
          .filter(part => part.type === 'reasoning')
          .map(part => part.reasoning)
          .join('\n');

        // 최종 content 생성
        const content = [
          reasoningParts && `Reasoning: ${reasoningParts}`,
          textParts
        ].filter(Boolean).join('\n\n');

        return {
          ...msg,
          content: content || "Incomplete response",  // 빈 응답 방지
        };
      }
    }
    return msg;
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Received request body:', body);
    
    const { messages, model }: ChatRequest = body;
    
    // 메시지 유효성 검사
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('Invalid messages:', messages);
      return NextResponse.json(
        { error: 'Invalid messages format' },
        { status: 400 }
      );
    }

    // 1. 새로운 사용자 메시지 저장
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage.role === 'user') {
      await supabase.from('messages').insert([{
        id: Date.now().toString(),
        content: lastUserMessage.content,
        role: 'user',
        created_at: new Date().toISOString(),
        model,
        host: model
      }]);
    }

    const selectedModel = providers.languageModel(model);
    if (!selectedModel) {
      return NextResponse.json({ error: 'Invalid model' }, { status: 400 });
    }

    // 메시지 형식 정규화
    const normalizedMessages = normalizeMessages(messages, model);

    // 2. AI 응답을 위한 초기 레코드 생성
    const assistantMessageId = Date.now().toString();
    await supabase.from('messages').insert([{
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      reasoning: '',  // 초기 reasoning 필드
      created_at: new Date().toISOString(),
      model,
      host: model
    }]);

    // 3. 스트리밍 응답 설정
    const result = streamText({
      model: selectedModel,
      messages: normalizedMessages,
      temperature: 0.7,
      maxTokens: 1000,
      onFinish: async (completion: CompletionResult) => {
        let finalContent = '';
        let finalReasoning = '';

        console.log('Completion:', completion);

        // steps 배열의 첫 번째 항목에서 text와 reasoning 추출
        if (completion.steps?.[0]) {
          const step = completion.steps[0];
          finalContent = step.text || '';
          finalReasoning = step.reasoning || '';
        } else {
          // steps가 없는 경우 text 사용
          finalContent = completion.text || '';
        }

        console.log('Final content:', finalContent);
        console.log('Final reasoning:', finalReasoning);

        await supabase.from('messages')
          .update({ 
            content: finalContent,
            reasoning: finalReasoning
          })
          .eq('id', assistantMessageId);
      }
    });

    return result.toDataStreamResponse({
      sendReasoning: true,  // 이 옵션이 활성화되어 있는지 확인
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
} 