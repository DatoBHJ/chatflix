import { type ModelMessage } from 'ai';
import { getModelById } from '@/lib/models/config';
import { providers } from '@/lib/providers';
import { generateObject, convertToModelMessages } from 'ai';
import { z } from 'zod';

export const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

type UIMessageCompat = {
  id: string;
  role: 'system' | 'user' | 'assistant' | string;
  content?: any;
  experimental_attachments?: any[];
  parts?: any[];
  metadata?: any;
  [key: string]: any;
};

export const fetchFileContent = async (url: string, supabase?: any, fileType?: string): Promise<{ text?: string; base64?: string } | null> => {
  try {
    // Special handling for PDFs - always get binary data
    const isPDF = fileType === 'pdf' || url.includes('.pdf') || url.includes('application/pdf');
    
    console.log('🔍 [DEBUG] fetchFileContent called:', {
      fileType: fileType,
      isPDF: isPDF,
      urlPreview: url.substring(0, 50) + '...'
    });
    
    if (url.includes('chat_attachments') && supabase) {
      const filePath = url.split('chat_attachments/')[1]?.split('?')[0];
      if (filePath) {
        try {
          const { data, error } = await supabase.storage
            .from('chat_attachments')
            .download(filePath);
            
          if (error) {
            return null;
          }
          
          if (isPDF) {
            // For PDFs, return base64 encoded data
            const arrayBuffer = await data.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
            const base64Data = btoa(binary);
            console.log('🔍 [DEBUG] Returning PDF as base64, length:', base64Data.length);
            return { base64: base64Data };
          } else {
            // For text files, return text content
            const textContent = await data.text();
            console.log('🔍 [DEBUG] Returning text content, length:', textContent.length);
            return { text: textContent };
          }
        } catch (err) {
          return null;
        }
      }
    }
    
    if (url.startsWith('http') || url.startsWith('https')) {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      
      if (isPDF) {
        // For PDFs, return base64 encoded data
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
        const base64Data = btoa(binary);
        return { base64: base64Data };
      } else {
        // For text files, return text content
        return { text: await response.text() };
      }
    }
    else if (url.startsWith('data:')) {
      // Data URLs are already properly formatted, no need to modify
      if (url.includes('base64,')) {
        // Extract base64 part if it's already in that format
        const base64Content = url.split(',')[1];
        if (base64Content) {
          if (isPDF) {
            return { base64: base64Content };
          } else {
            return { text: atob(base64Content) };
          }
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};


export const validateAndUpdateSession = async (
  supabase: any,
  chatId: string,
  userId: string,
  messages: any[]
) => {
  // 🚀 익명 사용자 지원: 익명 사용자는 세션 검증 건너뛰기
  if (userId === 'anonymous' || userId.startsWith('anonymous_')) {
    return;
  }

  try {
    // 🚀 세션과 메시지를 병렬로 조회
    const [sessionResult, messagesResult] = await Promise.all([
      supabase
        .from('chat_sessions')
        .select()
        .eq('id', chatId)
        .eq('user_id', userId)
        .single(),
      supabase
        .from('messages')
        .select('*')
        .eq('chat_session_id', chatId)
        .eq('user_id', userId)
        .order('sequence_number', { ascending: true })
    ]);

    const { data: existingSession, error: sessionError } = sessionResult;
    const { data: sessionMessages, error: messagesError } = messagesResult;

    // 🚀 세션이 없으면 조용히 처리 (새 채팅인 경우)
    if (sessionError || !existingSession) {
      return;
    }

    // 🚀 메시지 동기화 최적화 (Map 사용)
    if (!messagesError && sessionMessages) {
      const messageMap = new Map(sessionMessages.map((msg: any) => [msg.id, msg]));
      
      messages.forEach((msg, index) => {
        const dbMessage = messageMap.get(msg.id) as any;
        if (dbMessage) {
          // 필요한 데이터만 선택적으로 동기화
          if (dbMessage.is_edited) {
            messages[index].content = dbMessage.content;
          }
          if (dbMessage.experimental_attachments?.length > 0) {
            messages[index].experimental_attachments = dbMessage.experimental_attachments;
          }
          
          // 🆕 새로운 token_usage 칼럼에서 토큰 사용량 정보 로드
          if (dbMessage.token_usage) {
            (messages[index] as any).token_usage = dbMessage.token_usage;
          }
          
          // Include tool_results from the database message
          if (dbMessage.tool_results) {
            (messages[index] as any).tool_results = dbMessage.tool_results;
            
            // 🆕 백워드 호환성: tool_results에 token_usage가 있고 dedicated column에 없는 경우 처리
            if (dbMessage.tool_results.token_usage && !dbMessage.token_usage) {
              (messages[index] as any).token_usage = dbMessage.tool_results.token_usage;
            }
          }
        }
      });
    }
  } catch (error) {
    // 에러가 발생해도 조용히 처리 (AI 응답에 영향 없음)
    console.log('🚀 [SESSION] Session validation failed:', (error as Error).message);
  }
};

export const getProviderFromModel = (model: string): string => {
  const selectedModel = providers.languageModel(model);
  return selectedModel?.provider || 'Unknown Provider';
};


// 🆕 감지 함수들 (modelSelector와 동일한 로직)
export function detectImages(message: any): boolean {

  
  // AI SDK v5: parts 배열 구조 체크
  if (Array.isArray(message.parts)) {
    const hasImage = message.parts.some((part: any) => part.type === 'image');
    console.log('🔍 [DEBUG] detectImages from parts:', hasImage);
    return hasImage;
  }
  
  return false;
}

export function detectPDFs(message: any): boolean {
  // AI SDK v5: parts 배열 구조 체크
  if (Array.isArray(message.parts)) {
    return message.parts.some((part: any) => 
      part.type === 'file' && 
      (part.mimeType === 'application/pdf' || 
       (part.filename && part.filename.toLowerCase().endsWith('.pdf')))
    );
  }
  return false;
}

export function detectCodeAttachments(message: any): boolean {
  return Array.isArray(message.experimental_attachments) && 
    message.experimental_attachments.some((attachment: any) => 
      attachment.fileType === 'code' || 
      (attachment.name && attachment.name.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml)$/i))
    );
}

/**
 * 메시지에서 텍스트와 첨부파일 정보를 추출하는 함수
 * AI SDK v5의 다양한 메시지 구조를 지원
 */
export const extractTextFromMessage = (msg: any): string => {
  if (typeof msg.content === 'string') {
    return msg.content;
  } else if (Array.isArray(msg.content)) {
    // 텍스트 부분 추출
    const textContent = msg.content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n');
    
    // 첨부파일 메타데이터 추출
    const attachmentInfo = [];
    
    // 이미지 처리
    const images = msg.content.filter((part: any) => part.type === 'image');
    if (images.length > 0) {
      attachmentInfo.push(`[ATTACHED: ${images.length} image(s)]`);
    }
    
    // 파일 처리
    const files = msg.content.filter((part: any) => part.type === 'file');
    files.forEach((file: any) => {
      if (file.file) {
        const fileName = file.file.name || '';
        const fileType = file.file.contentType || '';
        
        // 파일 유형에 따른 구체적인 정보 제공
        if (fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
          attachmentInfo.push(`[ATTACHED: Image file - ${fileName}]`);
        } else if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
          attachmentInfo.push(`[ATTACHED: PDF document - ${fileName}]`);
        } else if (fileName.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
          const extension = fileName.split('.').pop();
          attachmentInfo.push(`[ATTACHED: Code file (${extension}) - ${fileName}]`);
        } else {
          attachmentInfo.push(`[ATTACHED: File - ${fileName} (${fileType})]`);
        }
      }
    });
    
    // AI SDK 5: parts 배열 구조 처리
    if (Array.isArray(msg.parts)) {
      msg.parts.forEach((part: any) => {
        if (part.type === 'image') {
          attachmentInfo.push(`[ATTACHED: Image file]`);
        } else if (part.type === 'file') {
          const fileName = part.filename || '';
          const mediaType = part.mediaType || '';
          
          if (mediaType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
            attachmentInfo.push(`[ATTACHED: PDF document - ${fileName}]`);
          } else if (fileName.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
            const extension = fileName.split('.').pop();
            attachmentInfo.push(`[ATTACHED: Code file (${extension}) - ${fileName}]`);
          } else if (fileName) {
            attachmentInfo.push(`[ATTACHED: File - ${fileName} (${mediaType})]`);
          }
        }
      });
    }
    
    // 하위 호환성을 위한 experimental_attachments 처리
    if (Array.isArray((msg as any).experimental_attachments)) {
      (msg as any).experimental_attachments.forEach((attachment: any) => {
        const fileName = attachment.name || '';
        const fileType = attachment.contentType || attachment.fileType || '';
        
        if (fileType === 'image' || fileType.startsWith('image/') || 
            fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
          attachmentInfo.push(`[ATTACHED: Image file - ${fileName}]`);
        } else if (fileType === 'pdf' || fileType === 'application/pdf' || 
                  fileName.toLowerCase().endsWith('.pdf')) {
          attachmentInfo.push(`[ATTACHED: PDF document - ${fileName}]`);
        } else if (fileType === 'code' || 
                  fileName.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
          const extension = fileName.split('.').pop();
          attachmentInfo.push(`[ATTACHED: Code file (${extension}) - ${fileName}]`);
        } else if (fileName) {
          attachmentInfo.push(`[ATTACHED: File - ${fileName} (${fileType})]`);
        }
      });
    }
    
    // 텍스트와 첨부파일 정보 결합
    if (textContent) {
      return attachmentInfo.length > 0 
        ? `${textContent}\n${attachmentInfo.join('\n')}` 
        : textContent;
    } else if (attachmentInfo.length > 0) {
      return attachmentInfo.join('\n');
    }
  }
  return '';
};



// OG Follow Up Questions
// export async function generateFollowUpQuestions(
//   userQuery: string,
//   aiResponse: string,
//   userMemoryData?: string
// ): Promise<string[]> {
//   try {
//     const contextInfo = 'The AI has provided a text response to the user.';
    
//     // 사용자 메모리 데이터가 있으면 개인화된 컨텍스트 추가
//     const personalizationContext = userMemoryData ? `
// **USER MEMORY & PREFERENCES:**
// ${userMemoryData}

// **PERSONALIZATION INSTRUCTIONS:**
// - Consider the user's interests, preferences, and communication style from their memory data
// - Generate questions that align with their typical topics of interest
// - Use their preferred level of detail and technical depth
// - Match their communication style (formal/casual, technical/non-technical)
// - Consider their past interactions and what they typically ask about
// - If they have specific domains of expertise or interest, incorporate those
// - Use their preferred language style and terminology` : '';

//     const followUpResult = await generateObject({
//       model: providers.languageModel('gemini-2.0-flash'),
//       prompt: `You are generating follow-up questions that a USER would naturally ask or input to an AI assistant. These should be direct requests, commands, or questions that users would actually type, NOT questions the AI would ask the user.

// **CRITICAL INSTRUCTION: Generate user inputs TO the AI, not AI questions TO the user**

// User's original query: "${userQuery}"
// AI's response: "${aiResponse}"
// Context: ${contextInfo}${personalizationContext}

// **WRONG EXAMPLES (AI asking user - DO NOT generate these):**
// ❌ "What details would you like me to emphasize in this image?"
// ❌ "Which style would you prefer?"
// ❌ "Do you want me to modify anything?"
// ❌ "Would you like me to create variations?"

// **CORRECT EXAMPLES (User asking/requesting from AI - Generate these types):**
// ✅ "Create a similar image with a dog instead"
// ✅ "Search for the latest news about this topic"
// ✅ "How does this algorithm work?"
// ✅ "What are the pros and cons of this approach?"
// ✅ "Make this image in a different style"
// ✅ "Find research papers about this subject"
// ✅ "Search YouTube for tutorials on this"
// ✅ "Explain this concept in more detail"
// ✅ "What are the alternatives to this approach?"

// **Generate 3 different types of user inputs:**
// 1. **Action Request**: User asks AI to create, generate, search, or make something
// 2. **Information Question**: User asks AI to explain, analyze, or provide information
// 3. **Follow-up Inquiry**: User asks about alternatives, improvements, or related topics

// **IMPORTANT RULES:**
// - Write as natural user inputs TO the AI (commands, requests, or questions)
// - Can be imperative ("Create...") or interrogative ("How does...?", "What is...?")
// - Respond in the same language as the user's original query
// - Make them natural and actionable - things users would actually type
// - Each input should be distinctly different in purpose
// - If user memory data is available, personalize questions based on their interests and communication style
// - Consider their technical level, preferred topics, and past interaction patterns`,
//       schema: z.object({
//         followup_questions: z.array(z.string()).length(3)
//       })
//     });
    
//     return followUpResult.object.followup_questions;
//   } catch (e) { 
//     console.error('Error generating follow-up questions:', e);
//     return [];
//   }
// }


/**
 * 후속 질문 생성 함수
 */
export async function generateFollowUpQuestions(
  userQuery: string,
  aiResponse: string,
  userMemoryData?: string
): Promise<string[]> {
  try {
    const contextInfo = 'The AI has provided a text response to the user.';
    
    // 사용자 메모리 데이터가 있으면 개인화된 컨텍스트 추가
    const personalizationContext = userMemoryData ? `
**USER MEMORY & PREFERENCES:**
${userMemoryData}

**PERSONALIZATION INSTRUCTIONS:**
- Consider the user's interests, preferences, and communication style from their memory data
- Generate questions that align with their typical topics of interest
- Use their preferred level of detail and technical depth
- Match their communication style (formal/casual, technical/non-technical)
- Consider their past interactions and what they typically ask about
- If they have specific domains of expertise or interest, incorporate those
- Use their preferred language style and terminology` : '';

    const followUpResult = await generateObject({
      model: providers.languageModel('gemini-2.0-flash'),
      prompt: `You are generating follow-up questions that a USER would naturally ask to continue the conversation with an AI assistant. These should be questions that naturally flow from the current response and help deepen the discussion.

**CRITICAL INSTRUCTION: Generate natural conversation continuations that build upon the current response**

User's original query: "${userQuery}"
AI's response: "${aiResponse}"
Context: ${contextInfo}${personalizationContext}

**CONVERSATION FLOW PRINCIPLES:**
- Questions should naturally continue the current topic or explore related aspects
- Focus on deepening understanding, exploring implications, or connecting to broader themes
- Questions should feel like a natural next step in the conversation
- Avoid questions that feel like starting a completely new topic
- Questions should build upon the information just provided
- Make questions "click-worthy" by including subtle summaries of key elements and sparking curiosity – keep them short and intriguing

**WRONG EXAMPLES (Don't generate these):**
❌ "What details would you like me to emphasize in this image?"
❌ "Which style would you prefer?"
❌ "Do you want me to modify anything?"
❌ "Would you like me to create variations?"
❌ Questions that feel like starting a completely unrelated topic
❌ "What are the ethical implications of this technology?"  // Avoid boring ethical questions
❌ "How can we solve the privacy issues here?"  // Too unrelated and not engaging
❌ "What countries might adopt this first?"  // Too obvious and not curiosity-driven

**CORRECT EXAMPLES (Generate these types):**
✅ "You mentioned 125,000-word vocab – any cases where it perfectly matched thoughts?"  // Summarizes key detail, builds curiosity
✅ "£10,000 robot pregnancy vs real hospital costs – how much cheaper?"  // Engaging real-life comparison
✅ "60-year zombie satellite signal – what's it actually saying now?"  // Stimulating with keywords
✅ "37.6% indoor solar efficiency – how much could it cut my home electric bill?"  // Practical and click-worthy
✅ "Brad Pitt burglary – what exactly did they steal?"  // Intriguing detail request
✅ "AI-generated images got 90 years – what did the guy do to get caught?"  // Mysterious angle

**Generate 3 different types of conversation continuations:**
1. **Deepening Questions**: Questions that explore the current topic in more detail, depth, or complexity
2. **Connection Questions**: Questions that connect the current topic to related concepts, applications, or broader themes
3. **Practical Questions**: Questions that explore real-world applications, implications, or next steps

**IMPORTANT RULES:**
- Write as natural conversation continuations that flow from the current response
- Questions should feel like logical next steps in the discussion
- Can be interrogative ("How does...?", "What are...?") or exploratory ("Tell me more about...", "Explain how...")
- Respond in the same language as the user's original query
- Make them feel like natural conversation flow, not isolated requests
- Each question should explore a different aspect or direction of the current topic
- If user memory data is available, personalize questions based on their interests and communication style
- Consider their technical level, preferred topics, and past interaction patterns
- Questions should encourage further exploration and discussion
- Include key phrases or details from the AI response to subtly summarize and build curiosity
- Prioritize engaging, fun, or mysterious angles (e.g., specific examples, real-life calculations, surprising facts) to make them "click-worthy"
- Avoid boring, overly ethical, or obvious questions; focus on rabbit hole-style depth that users would naturally pursue
- Keep questions concise (under 20-30 words) and punchy to encourage quick clicks`,
      schema: z.object({
        followup_questions: z.array(z.string()).length(3)
      })
    });
    
    return followUpResult.object.followup_questions;
  } catch (e) { 
    console.error('Error generating follow-up questions:', e);
    return [];
  }
}

/**
 * 도구 실행 계획 생성 함수
 */
// export async function generateToolExecutionPlan(
//   userQuery: string,
//   selectedTools: string[],
//   contextMessages: any[],
//   toolDescriptions: Record<string, string>,
// ): Promise<{
//   plan: string;
//   essentialContext: string;
// }> {    
//     // 첨부파일 감지
//     const hasAttachments = contextMessages.some(msg => {
//       if (Array.isArray(msg.content)) {
//         return msg.content.some((part: any) => part.type === 'image' || part.type === 'file');
//       }
//       // AI SDK 5: parts 배열 구조 체크
//       if (Array.isArray(msg.parts)) {
//         return msg.parts.some((part: any) => part.type === 'image' || part.type === 'file');
//       }
//       // 하위 호환성을 위한 experimental_attachments 체크
//       return Array.isArray((msg as any).experimental_attachments) && (msg as any).experimental_attachments.length > 0;
//     });
    
//     // 시스템 프롬프트 (첨부파일 유무에 따라 다르게)
//     const currentDate = new Date().toLocaleDateString('en-US', { 
//       year: 'numeric', 
//       month: 'long', 
//       day: 'numeric',
//       weekday: 'long'
//     });
    
//     const systemPrompt = `You are an AI assistant analyzing a user's request to create a detailed execution plan for using tools.

// **Current Date:** ${currentDate}
// **User's Request:** ${userQuery}
// **Selected Tools:** ${selectedTools.join(', ')}
// **Available Tools:** ${Object.entries(toolDescriptions).map(([key, desc]) => `${key}: ${desc}`).join('\n')}
// ${hasAttachments ? `**CRITICAL: ATTACHMENTS DETECTED**
// The conversation contains attached files (PDFs, images, documents). You MUST:
// 1. **Extract ALL specific details** from attached files that are relevant to the user's request
// 2. **List every specific entity** (companies, people, places, dates, numbers, etc.) mentioned in attachments
// 3. **Include ALL relevant context** from attachments in your plan
// 4. **Be extremely detailed** about what information to search for based on attachment content
// 5. **Mention specific search terms** and entities that should be researched
// 6. **Consider temporal relevance** - if attachments contain dates, check if information is current as of ${currentDate}

// **Example for company-related requests:**
// - If user asks "check if mentioned companies are listed" and PDF contains companies A, B, C
// - Your plan MUST list: "Search for: Company A, Company B, Company C"
// - Include any additional details from PDF about these companies

// **Example for data analysis requests:**
// - If user asks "analyze this data" and PDF contains specific data points
// - Your plan MUST include: "Search for: [specific data points], [relevant metrics], [related trends]"

// **ATTACHMENT ANALYSIS REQUIREMENTS:**
// - Extract ALL company names, product names, dates, locations, numbers, statistics
// - Include ALL relevant keywords and search terms
// - Be comprehensive - don't miss any important details
// - If attachment contains lists, include ALL items in the list
// - If attachment contains tables, extract ALL relevant data points
// - **Temporal Analysis**: If attachments contain dates, determine if information needs current verification as of ${currentDate}` : ''}

// **Your Task:**
// 1. **Analyze User Intent**: Understand what the user really wants
// 2. **Create Execution Plan**: Detail how to use each selected tool effectively${hasAttachments ? ', including ALL specific details from attachments' : ''}
// 3. **Extract Essential Context**: Identify the most relevant context from conversation history${hasAttachments ? ', with comprehensive details from attached files' : ''}

// **Requirements:**
// - Respond in the user's language
// - Be specific about tool usage order and purpose
// - Focus on what will help the user most
// - Extract only context that directly relates to the current request
// - **Consider temporal relevance** - if the request involves time-sensitive information, prioritize current data as of ${currentDate}${hasAttachments ? `
// - **MANDATORY**: Include ALL specific entities, numbers, dates, and details from attachments
// - **MANDATORY**: List every search term and entity that should be researched
// - **MANDATORY**: Be exhaustive - don't skip any relevant details from attachments
// - **MANDATORY**: For any dates in attachments, determine if current verification is needed as of ${currentDate}` : ''}

// **Output Format:**
// - Plan: Step-by-step tool execution strategy${hasAttachments ? ' with ALL specific details from attachments' : ''}
// - Essential Context: Only the most relevant parts of conversation history${hasAttachments ? ', including comprehensive attachment details' : ''}`;

//     // 🔧 메시지 변환 - unified converter 사용
//     const convertedMessages = convertToModelMessages(contextMessages);
    
//     const planResult = await generateObject({
//       model: providers.languageModel('gemini-2.0-flash'),
//       system: systemPrompt,
//       messages: convertedMessages,
//       schema: z.object({
//         plan: z.string().describe('Detailed step-by-step plan for tool execution'),
//         essentialContext: z.string().describe('Only the most relevant context from conversation history')
//       })
//     });
    
//     return planResult.object;
// }

/**
 * 공통 메시지 처리 함수 - 에이전트 모드와 일반 모드에서 공통으로 사용
 */
export async function processMessagesForAI(messagesWithTokens: any[], model?: string): Promise<ModelMessage[]> {
  
  // GPT-5 모델인지 확인
  const isGPT5 = model && model.startsWith('gpt-5') && model !== 'gpt-5-chat-latest';
  
  // 코드파일/텍스트파일을 텍스트로 변환 (UI는 파일로 유지)
  const processedMessages = await Promise.all(messagesWithTokens.map(async (msg: any) => {
    if (!msg.parts || !Array.isArray(msg.parts)) {
      return msg;
    }
    
    const processedParts = await Promise.all(msg.parts.map(async (part: any) => {
      // GPT-5의 경우 reasoning 데이터는 그대로 유지
      if (part.type === 'reasoning') {
        if (isGPT5) {
          return part; // GPT-5에서는 reasoning 데이터 유지
        } else {
          return {
            type: 'text',
            text: part.reasoningText || part.text || ''
          };
        }
      }
      
      // AI SDK v4 형식 이미지를 v5 형식으로 변환
      if (part.type === 'image' && part.image) {
        // experimental_attachments에서 정확한 mediaType과 filename 찾기
        const attachment = msg.experimental_attachments?.find((att: any) => 
          att.url === part.image || att.url.includes(part.image) || part.image.includes(att.url)
        );
        
        return {
          type: 'file',
          url: part.image,
          mediaType: attachment?.contentType || 'image/png',
          filename: attachment?.name || 'image'
        };
      }
      
      if (part.type === 'file' && part.url) {
        // PDF는 그대로 유지
        if (part.mediaType === 'application/pdf') {
          return part;
        }
        
        // 이미지도 그대로 유지
        if (part.mediaType && part.mediaType.startsWith('image/')) {
          return part;
        }
        
        // 코드파일/텍스트파일 (mediaType이 없거나 빈 문자열인 경우 포함)
        // 내용을 읽어서 텍스트로 변환
        try {
          const fileContent = await fetchFileContent(part.url);
          if (fileContent && fileContent.text) {
            return {
              type: 'text',
              text: `파일명: ${part.filename || 'unknown'}\n내용:\n\`\`\`\n${fileContent.text}\n\`\`\``
            };
          } else if (fileContent && fileContent.base64) {
            // PDF 파일인 경우 (fallback)
            return {
              type: 'file',
              url: part.url,
              mediaType: 'application/pdf',
              filename: part.filename || 'document.pdf'
            };
          }
        } catch (error) {
          console.error('파일 내용 읽기 실패:', error);
          return {
            type: 'text',
            text: `파일 읽기 실패: ${part.filename || 'unknown'}`
          };
        }
      }
      return part;
    }));
    
    return {
      ...msg,
      parts: processedParts
    };
  }));
  
  const result = convertToModelMessages(processedMessages);
  return result;
}

/**
 * Kimi K2 모델 호환성: completion 객체에서 안전하게 텍스트 추출
 */
export function extractTextFromCompletion(completion: any): string {
  try {
    // 우선순위: text > parts > steps > 빈 문자열
    if (completion.text && typeof completion.text === 'string') {
      return completion.text;
    }
    
    if (completion.parts && Array.isArray(completion.parts)) {
      const textParts = completion.parts
        .filter((part: any) => part.type === 'text' && part.text)
        .map((part: any) => part.text);
      if (textParts.length > 0) {
        return textParts.join('\n');
      }
    }
    
    if (completion.steps && Array.isArray(completion.steps)) {
      const textSteps = completion.steps
        .map((step: any) => step.text)
        .filter((text: any) => text && typeof text === 'string');
      if (textSteps.length > 0) {
        return textSteps.join('\n\n');
      }
    }
    
    // 모든 방법이 실패하면 빈 문자열 반환
    console.warn('⚠️ [COMPLETION] Could not extract text from completion object:', Object.keys(completion));
    return '';
  } catch (error) {
    console.error('💥 [COMPLETION] Error extracting text from completion:', error);
    return '';
  }
}
