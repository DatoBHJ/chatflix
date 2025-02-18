import { Message, streamText, createDataStreamResponse, smoothStream } from 'ai';
import { createClient } from '@/utils/supabase/server'
import { providers } from '@/lib/providers'
import { ChatRequest, MessagePart, CompletionResult } from '@/lib/types'
// import { ratelimit } from '@/lib/ratelimit'

export const runtime = 'edge'  // Edge Runtime 사용
export const maxDuration = 300 // 최대 실행 시간 300초로 설정

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
  return createDataStreamResponse({
    execute: async (dataStream) => {
      try {
        const supabase = await createClient()
        
        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          throw new Error('Unauthorized')
        }

        // // Apply rate limiting
        // const { success, reset, remaining } = await ratelimit.limit(user.id)
        
        // if (!success) {
        //   const now = Date.now()
        //   const retryAfter = Math.floor((reset - now) / 1000)
          
        //   dataStream.writeMessageAnnotation({
        //     type: 'error',
        //     data: {
        //       message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        //       code: 429,
        //       retryAfter,
        //       remaining
        //     }
        //   })
        //   return
        // }

        // Get user's system prompt
        const { data: systemPromptData, error: systemPromptError } = await supabase
          .from('system_prompts')
          .select('content')
          .eq('user_id', user.id)
          .single()

        if (systemPromptError) {
          console.error('Error fetching system prompt:', systemPromptError)
        }

        const systemPrompt = systemPromptData?.content || 'You are a helpful AI assistant. When sharing code or command examples, always specify a language for code blocks (e.g., ```javascript, ```python, ```bash, ```text for plain text). Use appropriate markdown syntax for code blocks, lists, tables, and other formatting elements.'

        const body = await req.json();
        const { messages, model, chatId, isRegeneration, existingMessageId }: ChatRequest = body;
        
        // chatId가 있는 경우 해당 세션이 존재하는지 확인
        if (chatId) {
          console.log('Checking session:', chatId);
          try {
            const { data: existingSession, error: sessionError } = await supabase
              .from('chat_sessions')
              .select()
              .eq('id', chatId)
              .eq('user_id', user.id)
              .single();

            if (sessionError || !existingSession) {
              throw new Error('Chat session not found');
            }
          } catch (error) {
            throw new Error('Failed to check session: ' + (error instanceof Error ? error.message : 'Unknown error'));
          }
        }

        // 메시지 유효성 검사
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          throw new Error('Invalid messages format');
        }

        // Check for prompt shortcuts in the last user message
        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage.role === 'user') {
          const content = lastUserMessage.content;
          // 수정된 정규식: 특수문자도 포함하도록 변경
          const match = content.match(/@([\w?]+)/);
          
          if (match) {
            const shortcutName = match[1];
            const { data: shortcutData, error: shortcutError } = await supabase
              .from('prompt_shortcuts')
              .select('content')
              .eq('user_id', user.id)
              .eq('name', shortcutName)
              .single();

            if (!shortcutError && shortcutData) {
              // 숏컷 내용을 먼저 위치시키고, 나머지 텍스트를 뒤에 붙임
              const remainingText = content.replace(new RegExp(`@${shortcutName}\\s*`), '').trim();
              const updatedContent = `${shortcutData.content} ${remainingText}`;
              
              lastUserMessage.content = updatedContent;

              // Update parts if they exist
              if (lastUserMessage.parts) {
                lastUserMessage.parts = lastUserMessage.parts.map(part => {
                  if (part.type === 'text') {
                    return {
                      ...part,
                      text: updatedContent
                    };
                  }
                  return part;
                });
              }
            }
          }
        }

        // provider 이름 가져오기
        const provider = getProviderFromModel(model);

        // 현재 채팅의 마지막 시퀀스 번호 가져오기
        const { data: lastMessage, error: sequenceError } = await supabase
          .from('messages')
          .select('sequence_number')
          .eq('chat_session_id', chatId)
          .eq('user_id', user.id)
          .order('sequence_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        // 다음 시퀀스 번호 계산 (let으로 변경)
        let nextSequence = (lastMessage?.sequence_number || 0) + 1;

        // 재생성이 아닌 경우에만 사용자 메시지 저장
        if (lastUserMessage.role === 'user' && !isRegeneration) {
          // 해당 메시지가 이미 존재하는지 확인
          const { data: existingMessage } = await supabase
            .from('messages')
            .select('id, sequence_number')
            .eq('chat_session_id', chatId)
            .eq('content', lastUserMessage.content)
            .eq('role', 'user')
            .eq('user_id', user.id)
            .maybeSingle();

          // 메시지가 존재하지 않는 경우에만 저장
          if (!existingMessage) {
            // 현재 최대 시퀀스 번호 다시 확인
            const { data: currentMax } = await supabase
              .from('messages')
              .select('sequence_number')
              .eq('chat_session_id', chatId)
              .eq('user_id', user.id)
              .order('sequence_number', { ascending: false })
              .limit(1)
              .maybeSingle();

            const userMessageSequence = (currentMax?.sequence_number || 0) + 1;
            
            const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const { error: insertError } = await supabase.from('messages').insert([{
              id: messageId,
              content: lastUserMessage.content,
              role: 'user',
              created_at: new Date().toISOString(),
              model,
              host: 'user',
              chat_session_id: chatId,
              user_id: user.id,
              sequence_number: userMessageSequence
            }]);

            if (insertError) {
              console.error('Failed to insert user message:', insertError);
              throw new Error('Failed to insert user message');
            }

            // AI 메시지를 위한 시퀀스 번호 업데이트
            nextSequence = userMessageSequence + 1;
          }
        }

        const selectedModel = providers.languageModel(model);
        if (!selectedModel) {
          throw new Error('Invalid model');
        }

        // 메시지 형식 정규화
        const normalizedMessages = normalizeMessages(messages);

        // AI 응답을 위한 메시지 ID 설정 (재생성 시 기존 ID 사용)
        const assistantMessageId = isRegeneration && existingMessageId 
          ? existingMessageId 
          : `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // 재생성이 아닐 때만 새 메시지를 생성
        if (!isRegeneration) {
          // 현재 최대 시퀀스 번호 다시 확인
          const { data: currentMax } = await supabase
            .from('messages')
            .select('sequence_number')
            .eq('chat_session_id', chatId)
            .eq('user_id', user.id)
            .order('sequence_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          const assistantSequence = (currentMax?.sequence_number || 0) + 1;

          const { error: insertError } = await supabase.from('messages').insert([{
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            reasoning: '',
            created_at: new Date().toISOString(),
            model, // 현재 선택된 모델 사용
            host: provider,
            chat_session_id: chatId,
            user_id: user.id,
            sequence_number: assistantSequence
          }]);

          if (insertError) {
            console.error('Failed to insert assistant message:', insertError);
            throw new Error('Failed to insert assistant message');
          }
        } else {
          // 재생성 시에는 즉시 빈 내용으로 업데이트 (시퀀스 번호는 유지)
          const { error: immediateUpdateError } = await supabase
            .from('messages')
            .update({
              content: '',
              reasoning: '',
              model, // 현재 선택된 모델 사용
              host: provider,
              created_at: new Date().toISOString()
            })
            .eq('id', assistantMessageId)
            .eq('user_id', user.id);

          if (immediateUpdateError) {
            console.error('Failed to update message immediately:', immediateUpdateError);
          }
        }

        // console.log(normalizedMessages, 'normalizedMessages','\n');
        console.log('normalizedMessages:', JSON.stringify(normalizedMessages, null, 2));
        // 스트리밍 응답 설정
        const result = streamText({
          model: selectedModel,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            ...normalizedMessages
          ],
          temperature: 0.7,
          maxTokens: 4000,
          experimental_transform: smoothStream({
            // chunking: 'word',
            // delayInMs: 15,
          }),
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
                model, // 현재 선택된 모델 사용
                host: provider,
                chat_session_id: chatId,
                user_id: user.id,
                sequence_number: isRegeneration ? lastMessage?.sequence_number : nextSequence + 1
              };

              // 재생성 시에는 update, 아닐 때는 upsert 사용
              const { error: updateError } = isRegeneration
                ? await supabase
                    .from('messages')
                    .update({
                      content: finalContent,
                      reasoning: finalReasoning && finalReasoning !== finalContent ? finalReasoning : null,
                      model, // 현재 선택된 모델 사용
                      host: provider,
                      created_at: new Date().toISOString()
                    })
                    .eq('id', assistantMessageId)
                    .eq('user_id', user.id)
                : await supabase
                    .from('messages')
                    .update({
                      content: finalContent,
                      reasoning: finalReasoning && finalReasoning !== finalContent ? finalReasoning : null,
                      model, // 현재 선택된 모델 사용
                      host: provider,
                      created_at: new Date().toISOString()
                    })
                    .eq('id', assistantMessageId)
                    .eq('user_id', user.id);

              if (updateError) {
                console.error('Failed to update message:', updateError);
              }
            } catch (error) {
              console.error('Error in onFinish:', error);
            }
          }
        });

        // Merge the result into the data stream
        return result.mergeIntoDataStream(dataStream, {
          sendReasoning: true
        });

      } catch (error) {
        // Handle any errors that occurred during execution
        if (error instanceof Error) {
          dataStream.writeMessageAnnotation({
            type: 'error',
            data: { message: error.message }
          });
        } else {
          dataStream.writeMessageAnnotation({
            type: 'error',
            data: { message: 'An unknown error occurred' }
          });
        }
      }
    }
  });
} 