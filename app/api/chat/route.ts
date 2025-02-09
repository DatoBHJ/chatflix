import { Message, streamText } from 'ai';
import { supabase } from '@/lib/supabase'
import { providers } from '@/lib/providers'
import { ChatRequest, MessagePart, CompletionResult } from '@/lib/types'

export const runtime = 'nodejs'  // Node.js 런타임 사용

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

// 모델 이름에서 provider 이름을 추출하는 함수
function getProviderFromModel(model: string): string {
  const selectedModel = providers.languageModel(model);
  
  // providers.ts에서 이미 모델별 provider를 관리하고 있으므로
  // 해당 정보를 활용
  return selectedModel?.provider || 'Unknown Provider';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model, chatId }: ChatRequest = body;
    
    // chatId가 있는 경우 해당 세션이 존재하는지 확인
    if (chatId) {
      console.log('Checking session:', chatId);
      try {
        const { data: existingSession, error: sessionError } = await supabase
          .from('chat_sessions')
          .select()
          .eq('id', chatId)
          .single();

        if (sessionError || !existingSession) {
          return new Response(
            JSON.stringify({ error: 'Chat session not found' }),
            { 
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      } catch (error) {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to check session',
            details: error instanceof Error ? error.message : undefined
          }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // 새로운 대화인 경우 세션 생성
    let sessionId = chatId;
    if (!sessionId) {
      try {
        const { data: session, error: sessionError } = await supabase
          .from('chat_sessions')
          .insert([{ 
            id: Date.now().toString(),
            title: messages[messages.length - 1]?.content || 'New Chat'
          }])
          .select()
          .single();

        if (sessionError) throw sessionError;
        sessionId = session.id;
      } catch (error) {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create session',
            details: error instanceof Error ? error.message : undefined
          }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // 메시지 유효성 검사
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('Invalid messages:', messages);
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // provider 이름 가져오기
    const provider = getProviderFromModel(model);

    // 1. 새로운 사용자 메시지 저장
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage.role === 'user') {
      await supabase.from('messages').insert([{
        id: Date.now().toString(),
        content: lastUserMessage.content,
        role: 'user',
        created_at: new Date().toISOString(),
        model,
        host: provider,
        chat_session_id: sessionId  // 추가
      }]);
    }

    const selectedModel = providers.languageModel(model);
    if (!selectedModel) {
      return new Response(
        JSON.stringify({ error: 'Invalid model' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 메시지 형식 정규화
    const normalizedMessages = normalizeMessages(messages, model);

    // 2. AI 응답을 위한 초기 레코드 생성
    const assistantMessageId = Date.now().toString();
    await supabase.from('messages').insert([{
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      reasoning: '',
      created_at: new Date().toISOString(),
      model,
      host: provider,
      chat_session_id: sessionId  // 추가
    }]);

    // 3. 스트리밍 응답 설정
    const result = streamText({
      model: selectedModel,
      messages: normalizedMessages,
      temperature: 0.7,
      maxTokens: 1000,
      onFinish: async (completion: CompletionResult) => {
        try {
          let finalContent = '';
          let finalReasoning = '';

          // steps 배열의 첫 번째 항목에서 text와 reasoning 추출
          if (completion.steps?.[0]) {
            const step = completion.steps[0];
            finalContent = step.text || '';
            finalReasoning = step.reasoning || '';
          } else {
            // steps가 없는 경우 text 사용
            finalContent = completion.text || '';
          }

          console.log('Updating message:', {
            id: assistantMessageId,
            content: finalContent,
            reasoning: finalReasoning
          });

          const { error: updateError } = await supabase
            .from('messages')
            .update({ 
              content: finalContent,
              reasoning: finalReasoning
            })
            .eq('id', assistantMessageId);

          if (updateError) {
            console.error('Failed to update message:', updateError);
          }
        } catch (error) {
          console.error('Error in onFinish:', error);
        }
      }
    });

    return result.toDataStreamResponse({
      sendReasoning: true,  // 이 옵션이 활성화되어 있는지 확인
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 