import { streamText, createDataStreamResponse, smoothStream, Message, streamObject, generateText, generateObject } from 'ai';
import { providers } from '@/lib/providers';
import { getModelById } from '@/lib/models/config';
import { MultiModalMessage } from '../types';
import { z } from 'zod';
import { 
  handlePromptShortcuts,
  buildSystemPrompt
} from '../services/chatService';
import { 
  generateMessageId, 
  convertMessageForAI, 
  getProviderFromModel,
  convertMultiModalToMessage,
  selectMessagesWithinTokenLimit
} from '../utils/messageUtils';
import { 
  createWebSearchTool, 
  createJinaLinkReaderTool, 
  createImageGeneratorTool, 
  createCalculatorTool, 
  createAcademicSearchTool, 
  createYouTubeSearchTool, 
  createYouTubeLinkAnalyzerTool, 
} from '../tools';
import { handleRateLimiting } from '../utils/ratelimit'; // 데모에서도 간단한 Rate Limiting은 유지
import { toolPrompts } from '../prompts/toolPrompts';
import { estimateTokenCount } from '@/utils/context-manager';

// Tool initialization helper function
function initializeTool(type: string, dataStream: any, processMessages: any[] = []) {
  switch (type) {
    case 'web_search':
      return createWebSearchTool(dataStream);
    case 'calculator':
      return createCalculatorTool(dataStream);
    case 'link_reader':
      return createJinaLinkReaderTool(dataStream);
    case 'image_generator':
      return createImageGeneratorTool(dataStream);
    case 'academic_search':
      return createAcademicSearchTool(dataStream);
    case 'youtube_search':
      return createYouTubeSearchTool(dataStream);
    case 'youtube_link_analyzer':
      return createYouTubeLinkAnalyzerTool(dataStream);
    default:
      throw new Error(`Unknown tool type: ${type}`);
  }
}

export async function POST(req: Request) {
    const requestData = await req.json();
    let { messages, model, isAgentEnabled = false } = requestData;

    // 데모에서는 고정된 userId 사용
    const userId = 'guest-demo-user'; 

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 데모용 Rate Limiting (필요시 config.ts의 rateLimits에서 demo용 level 정의 후 사용)
    const rateLimitResult = await handleRateLimiting(userId, model); 
    if (!rateLimitResult.success) {
      const { error } = rateLimitResult;
      return new Response(JSON.stringify({
        error: 'Too many requests',
        message: error?.message || 'Rate limit exceeded',
        retryAfter: error?.retryAfter,
        reset: error?.reset ? new Date(error.reset).toISOString() : undefined,
        limit: error?.limit,
        level: error?.level,
        model: model
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...(error?.limit && { 'X-RateLimit-Limit': error.limit.toString() }),
          'X-RateLimit-Remaining': '0',
          ...(error?.reset && { 'X-RateLimit-Reset': new Date(error.reset).toISOString() }),
        }
      });
    }

    return createDataStreamResponse({
      execute: async (dataStream) => {
          const processMessagesPromises = messages.map(async (msg: Message) => {
            // Demo API는 Supabase 클라이언트가 없으므로, 해당 의존성 제거
            const converted = await convertMessageForAI(msg, model, null);
            return {
              id: msg.id || generateMessageId(), // ID가 없을 경우 생성
              ...converted
            } as MultiModalMessage;
          });
          
          const processMessages = await Promise.all(processMessagesPromises);

          // 마지막 메시지에 대한 단축키 처리 (데모에서는 Supabase 의존성 제거)
          const lastMessage = processMessages[processMessages.length - 1];
          const processedLastMessagePromise = handlePromptShortcuts(null, lastMessage, userId) as Promise<MultiModalMessage>; 
          
          const [processedLastMessage] = await Promise.all([
            processedLastMessagePromise,
          ]);
          
          processMessages[processMessages.length - 1] = processedLastMessage;

          const abortController = new AbortController();
          const modelConfig = getModelById(model);
          const supportsReasoning = modelConfig?.reasoning?.enabled || false;

          const providerOptions: any = {};
          if (supportsReasoning) {
            providerOptions.anthropic = { thinking: { type: 'enabled', budgetTokens: 12000 } };
            providerOptions.xai = { reasoningEffort: 'high' };
            providerOptions.openai = { reasoningEffort: 'high' };
            providerOptions.google = { 
              thinkingConfig: { thinkingBudget: 2048, includeThoughts: true }, 
              safetySettings: [
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              ],
            };
          }
          
          const currentSystemPrompt = buildSystemPrompt(
            isAgentEnabled ? 'agent' : 'regular',
            'initial',
            undefined // 데모에서는 메모리 데이터 없음
          );
          
          if (isAgentEnabled) {
            const systemTokens = estimateTokenCount(currentSystemPrompt);
            const maxContextTokens = modelConfig?.contextWindow || 8000;
            const remainingTokens = maxContextTokens - systemTokens;
            
            const hasFileAttachments = processMessages.some(msg => {
              if (Array.isArray(msg.content)) {
                return msg.content.some((part: any) => part.type === 'file' || part.type === 'image'); 
              }
              return false;
            });
            
            const optimizedMessages = selectMessagesWithinTokenLimit(
              processMessages, 
              remainingTokens,
              hasFileAttachments
            );

            let userQuery = '';
            const extractTextFromMessage = (msg: any) => {
              if (typeof msg.content === 'string') {
                return msg.content;
              } else if (Array.isArray(msg.content)) {
                const textContent = msg.content
                  .filter((part: any) => part.type === 'text')
                  .map((part: any) => part.text)
                  .join('\n');
                const attachmentInfo: string[] = [];
                const images = msg.content.filter((part: any) => part.type === 'image');
                if (images.length > 0) attachmentInfo.push(`[ATTACHED: ${images.length} image(s)]`);
                const files = msg.content.filter((part: any) => part.type === 'file');
                files.forEach((file: any) => {
                  if (file.file) {
                    const fileName = file.file.name || '';
                    const fileType = file.file.contentType || '';
                    if (fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) attachmentInfo.push(`[ATTACHED: Image file - ${fileName}]`);
                    else if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) attachmentInfo.push(`[ATTACHED: PDF document - ${fileName}]`);
                    else if (fileName.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
                      const extension = fileName.split('.').pop();
                      attachmentInfo.push(`[ATTACHED: Code file (${extension}) - ${fileName}]`);
                    } else attachmentInfo.push(`[ATTACHED: File - ${fileName} (${fileType})]`);
                  }
                });
                if (Array.isArray(msg.experimental_attachments)) {
                  msg.experimental_attachments.forEach((attachment: any) => {
                    const fileName = attachment.name || '';
                    const fileType = attachment.contentType || attachment.fileType || '';
                    if (fileType === 'image' || fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) attachmentInfo.push(`[ATTACHED: Image file - ${fileName}]`);
                    else if (fileType === 'pdf' || fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) attachmentInfo.push(`[ATTACHED: PDF document - ${fileName}]`);
                    else if (fileType === 'code' || fileName.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
                      const extension = fileName.split('.').pop();
                      attachmentInfo.push(`[ATTACHED: Code file (${extension}) - ${fileName}]`);
                    } else if (fileName) attachmentInfo.push(`[ATTACHED: File - ${fileName} (${fileType})]`);
                  });
                }
                if (textContent) return attachmentInfo.length > 0 ? `${textContent}\n${attachmentInfo.join('\n')}` : textContent;
                if (attachmentInfo.length > 0) return attachmentInfo.join('\n');
              }
              return '';
            };
            
            const currentMessage = optimizedMessages[optimizedMessages.length - 1];
            userQuery = extractTextFromMessage(currentMessage);
            const conversationHistory = convertMultiModalToMessage(optimizedMessages.slice(0, -1));
            
            let availableToolsList = [
              'web_search', 'calculator', 'link_reader', 'image_generator',
              'academic_search', 'youtube_search', 'youtube_link_analyzer'
            ];
            if (model === 'gemini-2.5-pro-preview-05-06' || model === 'gemini-2.5-flash-preview-04-17') {
              availableToolsList = availableToolsList.filter(tool => tool !== 'link_reader' && tool !== 'youtube_link_analyzer');
            }
            const toolDescriptions: Record<string, string> = {
              'web_search': 'Real-time information from the internet',
              'calculator': 'Mathematical calculations and computations',
              'link_reader': 'Reading and analyzing web page content',
              'image_generator': 'Creating visual content',
              'academic_search': 'Finding scholarly and research materials',
              'youtube_search': 'Finding relevant video content',
              'youtube_link_analyzer': 'Analyzing specific YouTube videos'
            };

            const planningSystemPrompt = buildSystemPrompt('agent', 'initial', undefined);
            const planningResult = await streamText({
              model: providers.languageModel('gemini-2.5-flash-preview-04-17'), 
              prompt: `
${planningSystemPrompt}

              # Model Information
              - Current model: ${model}
              - Available tools are limited based on the model. For Gemini 2.5 Pro and Gemini 2.5 Flash, 'link_reader' and 'youtube_link_analyzer' are not available. If the user requests these tools, you must respond with an error message.

# Previous Conversation
${conversationHistory}

# User Query
${userQuery}

# File Attachment Analysis Instructions
- For all attachments, incorporate the file information in your analysis plan

              Your task is to first check if the user query explicitly requests any unavailable tools:
              - If the current model is 'gemini-2.5-pro-preview-05-06' or 'gemini-2.5-flash-preview-04-17' and the user query mentions or requests 'link_reader' or 'youtube_link_analyzer' (e.g., words like "link reader", "youtube analyzer", or their equivalents in any language), respond ONLY with a clear error message in the same language as the user\'s query: "This model does not support the 'link_reader' or 'youtube_link_analyzer' tool. Please use a different model or rephrase your query to avoid these tools."
              - Do not create a plan or proceed further if an unavailable tool is requested.
              - Otherwise, create a comprehensive plan to address the user\'s query.
              1. What is the user really asking for? Analyze the query to identify key needs.
              2. What information or capabilities will be needed? Review the available tools and determine if any are suitable by comparing them to the user\'s query.
              3. If suitable tools are available, select and justify their use in the plan. If no tools are appropriate based on your analysis, rely solely on the model\'s built-in capabilities without attempting to use tools.
              4. What is the best approach to provide a complete and helpful response?
              5. What workflow mode would be most appropriate?

              Available capabilities include:
              ${availableToolsList.length > 0 
                ? availableToolsList.map(tool => `- ${tool.charAt(0).toUpperCase() + tool.slice(1).replace('_', ' ')}: ${toolDescriptions[tool as keyof typeof toolDescriptions]}`).join('\n')
                : '- No specific tools available for this model. In this case, I will rely on the model\'s built-in capabilities to handle the query.'
              }

              IMPORTANT LANGUAGE REQUIREMENT:
              - Respond in the same language as the user\'s query
              - If user writes in Korean, respond in Korean
              - If user writes in English, respond in English
              - If user writes in another language, respond in that language

              Create a detailed plan explaining your approach to helping the user.
              `,
            });

            let planningText = '';
            for await (const textPart of planningResult.textStream) {
              planningText += textPart;
              dataStream.writeMessageAnnotation({
                type: 'agent_reasoning_progress',
                data: JSON.parse(JSON.stringify({
                  agentThoughts: '', 
                  plan: planningText,
                  selectionReasoning: '',
                  workflowMode: '',
                  modeReasoning: '',
                  selectedTools: [],
                  timestamp: new Date().toISOString(),
                  isComplete: false,
                  stage: 'planning'
                }))
              });
            }
            dataStream.writeMessageAnnotation({
              type: 'agent_reasoning_progress',
              data: JSON.parse(JSON.stringify({
                agentThoughts: '', 
                plan: planningText,
                selectionReasoning: '',
                workflowMode: '',
                modeReasoning: '',
                selectedTools: [],
                timestamp: new Date().toISOString(),
                isComplete: true,
                stage: 'planning'
              }))
            });

            const routingDecision = await generateObject({
              model: providers.languageModel('gemini-2.0-flash'),
              prompt: `
            Based on the following comprehensive plan, quickly select the specific tools needed:

            # Plan Created
            ${planningText}

            # User Query
            ${userQuery}

            Now select the specific tools needed to execute this plan effectively.

            Available Tools (use exact names):
            ${availableToolsList.map(tool => `- "${tool}": For ${toolDescriptions[tool as keyof typeof toolDescriptions]}`).join('\n')}

            ## Workflow Modes:
            1. **information_response**: Information-focused tasks (Q&A, explanations, research)
            2. **content_creation**: Creation-focused tasks (writing, coding, design)
            3. **balanced**: Both information gathering and content creation needed

            IMPORTANT LANGUAGE REQUIREMENT:
            - Tool selection must use exact English names from the available tools list above
            - All other fields (reasoning, selectionReasoning, modeReasoning) MUST be written in the same language as the user\'s query
            - If user writes in Korean, respond in Korean (except for tool names)
            - If user writes in English, respond in English (except for tool names which are already in English)
            - If user writes in another language, respond in that language (except for tool names)
            `,
              schema: z.object({
                selectedTools: z.array(z.enum(availableToolsList as [string, ...string[]])).describe('Array of tools needed for this query'),
                reasoning: z.string().describe('Brief reasoning for tool selection'),
                selectionReasoning: z.string().describe('Brief justification for the selected tools'),
                workflowMode: z.enum(['information_response', 'content_creation', 'balanced']).describe('The optimal workflow mode for this query'),
                modeReasoning: z.string().describe('Brief explanation for the selected workflow mode')
              })
            });
            
            const hasImage = optimizedMessages.some(msg => {
              if (Array.isArray(msg.content)) {
                return msg.content.some(part => part.type === 'image');
              }
              return false;
            });
            const hasFile = optimizedMessages.some(msg => {
              if (Array.isArray(msg.content)) {
                return msg.content.some(part => part.type === 'file');
              }
              return false;
            });
            
            const agentReasoningAnnotation = {
              type: 'agent_reasoning',
              data: JSON.parse(JSON.stringify({
                agentThoughts: routingDecision.object.reasoning,
                plan: planningText, 
                selectionReasoning: routingDecision.object.selectionReasoning,
                workflowMode: routingDecision.object.workflowMode,
                modeReasoning: routingDecision.object.modeReasoning,
                selectedTools: routingDecision.object.selectedTools,
                timestamp: new Date().toISOString(),
                isComplete: true
              }))
            };
            dataStream.writeMessageAnnotation(agentReasoningAnnotation);
            const agentReasoningData = { ...agentReasoningAnnotation.data };
            
            let toolSpecificPrompts: string[] = [];
            const tools: Record<string, any> = {};
            routingDecision.object.selectedTools.forEach((toolName: string) => {
              tools[toolName] = initializeTool(toolName, dataStream, processMessages);
              if (toolPrompts[toolName as keyof typeof toolPrompts]) toolSpecificPrompts.push(toolPrompts[toolName as keyof typeof toolPrompts]);
            });
              
            const todayDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit", weekday: "short" });
            let workflowGuidelines = "";
            switch(routingDecision.object.workflowMode) {
              case 'information_response':
                workflowGuidelines = `
# WORKFLOW: INFORMATION RESPONSE MODE
You\'re operating in information response mode. This means:
1. Focus on gathering comprehensive information using the tools
2. Provide a detailed, comprehensive main response
3. Your output in this phase should be the complete answer to the user\'s query
4. Keep your tools usage efficient but thorough

After collecting information, create a complete response that addresses all aspects of the user\'s query.
`;
                break;
              case 'content_creation':
                workflowGuidelines = `
# WORKFLOW: CONTENT CREATION MODE
You\'re operating in content creation mode (the preferred mode for organized responses). This means:
1. Use tools efficiently to gather just the necessary information and context
2. Keep your main response brief, concise and focused
3. Your main response should be a short introduction or summary ONLY (1-3 paragraphs)
4. Mention that detailed content will follow in files
5. DO NOT include detailed explanations, code, or elaborate content in this phase

In this phase, focus ONLY on collecting necessary information and providing a very brief introduction.
The detailed content (code, written text, analysis, etc.) will be created in the files during the next phase.
Users prefer this approach as it keeps the chat clean while providing organized content in files.
`;
                break;
              case 'balanced':
              default:
                workflowGuidelines = `
# WORKFLOW: BALANCED MODE
You\'re operating in balanced mode. This means:
1. Gather comprehensive information using the tools
2. Provide a substantial main response that addresses the core query
3. Balance your effort between the main response and preparing for supporting files
4. Cover the essential explanations in your main response

In this phase, create a thorough response while keeping in mind that supporting files will complement your answer.
`;
                break;
            }
            
            const agentSystemPrompt = buildSystemPrompt('agent', 'second', undefined) + `
            # SECOND STAGE: TOOL EXECUTION AND MAIN RESPONSE CREATION
Today's Date: ${todayDate}

            ## User Query
            ${userQuery}
            
            ## User Query Analysis
            ${routingDecision.object.reasoning}

            ## Plan -- This is just for your reference. You don\'t need to explicitly follow it. 
            ${planningText}
            
            ## Selected Workflow Mode: ${routingDecision.object.workflowMode}
            ${routingDecision.object.modeReasoning}
${workflowGuidelines}
            
${toolSpecificPrompts.join("\n\n")}

${hasImage ? `
            # ABOUT THE IMAGE:
            - Describe the image in detail.
            - Use appropriate tools to get more information if needed
            - Do not provide detailed analysis - just determine what tools to use
` : ''}

${hasFile ? `
            # ABOUT THE FILE:
            - Briefly identify what\'s in the file (1-2 sentences)
            - Use appropriate tools to process it if needed
            - Do not provide detailed analysis - just determine what tools to use
` : ''}

            **IMPORTANT: Use the same language as the user for all responses.**
            `;
            
            const activeTools = routingDecision.object.selectedTools;
            const toolResults: any = { agentReasoning: agentReasoningData };
            let responseInstructions = "";
            switch(routingDecision.object.workflowMode) {
              case 'information_response':
                responseInstructions = `
# FINAL RESPONSE INSTRUCTIONS
After using the tools, create a comprehensive answer that:
- Directly addresses the user\'s original query with all relevant findings from the tools
- Presents information in a logical, easy-to-follow manner
- Maintains a helpful, conversational tone
- Ensures factual accuracy based on tool results
- Provides a complete and detailed response to the user\'s question

Remember that you\'re in INFORMATION RESPONSE mode, so your main focus should be creating a detailed, comprehensive textual response. Supporting files will be minimal, if any.
`;
                break;
              case 'content_creation':
                responseInstructions = `
# FINAL RESPONSE INSTRUCTIONS
After using the tools, create a VERY BRIEF introductory response that:
- Briefly acknowledges the user\'s request (1 sentence)
- Provides a very concise overview of what will be in the files (1-2 sentences)
- Keeps the entire response under 3-5 sentences maximum
- DOES NOT include detailed explanations or content - save this for the files
- Mentions that the detailed information is organized in the files that follow

IMPORTANT: Your response must be extremely concise. The main value will be delivered in the files, not in this chat response. Users prefer brief chat responses with well-organized files.

Examples of good brief responses:
"I\'ve gathered information about climate change impacts. You\'ll find a comprehensive analysis in the attached research paper, which covers current evidence, future projections, and mitigation strategies."

"Here\'s the Python game you requested. I\'ve created a main.py file with the game logic and a README.md with instructions for running and playing the game."
`;
                break;
              case 'balanced':
              default:
                responseInstructions = `
# FINAL RESPONSE INSTRUCTIONS
After using the tools, create a balanced response that:
- Addresses the user\'s original query with relevant findings from the tools
- Provides enough detail to be useful on its own
- Maintains a helpful, conversational tone
- Ensures factual accuracy based on tool results
- Balances between explanation and implementation details

Remember that you\'re in BALANCED mode, so provide a substantial response while keeping in mind that supporting files will complement your answer with additional details or implementations.
`;
                break;
            }
            
            const systemPromptAgent = `${agentSystemPrompt}
            
${responseInstructions}
            
Remember to maintain the language of the user\'s query throughout your response.
            `;
            const finalMessages = convertMultiModalToMessage(optimizedMessages.slice(-6));

            const finalstep = streamText({
              model: providers.languageModel(model),
              system: systemPromptAgent,
              messages: finalMessages,
              toolChoice: 'auto',
              experimental_activeTools: activeTools,
              tools,
              maxSteps: 15,
              providerOptions: providerOptions,
              onFinish: async (completion) => {
                if (abortController.signal.aborted) return;
                
                if (routingDecision.object.selectedTools.includes('calculator')) {
                  dataStream.writeMessageAnnotation({ 
                    type: 'math_calculation_complete', 
                    steps: tools.calculator.calculationSteps, 
                    finalAnswer: completion.text || "Calculation completed" 
                  });
                }
                routingDecision.object.selectedTools.forEach((toolName: string) => {
                  if (tools[toolName]) {
                     if (toolName === 'calculator' && tools.calculator?.calculationSteps?.length > 0) toolResults.calculationSteps = tools.calculator.calculationSteps;
                     else if (toolName === 'web_search' && tools.web_search?.searchResults?.length > 0) toolResults.webSearchResults = tools.web_search.searchResults;
                  }
                });

                dataStream.writeMessageAnnotation({ type: 'status', data: { message: 'Creating supporting files and follow-up questions...' } });

                try {
                  const finalResultText = await finalstep.text;
                  const toolSummaries: string[] = [];
                  if (toolResults.webSearchResults && toolResults.webSearchResults.length > 0) {
                    const simplifiedResults = toolResults.webSearchResults.map((search: any) => {
                      const simplifiedSearches = search.searches.map((s: any) => ({ query: s.query, results: s.results.map((r: any) => ({ title: r.title, url: r.url, content: r.content || r.snippet })) }));
                      return { searches: simplifiedSearches };
                    });
                    toolSummaries.push(`WEB SEARCH RESULTS: ${JSON.stringify(simplifiedResults)}`);
                  }
                  if (toolResults.calculationSteps && toolResults.calculationSteps.length > 0) toolSummaries.push(`CALCULATION RESULTS: ${JSON.stringify(toolResults.calculationSteps)}`);
                  if (toolResults.linkReaderAttempts && toolResults.linkReaderAttempts.length > 0) {
                    const simplifiedLinks = toolResults.linkReaderAttempts.filter((l: any) => l.status === 'success').map((l: any) => ({ url: l.url, title: l.title, status: l.status, content: l.content || "Content not available" }));
                    toolSummaries.push(`LINK READER RESULTS: ${JSON.stringify(simplifiedLinks)}`);
                  }
                  if (toolResults.generatedImages && toolResults.generatedImages.length > 0) toolSummaries.push(`IMAGE GENERATOR RESULTS: ${JSON.stringify(toolResults.generatedImages)}`);
                  if (toolResults.academicSearchResults && toolResults.academicSearchResults.length > 0) toolSummaries.push(`ACADEMIC SEARCH RESULTS: ${JSON.stringify(toolResults.academicSearchResults)}`);
                  if (toolResults.youtubeSearchResults && toolResults.youtubeSearchResults.length > 0) toolSummaries.push(`YOUTUBE SEARCH RESULTS: ${JSON.stringify(toolResults.youtubeSearchResults)}`);
                  if (toolResults.youtubeLinkAnalysisResults && toolResults.youtubeLinkAnalysisResults.length > 0) toolSummaries.push(`YOUTUBE LINK ANALYSIS RESULTS: ${JSON.stringify(toolResults.youtubeLinkAnalysisResults)}`);
                  
                  let fileCreationGuidelines = "";
                  switch(routingDecision.object.workflowMode) {
                    case 'information_response':
                      fileCreationGuidelines = `
# FILE CREATION GUIDELINES (INFORMATION RESPONSE MODE)
In information response mode, the focus was on providing a comprehensive main response.
At this stage, you may create minimal supporting files if necessary, but they\'re optional and should only be created if they add significant value.

If you create files:
- They should complement the main response, not duplicate it
- Focus on structured references, checklists, or summary tables that organize the information
- Consider creating reference sheets, diagrams, or quick-reference guides if helpful
`;
                      break;
                    case 'content_creation':
                      fileCreationGuidelines = `
# FILE CREATION GUIDELINES (CONTENT CREATION MODE)
In content creation mode, this is the CRITICAL PHASE where you create detailed, well-structured files.
This is the MAIN DELIVERABLE that provides value to the user.

Your files should:
- Be extremely comprehensive and complete based on what was requested
- Include ALL content that would answer the user\'s query in appropriate format and structure
- Create multiple files if necessary to properly organize different aspects of the content
- Follow professional standards for the type of content being created:
  * For code: include proper organization, comments, documentation, and example usage
  * For written content: use proper structure with clear sections, headings, and professional formatting
  * For data/analysis: include clear organization, labels, explanations, and visualizations where helpful
- Be immediately usable without further modifications or additions
- Include all relevant information that was mentioned in the brief chat response

File naming and organization:
- Use descriptive filenames that clearly indicate the content
- For complex deliverables, include a README.md file that explains the structure and purpose of each file
- Organize content logically with appropriate sections, headings, and structure

Content types to consider:
- Code files (.py, .js, etc.): For complete, executable code examples
- Markdown (.md): For documentation, reports, articles, guides
- Data files (.json, .csv): For structured data
- Configuration files: For system setups, environment configurations
- Templates: For reusable content patterns

IMPORTANT: Put your MAXIMUM effort into creating these files. This is where the user gets the most value from your response.
`;
                      break;
                    case 'balanced':
                    default:
                      fileCreationGuidelines = `
# FILE CREATION GUIDELINES (BALANCED MODE)
In balanced mode, your files should complement the main response you\'ve already provided.

Your files should:
- Extend the main response with additional details, examples, or implementations
- Avoid duplicating content from the main response
- Provide organized, structured content that\'s ready for use
- Focus on aspects that benefit from being in a separate file format

Files can include a variety of content types based on what best serves the user\'s query:
- Code samples or implementations
- Detailed written content that expands on concepts from the main response
- Charts, diagrams, or other visual representations
- Step-by-step procedures or templates
- Structured data or analysis
`;
                      break;
                  }
                  
                  const responseSystemPrompt = `
${buildSystemPrompt('agent', 'third', undefined)}

You are now in the third stage of the Chatflix Agentic Process - creating supporting files based on the information gathered and the main response already provided.
Here's the blueprint and the previous steps we\'ve already taken:

# Stage 1: Agentic Plan and Workflow Analysis
## Analysis:
${routingDecision.object.reasoning}

## Plan:
${planningText}

## Selected Workflow Mode: ${routingDecision.object.workflowMode}
${routingDecision.object.modeReasoning}

# Stage 2: Tool Execution and Main Response Creation
## Information Gathered by Tools Execution:
${toolSummaries.join('\n\n')}

## Main Response Already Provided to User:
${finalResultText} 

# Stage 3: Supporting Files Creation - You\'re here

${fileCreationGuidelines}

## Your Task
Create supporting files that complement the main response already provided:

1. SUPPORTING FILES: Additional content for the canvas area (adaptive based on workflow mode)
   - Each file should have a clear purpose and be self-contained
   - Use appropriate file extensions (.py, .js, .md, .json, etc.)
   - Follow best practices for the content type (code, data, etc.)
   - IMPORTANT: ALL file content MUST be formatted with proper Markdown syntax. Use the following guidelines:
     - For code blocks, use triple backticks with language specification: \`\`\`python, \`\`\`javascript, etc.
     - For charts, use \`\`\`chartjs with VALID JSON format (see Chart Guidelines below)
     - For tables, use proper Markdown table syntax with pipes and dashes
     - For headings, use # symbols (e.g., # Heading 1, ## Heading 2)
     - For lists, use proper Markdown list syntax (-, *, or numbered lists)
     - For emphasis, use *italic* or **bold** syntax
     - For links, use [text](url) syntax
     - Ensure proper indentation and spacing for nested structures

## Chart Guidelines for Supporting Files
When creating data visualizations from gathered information, use \`\`\`chartjs with VALID JSON format:

**CRITICAL: All property names and string values MUST be in double quotes for valid JSON**

Example chart format:
\`\`\`chartjs
{
  "type": "bar",
  "data": {
    "labels": ["Data Point 1", "Data Point 2"],
    "datasets": [{
      "label": "Research Results",
      "data": [25, 75],
      "backgroundColor": ["#FF6B6B", "#4ECDC4"]
    }]
  },
  "options": {
    "responsive": true,
    "plugins": {
      "title": {
        "display": true,
        "text": "Data Analysis from Tools"
      }
    }
  }
}
\`\`\`

**IMPORTANT RESTRICTIONS FOR CHART CREATION:**
- **NEVER use callback functions in tooltip, scales, or any other options**
- **AVOID complex JavaScript functions inside JSON - they cannot be parsed**
- **Use simple, static configurations only**
- **For tooltips, rely on Chart.js default formatting - it\'s sufficient for most cases**

**FORBIDDEN PATTERNS (will cause parsing errors):**
❌ "callbacks": { "label": "function(context) { ... }" }
❌ "callback": "function(value) { return ['A', 'B'][value]; }"
❌ Any string containing backslashes like "text with \\\\ backslash"
❌ Multi-line strings with \\ line continuation

**SAFE ALTERNATIVE APPROACHES:**
✅ Use default Chart.js tooltips (no custom callbacks needed)
✅ Use simple static labels: "labels": ["Category A", "Category B", "Category C"]
✅ Use basic title and legend configurations without functions
✅ Rely on Chart.js automatic formatting for most data displays

**Chart Creation Scenarios:**
- Web search results: Create comparison or trend charts
- Academic research data: Visualize research findings or statistics
- YouTube video analysis: Show engagement metrics or trends
- Calculator results: Display mathematical relationships
- Multi-source data: Create comprehensive comparison visualizations

   - File Types to Consider (ONLY if needed):
    - code files (.py, .js, etc.): For complete, executable code examples
    - data files (.json, .csv): For structured data
    - chart files (.md): For data visualizations using chartjs blocks
    - explanation files (.md): For detailed explanations or background information
    - step-by-step guides (.md): For procedures or tutorials
    - comparison tables (.md): For comparing multiple options or data points



IMPORTANT: 
- Respond in the same language as the user\'s query
- You MUST NOT create a main response again - the user has already been given the main response
- DO NOT create files unless they provide substantial additional value
- NEVER use HTML tags in file content
- Consider creating charts when you have gathered quantitative data that would benefit from visualization
`;
                  
                  let finalObjectModel = model;
                  if (model.includes('claude') && model.includes('sonnet')) finalObjectModel = 'gemini-2.5-pro-preview-05-06';
            
                  const objectResult = await streamObject({
                    model: providers.languageModel(finalObjectModel),
                    system: responseSystemPrompt,
                    // 🔧 FIX: messages 파라미터 추가하여 이미지 및 파일 컨텍스트 직접 분석 가능
                    messages: finalMessages,
                    schema: z.object({ 
                      response: z.object({ 
                        description: z.string().optional().describe('Brief description of the supporting files being provided (if any). If no files are needed, don\'t include this field.'), 
                        files: z.array(
                          z.object({ 
                            name: z.string().describe('Name of the file with appropriate extension (e.g., code.py, data.json, explanation.md)'), 
                            content: z.string().describe('Content of the file formatted with proper Markdown syntax, including code blocks with language specification'), 
                            description: z.string().optional().describe('Optional short description of what this file contains') 
                          })
                        ).optional().describe('Optional list of files to display in the canvas area - ONLY include when necessary for complex information that cannot be fully communicated in the main response')
                      })
                    }),
                  });
                  
                  let lastResponse: any = {};
                  let partialCount = 0;
                  (async () => {
                    try {
                      for await (const partialObject of objectResult.partialObjectStream) {
                        if (abortController.signal.aborted) break;
                        partialCount++;
                        const partialResponse = partialObject.response || {};
                        if (partialResponse.description !== lastResponse.description || JSON.stringify(partialResponse.files) !== JSON.stringify(lastResponse.files)) {
                          dataStream.writeMessageAnnotation({
                            type: 'structured_response_progress',
                            data: JSON.parse(JSON.stringify(partialObject))
                          });
                          lastResponse = JSON.parse(JSON.stringify(partialResponse));
                        }
                      }
                    } catch (error) {}
                  })();
                  if (partialCount < 3) await new Promise(resolve => setTimeout(resolve, 1000));
                  
                  const finalObject = await objectResult.object;

                  try {
                    const stage3Summary: string[] = [];
                    if (finalObject.response.description) stage3Summary.push(`Supporting Files Description: ${finalObject.response.description}`);
                    if (finalObject.response.files && finalObject.response.files.length > 0) {
                      stage3Summary.push(`Generated Files:`);
                      finalObject.response.files.forEach(file => { stage3Summary.push(`- ${file.name}${file.description ? ` (${file.description})` : ''}`); });
                    }
                    const followUpPrompt = `
You are generating follow-up questions for a conversation. Based on the previous context and all the content created, create 3 natural follow-up questions that the user might want to ask next.

# Original User Query
"${userQuery}"

# Main Response Already Provided
${finalResultText}

# Supporting Content Created (Stage 3)
${stage3Summary.length > 0 ? stage3Summary.join('\n') : 'No additional files were created.'}

# Your Task
Generate 3 natural follow-up questions that continue the conversation, taking into account both the main response AND any supporting files that were created:

REQUIREMENTS:
- Consider both the main response AND any supporting files created when generating questions
- If code files were created, suggest improvements, modifications, or related functionality
- If data/analysis files were created, suggest deeper analysis, comparisons, or related topics
- If documentation files were created, suggest related topics or practical applications
- Each follow-up should be a short, natural input that a user might actually type to an AI in a chat (not a question to the user)
- Use statements, requests, or short phrases that a user would enter as their next message (not questions like "Would you like to know more?")
- Avoid polite or indirect forms (e.g., "Would you like to know more?" X)
- Prefer direct, conversational, and actionable inputs (e.g., "Tell me more about Nvidia stock", "I want to know more about the tech sector", "Show me recent semiconductor market trends", "Analyze the outlook for tech stocks")
- The follow-ups can be questions, but only if they are in the form a user would type to an AI (e.g., "What\'s the outlook for Nvidia?", "Show me recent trends in tech stocks")
- Do NOT use "Would you like me to...", "Shall I...", "Do you need..." or similar forms
- Make sure each follow-up is suitable for direct input by the user
- Keep each follow-up under 15 words if possible
- Examples:
  * "Tell me more about Nvidia stock"
  * "I want to know more about the tech sector"
  * "Show me recent semiconductor market trends"
  * "Analyze the outlook for tech stocks"
  * "Recent trends in the AI industry"
  * "Improve the error handling in this code"
  * "Add more features to this application"
  * "Create a visualization of this data"

**LANGUAGE RULE**: Respond in the same language as the user\'s original query.

Format your response as exactly 3 lines, one question per line, with no numbering or bullets:
`;
                    const followUpResult = await generateObject({ 
                        model: providers.languageModel('gemini-2.0-flash'), 
                        prompt: followUpPrompt, 
                        temperature: 0.7,
                        schema: z.object({ followup_questions: z.array(z.string()).length(3).describe('Exactly 3 natural follow-up questions that the user might want to ask next') })
                    });
                    const followUpQuestions = followUpResult.object.followup_questions;
                    const structuredResponse = { response: { ...finalObject.response, followup_questions: followUpQuestions } };
                    dataStream.writeMessageAnnotation({ type: 'structured_response', data: JSON.parse(JSON.stringify(structuredResponse)) });
                    toolResults.structuredResponse = structuredResponse;
                  } catch (followUpError) {
                    console.error('Follow-up question generation failed:', followUpError);
                    const structuredResponse = { response: { ...finalObject.response, followup_questions: [] } };
                    dataStream.writeMessageAnnotation({ type: 'structured_response', data: JSON.parse(JSON.stringify(structuredResponse)) });
                    toolResults.structuredResponse = structuredResponse;
                  }
                } catch (objError) { /* 오류 발생 시에도 기존 텍스트는 유지 (실제와 동일) */ }
                
                // 데모에서는 DB 저장(handleStreamCompletion) 및 메모리 업데이트(updateAllMemoryBanks) 안 함
              }
            });
            finalstep.mergeIntoDataStream(dataStream, { sendReasoning: true });

          } else { // 일반 채팅 (에이전트 비활성화)
            const systemTokens = estimateTokenCount(currentSystemPrompt);
            const maxContextTokens = modelConfig?.contextWindow || 8000;
            const remainingTokens = maxContextTokens - systemTokens;
            const hasFileAttachments = processMessages.some(msg => Array.isArray(msg.content) && msg.content.some((part: any) => part.type === 'file' || part.type === 'image'));
            const optimizedMessages = selectMessagesWithinTokenLimit(processMessages, remainingTokens, hasFileAttachments);
            const finalMessages = convertMultiModalToMessage(optimizedMessages);

            const result = streamText({
              model: providers.languageModel(model),
              system: currentSystemPrompt,
              messages: finalMessages,
              providerOptions: providerOptions,
              onFinish: async (completion) => {
                if (abortController.signal.aborted) return;
                // 데모에서는 DB 저장(handleStreamCompletion) 및 메모리 업데이트(updateAllMemoryBanks) 안 함
              }
            });
            result.mergeIntoDataStream(dataStream, { sendReasoning: true });
          }
      }
    });
}