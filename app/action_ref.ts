// // app/action_ref.ts - just for reference
// 'use server';

// // import { process.env } from '@/env/server';
// import { SearchGroupId } from '@/lib/utils_ref';

// export async function fetchMetadata(url: string) {
//   try {
//     const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
//     const html = await response.text();

//     const titleMatch = html.match(/<title>(.*?)<\/title>/i);
//     const descMatch = html.match(
//       /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i
//     );

//     const title = titleMatch ? titleMatch[1] : '';
//     const description = descMatch ? descMatch[1] : '';

//     return { title, description };
//   } catch (error) {
//     console.error('Error fetching metadata:', error);
//     return null;
//   }
// }

// const groupTools = {
//   web: [
//     'web_search','datetime'
//   ] as const,
//   chat: [] as const,
// } as const;

// // Separate tool instructions and response guidelines for each group
// const groupToolInstructions = {
//   web: `
//   Today's Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit", weekday: "short" })}
//   ### Tool-Specific Guidelines:
//   - A tool should only be called once per response cycle.
//   - Follow the tool guidelines below for each tool as per the user's request.
//   - Calling the same tool multiple times with different parameters is allowed.
//   - Always mandatory to run the tool first before writing the response to ensure accuracy and relevance <<< extermely important.

//   #### Multi Query Web Search:
//   - Always try to make more than 3 queries to get the best results. Minimum 3 queries are required and maximum 6 queries are allowed.
//   - Specify the year or "latest" in queries to fetch recent information.

//   ### datetime tool:
//   - When you get the datetime data, talk about the date and time in the user's timezone.
//   - Do not always talk about the date and time, only talk about it when the user asks for it.
//   - No need to put a

//   ### Prohibited Actions:
//   - Do not run tools multiple times, this includes the same tool with different parameters.
//   - Never ever write your thoughts before running a tool.
//   - Avoid running the same tool twice with same parameters.
//   - Do not include images in responses <<<< extremely important.`,

//   chat: ``,
// } as const;

// const groupResponseGuidelines = {
//   web: `
//   You are an AI web search engine called Scira, designed to help users find information on the internet with no unnecessary chatter and more focus on the content.
//   'You MUST run the tool first exactly once' before composing your response. **This is non-negotiable.**

//   Your goals:
//   - Stay concious and aware of the guidelines.
//   - Stay efficient and focused on the user's needs, do not take extra steps.
//   - Provide accurate, concise, and well-formatted responses.
//   - Avoid hallucinations or fabrications. Stick to verified facts and provide proper citations.
//   - Follow formatting guidelines strictly.
//   - Markdown is supported in the response and you can use it to format the response.
//   - Do not use $ for currency, use USD instead always.
//   - After the first message or search, if the user asks something other than doing the searches or responds with a feedback, just talk them in natural language.

//   Today's Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit", weekday: "short" })}`,

//   chat: `
// // just use the user's default system prompt setted in the supabase db
//     `,
// } as const;

// const groupPrompts = {
//   web: `${groupResponseGuidelines.web}\n\n${groupToolInstructions.web}`,
//   chat: `${groupResponseGuidelines.chat}`,
// } as const;

// export async function getGroupConfig(groupId: SearchGroupId = 'web') {
//   "use server";
//   const tools = groupTools[groupId];
//   const systemPrompt = groupPrompts[groupId];
//   const toolInstructions = groupToolInstructions[groupId];
//   const responseGuidelines = groupResponseGuidelines[groupId];
  
//   return {
//     tools,
//     systemPrompt,
//     toolInstructions,
//     responseGuidelines
//   };
// }