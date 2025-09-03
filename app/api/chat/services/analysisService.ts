import { generateObject } from 'ai';
import { z } from 'zod';
import { providers } from '@/lib/providers';
import { detectImages, detectPDFs, detectCodeAttachments } from '../utils/messageUtils';

export const analyzeRequestAndDetermineRoute = (
  analysisModel: string,
  model: string,
  baseAvailableToolsList: string[],
  messages: any[],
  toolDescriptions: Record<string, string>
) => {

  // 최근 10개 메시지만 사용
  const recentMessages = messages.length > 10 ? messages.slice(-10) : messages;
  
  // 첨부물 감지
  const hasImage = recentMessages.some(msg => detectImages(msg));
  const hasPDF = recentMessages.some(msg => detectPDFs(msg));
  const hasCodeAttachment = recentMessages.some(msg => detectCodeAttachments(msg));
  const hasAttachments = hasImage || hasPDF || hasCodeAttachment;

  // 첨부물이 있는 경우와 없는 경우에 따라 다른 프롬프트 사용
  const basePrompt = `# Tool Selection Analyzer
You are an intelligent tool selection assistant for Chatflix Agent. 
Your task is to analyze the user's request and conversation history to determine which tools (if any) are needed to provide a comprehensive answer.

## Current Model: ${model}
## Attachments Detected: ${hasAttachments ? `Yes (Images: ${hasImage}, PDFs: ${hasPDF}, Code: ${hasCodeAttachment})` : 'No'}

## Available Tools:
${baseAvailableToolsList.map(tool => `- "${tool}": ${toolDescriptions[tool]}`).join('\n')}`;

  const attachmentPrompt = hasAttachments ? `

## 🆕 ATTACHMENT-AWARE TOOL SELECTION GUIDELINES:

### When Attachments Are Present (Images, PDFs, Code Files):
**CRITICAL**: When users have attached files, you must carefully analyze whether tools are actually needed before selecting them.

#### Step-by-Step Analysis Process:
1. **FIRST**: Analyze the user's intent with the attached content
2. **SECOND**: Determine if the request can be answered using only the attached content
3. **THIRD**: Only select tools if external information is explicitly required

#### Tool Selection Rules for Attachments:
- **NO TOOLS NEEDED** (Most Common):
  - "Summarize this document" → No tools needed
  - "Explain this code" → No tools needed  
  - "What's in this image?" → No tools needed
  - "Translate this text" → No tools needed
  - "Fix the bugs in this code" → No tools needed
  - "Improve this code" → No tools needed
  - "Analyze this data" → No tools needed

- **TOOLS MAY BE NEEDED** (Only when explicitly requesting external info):
  - "Find the source of this document" → web_search
  - "Find similar research papers" → academic_search
  - "Find related images online" → web_search
  - "Find more information about this topic" → web_search
  - "Calculate something based on this data" → calculator

#### Examples:
- Attachment + "Summarize this" → NO TOOLS (use attached content directly)
- Attachment + "Find the source" → web_search (external info needed)
- Attachment + "Explain this code" → NO TOOLS (use attached content directly)
- Attachment + "Find similar examples online" → web_search (external info needed)` : '';

  const imagePrompt = !hasAttachments ? `

### Image-related Requests (No Attachments):
- **IMPORTANT**: If user query seems to even slightly requires external urls of images, always select web_search tool. 
- **SEARCH FIRST**: For requests like "show me", "find", "I want to see" → prioritize web_search
- **GENERATE ONLY**: When explicitly asked to "create", "generate", "draw", "make an image"
- **SEARCH FOR AMBIGUOUS**: When unclear whether user wants search or generation, default to web_search

#### Examples:
- "show me photos of Paris" → web_search 
- "find images of cats" → web_search
- "Send me some meme images" → web_search
- "create a fantasy landscape" → image_generator
- "draw a cartoon character" → image_generator
- "I need an image of a car" → web_search (default to search)` : '';

  const systemPrompt = basePrompt + attachmentPrompt + imagePrompt + `

## Tool Selection Guidelines:

**General Rules:**
- **Always respond directly** - no need to ask for clarification
- **Select tools only when needed** for external information, calculations, or specific functionality
- **No tools needed** for general conversation, explanations, code analysis, or when sufficient context is provided
- **Be helpful and comprehensive** in your response

**Common Tool Selection Patterns:**
- **web_search**: When user asks for current information, news, facts, or anything requiring external data
- **calculator**: When mathematical calculations are needed
- **image_generator**: When user explicitly asks to create/generate images
- **academic_search**: When user asks for research papers or academic information
- **link_reader**: When user provides a URL and wants content analyzed
- **youtube_search**: When user asks for videos or YouTube content

**Examples**:
- "explain how React hooks work" → No tools needed
- "what's the weather like in Tokyo?" → web_search needed
- "analyze this code for potential issues" → No tools needed if code is provided
- "find the latest news about AI" → web_search needed
- "calculate 15% of 200" → calculator needed
- "create an image of a sunset" → image_generator needed

- Respond in the user's language for the reasoning field.`;

  return generateObject({
    model: providers.languageModel(analysisModel),
    system: systemPrompt,
    messages: recentMessages,
    schema: z.object({
      reasoningText: z.string().describe('Explanation for why these tools are needed or why no tools are required.'),
      tools: z.array(z.enum(baseAvailableToolsList as [string, ...string[]])).describe('Array of tools needed to provide a comprehensive answer. Can be an empty array if no tools are required.'),
    })
  });
};

 