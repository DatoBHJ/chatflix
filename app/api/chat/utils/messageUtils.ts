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
 * "Personal Core" (00-personal-core) 메모리의 "## Basic Details" 섹션에서 "Language preference:" 찾기
 */
export function extractLanguagePreference(memoryData: string | null): string | null {
  if (!memoryData) return null;
  
  try {
    // "## 00 Personal Core" 또는 "## 00-personal-core" 섹션 찾기
    const personalInfoMatch = memoryData.match(/##\s+00\s+(?:Personal\s+Core|personal-core)\s+([\s\S]*?)(?=##\s+\d+|---|$)/i);
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
      model: providers.languageModel('gemini-2.5-flash'),
      prompt: `You are generating follow-up questions that a USER would naturally ask to continue the conversation with an AI assistant called "Chatflix".

**CHATFLIX IDENTITY & CAPABILITIES:**
Chatflix is a powerful AI agent with a wide range of specialized tools and workflows. Your goal is to suggest follow-ups that naturally lead the user to explore these capabilities.

**CORE TOOLS & WORKFLOWS:**
1.  **Visual Creation**:
    - \`gemini_image_tool\` (Nano Banana Pro): High-quality 4K images, infographics, logos, text-in-image.
    - \`seedream_image_tool\`: Cinematic, uncensored 4K images.
    - \`wan25_video_tool\` & \`grok_video_tool\`: Generate 5-15s videos, animate images, or edit existing videos.
    - \`image_upscaler\` (8K) & \`video_upscaler\` (4K).
2.  **Research & Information**:
    - \`google_search\`: General web search, images, and news.
    - \`webSearch\` (Exa): Specialized research (academic, financial, GitHub, LinkedIn).
    - \`twitterSearch\`: Real-time trends and viral content.
    - \`youtubeSearch\` & \`youtubeAnalyzer\`: Find and analyze video content/transcripts.
3.  **Data & Document Workflows**:
    - \`run_python_code\`: Data analysis (Pandas), charts (Matplotlib), complex calculations.
    - **PPT Generation**: Create multi-slide presentations.
    - **PDF Report**: Professional document generation with charts.
    - **Infographic**: Vertical visual summaries.
    - **Comic/Storyboard**: Sequential art (webtoon style).
    - **Social Media Pack**: Multi-platform content (Instagram, YouTube, etc.).
4.  **Workspace & Files**:
    - \`read_file\`, \`write_file\`, \`apply_edits\`: Direct file manipulation in the sandbox.

**CRITICAL INSTRUCTION: Generate exactly 3 follow-up questions—no more, no less. Keep each very short and concise (under 15 words) so they are easy to read and click.**

User's original query: "${userQuery}"
AI's response: "${aiResponse}"
Context: ${contextInfo}${languageInstruction}

**FOLLOW-UP STRATEGY (Prioritize based on context):**
- **If creative/visual**: Suggest generating an image, video, or comic.
- **If informational/news**: Suggest searching Google/Twitter or creating a summary PPT/Infographic.
- **If technical/data**: Suggest running Python analysis or creating a PDF report.
- **If broad/complex**: Suggest a deep-dive research or a structured presentation.
- **Always include at least one "Actionable" tool-based suggestion.**

**GOOD EXAMPLES (Leveraging Chatflix):**
✅ "Generate a 4K image of this"
✅ "Create a summary PPT for me"
✅ "Search for the latest news on Twitter"
✅ "Make a 5-second video of this scene"
✅ "Analyze this data with Python"
✅ "Can you make an infographic about this?"
✅ "Create a professional PDF report"
✅ "Show me the background on YouTube"

**STYLE & FORMAT:**
- Exactly 3 questions only.
- Very short (under 15 words each), easy to scan and click.
- Natural, clear, simple language.
- Same language as the user's query.`,
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

  const stripOpenAIProviderMetadata = (value: any): any => {
    if (!value || typeof value !== 'object') return value;
    const cloned = { ...value };
    if (cloned.providerMetadata?.openai) {
      const providerMetadata = { ...cloned.providerMetadata };
      delete providerMetadata.openai;
      cloned.providerMetadata = providerMetadata;
    }
    return cloned;
  };
  
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
    
    const processedParts = await Promise.all(msg.parts.map(async (part: any, partIndex: number) => {
      const normalizedToolCallId = typeof part.toolCallId === 'string'
        ? normalizeToolCallId(part.toolCallId, `${messageIndex}_${partIndex}`)
        : part.toolCallId;
      const normalizedPart = part.toolCallId
        ? { ...part, toolCallId: normalizedToolCallId }
        : part;
      const sanitizedPart = isGPT5 ? stripOpenAIProviderMetadata(normalizedPart) : normalizedPart;

      // UI/event streaming parts can be extremely large (search/link payloads) and are
      // not required as direct model input context.
      if (typeof sanitizedPart.type === 'string' && sanitizedPart.type.startsWith('data-')) {
        return null;
      }

      // 🧠 Anthropic 호환성: history 내 tool_use/tool_result 제거
      if (isAnthropic && sanitizedPart.type && typeof sanitizedPart.type === 'string') {
        if (sanitizedPart.type.startsWith('tool-')) {
          return {
            type: 'text',
            text: summarizeToolOutputForAnthropic(sanitizedPart)
          };
        }
        if (sanitizedPart.type === 'tool-call' || sanitizedPart.type === 'tool-result') {
          return null;
        }
      }

      // GPT-5(OpenAI Responses) 호환성:
      // 과거 턴의 tool-* 파트는 function_call(fc_*)/reasoning(rs_*) 연속성 제약을 유발할 수 있다.
      // 히스토리 재전송에서는 요약 텍스트로 치환해 연속성 제약을 회피한다.
      if (isGPT5 && sanitizedPart.type && typeof sanitizedPart.type === 'string' && sanitizedPart.type.startsWith('tool-')) {
        return {
          type: 'text',
          text: summarizeToolOutputForAnthropic(sanitizedPart),
        };
      }

      // 🚀 Anthropic API 호환성: 완료되지 않은 tool call 제거
      // AI SDK v5 형식: type이 "tool-"로 시작하고 toolCallId가 있는 경우
      if (sanitizedPart.type && typeof sanitizedPart.type === 'string' && sanitizedPart.type.startsWith('tool-')) {
        // 완료되지 않은 tool call 제거
        // 조건: toolCallId가 있고, output이 없거나 state가 "input-available"인 경우
        // 이는 Anthropic API의 tool_use/tool_result 요구사항을 위반할 수 있음
        // Anthropic은 tool_use가 있으면 반드시 다음 메시지에 tool_result가 있어야 함
        // 주의: output이 없으면 완료되지 않은 것으로 간주 (state와 관계없이)
        if (sanitizedPart.toolCallId && !sanitizedPart.output) {
          // state가 명시적으로 "output-available"이 아니면 제거
          // (state가 없거나 "input-available"이면 제거)
          if (!sanitizedPart.state || sanitizedPart.state !== 'output-available') {
            return null;
          }
        }
        
        // 🚀 Gemini API 호환성: thought_signature 보존
        // Gemini 모델에서는 function call에 thought_signature가 필수
        // part에 thought_signature가 있으면 보존하고, 없으면 providerMetadata에서 찾아서 추가
        if (isGemini && sanitizedPart.input) {
          // thought_signature가 이미 있으면 그대로 유지
          if (sanitizedPart.thought_signature) {
            return sanitizedPart;
          }
          // providerMetadata에서 thought_signature 찾기
          if (sanitizedPart.providerMetadata?.google?.thought_signature) {
            return {
              ...sanitizedPart,
              thought_signature: sanitizedPart.providerMetadata.google.thought_signature
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
        if (isFireworks && sanitizedPart.callProviderMetadata) {
          const { callProviderMetadata, ...cleanedPart } = sanitizedPart;
          return cleanedPart;
        }
        
        // read_file 도구 결과: 다음 턴 재전송 시 content를 12k로 잘라 prompt too long 방지 (이중 안전장치)
        if (sanitizedPart.type === 'tool-read_file' && typeof sanitizedPart.output?.content === 'string') {
          const out = sanitizedPart.output as {
            path?: string;
            content?: string;
            truncated?: boolean;
            totalLines?: number;
            startLine?: number;
            endLine?: number;
            nextReadStartLine?: number | null;
          };
          // Large-window/full-file reads are summarized aggressively to avoid history token accumulation.
          const shouldSummarize =
            out?.truncated === true ||
            (typeof out?.content === 'string' && out.content.length > 4000) ||
            (typeof out?.totalLines === 'number' && out.totalLines > 3000);
          if (shouldSummarize) {
            const snippet = typeof out?.content === 'string'
              ? out.content.slice(0, 700)
              : '';
            const summary = [
              '[read_file]',
              out?.path ? `path=${out.path}` : '',
              typeof out?.startLine === 'number' && typeof out?.endLine === 'number'
                ? `window=${out.startLine}-${out.endLine}`
                : '',
              typeof out?.totalLines === 'number' ? `totalLines=${out.totalLines}` : '',
              out?.truncated ? 'truncated=true' : '',
              typeof out?.nextReadStartLine === 'number' ? `nextStart=${out.nextReadStartLine}` : '',
            ].filter(Boolean).join(' ');
            const snippetBlock = snippet ? `\nsnippet=${JSON.stringify(snippet)}` : '';
            return { type: 'text', text: `${summary}${snippetBlock}` };
          }
          const truncated = truncateFileText(sanitizedPart.output.content);
          return {
            ...sanitizedPart,
            output: { ...sanitizedPart.output, content: truncated.text },
          };
        }

        // grep_file 결과는 대용량일 수 있으므로 히스토리에는 초압축 요약만 남긴다.
        if (sanitizedPart.type === 'tool-grep_file' && sanitizedPart.output) {
          const out = sanitizedPart.output as {
            path?: string;
            returnedMatches?: number;
            reachedMatchLimit?: boolean;
            nextSearchStartLine?: number | null;
            startLine?: number;
            endLine?: number;
            recommendedNextStep?: string;
            matches?: Array<{ lineNumber?: number; line?: string }>;
          };
          const summary = [
            '[grep_file]',
            out?.path ? `path=${out.path}` : '',
            typeof out?.startLine === 'number' && typeof out?.endLine === 'number'
              ? `window=${out.startLine}-${out.endLine}`
              : '',
            typeof out?.returnedMatches === 'number' ? `matches=${out.returnedMatches}` : '',
            out?.reachedMatchLimit ? 'reachedMatchLimit=true' : '',
            typeof out?.nextSearchStartLine === 'number' ? `nextStart=${out.nextSearchStartLine}` : '',
            out?.recommendedNextStep ? 'hasNextStep=true' : '',
          ].filter(Boolean).join(' ');
          const sampleMatches = Array.isArray(out?.matches)
            ? out.matches
                .slice(0, 5)
                .map((m) => `${m?.lineNumber ?? '?'}:${typeof m?.line === 'string' ? m.line : ''}`)
                .join(' | ')
            : '';
          return {
            type: 'text',
            text: sampleMatches ? `${summary}\nsample=${sampleMatches.slice(0, 700)}` : summary,
          };
        }
        
        // run_python_code 도구 결과: 기본은 짧은 안내.
        // BrightData 성공/실패 요약은 다음 턴 컨텍스트에 보존해 잘못된 성공 응답을 줄인다.
        if (sanitizedPart.type === 'tool-run_python_code' && sanitizedPart.output) {
          const out = sanitizedPart.output as {
            success?: boolean;
            error?: { value?: unknown };
            stdout?: unknown[];
            stderr?: unknown[];
            results?: Array<{ summary?: string }>;
          };
          const firstSummary = out?.results?.[0]?.summary;
          const errorValue =
            typeof out?.error?.value === 'string'
              ? out.error.value
              : undefined;
          const failMarkerLine = (() => {
            const pick = (arr: unknown[] | undefined) =>
              Array.isArray(arr)
                ? arr.find((line: unknown) => typeof line === 'string' && line.includes('FAIL:'))
                : undefined;
            const fromStderr = pick(out?.stderr as unknown[] | undefined);
            const fromStdout = pick(out?.stdout as unknown[] | undefined);
            return (typeof fromStderr === 'string' ? fromStderr : (typeof fromStdout === 'string' ? fromStdout : undefined));
          })();
          const isBrightDataSuccess =
            typeof firstSummary === 'string' &&
            (firstSummary.includes('BrightData') || firstSummary.includes('matchCentreData'));
          const isFailure = out?.success === false;
          const stdoutHead = Array.isArray(out?.stdout)
            ? out.stdout.filter((line): line is string => typeof line === 'string').slice(0, 2).join(' | ')
            : '';
          const failureReason = (errorValue || failMarkerLine || firstSummary || 'Execution failed.').slice(0, 260);
          const summaryText = isFailure
            ? `[run_python_code] Failed: ${failureReason}`
            : isBrightDataSuccess
              ? `[run_python_code] ${firstSummary}`
              : `[run_python_code] Success${stdoutHead ? `: ${stdoutHead.slice(0, 220)}` : (firstSummary ? `: ${firstSummary.slice(0, 220)}` : '')}`;
          return {
            type: 'text',
            text: summaryText,
          };
        }
        
        // browser_observe 결과는 핵심 필드만 짧게 보존
        if (sanitizedPart.type === 'tool-browser_observe' && sanitizedPart.output) {
          const out = sanitizedPart.output as {
            success?: boolean;
            url?: string;
            finalUrl?: string;
            final_url?: string;
            selectedAttempt?: string;
            selected_attempt?: string;
            htmlLength?: number;
            html_length?: number;
            error?: string;
          };
          const status = out?.success === true ? 'Success' : 'Failed';
          const finalUrl =
            typeof out?.finalUrl === 'string'
              ? out.finalUrl
              : (typeof out?.final_url === 'string' ? out.final_url : '');
          const selectedAttempt =
            typeof out?.selectedAttempt === 'string'
              ? out.selectedAttempt
              : (typeof out?.selected_attempt === 'string' ? out.selected_attempt : '');
          const htmlLength =
            typeof out?.htmlLength === 'number'
              ? out.htmlLength
              : (typeof out?.html_length === 'number' ? out.html_length : undefined);
          const summary = [
            `[browser_observe] ${status}`,
            out?.url ? `url=${out.url}` : '',
            finalUrl ? `finalUrl=${finalUrl}` : '',
            selectedAttempt ? `phase=${selectedAttempt}` : '',
            typeof htmlLength === 'number' ? `html=${htmlLength}` : '',
            out?.error ? `error=${String(out.error).slice(0, 200)}` : '',
          ].filter(Boolean).join(' · ');
          return {
            type: 'text',
            text: summary,
          };
        }

        // For other completed tool outputs, keep only short textual summaries in history.
        return {
          type: 'text',
          text: summarizeToolOutputForAnthropic(sanitizedPart),
        };
      }
      
      // tool-call/tool-result/function_call은 히스토리 재전송에서 제거한다.
      // 단, AI SDK v5 형식의 tool-* 타입은 위에서 처리됨
      if (
        sanitizedPart.type === 'tool-call' ||
        sanitizedPart.type === 'tool-result' ||
        sanitizedPart.type === 'function_call' ||
        sanitizedPart.type === 'function-call'
      ) {
        return null;
      }
      
      // GPT-5 포함 모든 모델: reasoning 파트는 다음 턴 입력으로 재주입하지 않는다.
      // OpenAI Responses는 rs_* reasoning item이 연속성 제약을 갖는데,
      // 재전송 히스토리 정리 과정에서 후속 item이 빠지면 400이 발생할 수 있다.
      // reasoning은 UI 표시용으로만 쓰고, 모델 입력에서는 제외한다.
      if (sanitizedPart.type === 'reasoning') {
        return null;
      }
      
      // AI SDK v4 형식 이미지를 v5 형식으로 변환
      if (sanitizedPart.type === 'image' && sanitizedPart.image) {
        // experimental_attachments에서 정확한 mediaType과 filename 찾기
        const attachment = msg.experimental_attachments?.find((att: any) => 
          att.url === sanitizedPart.image || att.url.includes(sanitizedPart.image) || sanitizedPart.image.includes(att.url)
        );
        
        return {
          type: 'file',
          url: sanitizedPart.image,
          mediaType: attachment?.contentType || 'image/png',
          filename: attachment?.name || 'image'
        };
      }
      
      if (sanitizedPart.type === 'file' && sanitizedPart.url) {
        // PDF는 그대로 유지
        if (sanitizedPart.mediaType === 'application/pdf') {
          return sanitizedPart;
        }
        
        // 이미지도 그대로 유지
        if (sanitizedPart.mediaType && sanitizedPart.mediaType.startsWith('image/')) {
          return sanitizedPart;
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
      return sanitizedPart;
    }));
    
    // null 값 (빈 reasoning part 등)을 필터링
    const filteredParts = processedParts.filter((part: any) => part !== null);
    
    // OpenAI Responses 제약: rs_* reasoning item은 반드시 "즉시 다음" 아이템이 필요하다.
    // 앞 단계에서 tool 관련 파트가 제거되면 reasoning만 고아로 남을 수 있으므로 여기서 제거한다.
    const prunedParts = filteredParts.filter((part: any, index: number, parts: any[]) => {
      if (part?.type !== 'reasoning') return true;
      if (!isGPT5) return true;
      const reasoningItemId = part?.providerMetadata?.openai?.itemId;
      if (typeof reasoningItemId !== 'string' || !reasoningItemId.startsWith('rs_')) return true;
      const nextPart = parts[index + 1];
      return !!nextPart && nextPart.type !== 'reasoning';
    });
    
    // 빈 parts 배열이면 최소한 빈 텍스트 part 하나 추가
    const finalParts = prunedParts.length > 0 
      ? prunedParts 
      : [{ type: 'text', text: '' }];
    
    // 모델 입력에는 불필요하게 큰 도구 결과(tool_results 등)는 포함하지 않되,
    // GPT-5 reasoning 등 프로바이더 메타데이터는 그대로 유지하기 위해
    // 원본 메시지에서 tool_results만 제거하고 나머지 필드는 보존한다.
    const { tool_results, providerMetadata, ...rest } = msg;
    const sanitizedMessage = isGPT5 ? stripOpenAIProviderMetadata(rest) : rest;

    return {
      ...sanitizedMessage,
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

