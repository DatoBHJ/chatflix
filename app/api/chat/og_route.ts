// import { streamText, createDataStreamResponse, smoothStream } from 'ai';
// import { createClient } from '@/utils/supabase/server'
// import { providers } from '@/lib/providers'
// import { ChatRequest, CompletionResult } from '@/lib/types'
// import { getRateLimiter } from '@/lib/ratelimit'

// export const runtime = 'edge'  // Edge Runtime 사용
// export const maxDuration = 300 // 최대 실행 시간 300초로 설정


// // 모델 이름에서 provider 이름을 추출하는 함수
// function getProviderFromModel(model: string): string {
//   const selectedModel = providers.languageModel(model);
  
//   // providers.ts에서 이미 모델별 provider를 관리하고 있으므로
//   // 해당 정보를 활용
//   return selectedModel?.provider || 'Unknown Provider';
// }

// export async function POST(req: Request) {
//   return createDataStreamResponse({
//     execute: async (dataStream) => {
//       try {
//         const supabase = await createClient()
        
//         // Get the current user
//         const { data: { user }, error: userError } = await supabase.auth.getUser()
//         if (userError || !user) {
//           throw new Error('Unauthorized')
//         }

//         const body = await req.json();
//         const { messages, model, chatId, isRegeneration, existingMessageId }: ChatRequest = body;

//         console.log('[Debug] API Request:', {
//           userId: user.id,
//           model,
//           chatId,
//           isRegeneration,
//           existingMessageId,
//           messageCount: messages.length
//         });

//         // Get model-specific rate limiter
//         const modelRateLimiter = getRateLimiter(model);
        
//         // Apply rate limiting with model-specific limits
//         const { success, reset } = await modelRateLimiter.limit(
//           `${user.id}:${model}` // Include model in the key to track per-model limits
//         );
        
//         if (!success) {
//           const now = Date.now()
//           const retryAfter = Math.floor((reset - now) / 1000)
          
//           throw new Error(JSON.stringify({
//             type: 'rate_limit',
//             message: `Rate limit exceeded for ${model}. Please try again in ${retryAfter} seconds.`,
//             retryAfter
//           }));
//         }

//         // Get user's system prompt
//         const { data: systemPromptData, error: systemPromptError } = await supabase
//           .from('system_prompts')
//           .select('content')
//           .eq('user_id', user.id)
//           .single()

//         if (systemPromptError) {
//           console.error('Error fetching system prompt:', systemPromptError)
//         }

//         const systemPrompt = systemPromptData?.content || 'You are a helpful AI assistant. When sharing code or command examples, always specify a language for code blocks (e.g., ```javascript, ```python, ```bash, ```text for plain text). Use appropriate markdown syntax for code blocks, lists, tables, and other formatting elements.'

//         // chatId가 있는 경우 해당 세션이 존재하는지 확인
//         if (chatId) {
//           console.log('[Debug] Checking session:', chatId);
//           try {
//             const { data: existingSession, error: sessionError } = await supabase
//               .from('chat_sessions')
//               .select()
//               .eq('id', chatId)
//               .eq('user_id', user.id)
//               .single();

//             if (sessionError || !existingSession) {
//               throw new Error('Chat session not found');
//             }

//             // 세션의 모든 메시지를 가져와서 편집된 내용 반영
//             const { data: sessionMessages, error: messagesError } = await supabase
//               .from('messages')
//               .select('*')
//               .eq('chat_session_id', chatId)
//               .eq('user_id', user.id)
//               .order('sequence_number', { ascending: true });

//             console.log('[Debug] Session messages:', {
//               messageCount: sessionMessages?.length,
//               hasError: !!messagesError
//             });

//             if (!messagesError && sessionMessages) {
//               // 편집된 메시지로 messages 배열 업데이트
//               messages.forEach((msg, index) => {
//                 const dbMessage = sessionMessages.find(dbMsg => dbMsg.id === msg.id);
//                 if (dbMessage && dbMessage.is_edited) {
//                   messages[index].content = dbMessage.content;
//                   console.log('[Debug] Updated edited message:', {
//                     messageId: dbMessage.id,
//                     content: dbMessage.content
//                   });
//                 }
//               });
//             }
//           } catch (error) {
//             throw new Error('Failed to check session: ' + (error instanceof Error ? error.message : 'Unknown error'));
//           }
//         }

//         // 현재 채팅의 마지막 시퀀스 번호 가져오기
//         const { data: lastMessage} = await supabase
//           .from('messages')
//           .select('sequence_number')
//           .eq('chat_session_id', chatId)
//           .eq('user_id', user.id)
//           .order('sequence_number', { ascending: false })
//           .limit(1)
//           .maybeSingle();

//         // 다음 시퀀스 번호 계산
//         let nextSequence = (lastMessage?.sequence_number || 0) + 1;

//         // 메시지 유효성 검사
//         if (!messages || !Array.isArray(messages) || messages.length === 0) {
//           throw new Error('Invalid messages format');
//         }

//         const lastUserMessage = messages[messages.length - 1];
//         console.log('[Debug] Last user message:', {
//           content: lastUserMessage.content,
//           role: lastUserMessage.role
//         });

//         // 재생성이 아닌 경우에만 사용자 메시지 저장
//         if (lastUserMessage.role === 'user' && !isRegeneration) {
//           // 해당 메시지가 이미 존재하는지 확인
//           const { data: existingMessage } = await supabase
//             .from('messages')
//             .select('id, sequence_number')
//             .eq('chat_session_id', chatId)
//             .eq('content', lastUserMessage.content)
//             .eq('role', 'user')
//             .eq('user_id', user.id)
//             .maybeSingle();

//           // 메시지가 존재하지 않는 경우에만 저장
//           if (!existingMessage) {
//             // 현재 최대 시퀀스 번호 다시 확인
//             const { data: currentMax } = await supabase
//               .from('messages')
//               .select('sequence_number')
//               .eq('chat_session_id', chatId)
//               .eq('user_id', user.id)
//               .order('sequence_number', { ascending: false })
//               .limit(1)
//               .maybeSingle();

//             const userMessageSequence = (currentMax?.sequence_number || 0) + 1;
            
//             const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
//             const { error: insertError } = await supabase.from('messages').insert([{
//               id: messageId,
//               content: lastUserMessage.content,
//               role: 'user',
//               created_at: new Date().toISOString(),
//               model,
//               host: 'user',
//               chat_session_id: chatId,
//               user_id: user.id,
//               sequence_number: userMessageSequence
//             }]);

//             if (insertError) {
//               console.error('Failed to insert user message:', insertError);
//               throw new Error('Failed to insert user message');
//             }

//             console.log('[Debug] Inserted user message:', {
//               messageId,
//               sequence: userMessageSequence
//             });

//             // AI 메시지를 위한 시퀀스 번호 업데이트
//             nextSequence = userMessageSequence + 1;
//           }
//         }

//         // AI 처리를 위한 메시지 배열 복사
//         let processMessages = [...messages];
//         const lastProcessMessage = processMessages[processMessages.length - 1];

//         // Check for prompt shortcuts and expand them for AI processing only
//         if (lastProcessMessage.role === 'user') {
//           const content = lastProcessMessage.content;
          
//           // Try to parse JSON mention data
//           try {
//             const jsonMatch = content.match(/\{"displayName":"[^"]+","promptContent":"[^"]+"}/g);
            
//             console.log('[Debug] JSON mention detection:', {
//               content,
//               hasMatch: !!jsonMatch,
//               matches: jsonMatch
//             });
            
//             if (jsonMatch) {
//               let updatedContent = content;
              
//               for (const match of jsonMatch) {
//                 const mentionData = JSON.parse(match);
//                 updatedContent = updatedContent.replace(match, mentionData.promptContent);
//               }
              
//               console.log('[Debug] JSON mention expansion:', {
//                 originalContent: content,
//                 updatedContent
//               });
              
//               // Update the processing message
//               lastProcessMessage.content = updatedContent;

//               if (lastProcessMessage.parts) {
//                 lastProcessMessage.parts = lastProcessMessage.parts.map(part => {
//                   if (part.type === 'text') {
//                     return {
//                       ...part,
//                       text: updatedContent
//                     };
//                   }
//                   return part;
//                 });
//               }
//             } else {
//               // Legacy @ mention handling as fallback
//               const match = content.match(/@([\w?!.,_\-+=@#$%^&*()<>{}\[\]|/\\~`]+)/);
              
//               console.log('[Debug] Legacy mention detection:', {
//                 content,
//                 hasMatch: !!match,
//                 matchValue: match ? match[1] : null
//               });
              
//               if (match) {
//                 const shortcutName = match[1];
//                 const { data: shortcutData, error: shortcutError } = await supabase
//                   .from('prompt_shortcuts')
//                   .select('content')
//                   .eq('user_id', user.id)
//                   .eq('name', shortcutName)
//                   .single();

//                 console.log('[Debug] Legacy shortcut lookup:', {
//                   shortcutName,
//                   hasData: !!shortcutData,
//                   error: shortcutError
//                 });

//                 if (!shortcutError && shortcutData) {
//                   const remainingText = content.replace(new RegExp(`@${shortcutName}\\s*`), '').trim();
//                   const updatedContent = `${shortcutData.content} ${remainingText}`;
                  
//                   console.log('[Debug] Legacy shortcut expansion:', {
//                     originalContent: content,
//                     remainingText,
//                     updatedContent
//                   });
                  
//                   // Update the processing message only
//                   lastProcessMessage.content = updatedContent;

//                   if (lastProcessMessage.parts) {
//                     lastProcessMessage.parts = lastProcessMessage.parts.map(part => {
//                       if (part.type === 'text') {
//                         return {
//                           ...part,
//                           text: updatedContent
//                         };
//                       }
//                       return part;
//                     });
//                   }
//                 }
//               }
//             }
//           } catch (error) {
//             console.error('[Debug] Error processing mentions:', error);
//           }
//         }

//         // provider 이름 가져오기
//         const provider = getProviderFromModel(model);

//         // AI 응답을 위한 메시지 ID 설정 (재생성 시 기존 ID 사용)
//         const assistantMessageId = isRegeneration && existingMessageId 
//           ? existingMessageId 
//           : `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
//         // 재생성이 아닐 때만 새 메시지를 생성
//         if (!isRegeneration) {
//           // 현재 최대 시퀀스 번호 다시 확인
//           const { data: currentMax } = await supabase
//             .from('messages')
//             .select('sequence_number')
//             .eq('chat_session_id', chatId)
//             .eq('user_id', user.id)
//             .order('sequence_number', { ascending: false })
//             .limit(1)
//             .maybeSingle();

//           const assistantSequence = (currentMax?.sequence_number || 0) + 1;

//           const { error: insertError } = await supabase.from('messages').insert([{
//             id: assistantMessageId,
//             role: 'assistant',
//             content: '',
//             reasoning: '',
//             created_at: new Date().toISOString(),
//             model, // 현재 선택된 모델 사용
//             host: provider,
//             chat_session_id: chatId,
//             user_id: user.id,
//             sequence_number: assistantSequence
//           }]);

//           if (insertError) {
//             console.error('Failed to insert assistant message:', insertError);
//             throw new Error('Failed to insert assistant message');
//           }

//           console.log('[Debug] Created assistant message:', {
//             messageId: assistantMessageId,
//             sequence: assistantSequence
//           });
//         } else {
//           // 재생성 시에는 즉시 빈 내용으로 업데이트 (시퀀스 번호는 유지)
//           const { error: immediateUpdateError } = await supabase
//             .from('messages')
//             .update({
//               content: '',
//               reasoning: '',
//               model, // 현재 선택된 모델 사용
//               host: provider,
//               created_at: new Date().toISOString()
//             })
//             .eq('id', assistantMessageId)
//             .eq('user_id', user.id);

//           if (immediateUpdateError) {
//             console.error('Failed to update message immediately:', immediateUpdateError);
//           }
//         }

//         // 스트리밍 응답 설정
//         const abortController = new AbortController();
//         let isStreamFinished = false;
        
//         const result = streamText({
//           model: providers.languageModel(model),
//           messages: [
//             {
//               role: 'system',
//               content: systemPrompt
//             },
//             ...processMessages
//           ],
//           temperature: 0.7,
//           maxTokens: 4000,
//           experimental_transform: smoothStream({
//             // chunking: 'word',
//             // delayInMs: 15,
//           }),
//           onFinish: async (completion: CompletionResult) => {
//             // If the stream was aborted or already finished, don't update the message
//             if (abortController.signal.aborted || isStreamFinished) {
//               return;
//             }
//             isStreamFinished = true;

//             try {
//               let finalContent = '';
//               let finalReasoning = '';

//               if (completion.steps?.[0]) {
//                 const step = completion.steps[0];
//                 finalContent = step.text || '';
//                 finalReasoning = step.reasoning || '';
//               } else if (completion.parts) {
//                 const textParts = completion.parts
//                   .filter(part => part.type === 'text')
//                   .map(part => part.text)
//                   .join('\n');
                
//                 const reasoningParts = completion.parts
//                   .filter(part => part.type === 'reasoning')
//                   .map(part => part.reasoning)
//                   .join('\n');

//                 finalContent = textParts || completion.text || '';
//                 finalReasoning = reasoningParts || '';
//               } else {
//                 finalContent = completion.text || '';
//                 const reasoningMatch = finalContent.match(/<think>(.*?)<\/think>/s);
//                 if (reasoningMatch) {
//                   finalReasoning = reasoningMatch[1].trim();
//                   finalContent = finalContent.replace(/<think>.*?<\/think>/s, '').trim();
//                 }
//               }

//               console.log('[Debug] Stream completion:', {
//                 messageId: assistantMessageId,
//                 contentLength: finalContent.length,
//                 hasReasoning: !!finalReasoning
//               });

//               // 재생성 시에는 update, 아닐 때는 upsert 사용
//               const { error: updateError } = isRegeneration
//                 ? await supabase
//                     .from('messages')
//                     .update({
//                       content: finalContent,
//                       reasoning: finalReasoning && finalReasoning !== finalContent ? finalReasoning : null,
//                       model, // 현재 선택된 모델 사용
//                       host: provider,
//                       created_at: new Date().toISOString()
//                     })
//                     .eq('id', assistantMessageId)
//                     .eq('user_id', user.id)
//                 : await supabase
//                     .from('messages')
//                     .update({
//                       content: finalContent,
//                       reasoning: finalReasoning && finalReasoning !== finalContent ? finalReasoning : null,
//                       model, // 현재 선택된 모델 사용
//                       host: provider,
//                       created_at: new Date().toISOString()
//                     })
//                     .eq('id', assistantMessageId)
//                     .eq('user_id', user.id);

//               if (updateError) {
//                 console.error('Failed to update message:', updateError);
//               }
//             } catch (error) {
//               console.error('Error in onFinish:', error);
//             }
//           }
//         });

//         // Merge the result into the data stream
//         const stream = result.mergeIntoDataStream(dataStream, {
//           sendReasoning: true
//         });

//         // Listen for abort signal
//         req.signal.addEventListener('abort', () => {
//           abortController.abort();
//           isStreamFinished = true;  // Prevent any further updates
//         });

//         return stream;

//       } catch (error) {
//         // Handle any errors that occurred during execution
//         if (error instanceof Error) {
//           try {
//             // Try to parse the error message as JSON
//             const errorData = JSON.parse(error.message);
//             if (errorData.type === 'rate_limit') {
//               dataStream.write(`0:${errorData.message}\n`);
//               dataStream.write(`e:{"finishReason":"error"}\n`);
//               return;
//             }
//           } catch (e) {
//             // If parsing fails, treat it as a regular error
//           }
          
//           // Handle other errors as before
//           dataStream.writeMessageAnnotation({
//             type: 'error',
//             data: { message: error.message }
//           });
//         } else {
//           dataStream.writeMessageAnnotation({
//             type: 'error',
//             data: { message: 'An unknown error occurred' }
//           });
//         }
//       }
//     }
//   });
// } 