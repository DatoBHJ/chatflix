// // /app/api/chat_ref/route.ts - just for reference
// import { tavily } from '@tavily/core';
// import {
//     convertToCoreMessages,
//     smoothStream,
//     streamText,
//     tool,
//     createDataStreamResponse,

// } from 'ai';
// import { z } from 'zod';
// import { getGroupConfig } from '@/app/action_ref';
// import { providers } from '@/lib/providers';
// import { geolocation } from '@vercel/functions';

// // Allow streaming responses up to 600 seconds
// export const maxDuration = 600;


// function sanitizeUrl(url: string): string {
//     return url.replace(/\s+/g, '%20');
// }

// async function isValidImageUrl(url: string): Promise<boolean> {
//     try {
//         const controller = new AbortController();
//         const timeout = setTimeout(() => controller.abort(), 5000);

//         const response = await fetch(url, {
//             method: 'HEAD',
//             signal: controller.signal,
//         });

//         clearTimeout(timeout);

//         return response.ok && (response.headers.get('content-type')?.startsWith('image/') ?? false);
//     } catch {
//         return false;
//     }
// }


// const extractDomain = (url: string): string => {
//     const urlPattern = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i;
//     return url.match(urlPattern)?.[1] || url;
// };

// const deduplicateByDomainAndUrl = <T extends { url: string }>(items: T[]): T[] => {
//     const seenDomains = new Set<string>();
//     const seenUrls = new Set<string>();

//     return items.filter(item => {
//         const domain = extractDomain(item.url);
//         const isNewUrl = !seenUrls.has(item.url);
//         const isNewDomain = !seenDomains.has(domain);

//         if (isNewUrl && isNewDomain) {
//             seenUrls.add(item.url);
//             seenDomains.add(domain);
//             return true;
//         }
//         return false;
//     });
// };

// // Modify the POST function to use the new handler
// export async function POST(req: Request) {
//     const { messages, model, group, user_id } = await req.json();
//     const { tools: activeTools, systemPrompt, toolInstructions, responseGuidelines } = await getGroupConfig(group);
//     const geo = geolocation(req);

//     console.log("Running with model: ", model.trim());
//     console.log("Group: ", group);

//     if (group !== 'chat' && group !== 'buddy') {
//         console.log("Running inside part 1");
//         return createDataStreamResponse({
//             execute: async (dataStream) => {
//                 const toolsResult = streamText({
//                     model: providers.languageModel(model),
//                     messages: convertToCoreMessages(messages),
//                     temperature: 0,
//                     experimental_activeTools: [...activeTools],
//                     system: toolInstructions,
//                     toolChoice: 'required',
//                     tools: {
//                         web_search: tool({
//                             description: 'Search the web for information with multiple queries, max results and search depth.',
//                             parameters: z.object({
//                                 queries: z.array(z.string().describe('Array of search queries to look up on the web.')),
//                                 maxResults: z.array(
//                                     z.number().describe('Array of maximum number of results to return per query.').default(10),
//                                 ),
//                                 topics: z.array(
//                                     z.enum(['general', 'news']).describe('Array of topic types to search for.').default('general'),
//                                 ),
//                                 searchDepth: z.array(
//                                     z.enum(['basic', 'advanced']).describe('Array of search depths to use.').default('basic'),
//                                 ),
//                                 exclude_domains: z
//                                     .array(z.string())
//                                     .describe('A list of domains to exclude from all search results.')
//                                     .default([]),
//                             }),
//                             execute: async ({
//                                 queries,
//                                 maxResults,
//                                 topics,
//                                 searchDepth,
//                                 exclude_domains,
//                             }: {
//                                 queries: string[];
//                                 maxResults: number[];
//                                 topics: ('general' | 'news')[];
//                                 searchDepth: ('basic' | 'advanced')[];
//                                 exclude_domains?: string[];
//                             }) => {
//                                 const apiKey = process.env.TAVILY_API_KEY;
//                                 const tvly = tavily({ apiKey });
//                                 const includeImageDescriptions = true;

//                                 console.log('Queries:', queries);
//                                 console.log('Max Results:', maxResults);
//                                 console.log('Topics:', topics);
//                                 console.log('Search Depths:', searchDepth);
//                                 console.log('Exclude Domains:', exclude_domains);

//                                 // Execute searches in parallel
//                                 const searchPromises = queries.map(async (query, index) => {
//                                     const data = await tvly.search(query, {
//                                         topic: topics[index] || topics[0] || 'general',
//                                         days: topics[index] === 'news' ? 7 : undefined,
//                                         maxResults: maxResults[index] || maxResults[0] || 10,
//                                         searchDepth: searchDepth[index] || searchDepth[0] || 'basic',
//                                         includeAnswer: true,
//                                         includeImages: true,
//                                         includeImageDescriptions: includeImageDescriptions,
//                                         excludeDomains: exclude_domains,
//                                     });

//                                     // Add annotation for query completion
//                                     dataStream.writeMessageAnnotation({
//                                         type: 'query_completion',
//                                         data: {
//                                             query,
//                                             index,
//                                             total: queries.length,
//                                             status: 'completed',
//                                             resultsCount: data.results.length,
//                                             imagesCount: data.images.length
//                                         }
//                                     });

//                                     return {
//                                         query,
//                                         results: deduplicateByDomainAndUrl(data.results).map((obj: any) => ({
//                                             url: obj.url,
//                                             title: obj.title,
//                                             content: obj.content,
//                                             raw_content: obj.raw_content,
//                                             published_date: topics[index] === 'news' ? obj.published_date : undefined,
//                                         })),
//                                         images: includeImageDescriptions
//                                             ? await Promise.all(
//                                                 deduplicateByDomainAndUrl(data.images).map(
//                                                     async ({ url, description }: { url: string; description?: string }) => {
//                                                         const sanitizedUrl = sanitizeUrl(url);
//                                                         const isValid = await isValidImageUrl(sanitizedUrl);
//                                                         return isValid
//                                                             ? {
//                                                                 url: sanitizedUrl,
//                                                                 description: description ?? '',
//                                                             }
//                                                             : null;
//                                                     },
//                                                 ),
//                                             ).then((results) =>
//                                                 results.filter(
//                                                     (image): image is { url: string; description: string } =>
//                                                         image !== null &&
//                                                         typeof image === 'object' &&
//                                                         typeof image.description === 'string' &&
//                                                         image.description !== '',
//                                                 ),
//                                             )
//                                             : await Promise.all(
//                                                 deduplicateByDomainAndUrl(data.images).map(async ({ url }: { url: string }) => {
//                                                     const sanitizedUrl = sanitizeUrl(url);
//                                                     return (await isValidImageUrl(sanitizedUrl)) ? sanitizedUrl : null;
//                                                 }),
//                                             ).then((results) => results.filter((url) => url !== null) as string[]),
//                                     };
//                                 });

//                                 const searchResults = await Promise.all(searchPromises);

//                                 return {
//                                     searches: searchResults,
//                                 };
//                             },
//                         }),
//                        datetime: tool({
//                             description: 'Get the current date and time in the user\'s timezone',
//                             parameters: z.object({}),
//                             execute: async () => {
//                                 try {
//                                     // Get current date and time
//                                     const now = new Date();

//                                     // Use geolocation to determine timezone
//                                     let userTimezone = 'UTC'; // Default to UTC

//                                     if (geo && geo.latitude && geo.longitude) {
//                                         try {
//                                             // Get timezone from coordinates using Google Maps API
//                                             const tzResponse = await fetch(
//                                                 `https://maps.googleapis.com/maps/api/timezone/json?location=${geo.latitude},${geo.longitude}&timestamp=${Math.floor(now.getTime() / 1000)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
//                                             );

//                                             if (tzResponse.ok) {
//                                                 const tzData = await tzResponse.json();
//                                                 if (tzData.status === 'OK' && tzData.timeZoneId) {
//                                                     userTimezone = tzData.timeZoneId;
//                                                     console.log(`Timezone determined from coordinates: ${userTimezone}`);
//                                                 } else {
//                                                     console.log(`Failed to get timezone from coordinates: ${tzData.status || 'Unknown error'}`);
//                                                 }
//                                             } else {
//                                                 console.log(`Timezone API request failed with status: ${tzResponse.status}`);
//                                             }
//                                         } catch (error) {
//                                             console.error('Error fetching timezone from coordinates:', error);
//                                         }
//                                     } else {
//                                         console.log('No geolocation data available, using UTC');
//                                     }

//                                     // Format date and time using the timezone
//                                     return {
//                                         timestamp: now.getTime(),
//                                         iso: now.toISOString(),
//                                         timezone: userTimezone,
//                                         formatted: {
//                                             date: new Intl.DateTimeFormat('en-US', {
//                                                 weekday: 'long',
//                                                 year: 'numeric',
//                                                 month: 'long',
//                                                 day: 'numeric',
//                                                 timeZone: userTimezone
//                                             }).format(now),
//                                             time: new Intl.DateTimeFormat('en-US', {
//                                                 hour: '2-digit',
//                                                 minute: '2-digit',
//                                                 second: '2-digit',
//                                                 hour12: true,
//                                                 timeZone: userTimezone
//                                             }).format(now),
//                                             dateShort: new Intl.DateTimeFormat('en-US', {
//                                                 month: 'short',
//                                                 day: 'numeric',
//                                                 year: 'numeric',
//                                                 timeZone: userTimezone
//                                             }).format(now),
//                                             timeShort: new Intl.DateTimeFormat('en-US', {
//                                                 hour: '2-digit',
//                                                 minute: '2-digit',
//                                                 hour12: true,
//                                                 timeZone: userTimezone
//                                             }).format(now)
//                                         }
//                                     };
//                                 } catch (error) {
//                                     console.error('Datetime error:', error);
//                                     throw error;
//                                 }
//                             },
//                         }),
//                     },
                  
//                     onChunk(event) {
//                         if (event.chunk.type === 'tool-call') {
//                             console.log('Called Tool: ', event.chunk.toolName);
//                         }
//                     },
//                     onStepFinish(event) {
//                         if (event.warnings) {
//                             console.log('Warnings: ', event.warnings);
//                         }
//                     },
//                     onFinish(event) {
//                         console.log('Fin reason[1]: ', event.finishReason);
//                         console.log('Reasoning[1]: ', event.reasoning);
//                         console.log('reasoning details[1]: ', event.reasoningDetails);
//                         console.log('Steps[1] ', event.steps);
//                         console.log('Messages[1]: ', event.response.messages);
//                     },
//                     onError(event) {
//                         console.log('Error: ', event.error);
//                     },
//                 });

//                 toolsResult.mergeIntoDataStream(dataStream, {
//                     experimental_sendFinish: false
//                 });

//                 console.log("we got here");

//                 const response = streamText({
//                     model: providers.languageModel(model),
//                     system: responseGuidelines,
//                     experimental_transform: smoothStream({
//                         chunking: 'word',
//                         delayInMs: 15,
//                     }),
//                     messages: [...convertToCoreMessages(messages), ...(await toolsResult.response).messages],
//                     onFinish(event) {
//                         console.log('Fin reason[2]: ', event.finishReason);
//                         console.log('Reasoning[2]: ', event.reasoning);
//                         console.log('reasoning details[2]: ', event.reasoningDetails);
//                         console.log('Steps[2] ', event.steps);
//                         console.log('Messages[2]: ', event.response.messages);
//                     },
//                     onError(event) {
//                         console.log('Error: ', event.error);
//                     },
//                 });

//                 return response.mergeIntoDataStream(dataStream, {
//                     experimental_sendStart: true,
//                 });
//             }
//         })
//     }
// }