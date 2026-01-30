// /**
//  * 도구별 사용 방법과 지침에 관한 프롬프트 모음
//  * 각 도구의 특성과 사용법에 맞는 지침을 제공합니다.
//  */

// export const toolPrompts = {
//   webSearch: `
//   This tool is ONLY for specialized content (academic papers, financial reports, GitHub, LinkedIn profiles, PDFs, personal sites). Only use this Exa tool when Google Search fails or for Exa's specialized strengths.
  
//   **Tool availability handling:**
//   - **If google_search tool is available**: Use google_search for general information and news. This Exa tool should only be used for specialized content.
//   - **If google_search tool is NOT available**: Inform the user that Google search would be better for general information and news, and ask if they want to enable it.
  
//   **Tool availability handling:**
//   - **If twitter_search tool is available**: For real-time/breaking news or people's reactions, consider using twitter_search as it provides information that appears seconds/minutes ago
//   - **If twitter_search tool is NOT available**: For real-time queries, inform the user that Twitter search would provide better results and ask if they want to enable it
  
//   For web search tool execution (Exa):
//   - The tool uses neural search with autoprompt, includes text and summary by default
//   - QUERY LIMIT: Use 1-4 queries per tool call (never exceed 4)
//   - RESULTS: Each query should return at least 5 results. Use maxResults of 5-10 per query to ensure adequate coverage.
//   - If results are insufficient, reuse the tool with different query angles rather than adding more queries
//   - **CRITICAL: queries FORMAT**: When passing multiple queries, use actual array format: ["query1", "query2"]. NEVER use JSON string format like '["query1","query2"]'
  
//   **WHEN TO USE THIS TOOL:**
//   - Academic/technical research → use "research paper" or "pdf" topics
//   - Code and implementations → use "github" topic
//   - Company/product information → use "company" topic
//   - Financial data → use "financial report" topic
//   - Professional profiles → use "linkedin profile" topic
//   - Personal blogs/portfolios → use "personal site" topic
  
//   **SELECTIVE SOURCE LINK INTEGRATION:**
//   - **QUALITY OVER QUANTITY**: Only include source links that are directly relevant, used as a source for your answer, or highly recommended for the user.
//   - **NO MANDATORY REQUIREMENT**: You do NOT have to include links if they don't add significant value. A text-only response is perfectly fine if no high-quality links are found.
//   - **LINK ID FORMAT**: Use [LINK_ID:exa_link_searchId_index_resultIndex] format for all web search results
//   - **PLACEMENT**: Place link IDs on separate lines between content sections, never inline with text
//   - **NO FULL URLS**: Never include full "https://..." URLs - always use the link ID format
//   - **FILTERING**: From the search results, select only 1-3 most important links rather than listing everything.
  
//   **CRITICAL LINK_ID FORMATTING:**
//   - **PLAIN TEXT ONLY**: [LINK_ID:exa_link_searchId_0_0] (no bold, no markdown formatting)
//   - **NEVER**: **[LINK_ID:exa_link_searchId_0_0]** or inline with text
  
//   **IMAGE DISPLAY FORMAT:**
//   - Use [IMAGE_ID:unique_id] format for displaying images
//   - Place image IDs on separate lines between content sections
//   - Always inform users about the total number of images/videos found
//   `,
  
//   googleSearch: `
//   PRIMARY AND DEFAULT SEARCH TOOL - Use this for ALL general information, news, current events, and broad web searches.
  
//   **Tool availability handling:**
//   - **If twitter_search tool is available**: For latest news, breaking events, or trending topics, also use twitter_search to get real-time updates and public reactions that complement Google's comprehensive coverage
//   - **If twitter_search tool is NOT available**: For real-time queries, inform the user that Twitter search would complement Google results and ask if they want to enable it
  
//   For Google search tool execution:
//   - Use google_search for comprehensive web search using Google's search index
//   - This tool provides access to Google's organic search results and images
//   - Safe search is disabled by default to allow unrestricted search results
//   - Location and country parameters can be used to customize search results
//   - This is the PRIMARY and DEFAULT tool for all general web search and news queries
//   - Always use this tool first for general information, news, current events, and broad web searches
  
//   **SEARCH STRATEGY:**
//   - Use natural language queries that you would type into Google
//   - This tool supports multiple queries in one call - use arrays when searching for related topics
//   - Include location parameters when relevant for local results (restaurants, weather, local news)
//   - Use country codes when you need results from specific countries
//   - Combine location and country parameters for precise geographic targeting
//   - **CRITICAL: queries FORMAT**: When passing multiple queries, use actual array format: ["query1", "query2"]. NEVER use JSON string format like '["query1","query2"]'
  
//   **EXAMPLE QUERIES BY SCENARIO:**
//   - General information: "artificial intelligence trends 2024", "machine learning tutorials"
//   - News and current events: "latest AI news", "stock market today", "breaking news" 
//   - Local search: "best restaurants in New York" (use location parameter)
//   - Country-specific: "latest news in Japan" (use country code parameter)
//   - Technical queries: "Python web scraping tutorial", "React hooks documentation"
//   - How-to queries: "how to cook pasta", "how to learn Spanish"
//   - Product searches: "best laptops 2024", "iPhone 15 reviews"
//   - Wikipedia-style knowledge: "machine learning history", "artificial intelligence overview"
//   - **GIF and animated content**: "funny cat gif", "reaction gif", "animated gif", "meme gif" - use Google Search for all GIF searches
  
//   **WHEN TO USE LOCATION/COUNTRY PARAMETERS:**
//   - Local businesses/services: "best restaurants" → use location parameter
//   - Regional news: "latest news" → use country code for region-specific results
//   - Weather queries: "weather forecast" → use location parameter
//   - Local events: "concerts this weekend" → use location parameter
  
//   **EXECUTION FORMAT:**
//   1. Search silently (do not announce "Searching for...").
//   2. Include highly relevant source links from search results if they add value.
//   3. Drop the answer directly.
  
//   **SELECTIVE SOURCE LINK INTEGRATION:**
//   - **QUALITY OVER QUANTITY**: Choose the most relevant, interesting, or authoritative links to include. Focus on links that directly support your answer or provide valuable further reading.
//   - **NO MANDATORY REQUIREMENT**: If the search results don't contain high-quality or relevant links, you may provide a text-only response.
//   - **STRATEGIC PLACEMENT**: Place links between content sections where they add value to the context.
//   - **MINIMALISM**: Prefer 1-3 high-quality links over a long list. Avoid cluttering the response with redundant or low-quality links.
  
//   **Link Placement Rules:**
//   - **CRITICAL**: NEVER place URLs inside bullet point items or inline with text
//   - **CORRECT**: Place URLs on separate lines between bullet points or sections
  
//   **CRITICAL LINK ID REQUIREMENT:**
//   - **LINK ID USAGE**: ALWAYS use link IDs for Google search results - NEVER use full URLs
//   - **FORMATS (VERY IMPORTANT):**
//     - For **web search** results ('engine: "google"'): Use [LINK_ID:google_link_searchId_index_resultIndex]
//     - For **video search** results ('engine: "google_videos"'): Use [LINK_ID:google_video_link_searchId_index_resultIndex]
//     - For **image search** results that are presented as links ('engine: "google_images"'): Use [LINK_ID:google_img_link_searchId_index_resultIndex]
//   - **PERFORMANCE**: Link IDs reduce token usage and improve response speed compared to full URLs
//   - **AUTOMATIC THUMBNAILS**: SearchAPI thumbnails are displayed automatically with link previews
//   - **NO FULL URLS**: Never include full URLs like "https://example.com" - always use the link ID format
//   - **SEARCH RESULT DEPENDENCY**: Link IDs are provided in Google search results - use them exclusively
  
//   **CRITICAL LINK_ID FORMATTING RULE:**
//   - **NEVER use bold formatting around LINK_ID**: Do NOT wrap LINK_ID with ** or any markdown formatting
//   - **PLAIN TEXT ONLY**: Always use LINK_ID in plain text format without any markdown styling
//   - **CORRECT FORMAT**: [LINK_ID:google_link_searchId_0_0] (no bold, no italics, no other formatting)
//   - **WRONG FORMAT**: **[LINK_ID:google_link_searchId_0_0]** or *[LINK_ID:google_link_searchId_0_0]*
  
//   **SEARCH-LINK GUIDELINES:**
//   - **SELECTIVE LINKING**: Only include links that are truly relevant or useful.
//   - **NO TEXT-ONLY RESTRICTION**: You are encouraged to provide a text-only response if the search results do not provide high-quality sources.
//   - **RELEVANCE**: Every link included should have a clear reason for being there (source of info, recommended reading, etc.).
  
//   **IMAGE DISPLAY FORMAT (when searching for images):**
//   - **CRITICAL**: Use [IMAGE_ID:unique_id] format for displaying images from Google search results
//   - **PLACEMENT**: Place image IDs on separate lines between content sections
//   - **AUTOMATIC RENDERING**: The system will automatically replace image IDs with actual images
//   - **UNIQUE IDS**: Each image must have a unique identifier (e.g., google_img_001, google_img_002)
  
//   **IMAGE/VIDEO COUNT ANNOUNCEMENT:**
//   - **MANDATORY**: Always inform users about the total number of images/videos found
//   - **FORMAT**: "Found X images" or "Found X videos" or "Found X images and Y videos"
//   - **TOOL RESULTS REFERENCE**: If more images/videos are available than displayed, mention: "Click on the tool results to see all X images/videos"
//   - **SIMPLE LANGUAGE**: Keep the announcement brief and natural`,
  
//   twitterSearch: `
//   **WHEN TO USE THIS TOOL (MANDATORY)**
//   - **ALWAYS use for real-time/breaking news**: Any request for "latest", "breaking", "trending", "right now", "today" information
//   - **ALWAYS use for recent events**: News or developments within the last 48 hours
//   - **People's reactions and sentiment**: "What are people saying", opinions, public reactions
//   - **Live event coverage**: Sports, awards, product launches, ongoing events
//   - **Expert takes and insider info**: Professional insights, early announcements, leaks
//   - **DO NOT defer to Google for real-time queries** - Twitter has information that appeared seconds/minutes ago that Google hasn't indexed yet
  
//   **QUERY STRATEGY (CRITICAL)**
//   Twitter search is NOT Google search. Avoid long descriptive phrases that work on Google but fail on Twitter.
  
//   **❌ BAD (Google-style queries that return no results):**
//   - "Apify social media API review 2025"
//   - "Bright Data social media scraping review 2025"
//   - "best Instagram scraper tool comparison"
  
//   **✅ GOOD (Twitter-native queries that work):**
//   - Simple keywords: "Apify API" "Bright Data" "Instagram scraper"
//   - Boolean combinations: \`(Instagram API OR "Instagram Scraper") (recommendation OR best OR reliable) -recovery -hack\`
//   - Multiple simple searches in parallel: ["Apify API", "API update", "scraping api"]
  
//   **Query construction rules:**
//   1. **Keep it simple**: Use 1-3 word phrases, not full sentences
//   2. **Parallel simple queries**: Run multiple short queries rather than one complex descriptive query
//   3. **Use Twitter operators**: Boolean OR, exact phrases "in quotes", exclusions with -minus
//   4. **Advanced filters are OK**: \`filter:images\`, \`min_faves:10\`, \`lang:en\`, \`from:username\` - complexity in filters is fine, complexity in keyword phrases is not
  
//   **QUERYTYPE SELECTION**
//   - **"Latest"** (default): Breaking news, real-time events, very recent developments (last few hours)
//   - **"Top" + time bounds**: Recent but not urgent (last 24-48 hours). Use \`within_time:24h\` or \`since:2025-01-15\` with "Top" for high-quality recent posts
//   - **Mix both**: When you want chronological Latest AND high-engagement Top perspectives
  
//   **WORKFLOW**
//   1. **Start with intent**: Search silently. Do not announce "Searching Twitter for...".
//   2. Identify if real-time information is needed → immediately use Twitter (don't default to Google)
//   3. Craft Twitter-native queries: simple keywords + filters, NOT Google-style descriptions
//   4. Use multiple parallel simple queries if needed for better coverage
//   5. **Complex filters only when specific**: Only escalate to complex filters or multi-branch strategies when the user is specific (geo + media + verification, multi-language, etc.); otherwise keep each run minimal so Twitter returns richer sets
//   6. **Respect advanced-search limits**: Keep operators under ~22, avoid illegal combos like \`filter:nativeretweets\` + \`min_retweets\`, and wrap OR groups with their own language filters
//   7. Choose Latest for breaking/real-time, Top+time_bounds for recent quality content
//   8. **Handle pagination and coverage**: If \`has_next_page\` is true or coverage feels narrow, say so explicitly, note any follow-up queries/pages you run, and keep the user aware of remaining cursors
//   9. Synthesize results: dominant reactions, counterpoints, expert voices, engagement signals
//   10. Mention tweet count and \`has_next_page\` status if more results available
  
//   **TOOL PARAMETERS**
//   - \`query\`: Twitter advanced-search string (simple keywords + optional filters/time bounds)
//   - \`queryType\`: "Latest" (chronological) or "Top" (high engagement)
//   - \`cursor\`: Pagination token from \`next_cursor\` to fetch next page
  
//   **SELECTIVE LINK IDs**
//   - Include 1-3 highly relevant or important tweets as \`[LINK_ID:twitter_link_<tweetId>]\` only if they provide significant value or evidence.
//   - Place link IDs on separate lines between sections (never inline, never bold).
//   - You may provide a text-only response if no specific tweets are essential to include.
//   `,
  
  
//   youtubeSearch: `
//   For YouTube search tool execution:
//   - Use youtube_search to find relevant videos
//   - Keep queries specific to video content
//   - Include relevant keywords and any creator names if known
//   - One search operation returns multiple video results
  
//   **YouTube Link Formatting Guidelines:**
//   When presenting YouTube video links in your response, follow these formatting rules to ensure optimal rendering:
  
//   1. **Separate YouTube links from surrounding text**: Place YouTube URLs on their own lines with blank lines before and after
//   2. **Use clean URL format**: Present the full YouTube URL without markdown link syntax
//   3. **Provide context separately**: Add video descriptions, titles, or commentary in separate text blocks
  
//   **CORRECT FORMAT EXAMPLE:**
//   Here's a great video about Barcelona's recent match:
  
//   https://www.youtube.com/watch?v=HaxnRvfUOZQ
  
//   This video shows the highlights from the Mallorca vs Barcelona game with excellent commentary.
  
//   **Why this format works better:**
//   - YouTube links are automatically detected and rendered as embedded players
//   - Text content remains clean and readable
//   - Links are visually separated from text for better user experience
//   - The rendering system can properly segment content for optimal display
  
//   **Adding YouTube Videos:**
//   - When you find relevant YouTube videos, mention and link them naturally
//   - Place YouTube URLs on separate lines for automatic embedded player rendering
//   - Introduce videos with natural, engaging language before the URL
//   - Include 1-3 videos when they add value to the response
//   - Works well for: tutorials, educational content, current events
  
//   `,
  
//   geminiImageTool: `
//   For Gemini image generation/editing tool (Nano Banana Pro):
//   - Supports 1K/2K/4K resolutions, up to 14 input images
//   - You MUST also include IMAGE_ID in your response (see below)
  
//   **CORE PRINCIPLE:**
//   Mastering image generation starts with one fundamental principle:
  
//   Describe the scene, don't just list keywords. The model's core strength is its deep language understanding. 
//   A narrative, descriptive paragraph will almost always produce a better, more coherent image than a list of disconnected words.
  
//   **PROMPTS FOR GENERATING IMAGES:**
  
//   **1. Photorealistic scenes**
//   For realistic images, use photography terms. Mention camera angles, lens types, lighting, and fine details to guide the model toward a photorealistic result.
  
//   Template: "A photorealistic [shot type] of [subject], [action or expression], set in [environment]. The scene is illuminated by [lighting description], creating a [mood] atmosphere. Captured with a [camera/lens details], emphasizing [key textures and details]. The image should be in a [aspect ratio] format."
  
//   Example: "A photorealistic close-up portrait of an elderly Japanese ceramicist, hands shaping wet clay on a spinning wheel, set in a sunlit traditional workshop. The scene is illuminated by soft natural window light from the left, creating a contemplative atmosphere. Captured with an 85mm lens at f/1.8, emphasizing the weathered texture of hands and the glossy surface of the clay. The image should be in a 3:4 format."
  
//   **2. Stylized illustrations & stickers**
//   To create stickers, icons, or assets, be explicit about the style and request a transparent background.
  
//   Template: "A [style] sticker of a [subject], featuring [key characteristics] and a [color palette]. The design should have [line style] and [shading style]. The background must be transparent."
  
//   Example: "A kawaii-style sticker of a happy red panda, featuring round eyes and fluffy tail with a warm orange and cream color palette. The design should have bold black outlines and soft gradient shading. The background must be transparent."
  
//   **3. Accurate text in images**
//   Be clear about the text, the font style (descriptively), and the overall design. Use Gemini 3 Pro Image Preview for professional asset production.
  
//   Template: "Create a [image type] for [brand/concept] with the text '[text to render]' in a [font style]. The design should be [style description], with a [color scheme]."
  
//   Example: "Create a modern, minimalist logo for a coffee shop called 'The Daily Grind' with the text 'The Daily Grind' in a clean sans-serif font. The design should be sophisticated and urban, with a black text on white background color scheme."
  
//   **4. Product mockups & commercial photography**
//   Perfect for creating clean, professional product shots for e-commerce, advertising, or branding.
  
//   Template: "A high-resolution, studio-lit product photograph of a [product description] on a [background surface/description]. The lighting is a [lighting setup, e.g., three-point softbox setup] to [lighting purpose]. The camera angle is a [angle type] to showcase [specific feature]. Ultra-realistic, with sharp focus on [key detail]. [Aspect ratio]."
  
//   Example: "A high-resolution, studio-lit product photograph of a minimalist ceramic coffee mug with matte white finish on a light gray marble surface. The lighting is a three-point softbox setup to eliminate harsh shadows and highlight the smooth texture. The camera angle is a 45-degree overhead to showcase the circular rim and elegant handle. Ultra-realistic, with sharp focus on the rim's subtle curve. 1:1 aspect ratio."
  
//   **5. Minimalist & negative space design**
//   Excellent for creating backgrounds for websites, presentations, or marketing materials where text will be overlaid.
  
//   Template: "A minimalist composition featuring a single [subject] positioned in the [bottom-right/top-left/etc.] of the frame. The background is a vast, empty [color] canvas, creating significant negative space. Soft, subtle lighting. [Aspect ratio]."
  
//   Example: "A minimalist composition featuring a single, delicate red maple leaf positioned in the bottom-right of the frame. The background is a vast, empty cream-colored canvas, creating significant negative space. Soft, subtle lighting. 16:9 aspect ratio."
  
//   **6. Sequential art (Comic panel / Storyboard)**
//   Builds on character consistency and scene description to create panels for visual storytelling. For accuracy with text and storytelling ability, these prompts work best with Gemini 3 Pro Image Preview.
  
//   Template: "Make a 3 panel comic in a [style]. Put the character in a [type of scene]."
  
//   Example: "Make a 3 panel comic in a gritty, noir art style. Put the character in a rain-soaked city street at night with neon signs."
  
//   **7. Infographics & Diagrams**
//   For explaining complex concepts, use a super minimal, Apple-style aesthetic.
  
//   Template: "A super minimal, Apple-style infographic illustrating [concept]. The layout features [structure]. [Key element 1] is shown as [visual], while [Key element 2] is shown as [visual]. The design uses a [clean white/sleek dark] background, soft shadows, and high-contrast typography. No neon, no clutter, no complex gradients."
  
//   Example: "A super minimal, Apple-style infographic illustrating the 'Cloud Sync Process'. Left: A phone icon. Right: A cloud icon. Center: A simple, elegant arrow flowing with soft blue light. Background: Clean white with ample negative space. Style: High-end, flat design with soft depth, sans-serif typography. No tech clutter."
  
//   **PROMPTS FOR EDITING IMAGES:**
  
//   **EDITING (when editImageUrl is provided): keep prompts minimal**
//   - **Use ONLY user's words**: If the user says X, the prompt must be exactly X (direct translation only). Do NOT add style/lighting/preservation instructions the user didn't ask for.
//   - **No extra “helper” phrases**: Avoid additions like "match the style", "preserve the background", "maintain the lighting" unless explicitly requested.
//   - **Trust the model**: It already sees the images and handles matching/integration; don't describe what's in the image or add unsolicited technical details.
  
//   **Example (correct vs wrong):**
//   - User: "Replace 'Perplexity x CR7' with 'Gemini x Messi' in this image. Use the Messi logo from the second image."
//   - ✅ Prompt: "Replace 'Perplexity x CR7' with 'Gemini x Messi' in the first image. Use the Messi logo from the second image."
//   - ❌ Wrong: adding "Match the glowing neon style of the background" (user didn't say it)
  
//   **When to add detail:**
//   - Only when the user explicitly requests it (e.g., "make it glow white", "preserve the background")
//   - For pure generation (when editImageUrl is NOT provided), detailed prompts are still recommended
//   - For truly complex edits, use step-by-step instructions only when necessary
  
  
//   **IMAGE REFERENCES:**
//   - User-uploaded: "uploaded_image_N" (e.g., uploaded_image_1, uploaded_image_2)
//   - Generated: "generated_image_N" (e.g., generated_image_1, generated_image_2)
//   - Search images: "search_img_XXX" (from web_search) or "google_img_XXX" (from google_search) - use the exact ID from search results
//   - Raw URLs: Direct image URLs can be used directly as editImageUrl. If link_reader content contains image URLs (e.g., https://example.com/image.jpg), extract and use them directly
//   - Multiple images: Use array ["uploaded_image_1", "generated_image_1", "search_img_xxx", ...] (up to 14)
//   - Single image: Use string "uploaded_image_1"
  
//   **CRITICAL: editImageUrl FORMAT**
//   - **Single image**: Use string format: "uploaded_image_1" or "https://example.com/image.jpg"
//   - **Multiple images**: Use actual array format: ["uploaded_image_1", "generated_image_2", "search_img_xxx"]
//   - **NEVER use JSON string format**: Do NOT pass arrays as JSON strings like '["generated_image_5","generated_image_6"]'
//   - **Always use native array syntax**: When passing multiple images, use the actual array format, not a string representation
//   - The tool expects either a string (single image) or an array (multiple images), never a JSON-encoded string
  
//   **EXAMPLES:**
//   - Edit uploaded image: gemini_image_tool({ prompt: "Add a hat", editImageUrl: "uploaded_image_1" })
//   - Edit generated image: gemini_image_tool({ prompt: "Make darker", editImageUrl: "generated_image_1" })
//   - Edit search image: gemini_image_tool({ prompt: "Add text overlay", editImageUrl: "search_img_123_0_5" })
//   - Edit raw URL: gemini_image_tool({ prompt: "Transform into cyberpunk", editImageUrl: "https://example.com/image.jpg" })
//   - Combine images: gemini_image_tool({ prompt: "Combine these images", editImageUrl: ["uploaded_image_1", "generated_image_1", "google_img_456_1_2"] })
//   - ❌ WRONG: gemini_image_tool({ prompt: "...", editImageUrl: '["generated_image_5","generated_image_6"]' })
//   - ✅ CORRECT: gemini_image_tool({ prompt: "...", editImageUrl: ["generated_image_5", "generated_image_6"] })
  
//   **BEST PRACTICES:**
//   To elevate your results from good to great, incorporate these professional strategies into your workflow.
  
//   1. **Be Hyper-Specific**: The more detail you provide, the more control you have. Instead of "fantasy armor," describe it: "ornate elven plate armor, etched with silver leaf patterns, with a high collar and pauldrons shaped like falcon wings."
  
//   2. **Provide Context and Intent**: Explain the purpose of the image. The model's understanding of context will influence the final output. For example, "Create a logo for a high-end, minimalist skincare brand" will yield better results than just "Create a logo."
  
//   3. **Iterate and Refine**: Don't expect a perfect image on the first try. Use the conversational nature of the model to make small changes. Follow up with prompts like, "That's great, but can you make the lighting a bit warmer?" or "Keep everything the same, but change the character's expression to be more serious."
  
//   4. **Use Step-by-Step Instructions**: For complex scenes with many elements, break your prompt into steps. "First, create a background of a serene, misty forest at dawn. Then, in the foreground, add a moss-covered ancient stone altar. Finally, place a single, glowing sword on top of the altar."
  
//   5. **Use "Semantic Negative Prompts"**: Instead of saying "no cars," describe the desired scene positively: "an empty, deserted street with no signs of traffic."
  
//   6. **Control the Camera**: Use photographic and cinematic language to control the composition. Terms like wide-angle shot, macro shot, low-angle perspective, bird's eye view, shallow depth of field, bokeh background, dramatic side lighting, golden hour lighting, high-key lighting, chiaroscuro.
  
//   **EXECUTION:**
//   1. Check for image attachments or previous generated images
//   2. Choose aspectRatio and imageSize based on user request (see tool parameters)
//   3. Call tool with prompt, editImageUrl (if editing), aspectRatio, imageSize
//   4. Include IMAGE_ID in response (see below)
  
//   **CRITICAL - IMAGE_ID FORMAT:**
//   - **MANDATORY**: Always include IMAGE_ID placeholder in your response after calling the tool
//   - **FORMAT**: [IMAGE_ID:gemini_timestamp_random] (extract from tool result path)
//   - **EXAMPLE**: Here. [IMAGE_ID:gemini_1760501931670_mpfzipm7pe]
//   - Do NOT use markdown image syntax or full URLs
  
//   **NOTES:**
//   - Google search and thinking mode are automatically available when needed
//   - Best language: English (EN), Spanish-Mexico (es-MX), Japanese (ja-JP), Chinese-Simplified (zh-CN), Hindi (hi-IN) - translate if needed
//   - Tool parameters (aspectRatio, imageSize) are described in the tool schema
  
//   ## Visual Explanation Guidelines (Nano Banana Pro)
  
//   **Default**: If a concept benefits from visuals (flows, architectures, relationships, timelines, charts), 
//   prefer generating a diagram with **gemini_image_tool** over long text.
  
//   **Prompt requirements**
//   - Specify the diagram type + key nodes/edges/labels.
//   - Keep prompts short and structural (what goes where).
//   - **Style**: **Apple-style super minimal & clean**. Use solid backgrounds (clean white/sleek dark), soft shadows, and elegant typography. Strictly avoid neon lights, complex gradients, or dashboard clutter. Focus on maximum clarity.
//   - **All labels/text must be in the user's language.**
//   - Use aspect ratios: **16:9** for wide diagrams, **1:1** for balanced layouts.
//     `,
  
//   seedreamImageTool: `
//   For Seedream 4.5 image generation/editing:
//   - Use seedream_image_tool (ByteDance Seedream 4.5 via AtlasCloud)
//   - Images show in Canvas automatically, but you MUST also include IMAGE_ID in your response (format below)
  
//   **CRITICAL LIMIT**
//   - Keep prompt under **2000 characters** (otherwise the API may truncate). If too long, split into multiple generations.
  
//   **GENERATION (no editImageUrl)**
//   - Write a clear scene description (subject + setting + lighting + style + key details).
//   - Output size: 1K / 2K (default) / 4K / custom (min 1024, max 4096).
//   - One image per request (make multiple tool calls for multiple images).
//   - Use aspectRatio when you care about framing (e.g., "16:9", "9:16", "1:1").
  
//   **EDITING / COMPOSITING (editImageUrl provided)**
//   - By default, Seedream preserves the input image aspect ratio; only set aspectRatio if the user explicitly asks.
//   - Prompt should state the *requested change* directly. Add constraints (e.g., glow/keep background) only if the user asks.
//   - For complex edits, use short numbered steps (keep it concise).
  
//   **IMAGE REFERENCES (for editImageUrl)**
//   - User uploads: "uploaded_image_N"
//   - Previously generated: "generated_image_N"
//   - Search results: "search_img_XXX" / "google_img_XXX"
//   - Raw URLs: "https://.../image.jpg"
  
//   **CRITICAL: editImageUrl FORMAT (max 10 images)**
//   - Single: "uploaded_image_1" or "https://..."
//   - Multiple: ["uploaded_image_1", "uploaded_image_2", "search_img_xxx"]
//   - NEVER pass arrays as a JSON string (bad: '["a","b"]')
  
//   **EXAMPLES**
//   - seedream_image_tool({ prompt: "A cinematic wide shot of ...", imageSize: "2K", aspectRatio: "16:9" })
//   - seedream_image_tool({ prompt: "Replace 'Perplexity x CR7' with 'Gemini x Messi' in the first image. Use the Messi logo from the second image.", editImageUrl: ["uploaded_image_1", "uploaded_image_2"] })
//   - ❌ WRONG: editImageUrl: '["generated_image_5","generated_image_6"]'
//   - ✅ CORRECT: editImageUrl: ["generated_image_5", "generated_image_6"]
  
//   **RESPONSE REQUIREMENT (MANDATORY)**
//   - After the tool call, include IMAGE_ID on its own line (no markdown image syntax, no URL):
  
//   [IMAGE_ID:seedream_timestamp_random]
//     `,
  
//     qwenImageTool: `
//   For Qwen Image Edit image editing:
//   - Use **qwen_image_edit** (Qwen Image Edit 2511 via Replicate)
//   - Images show in Canvas automatically, but you MUST also include IMAGE_ID in your response (format below)
  
//   **CORE STRENGTHS**
//   - **Precise text editing**: Add, remove, or modify text in images while preserving the original font, size, and style.
//   - **Identity preservation**: Keep facial features, product identities, or character consistency intact across edits.
//   - **Multi-image editing**: Combine 1 to 3 images in creative ways (person + person, person + scene, etc.).
  
//   **EDITING / COMPOSITING**
//   - By default, Qwen preserves the input image aspect ratio; only set aspectRatio if the user explicitly asks.
//   - Prompt should state the requested change directly. Reference which elements come from which images if multiple are provided.
//   - Be specific about what should change and what should stay the same.
  
//   **IMAGE REFERENCES (for editImageUrl)**
//   - User uploads: "uploaded_image_N"
//   - Previously generated: "generated_image_N"
//   - Search results: "search_img_XXX" / "google_img_XXX"
//   - Raw URLs: "https://.../image.jpg"
  
//   **CRITICAL: editImageUrl FORMAT (max 3 images)**
//   - Single: "uploaded_image_1" or "https://..."
//   - Multiple: ["uploaded_image_1", "uploaded_image_2", "search_img_xxx"]
//   - NEVER pass arrays as a JSON string.
  
//   **RESPONSE REQUIREMENT (MANDATORY)**
//   - After the tool call, include IMAGE_ID on its own line:
  
//   [IMAGE_ID:qwen_timestamp_random]
//   `,
  
//     wan25VideoTool: `
//   For Alibaba Wan 2.5 video generation (**wan25_video** tool):
//   - Use **model: "text-to-video"** to generate videos from text descriptions
//   - Use **model: "image-to-video"** to animate static images (provide imageUrl)
//   - **Image ID Support**: When users refer to images, use ID references:
//     - "uploaded_image_N" for user uploads
//     - "generated_image_N" for AI-generated images
//     - "search_img_XXX" or "google_img_XXX" for search results
  
//   **DISPLAY FORMAT**:
//   - Videos are automatically shown in the Canvas panel
//   - **CRITICAL**: You MUST also include the VIDEO_ID placeholder in your response for rendering the video in the chat bubble
//   - **VIDEO_ID FORMAT**: [VIDEO_ID:wan25_timestamp_random]
//   - Extract the ID from the video path (filename without extension)
//   - Example: "Here. [VIDEO_ID:wan25_1760501931670_mpfzipm7pe]"
  
//   **PROMPTS**:
//   - Be detailed and specific about motion, scene, and style.
//   - For image-to-video, describe the desired animation clearly.
//   `,
  
//   };
  
  
  
  