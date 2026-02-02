/**
 * 도구별 사용 방법과 지침에 관한 프롬프트 모음
 * 각 도구의 특성과 사용법에 맞는 지침을 제공합니다.
 */

export const toolPrompts = {
  webSearch: `
#### Web Search (Exa)

**1. Capabilities and Output Protocol**
- **Search query language**: Prefer English for search queries to get broader and more accurate results. For region-specific content (e.g. Korean companies, Japanese docs), use that language for queries.
- Specs:
  - The tool uses neural search with autoprompt, includes text and summary by default
  - QUERY LIMIT: Use 1-4 queries per tool call (never exceed 4)
  - RESULTS: Each query should return at least 5 results. Use maxResults of 5-10 per query to ensure adequate coverage.
  - If results are insufficient, reuse the tool with different query angles rather than adding more queries
  - **CRITICAL: queries FORMAT**: When passing multiple queries, use actual array format: ["query1", "query2"]. NEVER use JSON string format like '["query1","query2"]'

**2. Specialized Topics**
- Academic/technical research → use "research paper" or "pdf" topics
- Code and implementations → use "github" topic
- Company/product information → use "company" topic
- Financial data → use "financial report" topic
- Professional profiles → use "linkedin profile" topic
- Personal blogs/portfolios → use "personal site" topic

**3. Link & Image Formatting**
- **LINK ID FORMAT**: [LINK_ID:exa_link_searchId_index_resultIndex] (plain text only, no bold)
- **PLACEMENT**: Place link IDs on separate lines between content sections, never inline with text
- **NO FULL URLS**: Never include full "https://..." URLs - always use the link ID format
- **FILTERING**: Select only 1-3 most important links.
- **IMAGE DISPLAY**: Use [IMAGE_ID:unique_id] on separate lines.

**4. Execution Workflow**
1. Select appropriate topic based on content type (see Specialized Topics section).
2. Call web_search with correct query format (array for multiple queries).
3. Format results using link IDs and image IDs as specified.
  `,

  googleSearch: `
#### Google Search

**1. Capabilities and Output Protocol**
- Specs:
  - This tool provides access to Google's organic search results and images
  - Safe search is disabled by default to allow unrestricted search results
  - Location and country parameters can be used to customize search results
  - **CRITICAL: queries FORMAT**: When passing multiple queries, use actual array format: ["query1", "query2"]. NEVER use JSON string format like '["query1","query2"]'

**2. Search Strategy**
- **Search query language**: Prefer English for search queries to get broader and more accurate results. For region-specific topics use that language for queries. Use \`hl\` (and optionally \`gl\`/location) to align result language: e.g. hl=en for broad coverage, hl=ko for Korean results when relevant.
- Use natural language queries
- Supports multiple queries in one call (use arrays)
- Include location parameters for local results (restaurants, weather, etc.)
- Use country codes for region-specific results
- **GIF and animated content**: Use Google Search for all GIF searches (e.g., "funny cat gif")

**3. Link & Image Formatting**
- **LINK ID USAGE**: ALWAYS use link IDs - NEVER use full URLs
- **FORMATS**:
  - Web search: [LINK_ID:google_link_searchId_index_resultIndex]
  - Video search: [LINK_ID:google_video_link_searchId_index_resultIndex]
  - Image search links: [LINK_ID:google_img_link_searchId_index_resultIndex]
- **PLACEMENT**: Place link IDs on separate lines (plain text only, no bold)
- **IMAGE DISPLAY**: Use [IMAGE_ID:unique_id] on separate lines for images from search results.

**4. Execution Workflow**
1. Construct natural language queries with appropriate parameters.
2. Call google_search with correct query format (array for multiple queries).
3. Format results using link IDs and image IDs as specified.
  `,

  twitterSearch: `
#### Twitter Search

**1. Capabilities and Output Protocol**
- Specs:
  - QueryType: "Latest" (chronological) or "Top" (high engagement)
  - Supports Twitter advanced-search operators and filters
- **CRITICAL**: Twitter search is NOT Google search. NEVER use long descriptive phrases or full sentences. ONLY use individual words or short keyword combinations.

**2. Query Strategy: Word-Only Search**
- **Search query language**: Prefer English for query keywords to get broader coverage. For region-specific topics use that language for query keywords. (Do not rely on lang: filter for language—write the query itself in English or the target region's language.)
- **MANDATORY**: Break down queries into individual words. Use ONLY keywords, NEVER phrases.
- **GOOD**: Single words ("API", "update"), keyword pairs ("Apify API"), Boolean OR (\`(Instagram OR Scraper)\`)
- **BAD**: "What is the latest update about Apify API" ❌ → Use: "Apify API update" or ["Apify", "API", "update"] ✅
- **Query construction**: 
  * Extract core words from the query (1-3 words max per query)
  * Use Boolean operators: OR, AND, parentheses for grouping
  * Use exclusions: -minus to exclude terms
  * NEVER write queries as questions or descriptive sentences

**3. Parallel Multi-Word Search (CRITICAL)**
- **ALWAYS break complex queries into multiple parallel word-based searches**
- Example: For "latest news about AI developments"
  * Run parallel queries: ["AI", "news", "latest"], ["AI", "developments"], ["artificial intelligence", "update"]
- **Strategy**: Extract different word combinations and run them in parallel to maximize coverage
- Use array of queries: ["word1", "word2 word3", "word4 OR word5"]
- **CRITICAL: Avoid Duplicate Queries**
  * Before creating parallel queries, check for duplicates
  * Each query in the array must be unique (different word combinations or filters)
  * Do not create multiple queries with identical keywords - vary word combinations, filters, or QueryTypes instead

**4. Advanced Filtering & QueryType Diversity**
- **MANDATORY**: Use filters and QueryType strategically for comprehensive results
- **Filters to use**:
  * \`filter:images\` - For visual content
  * \`filter:videos\` - For video content
  * \`min_faves:10\`, \`min_retweets:5\` - For quality content
  * \`lang:en\`, \`lang:ko\` - For language-specific results
  * \`from:username\` - For specific accounts
  * \`since:YYYY-MM-DD\`, \`until:YYYY-MM-DD\` - For date ranges
  * \`-filter:retweets\` - Exclude retweets
- **QueryType Strategy**:
  * **"Latest"**: Use for breaking news, real-time events (last few hours), trending topics
  * **"Top"**: Use for quality content, popular discussions (last 24-48h)
  * **CRITICAL**: Run BOTH QueryTypes in parallel when possible - "Latest" for speed, "Top" for quality
  * Use \`within_time:24h\` or \`within_time:7d\` with "Top" for time-bounded quality results
- **Diversity**: Vary filters and QueryTypes across parallel searches to get comprehensive coverage

**5. Link Formatting**
- **LINK ID FORMAT**: [LINK_ID:twitter_link_<tweetId>] (plain text only, no bold)
- **PLACEMENT**: Place link IDs on separate lines between sections.
- Include 1-3 highly relevant tweets only if they provide significant value.

**6. Execution Workflow**
1. Extract core words from the query (NEVER use full sentences).
2. Create multiple parallel word-based queries (different word combinations).
3. Apply diverse filters and QueryTypes across parallel searches ("Latest" + "Top").
4. Run parallel searches with varied filters to maximize coverage.
5. Format results using link IDs as specified.
  `,

  youtubeSearch: `
#### YouTube Search

**1. Capabilities and Output Protocol**
- **Search query language**: Prefer English (or the target region's language when it fits the content) for the search query.
- Specs:
  - Keep queries specific to video content
  - Include relevant keywords and creator names if known
- One search operation returns multiple video results

**2. Link Formatting**
- **Separate YouTube links**: Place URLs on their own lines with blank lines before and after
- **Use clean URL format**: Present the full YouTube URL without markdown link syntax
- Provide context (titles, descriptions) in separate text blocks

**3. Execution Workflow**
1. Construct queries specific to video content with relevant keywords.
2. Call youtube_search with appropriate query.
3. Format results using clean URL format as specified.
  `,

  geminiImageTool: `
#### Gemini Image Tool (Nano Banana Pro)

**1. Capabilities and Output Protocol**
- Specs:
  - Max input images: 14
  - Resolutions: 1K, 2K, 4K
  - Image reference IDs: uploaded_image_N, generated_image_N, search_img_XXX, google_img_XXX, raw URLs (from link_reader: extract and use directly)
  - editImageUrl: String (single) or native Array (multiple). NEVER use JSON string format (e.g. '["a","b"]').
- Core principle: Describe the scene, don't just list keywords. A narrative, descriptive paragraph produces better, more coherent images than a list of disconnected words.

**2. Creative Toolkit: Style References and Prompt Patterns**
Use these terms and patterns to enhance quality based on the user's intent. Adapt and mix freely.

- For Realism (Photography):
  * Optics/Shot: Wide-angle, 85mm Portrait, Macro detail, Bird's eye view, Low-angle perspective, f/1.8 (bokeh), f/11 (deep focus).
  * Lighting: Golden hour, Cinematic side-lighting, Chiaroscuro, Softbox, High-key, Moody/Dimly lit.
  * Quality: 8K, HDR, fine skin textures, fabric weave, hyper-realistic, film grain.
  * Pattern: "A photorealistic [shot type] of [subject], [action], set in [environment]. Illuminated by [lighting], [mood]. [Camera/lens details], emphasizing [key details]. [Aspect ratio]."

- For Stickers / Icons / Assets:
  * Be explicit about style and request transparent background.
  * Pattern: "A [style] sticker of [subject], [characteristics], [color palette]. [Line style] and [shading style]. The background must be transparent."

- For Text in Images (logos, captions):
  * Specify exact text in quotes, font style (serif/sans-serif/futuristic), and overall design.
  * Pattern: "Create a [image type] for [brand/concept] with the text '[text]' in [font style]. [Style description], [color scheme]."

- For Product / Commercial:
  * Layout: Studio-lit, 3-point lighting, Rule of thirds, Top-down flat lay, Hero shot.
  * Pattern: "High-resolution, studio-lit product photograph of [product] on [surface]. [Lighting setup] to [purpose]. Camera angle [type] to showcase [feature]. [Aspect ratio]."

- For Minimalist / Negative Space:
  * Pattern: "Minimalist composition: single [subject] in [position]. Vast, empty [color] background, negative space. Soft lighting. [Aspect ratio]."

- For Sequential Art (comic / storyboard):
  * Pattern: "Make a 3 panel comic in [style]. Put the character in [scene]."

- For Infographics / Diagrams:
  * Prefer diagram over long text when explaining flows, architectures, timelines.
  * Style: Apple-style super minimal. Clean white or sleek dark, soft shadows, high-contrast typography. No neon, no clutter, no complex gradients. All labels in the user's language. Use 16:9 for wide diagrams, 1:1 for balanced layouts.

- For Artistic/Graphic Styles:
  * Aesthetics: Kawaii, Minimalist, Vector art, Flat design, 3D render (Pixar-style), Noir/Gritty, Pop Art, Impressionist.

**3. Direction and Intent (Core Logic)**
- Adaptability: Prioritize the user's specific request. If the user gives a unique style, follow it strictly.
- Enhancing: Use Creative Toolkit terms only when they improve the result within the user's direction.
- Editing (when editImageUrl is provided): Keep prompts minimal.
  * Use ONLY the user's words: if the user says X, the prompt must be X (direct translation). Do NOT add style/lighting/preservation the user didn't ask for.
  * No extra "helper" phrases: avoid "match the style", "preserve the background", "maintain the lighting" unless explicitly requested.
  * Trust the model: it sees the images and handles matching; don't describe what's in the image or add unsolicited technical details.
  * **Aspect ratio (MANDATORY for editing)**: When editing user-uploaded or any input images, always pass **aspectRatio: "match_input_image"** so the output keeps the original proportions. Only pass a specific ratio (e.g. "16:9") when the user explicitly asks to change the aspect ratio.
  * When to add detail: only when the user explicitly asks (e.g. "make it glow white", "preserve the background"). For pure generation (no editImageUrl), detailed prompts are recommended. For complex edits, use step-by-step only when necessary.
- Example (correct vs wrong):
  * User: "Replace 'Perplexity x CR7' with 'Gemini x Messi' in this image. Use the Messi logo from the second image."
  * ✅ Prompt: "Replace 'Perplexity x CR7' with 'Gemini x Messi' in the first image. Use the Messi logo from the second image."
  * ❌ Wrong: adding "Match the glowing neon style of the background" when the user didn't say it.

**4. Technical Syntax Rules for editImageUrl**
- Format: String for one image (e.g. "uploaded_image_1" or "https://example.com/image.jpg") or native Array for multiple. Max 14.
- NEVER use JSON string format (e.g. '["img1","img2"]'). Use actual array: ["uploaded_image_1", "generated_image_2"].
- References: uploaded_image_N, generated_image_N, search_img_XXX, google_img_XXX, raw URLs.
- Examples:
  * Edit uploaded (preserve ratio): gemini_image_tool({ prompt: "Add a hat", editImageUrl: "uploaded_image_1", aspectRatio: "match_input_image" })
  * Edit generated (preserve ratio): gemini_image_tool({ prompt: "Make darker", editImageUrl: "generated_image_1", aspectRatio: "match_input_image" })
  * Edit search image: gemini_image_tool({ prompt: "Add text overlay", editImageUrl: "search_img_123_0_5" })
  * Combine: gemini_image_tool({ prompt: "Combine these images", editImageUrl: ["uploaded_image_1", "generated_image_1", "google_img_456_1_2"] })
  * ❌ WRONG: editImageUrl: '["generated_image_5","generated_image_6"]'
  * ✅ CORRECT: editImageUrl: ["generated_image_5", "generated_image_6"]

**5. Best Practices**
- Be hyper-specific: e.g. "ornate elven plate armor, etched with silver leaf, pauldrons shaped like falcon wings" rather than "fantasy armor."
- Provide context and intent: e.g. "Create a logo for a high-end, minimalist skincare brand" yields better results than "Create a logo."
- Use step-by-step for complex scenes: "First, background of misty forest at dawn. Then, moss-covered altar. Finally, glowing sword on top."
- Semantic negative prompts: describe desired scene positively (e.g. "empty, deserted street with no signs of traffic" instead of "no cars").
- Control the camera: wide-angle shot, macro, low-angle, bird's eye view, shallow depth of field, bokeh, dramatic side lighting, golden hour, chiaroscuro.

**6. Execution Workflow**
1. Check for image attachments or previous generated images.
2. **Aspect ratio**: When editing (editImageUrl provided), use aspectRatio: "match_input_image" unless the user explicitly asks for a different ratio. When generating (no editImageUrl), choose aspectRatio from user request or content (1:1, 16:9, etc.).
3. Choose imageSize from user request (see tool schema).
4. Analyze intent, style, subject; apply Creative Toolkit and Best Practices where appropriate.
5. Call gemini_image_tool with correct editImageUrl and aspectRatio.
6. **IMMEDIATE DISPLAY**: As soon as the tool result is available, display the IMAGE_ID FIRST before any other text (see below).

**7. CRITICAL - IMAGE_ID FORMAT**
- **MANDATORY**: Always include IMAGE_ID in your response when tool result is available.
- **PRIORITY**: Display IMAGE_ID FIRST, before any explanatory text.
- **FORMAT**: [IMAGE_ID:gemini_timestamp_random] (extract from tool result path / filename without extension).
- **EXAMPLE**: [IMAGE_ID:gemini_1760501931670_mpfzipm7pe]
- **PLACEMENT**: On its own line at the very beginning of the response when result is ready.
- **DO NOT**: Use markdown image syntax (![...](url)) or full URLs.
- **TIMING**: Show the result immediately when available; don't wait for additional processing or explanation.
  `,

  seedreamImageTool: `
#### Seedream 4.5 Image Tool

**1. Capabilities and Output Protocol**
- Specs:
  - Max input images: 10
  - Resolutions: 1K, 2K (default), 4K, custom (min 1024, max 4096)
  - Prompt: max 2000 characters (if too long, split into multiple generations)
  - One image per request; make multiple tool calls for multiple images
  - Image reference IDs: uploaded_image_N, generated_image_N, search_img_XXX, google_img_XXX, raw URLs
  - editImageUrl: String (single) or native Array (multiple). NEVER use JSON string format (e.g. '["a","b"]').

**2. Creative Toolkit: Enhancement References**
Use these terms to elevate visual quality based on the user's intent. Seedream excels at cinematic textures and high-end lighting.

- Cinematic and Realistic Lighting:
  * Effects: Volumetric lighting, Global illumination, Ray-tracing, Soft shadows, Rim lighting, Lens flare.
  * Environment: Cyberpunk neon, Natural sunlight, Deep sea bioluminescence, Ethereal mist.
  * Camera: 35mm film grain, Shallow depth of field, Motion blur (if requested), 4K ultra-detailed texture.

- Commercial and Advertising Style:
  * Texture: Glossy finish, Metallic reflection, Soft-focus background, Hyper-realistic product detail.
  * Layout: Studio-lit, Symmetrical composition, Minimalist hero shot, Professional color grading.

**3. Direction and Constraints (Core Logic)**
- Character Limit: Keep prompts under 2000 characters to prevent API truncation.
- Adaptability: Always prioritize the user's core description. Only add enhancement terms if they align with the user's vision.

- **Generation (no editImageUrl)**:
  * Write a clear scene description: subject + setting + lighting + style + key details.
  * Use aspectRatio when you care about framing (e.g. "16:9", "9:16", "1:1").

- **Editing / Compositing (editImageUrl provided)**:
  * By default, Seedream preserves the input image aspect ratio; only set aspectRatio if the user explicitly asks.
  * Prompt should state the *requested change* directly. For complex edits, use short numbered steps (keep it concise).
  * **STRICT CONSISTENCY RULE**: Seedream tends to change too much during editing. Always append instructions like "Keep everything else exactly the same", "Maintain the original composition, background, and lighting", or "Do not alter any other details". Modify ONLY the elements explicitly requested by the user.
  * Example: User says "Make it more realistic" → prompt: "[Your realistic prompt], while keeping every other element and the original composition exactly the same."

**4. Technical Syntax Rules for editImageUrl**
- Format: String for one image (e.g. "uploaded_image_1" or "https://...") or native Array for multiple. Max 10.
- NEVER use JSON string format (e.g. '["a","b"]'). Use actual array: ["uploaded_image_1", "generated_image_2"].
- References: uploaded_image_N, generated_image_N, search_img_XXX, google_img_XXX, raw URLs.
- Examples:
  * Generation: seedream_image_tool({ prompt: "A cinematic wide shot of ...", imageSize: "2K", aspectRatio: "16:9" })
  * Edit: seedream_image_tool({ prompt: "Replace 'X' with 'Y' in the first image. Use the logo from the second image.", editImageUrl: ["uploaded_image_1", "uploaded_image_2"] })
  * ❌ WRONG: editImageUrl: '["generated_image_5","generated_image_6"]'
  * ✅ CORRECT: editImageUrl: ["generated_image_5", "generated_image_6"]

**5. Execution Workflow**
1. Analyze user intent and character limit (max 2000).
2. If **Edit**: identify the requested change; apply STRICT CONSISTENCY RULE; do not set aspectRatio unless user asks.
3. If **Generation**: one image per call; use aspectRatio for framing when relevant.
4. Select Creative Toolkit terms only when they align with the user's vision.
5. Call seedream_image_tool with correct imageSize and editImageUrl syntax.
6. **IMMEDIATE DISPLAY**: As soon as the tool result is available, display the IMAGE_ID FIRST (see below).

**6. CRITICAL - IMAGE_ID FORMAT**
- **MANDATORY**: Always include IMAGE_ID in your response when tool result is available.
- **PRIORITY**: Display IMAGE_ID FIRST, before any explanatory text.
- **FORMAT**: [IMAGE_ID:seedream_timestamp_random] (extract from tool result path / filename without extension).
- **EXAMPLE**: [IMAGE_ID:seedream_1760501931670_mpfzipm7pe]
- **PLACEMENT**: On its own line at the very beginning when result is ready (no markdown image syntax, no URL).
- **DO NOT**: Use markdown image syntax (![...](url)) or full URLs.
- **TIMING**: Show the result immediately when available; don't wait for additional processing or explanation.
  `,

  wan25VideoTool: `
#### Alibaba Wan 2.5 Video Tool

**1. Capabilities and Output Protocol**
- Specs:
  - Models: text-to-video (from scratch), image-to-video (animate image, requires imageUrl)
  - Video duration: 5-10 seconds
  - Image reference IDs (image-to-video): uploaded_image_N, generated_image_N, search_img_XXX, google_img_XXX

**2. Creative Toolkit: Motion and Style**
Use these concepts to create dynamic and visually stunning videos.

- Motion Control:
  * Camera Movements: Panning, Tilting, Zoom-in/out, Dolly shot, Crane shot, Tracking shot.
  * Subject Action: Dynamic movement, slow-motion, fluid transitions, expressive gestures.
- Scene and Style:
  * Visual Style: Cinematic, Photorealistic, Anime, Cyberpunk, 3D Animation, Vintage film.
  * Atmosphere: Dramatic lighting, particles in the air, volumetric fog, vibrant colors.

**3. Direction and Constraints (Core Logic)**
- Model Selection: 
  * Use "text-to-video" for creating scenes from scratch.
  * Use "image-to-video" for animating static images (requires imageUrl).
- Prompting: Be highly detailed. Describe the specific motion, the environment, and the visual style in a narrative format.
- Image-to-Video: Clearly state how the image should move or what action should take place.

**4. Technical Syntax Rules for imageUrl**
- imageUrl (image-to-video only): Single image reference. See Specs for valid IDs (uploaded_image_N, generated_image_N, search_img_XXX, google_img_XXX).
- Duration: See Specs.

**5. Execution Workflow**
1. Identify the task: Generate new video (text-to-video) or Animate image (image-to-video).
2. Analyze the desired motion and style based on user intent.
3. Craft a detailed prompt including camera movement and subject action.
4. Call wan25_video with the correct model and parameters.
5. **IMMEDIATE DISPLAY**: As soon as the tool result is available, display the VIDEO_ID FIRST before any other text or explanation (see below).

**6. CRITICAL - VIDEO_ID FORMAT**
- **MANDATORY**: Always include VIDEO_ID placeholder in your response IMMEDIATELY when tool result is available
- **PRIORITY**: Display the VIDEO_ID FIRST, before any explanatory text or additional content
- **FORMAT**: [VIDEO_ID:wan25_timestamp_random] (extract from tool result path)
- **EXAMPLE**: [VIDEO_ID:wan25_1760501931670_mpfzipm7pe]
- **PLACEMENT**: Place on its own line at the very beginning of your response when result is ready
- **DO NOT**: Use markdown syntax or full URLs
- **EXTRACTION**: Extract the ID from the tool result's file path (filename without extension)
- **PURPOSE**: Videos are automatically shown in the Canvas panel, but you MUST also include VIDEO_ID for rendering in the chat bubble
- **TIMING**: Show the result immediately when available - don't wait for additional processing or explanation
  `,

  grokVideoTool: `
#### xAI Grok Imagine Video Tool

**1. Capabilities and Output Protocol**
- Specs:
  - Models: text-to-video (from scratch), image-to-video (animate image, requires imageUrl), video-edit (edit existing video from conversation, requires videoUrl)
  - Video duration: 1-15 seconds for generation. For video-edit: duration is not user-specified; the edited video keeps the original video's length (API behavior).
  - Image reference IDs (image-to-video): uploaded_image_N, generated_image_N
  - Video reference IDs (video-edit): generated_video_N or filename id (e.g. grok_1760_xxx, wan25_1760_xxx) from previous messages. Input video must be at most 8.7 seconds (API limit).

**2. Creative Toolkit: Motion and Style**
Use these concepts to create or edit dynamic videos. Grok Imagine has strong instruction-following; be specific in prompts.

- Motion Control:
  * Camera: Panning, Tilting, Zoom in/out, Dolly, Crane, Tracking shot; Timelapse, Pull back, Pan up/right.
  * Subject: Dynamic movement, slow-motion, fluid transitions, expressive gestures, object interactions, visual continuity.
- Scene and Style:
  * Visual Style: Cinematic, Photorealistic, Anime, Cyberpunk, 3D Animation, Vintage film; Restyle options: Block, Retro, Origami, Watercolor, Mosaic, Sketches to Life.
  * Atmosphere: Dramatic lighting, particles, volumetric fog, vibrant colors; scene mood (e.g. golden hour, autumn, winter, fog, sunset, cloudy).
- Video Edit (video-edit only): Describe the change precisely. Supported edit types:
  * Add/remove/swap objects (e.g. "Add rain in the background", "Remove the person", "Swap the ball for a cube").
  * Scene control (e.g. "Change to sunset", "Add fog").
  * Object control (e.g. "Make the ball larger", "Change the shirt color").
  * Restyle (e.g. "Make it look like anime", "Apply watercolor style").

**3. Direction and Constraints (Core Logic)**
- Model Selection:
  * Use "text-to-video" for creating scenes from scratch.
  * Use "image-to-video" for animating static images (requires imageUrl).
  * Use "video-edit" for modifying an existing video from the conversation (requires videoUrl; reference previous grok or wan25 video by generated_video_N or filename id).
- Prompting: Be detailed and explicit. For edit, describe exactly what to change (instruction-following is a strength).
- videoUrl (video-edit only): Use generated_video_N or the video filename id from a prior result (e.g. grok_1760501931670_abc123, wan25_1760501931670_xyz789). Source video must be at most 8.7 seconds (API limit). Input must be a direct, publicly accessible video URL (tool resolves IDs).

**4. Technical Syntax Rules**
- imageUrl (image-to-video only): Single image reference. uploaded_image_N, generated_image_N.
- videoUrl (video-edit only): Single video reference from conversation. generated_video_N or filename id (grok_..., wan25_...). Source video max length 8.7 seconds.
- duration: 1-15 seconds. Optional; only for text-to-video and image-to-video. Not used for video-edit (edited output keeps original duration).
- aspect_ratio: Optional. One of 16:9, 4:3, 1:1, 9:16, 3:4, 3:2, 2:3. Default 16:9.
- resolution: Optional. 720p or 480p. Default 720p.

**5. Execution Workflow**
1. Identify the task: Generate (text-to-video), Animate image (image-to-video), or Edit video (video-edit).
2. For video-edit: Identify which previous video to edit (generated_video_1, grok_..., wan25_...).
3. Craft a detailed prompt.
4. Call grok_video with the correct model and parameters.
5. **IMMEDIATE DISPLAY**: As soon as the tool result is available, display the VIDEO_ID FIRST (see below).

**6. CRITICAL - VIDEO_ID FORMAT**
- **MANDATORY**: Always include VIDEO_ID placeholder in your response IMMEDIATELY when tool result is available
- **PRIORITY**: Display the VIDEO_ID FIRST, before any explanatory text
- **FORMAT**: [VIDEO_ID:grok_timestamp_random] (extract from tool result path)
- **EXAMPLE**: [VIDEO_ID:grok_1760501931670_mpfzipm7pe]
- **PLACEMENT**: On its own line at the very beginning when result is ready
- **DO NOT**: Use markdown syntax or full URLs
- **EXTRACTION**: Extract the ID from the tool result's file path (filename without extension)
- **PURPOSE**: Videos are shown in the Canvas panel; you MUST also include VIDEO_ID for the chat bubble
- **TIMING**: Show the result immediately when available - don't wait for additional processing or explanation
  `,

};
