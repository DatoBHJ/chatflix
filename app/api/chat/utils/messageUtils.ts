import { Buffer } from 'buffer';
import { type ModelMessage } from 'ai';
import { providers } from '@/lib/providers';
import { generateObject, convertToModelMessages } from 'ai';
import { z } from 'zod';

export const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const MAX_FILE_CONTENT_CHARS = 12000;
/** Suffix appended when file content is truncated; strip this for display and show line-based highlight instead. */
export const FILE_TRUNCATION_SUFFIX = '\n...[truncated, use read_file in workspace if available]';
const TRUNCATION_SUFFIX = FILE_TRUNCATION_SUFFIX;

export const truncateFileText = (content: string) => {
  if (content.length <= MAX_FILE_CONTENT_CHARS) {
    return { text: content, truncated: false };
  }
  return {
    text: content.slice(0, MAX_FILE_CONTENT_CHARS) + TRUNCATION_SUFFIX,
    truncated: true,
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
        const imageToolNames = ['gemini_image_tool', 'seedream_image_tool', 'qwen_image_edit', 'image_upscaler'];
        const isImageToolResult = imageToolNames.some(toolName => 
          part.type === `tool-${toolName}` || // 실제 DB 구조: "tool-seedream_image_tool"
          (part.type === 'tool-result' && part.toolName === toolName) // AI SDK 표준 구조
        );
        
        if (isImageToolResult && (part.state === 'output-available' || part.output) && part.output) {
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
                } else if (part.type === 'tool-image_upscaler' || part.toolName === 'image_upscaler') {
                  type = 'Upscaled 8K';
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

      // Image upscaler (tool_results - 레거시 형식)
      if (message.tool_results?.imageUpscalerResults && Array.isArray(message.tool_results.imageUpscalerResults)) {
        for (const img of message.tool_results.imageUpscalerResults) {
          if (img.imageUrl && img.path) {
            const imageId = `generated_image_${generatedImageIndex}`;
            const prompt = img.prompt || img.originalPrompt || 'No prompt';
            imageIdMap.set(imageId, { 
              prompt, 
              type: 'Upscaled 8K',
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

function buildGlobalVideoIdMap(messages: any[]): Map<string, { prompt: string, type: string, messageId?: string }> {
  const videoIdMap = new Map<string, { prompt: string, type: string, messageId?: string }>();
  let generatedVideoIndex = 1;
  const seenVideoKeys = new Set<string>();

  for (const message of messages) {
    let foundInParts = false;

    if (message.parts && Array.isArray(message.parts)) {
      for (const part of message.parts) {
        const isVideoToolResult =
          part.type?.startsWith('tool-wan25_') ||
          part.type?.startsWith('tool-grok_') ||
          part.type?.startsWith('tool-video_upscaler') ||
          (part.type === 'tool-result' &&
            ['wan25_video', 'grok_video', 'video_upscaler'].includes(part.toolName));

        if (isVideoToolResult) {
          const result = part.output?.value || part.output || part.result;
          if (result && result.success !== false && Array.isArray(result.videos)) {
            for (const vid of result.videos) {
              const dedupKey = vid.path || vid.videoUrl;
              if ((vid.videoUrl || vid.path) && dedupKey && !seenVideoKeys.has(dedupKey)) {
                seenVideoKeys.add(dedupKey);
                const videoId = `generated_video_${generatedVideoIndex}`;
                const prompt = vid.prompt || result.prompt || 'No prompt';
                let type = 'Video';
                if (part.type?.includes('wan25_') || part.toolName === 'wan25_video') type = 'Wan 2.5';
                else if (part.type?.includes('grok_') || part.toolName === 'grok_video') type = 'Grok';
                else if (part.type?.includes('video_upscaler') || part.toolName === 'video_upscaler') type = 'Upscaled 4K';
                videoIdMap.set(videoId, { prompt, type, messageId: message.id });
                generatedVideoIndex++;
                foundInParts = true;
              }
            }
          }
        }

        if (
          (part.type === 'data-wan25_video_complete' ||
            part.type === 'data-grok_video_complete' ||
            part.type === 'data-video_upscaler_complete') &&
          (part.data?.videoUrl || part.data?.path)
        ) {
          const dedupKey = part.data?.path || part.data?.videoUrl;
          if (!dedupKey || seenVideoKeys.has(dedupKey)) {
            continue;
          }
          seenVideoKeys.add(dedupKey);
          const videoId = `generated_video_${generatedVideoIndex}`;
          const prompt = part.data?.prompt || 'No prompt';
          let type = 'Video';
          if (part.type === 'data-wan25_video_complete') type = 'Wan 2.5';
          else if (part.type === 'data-grok_video_complete') type = 'Grok';
          else if (part.type === 'data-video_upscaler_complete') type = 'Upscaled 4K';
          videoIdMap.set(videoId, { prompt, type, messageId: message.id });
          generatedVideoIndex++;
          foundInParts = true;
        }
      }
    }

    if (!foundInParts && message.tool_results) {
      const mergedVideos = [
        ...(Array.isArray(message.tool_results.wan25VideoResults) ? message.tool_results.wan25VideoResults : []),
        ...(Array.isArray(message.tool_results.grokVideoResults) ? message.tool_results.grokVideoResults : []),
        ...(Array.isArray(message.tool_results.videoUpscalerResults) ? message.tool_results.videoUpscalerResults : []),
      ];
      for (const vid of mergedVideos) {
        const dedupKey = vid.path || vid.videoUrl;
        if ((vid.videoUrl || vid.path) && dedupKey && !seenVideoKeys.has(dedupKey)) {
          seenVideoKeys.add(dedupKey);
          const videoId = `generated_video_${generatedVideoIndex}`;
          const prompt = vid.prompt || 'No prompt';
          const type = vid.targetResolution === '4k' ? 'Upscaled 4K' : (vid.isVideoEdit ? 'Grok Video Edit' : (vid.isImageToVideo ? 'Image to Video' : 'Video'));
          videoIdMap.set(videoId, { prompt, type, messageId: message.id });
          generatedVideoIndex++;
        }
      }
    }
  }

  return videoIdMap;
}

function buildVideoContextSummary(
  globalVideoIdMap: Map<string, { prompt: string, type: string, messageId?: string }>
): string {
  if (globalVideoIdMap.size === 0) return '';

  const entries = Array.from(globalVideoIdMap.entries());
  const totalCount = entries.length;
  const latestVideoId = `generated_video_${totalCount}`;
  const lines: string[] = [
    `## Available Generated Videos in This Conversation`,
    ``,
    `**Total: ${totalCount} video(s)**`,
    `- Video IDs: generated_video_1 through generated_video_${totalCount}`,
    `- **Latest (most recent):** ${latestVideoId}`,
    ``,
  ];

  const recentCount = Math.min(3, totalCount);
  lines.push(`**Recent ${recentCount} video(s):**`);
  for (const [videoId, info] of entries.slice(-recentCount)) {
    const truncatedPrompt = info.prompt.substring(0, 60);
    const ellipsis = info.prompt.length > 60 ? '...' : '';
    lines.push(`- ${videoId}: "${truncatedPrompt}${ellipsis}" [${info.type}]`);
  }

  return lines.join('\n');
}

function summarizeToolOutputForAnthropic(part: any): string {
  const toolName = typeof part.type === 'string' ? part.type.replace(/^tool-/, '') : 'tool';
  if (!part.output) {
    return `[Tool ${toolName}]`;
  }

  try {
    const raw = JSON.stringify(part.output);
    const truncated = raw.length > 1500 ? `${raw.slice(0, 1500)}...` : raw;
    return `[Tool ${toolName} output]\n${truncated}`;
  } catch (error) {
    return `[Tool ${toolName} output unavailable]`;
  }
}

/**
 * 공통 메시지 처리 함수 - 에이전트 모드와 일반 모드에서 공통으로 사용
 * (워크스페이스 파일 컨텍스트는 API route에서 주입 후 이 함수에 넘김)
 */
export async function processMessagesForAI(
  messagesWithTokens: any[],
  model?: string
): Promise<ModelMessage[]> {
  
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

  // 🧠 Anthropic 모델인지 확인 (tool_use/tool_result 제약 대응)
  const isAnthropic = model && (
    model.startsWith('claude') ||
    model.includes('anthropic') ||
    getProviderFromModel(model) === 'anthropic'
  );
  
  // 1️⃣ 먼저 전체 메시지에서 전역 이미지 ID 맵 생성
  const globalImageIdMap = buildGlobalImageIdMap(messagesWithTokens);
  const globalVideoIdMap = buildGlobalVideoIdMap(messagesWithTokens);

  // 🧹 toolCallId 정규화 (Anthropic tool_use.id 규칙 준수)
  const toolCallIdMap = new Map<string, string>();
  const usedToolCallIds = new Set<string>();
  const normalizeToolCallId = (rawId: string, fallbackKey: string) => {
    const trimmed = rawId.trim();
    const mapKey = trimmed || rawId;
    const existing = toolCallIdMap.get(mapKey);
    if (existing) {
      return existing;
    }

    let base = trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!base) {
      base = `tool_${fallbackKey}`;
    }

    let candidate = base;
    let counter = 1;
    while (usedToolCallIds.has(candidate)) {
      candidate = `${base}_${counter++}`;
    }

    usedToolCallIds.add(candidate);
    if (trimmed) {
      toolCallIdMap.set(mapKey, candidate);
    }
    return candidate;
  };
  
  // 코드파일/텍스트파일을 텍스트로 변환 (UI는 파일로 유지)
  const processedMessages = await Promise.all(messagesWithTokens.map(async (msg: any, messageIndex: number) => {
    if (!msg.parts || !Array.isArray(msg.parts)) {
      return msg;
    }
    
    // 메시지에 function_call이 있는지 먼저 확인 (reasoning과의 관계 체크용)
    const hasFunctionCall = msg.parts.some((p: any) => 
      p.type === 'function_call' || 
      p.type === 'tool-call' || 
      (p.type && typeof p.type === 'string' && p.type.startsWith('tool-'))
    );
    
    const processedParts = await Promise.all(msg.parts.map(async (part: any, partIndex: number) => {
      const normalizedToolCallId = typeof part.toolCallId === 'string'
        ? normalizeToolCallId(part.toolCallId, `${messageIndex}_${partIndex}`)
        : part.toolCallId;
      const normalizedPart = part.toolCallId
        ? { ...part, toolCallId: normalizedToolCallId }
        : part;

      // 🧠 Anthropic 호환성: history 내 tool_use/tool_result 제거
      if (isAnthropic && normalizedPart.type && typeof normalizedPart.type === 'string') {
        if (normalizedPart.type.startsWith('tool-')) {
          return {
            type: 'text',
            text: summarizeToolOutputForAnthropic(normalizedPart)
          };
        }
        if (normalizedPart.type === 'tool-call' || normalizedPart.type === 'tool-result') {
          return null;
        }
      }

      // 🚀 Anthropic API 호환성: 완료되지 않은 tool call 제거
      // AI SDK v5 형식: type이 "tool-"로 시작하고 toolCallId가 있는 경우
      if (normalizedPart.type && typeof normalizedPart.type === 'string' && normalizedPart.type.startsWith('tool-')) {
        // 완료되지 않은 tool call 제거
        // 조건: toolCallId가 있고, output이 없거나 state가 "input-available"인 경우
        // 이는 Anthropic API의 tool_use/tool_result 요구사항을 위반할 수 있음
        // Anthropic은 tool_use가 있으면 반드시 다음 메시지에 tool_result가 있어야 함
        // 주의: output이 없으면 완료되지 않은 것으로 간주 (state와 관계없이)
        if (normalizedPart.toolCallId && !normalizedPart.output) {
          // state가 명시적으로 "output-available"이 아니면 제거
          // (state가 없거나 "input-available"이면 제거)
          if (!normalizedPart.state || normalizedPart.state !== 'output-available') {
            return null;
          }
        }
        
        // 🚀 Gemini API 호환성: thought_signature 보존
        // Gemini 모델에서는 function call에 thought_signature가 필수
        // part에 thought_signature가 있으면 보존하고, 없으면 providerMetadata에서 찾아서 추가
        if (isGemini && normalizedPart.input) {
          // thought_signature가 이미 있으면 그대로 유지
          if (normalizedPart.thought_signature) {
            return normalizedPart;
          }
          // providerMetadata에서 thought_signature 찾기
          if (normalizedPart.providerMetadata?.google?.thought_signature) {
            return {
              ...normalizedPart,
              thought_signature: normalizedPart.providerMetadata.google.thought_signature
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
        if (isFireworks && normalizedPart.callProviderMetadata) {
          const { callProviderMetadata, ...cleanedPart } = normalizedPart;
          return cleanedPart;
        }
        
        // read_file 도구 결과: 다음 턴 재전송 시 content를 12k로 잘라 prompt too long 방지 (이중 안전장치)
        if (normalizedPart.type === 'tool-read_file' && typeof normalizedPart.output?.content === 'string') {
          const truncated = truncateFileText(normalizedPart.output.content);
          return {
            ...normalizedPart,
            output: { ...normalizedPart.output, content: truncated.text },
          };
        }
        
        // run_python_code 도구 결과: 전체 출력 재주입은 막되, 대용량 offload 경로는 유지.
        if (normalizedPart.type === 'tool-run_python_code' && normalizedPart.output) {
          const output = normalizedPart.output as {
            offloadedOutputPath?: unknown;
            offloadedOutputChars?: unknown;
          };
          const offloadedOutputPath =
            typeof output?.offloadedOutputPath === 'string'
              ? output.offloadedOutputPath
              : undefined;
          const offloadedOutputChars =
            typeof output?.offloadedOutputChars === 'number'
              ? output.offloadedOutputChars
              : undefined;
          if (offloadedOutputPath) {
            const sizeText = typeof offloadedOutputChars === 'number'
              ? ` (${offloadedOutputChars} chars)`
              : '';
            return {
              type: 'text',
              text: `[run_python_code] Large output offloaded to ${offloadedOutputPath}${sizeText}. Use read_file(path) when needed.`,
            };
          }
          return {
            type: 'text',
            text: '[run_python_code] Output shown to user.',
          };
        }
        
        // 완료된 tool call은 유지 (convertToModelMessages가 tool_use/tool_result로 변환함)
        // 완료된 tool call은 output이 있거나 state가 "output-available"임
        return normalizedPart;
      }
      
      // tool-call과 tool-result는 제거 (streamText의 tools 파라미터로 도구 호출 가능)
      // 단, AI SDK v5 형식의 tool-* 타입은 위에서 처리됨
      if (normalizedPart.type === 'tool-call' || normalizedPart.type === 'tool-result') {
        return null;
      }
      
      // GPT-5의 경우 reasoning 데이터는 그대로 유지
      if (normalizedPart.type === 'reasoning') {
        if (isGPT5) {
          // function_call이 있거나 reasoning part에 providerMetadata itemId가 있는 경우, 
          // 빈 reasoning이라도 유지해야 함 (OpenAI API 에러 방지)
          const hasReasoningId = normalizedPart.providerMetadata?.openai?.itemId && 
                                 normalizedPart.providerMetadata.openai.itemId.startsWith('rs_');
          
          // 🚀 메시지에 tool-call이 있고 reasoning part가 있으면, 
          // tool-call이 해당 reasoning을 참조할 수 있으므로 항상 유지
          // (tool-call이 제거되더라도 reasoning은 유지되어야 함)
          if (hasFunctionCall || hasReasoningId) {
            // function_call이 있거나 reasoning ID가 있으면 빈 텍스트라도 포함하여 유지
            return {
              ...normalizedPart,
              text: normalizedPart.text || normalizedPart.reasoningText || '',
              reasoningText: normalizedPart.reasoningText || normalizedPart.text || ''
            };
          }
          // function_call이 없고 reasoning ID도 없고 텍스트도 없으면 null 반환 (나중에 필터링됨)
          if (!normalizedPart.text || normalizedPart.text.trim().length === 0) {
            return null;
          }
          return normalizedPart; // GPT-5에서는 reasoning 데이터 유지
        }
        // GPT-5가 아닌 모델에서는 reasoning 파트를 다음 턴 컨텍스트로 재주입하지 않는다.
        // reasoning을 일반 text로 변환하면 일부 모델이 "Thinking..." 같은 내부 문구를
        // 사용자 응답 본문으로 재생성하는 문제가 발생할 수 있다.
        return null;
      }
      
      // AI SDK v4 형식 이미지를 v5 형식으로 변환
      if (normalizedPart.type === 'image' && normalizedPart.image) {
        // experimental_attachments에서 정확한 mediaType과 filename 찾기
        const attachment = msg.experimental_attachments?.find((att: any) => 
          att.url === normalizedPart.image || att.url.includes(normalizedPart.image) || normalizedPart.image.includes(att.url)
        );
        
        return {
          type: 'file',
          url: normalizedPart.image,
          mediaType: attachment?.contentType || 'image/png',
          filename: attachment?.name || 'image'
        };
      }
      
      if (normalizedPart.type === 'file' && normalizedPart.url) {
        // PDF는 그대로 유지
        if (normalizedPart.mediaType === 'application/pdf') {
          return normalizedPart;
        }
        
        // 이미지도 그대로 유지
        if (normalizedPart.mediaType && normalizedPart.mediaType.startsWith('image/')) {
          return normalizedPart;
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
      return normalizedPart;
    }));
    
    // null 값 (빈 reasoning part 등)을 필터링
    const filteredParts = processedParts.filter((part: any) => part !== null);
    
    // 빈 parts 배열이면 최소한 빈 텍스트 part 하나 추가
    const finalParts = filteredParts.length > 0 
      ? filteredParts 
      : [{ type: 'text', text: '' }];
    
    // 모델 입력에는 불필요하게 큰 도구 결과(tool_results 등)는 포함하지 않되,
    // GPT-5 reasoning 등 프로바이더 메타데이터는 그대로 유지하기 위해
    // 원본 메시지에서 tool_results만 제거하고 나머지 필드는 보존한다.
    const { tool_results, ...rest } = msg;

    return {
      ...rest,
      parts: finalParts,
    };
  }));
  
  // 🔥 전체 이미지/비디오 목록을 마지막 사용자 메시지에 추가
  // AI가 generated_image_N / generated_video_N 참조를 정확히 해석할 수 있도록 함
  const summaries: string[] = [];
  if (globalImageIdMap.size > 0) {
    const imageContextSummary = buildImageContextSummary(globalImageIdMap);
    if (imageContextSummary) summaries.push(imageContextSummary);
  }
  if (globalVideoIdMap.size > 0) {
    const videoContextSummary = buildVideoContextSummary(globalVideoIdMap);
    if (videoContextSummary) summaries.push(videoContextSummary);
  }
  if (summaries.length > 0) {
    const mergedSummary = summaries.join('\n\n');
    for (let i = processedMessages.length - 1; i >= 0; i--) {
      const msg = processedMessages[i];
      if (msg.role === 'user' && msg.parts && Array.isArray(msg.parts)) {
        msg.parts.push({
          type: 'text',
          text: `\n\n---\n${mergedSummary}\n---\n`
        });
        break;
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

