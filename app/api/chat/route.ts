import { Message, streamText } from 'ai';
import { supabase } from '@/lib/supabase'
import { providers } from '@/lib/providers'
import { ChatRequest, MessagePart, CompletionResult } from '@/lib/types'

export const runtime = 'nodejs'  // Node.js 런타임 사용

// 메시지 형식을 정규화하는 함수
function normalizeMessages(messages: Message[]): Message[] {
  return messages.map(msg => {
    if (msg.role === 'assistant') {
      if (msg.parts) {
        const textParts = msg.parts
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join('\n');
        
        const reasoningParts = msg.parts
          .filter(part => part.type === 'reasoning')
          .map(part => part.reasoning)
          .join('\n');

        const reasoning = reasoningParts && reasoningParts !== textParts ? reasoningParts : null;

        return {
          ...msg,
          content: textParts || msg.content || "Incomplete response",
          parts: reasoning ? [
            {
              type: 'reasoning' as const,
              reasoning
            },
            {
              type: 'text' as const,
              text: textParts || msg.content || "Incomplete response"
            }
          ] : undefined
        };
      }

      if (msg.content) {
        const reasoningMatch = msg.content.match(/<think>([\s\S]*?)<\/think>/);
        if (reasoningMatch) {
          const reasoning = reasoningMatch[1].trim();
          const content = msg.content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
          
          if (reasoning && reasoning !== content) {
            return {
              ...msg,
              content: content || "Incomplete response",
              parts: [
                {
                  type: 'reasoning' as const,
                  reasoning
                },
                {
                  type: 'text' as const,
                  text: content || "Incomplete response"
                }
              ]
            };
          }
        }
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
    const { messages, model, chatId, isRegeneration }: ChatRequest = body;
    
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

    // 재생성이 아닌 경우에만 사용자 메시지 저장
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage.role === 'user' && !isRegeneration) {
      await supabase.from('messages').insert([{
        id: Date.now().toString(),
        content: lastUserMessage.content,
        role: 'user',
        created_at: new Date().toISOString(),
        model,
        host: provider,
        chat_session_id: chatId
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
    const normalizedMessages = normalizeMessages(messages);

    // AI 응답을 위한 초기 레코드 생성
    const assistantMessageId = Date.now().toString();
    
    // 재생성 시에는 새 메시지를 생성하지 않고 기존 메시지를 업데이트
    if (!isRegeneration) {
      await supabase.from('messages').insert([{
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        reasoning: '',
        created_at: new Date().toISOString(),
        model,
        host: provider,
        chat_session_id: chatId
      }]);
    }

    // 스트리밍 응답 설정
    const result = streamText({
      model: selectedModel,
      messages: normalizedMessages,
      temperature: 0.7,
      maxTokens: 1000,
      onFinish: async (completion: CompletionResult) => {
        try {
          let finalContent = '';
          let finalReasoning = '';

          if (completion.steps?.[0]) {
            const step = completion.steps[0];
            finalContent = step.text || '';
            finalReasoning = step.reasoning || '';
          } else if (completion.parts) {
            const textParts = completion.parts
              .filter(part => part.type === 'text')
              .map(part => part.text)
              .join('\n');
            
            const reasoningParts = completion.parts
              .filter(part => part.type === 'reasoning')
              .map(part => part.reasoning)
              .join('\n');

            finalContent = textParts || completion.text || '';
            finalReasoning = reasoningParts || '';
          } else {
            finalContent = completion.text || '';
            const reasoningMatch = finalContent.match(/<think>(.*?)<\/think>/s);
            if (reasoningMatch) {
              finalReasoning = reasoningMatch[1].trim();
              finalContent = finalContent.replace(/<think>.*?<\/think>/s, '').trim();
            }
          }

          // reasoning과 content가 동일한 경우 reasoning을 저장하지 않음
          const messageData = {
            id: assistantMessageId,
            content: finalContent,
            reasoning: finalReasoning && finalReasoning !== finalContent ? finalReasoning : null,
            role: 'assistant',
            created_at: new Date().toISOString(),
            model,
            host: provider,
            chat_session_id: chatId
          };

          const { error: updateError } = await supabase
            .from('messages')
            .upsert(messageData);

          if (updateError) {
            console.error('Failed to update message:', updateError);
          }
        } catch (error) {
          console.error('Error in onFinish:', error);
        }
      }
    });

    return result.toDataStreamResponse({
      sendReasoning: true,
      getErrorMessage: error => {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        return 'An error occurred while processing your request';
      }
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