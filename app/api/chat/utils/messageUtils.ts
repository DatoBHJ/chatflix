import { Buffer } from 'buffer';
import { type ModelMessage } from 'ai';
import { providers } from '@/lib/providers';
import { generateObject, convertToModelMessages } from 'ai';
import { z } from 'zod';

export const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const truncateFileText = (content: string) => {
  // 제한 없이 전체 내용 반환
  return {
    text: content,
    truncated: false,
  };
};

const formatFileTextForPrompt = (filename: string | undefined, content: string) => {
  const { text } = truncateFileText(content);

  return `Filename: ${filename || 'unknown'}\nContent:\n\`\`\`\n${text}\n\`\`\``;
};

export const fetchFileContent = async (
  url: string,
  fileType?: string
): Promise<{ text?: string; base64?: string } | null> => {
  try {
    const normalizedType = fileType?.toLowerCase() || '';
    const lowerUrl = url.toLowerCase();
    const isPDF = normalizedType.includes('pdf') || lowerUrl.includes('.pdf') || lowerUrl.includes('application/pdf');

    if (!url || url.startsWith('blob:')) {
      return null;
    }

    if (url.startsWith('data:')) {
      const [metadata, payload] = url.split(',');
      if (!payload) {
        return null;
      }

      if (metadata.includes(';base64')) {
        if (isPDF) {
          return { base64: payload };
        }
        const buffer = Buffer.from(payload, 'base64');
        return { text: buffer.toString('utf-8') };
      }

      const decoded = decodeURIComponent(payload);
      if (isPDF) {
        return { base64: Buffer.from(decoded, 'utf-8').toString('base64') };
      }
      return { text: decoded };
    }

    if (url.startsWith('http')) {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (isPDF) {
        return { base64: buffer.toString('base64') };
      }

      return { text: buffer.toString('utf-8') };
    }

    return null;
  } catch (error) {
    console.error('fetchFileContent failed:', error);
    return null;
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


/**
 * 메모리에서 언어 선호도 추출 함수
 * "About You" (00-personal-info) 메모리의 "## Basic Details" 섹션에서 "Language preference:" 찾기
 */
export function extractLanguagePreference(memoryData: string | null): string | null {
  if (!memoryData) return null;
  
  try {
    // "## 00 Personal Info" 또는 "## 00-personal-info" 섹션 찾기 (About You 카테고리)
    const personalInfoMatch = memoryData.match(/##\s+00\s+(?:Personal\s+Info|personal-info)\s+([\s\S]*?)(?=##\s+\d+|---|$)/i);
    if (!personalInfoMatch) {
      // 대체: "## Basic Details" 섹션 직접 찾기 (다른 형식 지원)
      const basicDetailsMatch = memoryData.match(/##\s+Basic\s+Details\s+([\s\S]*?)(?=##|$)/i);
      if (!basicDetailsMatch) return null;
      
      const basicDetailsSection = basicDetailsMatch[1];
      
      // "Language preference:" 또는 "Language preference" 패턴 찾기
      const languageMatch = basicDetailsSection.match(/Language\s+preference:\s*(.+?)(?:\n|$)/i);
      if (!languageMatch) return null;
      
      const language = languageMatch[1].trim();
      
      // 빈 값이나 플레이스홀더 제외
      if (!language || 
          language === '[Extract from conversation]' || 
          language === '[To be determined from conversations]' ||
          (language.startsWith('[') && language.endsWith(']'))) {
        return null;
      }
      
      return language;
    }
    
    const personalInfoSection = personalInfoMatch[1];
    
    // "## Basic Details" 서브섹션 찾기
    const basicDetailsMatch = personalInfoSection.match(/##\s+Basic\s+Details\s+([\s\S]*?)(?=##|$)/i);
    if (!basicDetailsMatch) return null;
    
    const basicDetailsSection = basicDetailsMatch[1];
    
    // "Language preference:" 또는 "Language preference" 패턴 찾기
    const languageMatch = basicDetailsSection.match(/Language\s+preference:\s*(.+?)(?:\n|$)/i);
    if (!languageMatch) return null;
    
    const language = languageMatch[1].trim();
    
    // 빈 값이나 플레이스홀더 제외
    if (!language || 
        language === '[Extract from conversation]' || 
        language === '[To be determined from conversations]' ||
        (language.startsWith('[') && language.endsWith(']'))) {
      return null;
    }
    
    return language;
  } catch (error) {
    console.error('Error extracting language preference:', error);
    return null;
  }
}

/**
 * 후속 질문 생성 함수
 */
export async function generateFollowUpQuestions(
  userQuery: string,
  aiResponse: string,
  languagePreference?: string | null
): Promise<string[]> {
  try {
    const contextInfo = 'The AI has provided a text response to the user.';
    
    const languageInstruction = languagePreference 
      ? `\n**LANGUAGE PREFERENCE:** The user's preferred language is "${languagePreference}". Generate all follow-up questions in this language.`
      : '\n**LANGUAGE:** Respond in the same language as the user\'s original query.';
    
    const followUpResult = await generateObject({
      model: providers.languageModel('gemini-2.5-flash-lite'),
      prompt: `You are generating follow-up questions that a USER would naturally ask to continue the conversation with an AI assistant.

**CRITICAL INSTRUCTION: Generate exactly 3 follow-up questions—no more, no less. Keep each very short and concise (under 15 words) so they are easy to read and click.**

User's original query: "${userQuery}"
AI's response: "${aiResponse}"
Context: ${contextInfo}${languageInstruction}

**UNIVERSAL QUESTION STYLE (Always Apply):**
- Generate VERY SHORT questions (under 15 words each)
- Focus on immediate, actionable follow-ups
- Make them easy to scan and click
- Avoid long, complex questions that users might skip
- Prioritize curiosity-driven, specific questions over broad ones

**SHORT QUESTION EXAMPLES:**
✅ "Show me the code for this"
✅ "What are the alternatives?"
✅ "How does this work in practice?"
✅ "Any real-world examples?"
✅ "What's the next step?"
✅ "Explain this simpler"


**WRONG EXAMPLES (Don't generate these):**
❌ "What details would you like me to emphasize in this image?"
❌ "Which style would you prefer?"
❌ "Do you want me to modify anything?"
❌ "Would you like me to create variations?"
❌ Long, complex questions that are hard to scan

**STYLE & FORMAT:**
- Exactly 3 questions only (maximum 3—do not exceed)
- Very short (under 15 words each), easy to scan and click
- Natural, clear, simple language
- Same language as the user's query`,
      schema: z.object({
        followup_questions: z.array(z.string()).min(1).max(10)
      })
    });

    const raw = followUpResult.object.followup_questions;
    return Array.isArray(raw) ? raw.slice(0, 3) : [];
  } catch (e) { 
    console.error('Error generating follow-up questions:', e);
    return [];
  }
}

/**
 * 전체 메시지 배열에서 이미지 ID 맵을 생성
 * tools.ts의 createGeminiImageTool/createSeedreamImageTool과 동일한 로직
 * 🔥 parts 배열 (AI SDK v5) + tool_results (레거시) 모두 처리
 */
function buildGlobalImageIdMap(messages: any[]): Map<string, { prompt: string, type: string, messageId?: string }> {
  const imageIdMap = new Map();
  let generatedImageIndex = 1;  // 전역 누적 카운터
  
  for (const message of messages) {
    let foundInParts = false;
    
    // 1️⃣ [Primary] AI SDK v5: parts 배열 처리 (tools.ts와 동일한 로직)
    if (message.parts && Array.isArray(message.parts)) {
      for (const part of message.parts) {
        // v5 도구 결과 파트 (Gemini, Seedream 통합 수집)
        // 🔥 실제 DB 구조: type="tool-${toolName}" (예: "tool-seedream_image_tool")
        const imageToolNames = ['gemini_image_tool', 'seedream_image_tool', 'qwen_image_edit'];
        const isImageToolResult = imageToolNames.some(toolName => 
          part.type === `tool-${toolName}` || // 실제 DB 구조: "tool-seedream_image_tool"
          (part.type === 'tool-result' && part.toolName === toolName) // AI SDK 표준 구조
        );
        
        if (isImageToolResult && part.state === 'output-available' && part.output) {
          const result = part.output?.value || part.output;
          if (result && result.success !== false) {
            const images = Array.isArray(result) ? result : (result.images || (result.imageUrl ? [result] : []));
            for (const img of images) {
              if (img.imageUrl && img.path) {
                const imageId = `generated_image_${generatedImageIndex}`;
                const prompt = img.prompt || img.originalPrompt || result.prompt || 'No prompt';
                
                // 도구 타입 판별
                let type = 'Generated';
                if (part.type === 'tool-gemini_image_tool' || part.toolName === 'gemini_image_tool') {
                  type = 'Gemini';
                } else if (part.type === 'tool-seedream_image_tool' || part.toolName === 'seedream_image_tool') {
                  type = 'Seedream';
                } else if (part.type === 'tool-qwen_image_edit' || part.toolName === 'qwen_image_edit') {
                  type = 'Qwen';
                }
                
                imageIdMap.set(imageId, { 
                  prompt, 
                  type,
                  messageId: message.id 
                });
                generatedImageIndex++;
                foundInParts = true;
              }
            }
          }
        }
      }
    }
    
    // 2️⃣ [Backup] 기존 구조 처리 (parts에서 찾지 못한 경우만 - 중복 방지)
    if (!foundInParts) {
      // Gemini 이미지 (tool_results - 레거시 형식)
      if (message.tool_results?.geminiImageResults && Array.isArray(message.tool_results.geminiImageResults)) {
        for (const img of message.tool_results.geminiImageResults) {
          if (img.imageUrl && img.path) {
            const imageId = `generated_image_${generatedImageIndex}`;
            const prompt = img.prompt || img.originalPrompt || 'No prompt';
            imageIdMap.set(imageId, { 
              prompt, 
              type: 'Gemini',
              messageId: message.id 
            });
            generatedImageIndex++;
          }
        }
      }
      
      // Seedream 이미지 (tool_results - 레거시 형식)
      if (message.tool_results?.seedreamImageResults && Array.isArray(message.tool_results.seedreamImageResults)) {
        for (const img of message.tool_results.seedreamImageResults) {
          if (img.imageUrl && img.path) {
            const imageId = `generated_image_${generatedImageIndex}`;
            const prompt = img.prompt || img.originalPrompt || 'No prompt';
            imageIdMap.set(imageId, { 
              prompt, 
              type: 'Seedream',
              messageId: message.id 
            });
            generatedImageIndex++;
          }
        }
      }

      // Qwen 이미지 (tool_results - 레거시 형식)
      if (message.tool_results?.qwenImageResults && Array.isArray(message.tool_results.qwenImageResults)) {
        for (const img of message.tool_results.qwenImageResults) {
          if (img.imageUrl && img.path) {
            const imageId = `generated_image_${generatedImageIndex}`;
            const prompt = img.prompt || img.originalPrompt || 'No prompt';
            imageIdMap.set(imageId, { 
              prompt, 
              type: 'Qwen',
              messageId: message.id 
            });
            generatedImageIndex++;
          }
        }
      }
    }
  }
  
  return imageIdMap;
}

/**
 * 메시지에서 실제로 참조된 IMAGE_ID 추출
 * AI 응답 텍스트에 [IMAGE_ID:...]로 포함된 이미지만 반환
 */
function extractReferencedImageIds(message: any): Set<string> {
  const referencedIds = new Set<string>();
  
  // parts 배열에서 추출
  if (message.parts && Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (part.type === 'text' && part.text) {
        // 매번 새 정규식 생성 (global 플래그 때문에)
        const regex = /\[IMAGE_ID:([^\]]+)\]/g;
        let match;
        while ((match = regex.exec(part.text)) !== null) {
          referencedIds.add(match[1]);
        }
      }
    }
  }
  
  // content 배열에서 추출 (레거시)
  if (message.content && typeof message.content === 'string') {
    // 매번 새 정규식 생성 (global 플래그 때문에)
    const regex = /\[IMAGE_ID:([^\]]+)\]/g;
    let match;
    while ((match = regex.exec(message.content)) !== null) {
      referencedIds.add(match[1]);
    }
  }
  
  return referencedIds;
}

/**
 * 도구 결과 요약 함수들 - AI 컨텍스트 토큰 절감을 위한 최소 메타데이터 추출
 */

// Twitter 검색 요약: 검색어, 결과 개수, linkId만
function summarizeTwitterSearch(results: any): string {
  const searches = results.searches || [];
  const lines = [`[Twitter Search: ${results.searchId}]`];
  
  searches.forEach((search: any, i: number) => {
    lines.push(`Query ${i+1}: "${search.query}" (${search.totalResults} results)`);
    (search.results || []).forEach((tweet: any) => {
      lines.push(`  - ${tweet.linkId}: @${tweet.author?.username || 'unknown'}`);
    });
  });
  
  return lines.join('\n');
}

// Google 검색 요약: 검색어, 결과 개수, linkId, 그리고 실제 참조된 이미지만
function summarizeGoogleSearch(results: any, referencedImageIds?: Set<string>): string {
  if (!Array.isArray(results)) return '';
  
  const lines = ['[Google Search]'];
  // results는 googleSearchResults 배열: [{ searchId, searches: [...], imageMap: {...} }, ...]
  results.forEach((result: any) => {
    // 각 result의 searches 배열 처리
    if (result.searches && Array.isArray(result.searches)) {
      result.searches.forEach((search: any) => {
        lines.push(`Query: "${search.query}" (${search.totalResults || search.results?.length || 0} results)`);
        (search.results || []).forEach((linkResult: any) => {
          lines.push(`  - ${linkResult.linkId}: ${linkResult.title || 'No title'}`);
        });
        
        // 실제 참조된 이미지만 포함
        if (referencedImageIds && search.images && Array.isArray(search.images)) {
          const referencedImages = search.images.filter((img: any) => 
            img.id && referencedImageIds.has(img.id)
          );
          if (referencedImages.length > 0) {
            lines.push(`  Referenced images (${referencedImages.length}):`);
            referencedImages.forEach((img: any, idx: number) => {
              const description = img.description || img.title || `Image ${idx + 1}`;
              lines.push(`    - ${img.id}: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`);
            });
          }
        }
      });
    }
  });
  
  return lines.join('\n');
}

// YouTube 검색 요약: 검색어, 결과 개수, 비디오 제목만
function summarizeYouTubeSearch(results: any): string {
  if (!Array.isArray(results)) return '';
  
  const lines = ['[YouTube Search]'];
  results.forEach((search: any) => {
    lines.push(`Query: "${search.query}" (${search.totalResults || 0} results)`);
    (search.results || []).forEach((video: any, i: number) => {
      lines.push(`  ${i+1}. ${video.title || 'No title'} (${video.videoId})`);
    });
  });
  
  return lines.join('\n');
}

// Link Reader 요약: URL과 linkId만
function summarizeLinkReader(results: any): string {
  if (!Array.isArray(results)) return '';
  
  const lines = ['[Link Reader]'];
  results.forEach((link: any) => {
    lines.push(`  - ${link.linkId}: ${link.url}`);
  });
  
  return lines.join('\n');
}

/**
 * 특정 메시지의 이미지를 전역 ID 맵 기반으로 요약
 * 실제 참조된 이미지만 포함 (일관성을 위해 검색 이미지와 동일한 방식)
 */
function summarizeImagesForMessage(
  messageId: string | undefined,
  toolResults: any, 
  globalImageIdMap: Map<string, { prompt: string, type: string, messageId?: string }>,
  referencedImageIds?: Set<string>
): string {
  if (!messageId) return '';
  
  const lines: string[] = [];
  
  // 전역 맵에서 이 메시지에 속한 이미지 찾기
  for (const [imageId, info] of globalImageIdMap.entries()) {
    if (info.messageId === messageId) {
      // 실제 참조된 이미지만 포함 (referencedImageIds가 제공된 경우)
      if (referencedImageIds && !referencedImageIds.has(imageId)) {
        continue;
      }
      
      const truncatedPrompt = info.prompt.substring(0, 60);
      const ellipsis = info.prompt.length > 60 ? '...' : '';
      lines.push(`  ${imageId}: "${truncatedPrompt}${ellipsis}" [${info.type}]`);
    }
  }
  
  return lines.length > 0 ? `[Generated Images]\n${lines.join('\n')}` : '';
}

/**
 * 🔥 전체 이미지 목록을 AI 컨텍스트용으로 요약
 * AI가 "마지막 이미지", "최근 이미지" 등의 참조를 정확히 해석할 수 있도록 함
 */
function buildImageContextSummary(
  globalImageIdMap: Map<string, { prompt: string, type: string, messageId?: string }>
): string {
  if (globalImageIdMap.size === 0) return '';
  
  const entries = Array.from(globalImageIdMap.entries());
  const totalCount = entries.length;
  const latestImageId = `generated_image_${totalCount}`;
  
  const lines: string[] = [
    `## Available Generated Images in This Conversation`,
    ``,
    `**Total: ${totalCount} image(s)**`,
    `- Image IDs: generated_image_1 through generated_image_${totalCount}`,
    `- **Latest (most recent):** ${latestImageId}`,
    ``
  ];
  
  // 최근 5개 이미지 상세 정보 (토큰 절약)
  const recentCount = Math.min(5, totalCount);
  if (recentCount > 0) {
    lines.push(`**Recent ${recentCount} image(s):**`);
    const recentEntries = entries.slice(-recentCount);
    for (const [imageId, info] of recentEntries) {
      const truncatedPrompt = info.prompt.substring(0, 50);
      const ellipsis = info.prompt.length > 50 ? '...' : '';
      lines.push(`- ${imageId}: "${truncatedPrompt}${ellipsis}" [${info.type}]`);
    }
  }
  
  return lines.join('\n');
}

// Web Search 요약 (web_search 도구)
function summarizeWebSearch(results: any, referencedImageIds?: Set<string>): string {
  if (!Array.isArray(results)) return '';
  
  const lines = ['[Web Search]'];
  // results는 webSearchResults 배열: [{ searchId, searches: [...], imageMap: {...} }, ...]
  results.forEach((result: any) => {
    // 각 result의 searches 배열 처리
    if (result.searches && Array.isArray(result.searches)) {
      result.searches.forEach((search: any) => {
        lines.push(`Query: "${search.query}" (${search.totalResults || 0} results)`);
        (search.results || []).forEach((linkResult: any) => {
          lines.push(`  - ${linkResult.linkId}: ${linkResult.title || 'No title'}`);
        });
        
        // 실제 참조된 이미지만 포함
        if (referencedImageIds && search.images && Array.isArray(search.images)) {
          const referencedImages = search.images.filter((img: any) => 
            img.id && referencedImageIds.has(img.id)
          );
          if (referencedImages.length > 0) {
            lines.push(`  Referenced images (${referencedImages.length}):`);
            referencedImages.forEach((img: any, idx: number) => {
              const description = img.description || `Image ${idx + 1}`;
              lines.push(`    - ${img.id}: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`);
            });
          }
        }
      });
    }
  });
  
  return lines.join('\n');
}

/**
 * 통합 도구 결과 요약 함수
 */
function summarizeToolResults(
  messageId: string | undefined,
  toolResults: any, 
  globalImageIdMap: Map<string, { prompt: string, type: string, messageId?: string }>,
  message?: any  // 메시지 전체를 받아서 참조된 이미지 ID 추출
): string {
  const summaries: string[] = [];
  
  // 메시지에서 실제 참조된 이미지 ID 추출
  const referencedImageIds = message ? extractReferencedImageIds(message) : undefined;
  
  // 검색 도구 (기존 로직 유지)
  if (toolResults.twitterSearchResults) {
    summaries.push(summarizeTwitterSearch(toolResults.twitterSearchResults));
  }
  
  if (toolResults.googleSearchResults) {
    summaries.push(summarizeGoogleSearch(toolResults.googleSearchResults, referencedImageIds));
  }
  
  if (toolResults.youtubeSearchResults) {
    summaries.push(summarizeYouTubeSearch(toolResults.youtubeSearchResults));
  }
  
  if (toolResults.webSearchResults) {
    summaries.push(summarizeWebSearch(toolResults.webSearchResults, referencedImageIds));
  }
  
  if (toolResults.linkReaderResults) {
    summaries.push(summarizeLinkReader(toolResults.linkReaderResults));
  }
  
  // 이미지 생성 (새로운 방식 - 전역 ID 맵 사용)
  if (toolResults.geminiImageResults || toolResults.seedreamImageResults || toolResults.qwenImageResults) {
    const imageSummary = summarizeImagesForMessage(messageId, toolResults, globalImageIdMap, referencedImageIds);
    if (imageSummary) {
      summaries.push(imageSummary);
    }
  }
  
  // 기타 도구 결과가 있으면 간단히 언급만
  const handledKeys = [
    'twitterSearchResults', 'googleSearchResults', 'youtubeSearchResults',
    'webSearchResults', 'linkReaderResults', 'geminiImageResults', 
    'seedreamImageResults', 'qwenImageResults', 'structuredResponse', 'token_usage'
  ];
  const otherKeys = Object.keys(toolResults).filter(k => !handledKeys.includes(k));
  if (otherKeys.length > 0) {
    summaries.push(`[Other Tools: ${otherKeys.join(', ')}]`);
  }
  
  return summaries.filter(s => s).join('\n\n');
}

/**
 * 공통 메시지 처리 함수 - 에이전트 모드와 일반 모드에서 공통으로 사용
 */
export async function processMessagesForAI(messagesWithTokens: any[], model?: string): Promise<ModelMessage[]> {
  
  // GPT-5 모델인지 확인
  const isGPT5 = model && model.startsWith('gpt-5') && model !== 'gpt-5-chat-latest';
  
  // 🚀 Gemini 모델인지 확인 (thought_signature 보존 필요)
  const isGemini = model && (model.startsWith('gemini') || model.includes('gemini'));
  
  // 🔥 Fireworks 모델인지 확인 (extra_content 제거 필요)
  const isFireworks = model && (
    model.startsWith('accounts/fireworks/models/') || 
    model.includes('fireworks') ||
    model.includes('kimi-k2') ||
    getProviderFromModel(model) === 'fireworks'
  );
  
  // 1️⃣ 먼저 전체 메시지에서 전역 이미지 ID 맵 생성
  const globalImageIdMap = buildGlobalImageIdMap(messagesWithTokens);
  
  // 2️⃣ 최근 2개 메시지 중 tool_results가 있는 메시지 필터링
  const RECENT_TOOL_RESULTS_COUNT = 2;
  const messagesWithToolResults = new Set(
    messagesWithTokens
      .filter(m => m.tool_results && Object.keys(m.tool_results).length > 0)
      .slice(-RECENT_TOOL_RESULTS_COUNT)
  );
  
  // 코드파일/텍스트파일을 텍스트로 변환 (UI는 파일로 유지)
  const processedMessages = await Promise.all(messagesWithTokens.map(async (msg: any) => {
    if (!msg.parts || !Array.isArray(msg.parts)) {
      return msg;
    }
    
    // 메시지에 function_call이 있는지 먼저 확인 (reasoning과의 관계 체크용)
    const hasFunctionCall = msg.parts.some((p: any) => 
      p.type === 'function_call' || 
      p.type === 'tool-call' || 
      (p.type && typeof p.type === 'string' && p.type.startsWith('tool-'))
    );
    
    const processedParts = await Promise.all(msg.parts.map(async (part: any) => {
      // 🚀 Anthropic API 호환성: 완료되지 않은 tool call 제거
      // AI SDK v5 형식: type이 "tool-"로 시작하고 toolCallId가 있는 경우
      if (part.type && typeof part.type === 'string' && part.type.startsWith('tool-')) {
        // 완료되지 않은 tool call 제거
        // 조건: toolCallId가 있고, output이 없거나 state가 "input-available"인 경우
        // 이는 Anthropic API의 tool_use/tool_result 요구사항을 위반할 수 있음
        // Anthropic은 tool_use가 있으면 반드시 다음 메시지에 tool_result가 있어야 함
        // 주의: output이 없으면 완료되지 않은 것으로 간주 (state와 관계없이)
        if (part.toolCallId && !part.output) {
          // state가 명시적으로 "output-available"이 아니면 제거
          // (state가 없거나 "input-available"이면 제거)
          if (!part.state || part.state !== 'output-available') {
            return null;
          }
        }
        
        // 🚀 Gemini API 호환성: thought_signature 보존
        // Gemini 모델에서는 function call에 thought_signature가 필수
        // part에 thought_signature가 있으면 보존하고, 없으면 providerMetadata에서 찾아서 추가
        if (isGemini && part.input) {
          // thought_signature가 이미 있으면 그대로 유지
          if (part.thought_signature) {
            return part;
          }
          // providerMetadata에서 thought_signature 찾기
          if (part.providerMetadata?.google?.thought_signature) {
            return {
              ...part,
              thought_signature: part.providerMetadata.google.thought_signature
            };
          }
          // 히스토리에서 가져온 메시지에 thought_signature가 없는 경우
          // AI SDK의 convertToModelMessages가 처리하지만, 혹시 모를 경우를 대비해
          // part 자체에 thought_signature 필드가 있는지 확인
          // (convertToModelMessages가 Gemini 형식으로 변환할 때 처리됨)
        }
        
        // 🔥 Fireworks API 호환성: callProviderMetadata 제거
        // Fireworks 모델에서는 callProviderMetadata가 extra_content로 변환되어 에러 발생
        // Gemini에서 온 메시지의 callProviderMetadata를 Fireworks 모델 사용 시 제거
        if (isFireworks && part.callProviderMetadata) {
          const { callProviderMetadata, ...cleanedPart } = part;
          return cleanedPart;
        }
        
        // 완료된 tool call은 유지 (convertToModelMessages가 tool_use/tool_result로 변환함)
        // 완료된 tool call은 output이 있거나 state가 "output-available"임
        return part;
      }
      
      // tool-call과 tool-result는 제거 (streamText의 tools 파라미터로 도구 호출 가능)
      // 단, AI SDK v5 형식의 tool-* 타입은 위에서 처리됨
      if (part.type === 'tool-call' || part.type === 'tool-result') {
        return null;
      }
      
      // GPT-5의 경우 reasoning 데이터는 그대로 유지
      if (part.type === 'reasoning') {
        if (isGPT5) {
          // function_call이 있거나 reasoning part에 providerMetadata itemId가 있는 경우, 
          // 빈 reasoning이라도 유지해야 함 (OpenAI API 에러 방지)
          const hasReasoningId = part.providerMetadata?.openai?.itemId && 
                                 part.providerMetadata.openai.itemId.startsWith('rs_');
          
          // 🚀 메시지에 tool-call이 있고 reasoning part가 있으면, 
          // tool-call이 해당 reasoning을 참조할 수 있으므로 항상 유지
          // (tool-call이 제거되더라도 reasoning은 유지되어야 함)
          if (hasFunctionCall || hasReasoningId) {
            // function_call이 있거나 reasoning ID가 있으면 빈 텍스트라도 포함하여 유지
            return {
              ...part,
              text: part.text || part.reasoningText || '',
              reasoningText: part.reasoningText || part.text || ''
            };
          }
          // function_call이 없고 reasoning ID도 없고 텍스트도 없으면 null 반환 (나중에 필터링됨)
          if (!part.text || part.text.trim().length === 0) {
            return null;
          }
          return part; // GPT-5에서는 reasoning 데이터 유지
        } else {
          // 다른 모델의 경우 reasoning을 text로 변환
          const reasoningText = part.reasoningText || part.text || '';
          if (!reasoningText.trim()) {
            return null; // 빈 텍스트는 필터링
          }
          return {
            type: 'text',
            text: reasoningText
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
          const fileContent = await fetchFileContent(part.url, part.mediaType);
          if (fileContent?.text) {
            return {
              type: 'text',
              text: formatFileTextForPrompt(part.filename, fileContent.text),
            };
          } else if (fileContent?.base64) {
            // PDF 파일인 경우 (fallback)
            return {
              type: 'file',
              url: part.url,
              mediaType: 'application/pdf',
              filename: part.filename || 'document.pdf',
            };
          }
        } catch (error) {
          console.error('Failed to read file content:', error);
          return {
            type: 'text',
            text: `Failed to read file: ${part.filename || 'unknown'}`,
          };
        }
      }
      return part;
    }));
    
    // null 값 (빈 reasoning part 등)을 필터링
    const filteredParts = processedParts.filter((part: any) => part !== null);
    
    // 빈 parts 배열이면 최소한 빈 텍스트 part 하나 추가
    const finalParts = filteredParts.length > 0 
      ? filteredParts 
      : [{ type: 'text', text: '' }];
    
    // 3️⃣ 최근 2개 메시지 중 하나이고 tool_results가 있으면 요약본 추가
    if (messagesWithToolResults.has(msg) && msg.tool_results) {
      const summary = summarizeToolResults(msg.id, msg.tool_results, globalImageIdMap, msg);
      if (summary) {
        finalParts.push({
          type: 'text',
          text: `\n\n---\n[Previous Tool Results]\n${summary}\n---\n`
        });
      }
    }
    
    // 모델 입력에는 불필요하게 큰 도구 결과(tool_results 등)는 포함하지 않되,
    // GPT-5 reasoning 등 프로바이더 메타데이터는 그대로 유지하기 위해
    // 원본 메시지에서 tool_results만 제거하고 나머지 필드는 보존한다.
    const { tool_results, ...rest } = msg;

    return {
      ...rest,
      parts: finalParts,
    };
  }));
  
  // 🔥 전체 이미지 목록을 마지막 사용자 메시지에 추가
  // AI가 "마지막 이미지", "최근 이미지" 등의 참조를 정확히 해석할 수 있도록 함
  if (globalImageIdMap.size > 0) {
    const imageContextSummary = buildImageContextSummary(globalImageIdMap);
    if (imageContextSummary) {
      // 마지막 사용자 메시지 찾기 (역순으로 검색)
      for (let i = processedMessages.length - 1; i >= 0; i--) {
        const msg = processedMessages[i];
        if (msg.role === 'user' && msg.parts && Array.isArray(msg.parts)) {
          // 마지막 사용자 메시지에 이미지 컨텍스트 추가
          msg.parts.push({
            type: 'text',
            text: `\n\n---\n${imageContextSummary}\n---\n`
          });
          break;
        }
      }
    }
  }
  
  const result = convertToModelMessages(processedMessages);
  
  // 🚀 Gemini API 호환성: convertToModelMessages 후 thought_signature 보존 확인
  // Gemini 모델에서는 function call에 thought_signature가 필수
  // convertToModelMessages가 Gemini 형식으로 변환한 후, function call parts에 thought_signature 확인
  if (isGemini && result && Array.isArray(result)) {
    for (const msg of result) {
      // Gemini 형식: 메시지가 content 배열을 가지거나 parts 배열을 가질 수 있음
      const content = (msg as any).content;
      if (Array.isArray(content)) {
        for (const part of content) {
          // 1. functionCall이 있는 part (레거시/직접 호출)
          if (part.functionCall && !part.thought_signature) {
             part.thought_signature = 'skip_thought_signature_validator';
          }
          
          // 2. tool-call 타입 part (AI SDK 표준)
          if (part.type === 'tool-call') {
            // providerMetadata에 thought_signature가 있는지 확인
            const hasSignature = part.providerMetadata?.google?.thought_signature;
            
            if (!hasSignature) {
              // 없으면 providerMetadata에 추가
              if (!part.providerMetadata) part.providerMetadata = {};
              if (!part.providerMetadata.google) part.providerMetadata.google = {};
              
              // 더미 서명 추가 (Gemini API 요구사항)
              part.providerMetadata.google.thought_signature = 'skip_thought_signature_validator';
            }
          }
        }
      }
      
      // parts 배열도 확인 (일부 포맷 호환성)
      const parts = (msg as any).parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part.functionCall && !part.thought_signature) {
            part.thought_signature = 'skip_thought_signature_validator';
          }
          
          if (part.type === 'tool-call') {
            const hasSignature = part.providerMetadata?.google?.thought_signature;
            if (!hasSignature) {
              if (!part.providerMetadata) part.providerMetadata = {};
              if (!part.providerMetadata.google) part.providerMetadata.google = {};
              part.providerMetadata.google.thought_signature = 'skip_thought_signature_validator';
            }
          }
        }
      }
    }
  }
  
  return result;
}

/**
 * 🔥 Fireworks API 호환성: 메시지에서 extra_content 제거
 * API 호출 직전 안전장치로 tool_calls의 extra_content 제거
 */
export function removeExtraContentFromMessages(messages: ModelMessage[], model?: string): ModelMessage[] {
  // Fireworks 모델인지 확인
  const isFireworks = model && (
    model.startsWith('accounts/fireworks/models/') || 
    model.includes('fireworks') ||
    model.includes('kimi-k2') ||
    getProviderFromModel(model) === 'fireworks'
  );
  
  if (!isFireworks || !messages || !Array.isArray(messages)) {
    return messages;
  }
  
  return messages.map((msg: any) => {
    // tool_calls에서 extra_content 제거
    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
      const cleanedToolCalls = msg.tool_calls.map((toolCall: any) => {
        if ('extra_content' in toolCall) {
          const { extra_content, ...rest } = toolCall;
          return rest;
        }
        return toolCall;
      });
      return { ...msg, tool_calls: cleanedToolCalls };
    }
    return msg;
  });
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

