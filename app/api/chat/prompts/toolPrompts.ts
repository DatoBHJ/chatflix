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
  - Location and language parameters can be used to customize search results
  - **CRITICAL: queries FORMAT**: When passing multiple queries, use actual array format: ["query1", "query2"]. NEVER use JSON string format like '["query1","query2"]'
- **Search query language**: Prefer English for search queries to get broader and more accurate results. For region-specific topics use that language for queries. Use \`hl\` (and optionally \`gl\`/location) to align result language: e.g. hl=en for broad coverage, hl=ko for Korean results when relevant.

**2. Search Strategy**
- Run a broad query plus one or more narrow queries (e.g. with \`site:\` or \`filetype:\`) in parallel for better coverage
- **Engine choice**: \`google\` for web; \`google_images\` for images/GIFs; \`google_videos\` for video. Same topic can use web + images in one call (different entries in queries/engines)
- Use \`locations\`, \`gl\`/\`hl\` for local results (restaurants, weather, regional news). Keep \`hl\` and query language consistent
- **GIF and animated content**: Use Google Search for all GIF searches (e.g., "funny cat gif")

**3. Google Query Operators (use inside the query string)**
- \`site:domain.com\` - Restrict to a site (e.g. \`site:github.com React hooks\`, \`site:reddit.com best laptop 2024\`)
- \`inurl:keyword\` - URL contains keyword (e.g. \`inurl:docs API reference\`)
- \`intitle:keyword\` - Title contains keyword (e.g. \`intitle:tutorial Next.js\`)
- \`filetype:ext\` - File type (e.g. \`filetype:pdf machine learning\`)
- \`"exact phrase"\`, \`-keyword\` (exclude), \`OR\` (e.g. \`Python OR Ruby tutorial\`)
- **When to use**: "From ~ site" / "~에서 나온 자료" → \`site:도메인\` + keywords. "Official docs" / "문서만" → \`site:해당사이트\` or \`inurl:docs\`. "PDF only" / "논문 PDF" → \`filetype:pdf\` + keywords. "Title contains ~" → \`intitle:키워드\`. Include these operators in the query string when they match user intent.

**4. Link & Image Formatting**
- **LINK ID USAGE**: ALWAYS use link IDs - NEVER use full URLs
- **FORMATS**:
  - Web search: [LINK_ID:google_link_searchId_index_resultIndex]
  - Video search: [LINK_ID:google_video_link_searchId_index_resultIndex]
  - Image search links: [LINK_ID:google_img_link_searchId_index_resultIndex]
- **PLACEMENT**: Place link IDs on separate lines (plain text only, no bold)
- **IMAGE DISPLAY**: Use [IMAGE_ID:unique_id] on separate lines for images from search results.

**5. Execution Workflow**
1. Infer user intent; if they want a specific site, file type, or title match, add \`site:\`/\`filetype:\`/\`intitle:\` (etc.) to the query string.
2. Run at least one broad query and, when useful, one or more targeted queries (with operators) in parallel.
3. Call google_search with correct query format (array for multiple queries) and appropriate engines/locations/hl.
4. Format results using link IDs and image IDs as specified.
  `,

  twitterSearch: `
#### Twitter Search

**1. Capabilities and Output Protocol**
- Specs: QueryType "Latest" (chronological) or "Top" (high engagement). Full Twitter advanced-search operators supported.
- **CRITICAL**: Twitter search is NOT Google search. Use ONLY keywords or short combinations, NEVER full sentences.
- **Search query language**: Prefer English for broader coverage; for region-specific topics use that language in the query.

**2. Query Volume & Diversity (CRITICAL)**
- Run **6–12+** distinct (query, queryType) combinations for complex topics—not just 2–3.
- Same topic, many variants: different keyword combinations, \`"exact phrase"\`, with/without \`filter:images\` or \`min_faves\`, multilingual when relevant.
- **Strategy pairing**: For each conceptual query run **both** (1) QueryType Top, (2) QueryType Latest (add \`min_faves:10\` or \`min_faves:50\` when you want quality recent tweets). Same keywords = run as two calls: one Top, one Latest.
- **Avoid duplicates**: Each call must differ in query text, filters, or QueryType.

**3. User Intent → Operators (match query to scenario)**
- **Real-time/news**: \`within_time:24h\` or \`6h\`, \`filter:news\`, \`lang:ko\`/\`lang:en\`, \`-filter:retweets\`, Latest.
- **Person/account**: \`from:username\`, \`to:username\`, \`@user -from:user\`, \`filter:verified\`, \`-filter:replies\`.
- **Time range**: \`within_time:24h\`/\`6h\`/\`5m\`, \`since:YYYY-MM-DD\` \`until:YYYY-MM-DD\`.
- **Viral/engagement**: \`min_retweets:N\`, \`min_faves:N\`, \`filter:has_engagement\`, QueryType **Top**.
- **Media**: \`filter:images\`, \`filter:videos\`, \`filter:links\`, \`card_name:animated_gif\` for GIFs.
- **Tweet type**: \`-filter:retweets -filter:replies\` for originals only; \`filter:replies\` or \`filter:quote\` when needed.
- **Other**: \`lang:ko\`/\`lang:en\`, \`url:domain.com\`, \`source:Twitter_for_iOS\` (spaces as \`_\`), \`$NVDA\` (cashtag), \`#hashtag\`, \`"exact phrase"\`, \`(A OR B)\` (OR in uppercase), \`-term\` to exclude. Max ~22 operators per query; hyphen in domain/source → use underscore.

**4. Advanced Filtering (combine to vary queries)**
- Time: \`within_time:2d\`/\`6h\`/\`5m\`, \`since:\`/\`until:\`
- Engagement: \`min_faves:10\`/\`50\`, \`min_retweets:N\`, \`min_replies:N\`, \`filter:has_engagement\`
- Media: \`filter:images\`, \`filter:videos\`, \`filter:links\`, \`filter:news\`
- Type: \`-filter:retweets\`, \`-filter:replies\`, \`from:\`, \`filter:verified\`
- Use these in combination so parallel searches differ by operators, not just keywords.

**5. Bad vs Good Example**
- **Bad**: 3 calls only, no operators—e.g. \`"US stock market today" (Latest)\`, \`"S&P500 Nasdaq Dow" (Top)\`, \`"미국 증시 오늘" (Latest)\`.
- **Good** (same topic, 10+ strategic calls): \`(S&P500 OR Nasdaq OR Dow) within_time:24h\` (Latest + Top); \`"US stocks" min_faves:20 within_time:24h\` (Latest); \`"stock market" min_retweets:50\` (Top); \`filter:news (stock OR market) within_time:24h lang:en\` (Latest); \`"stock market" filter:images within_time:24h\` (Top); \`미국 증시\` (Latest); \`주식 시장\` (Top); \`(S&P500 OR Dow) -filter:retweets\` (Latest). Aim for this level of variety and operator use.

**6. Link Formatting**
- **LINK ID FORMAT**: [LINK_ID:twitter_link_<tweetId>] (plain text only, no bold). Place on separate lines. Include 1–3 highly relevant tweets when they add value.

**7. Execution Workflow**
1. Infer user intent and pick scenario-appropriate operators (time, engagement, media, person, etc.).
2. Build many query variants (keyword combos, exact phrases, filters, languages).
3. For each variant run a **pair**: one with QueryType Top, one with Latest (add \`min_faves\` on Latest when useful).
4. Execute 6–12+ distinct (query, queryType) calls in parallel; no duplicate queries.
5. Format results with link IDs as specified.
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
  * Pattern: "Make a 3-panel vertical comic strip in [style]. Put the character in [scene]."
  * Default layout (when user does not specify): vertical strip (N x 1), like webtoon scrolling.

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
- When **editing an image you just generated in the same turn** (e.g. right after another seedream_image_tool or gemini_image_tool call), pass the **image URL from that tool's result** (e.g. images[0].imageUrl) as editImageUrl, not "generated_image_1". The reference may not be available until the message is saved.
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
6. **PARALLEL GENERATION**: When multiple images need to be generated (e.g. multiple slides, sections, panels, or variants), call \`gemini_image_tool\` for ALL images simultaneously in a single response. Do NOT generate one image at a time — emit all tool calls at once so they execute concurrently.
7. **IMMEDIATE DISPLAY**: As soon as the tool result is available, display the IMAGE_ID FIRST before any other text (see below).
8. **SELF-REVIEW**: The generated image is included in the tool result — you can see it directly. After generation, briefly check if the image matches the intended prompt. If the image has obvious issues (wrong subject, missing key elements, broken text, style mismatch), regenerate with an improved prompt or use editImageUrl to fix it. For multi-image workflows (infographic, comic, PPT), review all images before proceeding to assembly.

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
  * Texture: Glossy finish, Metallic reflection, Soft-focus background, hyper-realistic product detail.
  * Layout: Studio-lit, Symmetrical composition, Minimalist hero shot, Professional color grading.

**3. Direction and Constraints (Core Logic)**
- Character Limit: Keep prompts under 2000 characters to prevent API truncation.
- Adaptability: Always prioritize the user's core description. Only add enhancement terms if they align with the user's vision.

- **Generation (no editImageUrl)**:
  * Write a clear scene description: subject + setting + lighting + style + key details.
  * **Aspect ratio (MANDATORY constraint)**: Pass aspectRatio only from this list—1:1, 16:9, 9:16, 4:3, 3:4, 2:3, 3:2, 21:9. Any other ratio (e.g. 4:5, 5:4) will cause the API to fail. If the user requests an unsupported ratio, call the tool with the closest allowed ratio and briefly inform the user which ratios are supported.
  * Otherwise use aspectRatio when you care about framing (e.g. "16:9", "9:16", "1:1").

- **Editing / Compositing (editImageUrl provided)**:
  * By default, Seedream preserves the input image aspect ratio; only set aspectRatio if the user explicitly asks.
  * Prompt should state the *requested change* directly. For complex edits, use short numbered steps (keep it concise).
  * **STRICT CONSISTENCY RULE**: Seedream tends to change too much during editing. Always append instructions like "Keep everything else exactly the same", "Maintain the original composition, background, and lighting", or "Do not alter any other details". Modify ONLY the elements explicitly requested by the user.
  * Example: User says "Make it more realistic" → prompt: "[Your realistic prompt], while keeping every other element and the original composition exactly the same."

**4. Technical Syntax Rules for editImageUrl**
- Format: String for one image (e.g. "uploaded_image_1" or "https://...") or native Array for multiple. Max 10.
- NEVER use JSON string format (e.g. '["a","b"]'). Use actual array: ["uploaded_image_1", "generated_image_2"].
- References: uploaded_image_N, generated_image_N, search_img_XXX, google_img_XXX, raw URLs.
- When **editing an image you just generated in the same turn** (e.g. right after another seedream_image_tool or gemini_image_tool call), pass the **image URL from that tool's result** (e.g. images[0].imageUrl) as editImageUrl, not "generated_image_1". The reference may not be available until the message is saved.
- Examples:
  * Generation: seedream_image_tool({ prompt: "A cinematic wide shot of ...", imageSize: "2K", aspectRatio: "16:9" })
  * Edit: seedream_image_tool({ prompt: "Replace 'X' with 'Y' in the first image. Use the logo from the second image.", editImageUrl: ["uploaded_image_1", "uploaded_image_2"] })
  * ❌ WRONG: editImageUrl: '["generated_image_5","generated_image_6"]'
  * ✅ CORRECT: editImageUrl: ["generated_image_5", "generated_image_6"]

**5. Execution Workflow**
1. Analyze user intent and character limit (max 2000).
2. If **Edit**: identify the requested change; apply STRICT CONSISTENCY RULE; do not set aspectRatio unless user asks.
3. If **Generation**: one image per call; use aspectRatio for framing when relevant. Before calling: ensure aspectRatio is one of 1:1, 16:9, 9:16, 4:3, 3:4, 2:3, 3:2, 21:9—otherwise substitute the closest and inform the user.
4. Select Creative Toolkit terms only when they align with the user's vision.
5. Call seedream_image_tool with correct imageSize and editImageUrl syntax.
6. **PARALLEL GENERATION**: When multiple images need to be generated (e.g. multiple slides, sections, panels, or variants), call \`seedream_image_tool\` for ALL images simultaneously in a single response. Do NOT generate one image at a time — emit all tool calls at once so they execute concurrently.
7. **IMMEDIATE DISPLAY**: As soon as the tool result is available, display the IMAGE_ID FIRST (see below).
8. **SELF-REVIEW**: The generated image is included in the tool result — you can see it directly. After generation, briefly check if the image matches the intended prompt. If the image has obvious issues (wrong subject, missing key elements, broken text, style mismatch), regenerate with an improved prompt or use editImageUrl to fix it. For multi-image workflows (infographic, comic, PPT), review all images before proceeding to assembly.

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
- **Size (text-to-video only, MANDATORY constraint)**: Pass size only from this list—832*480, 480*832, 624*624, 1280*720, 720*1280, 960*960, 1088*832, 832*1088, 1920*1080, 1080*1920, 1440*1440, 1632*1248, 1248*1632. Any other size or aspect (e.g. 21:9, 2560*1080) will cause the API to fail. If the user requests an unsupported size or ratio, call the tool with the closest allowed size and briefly inform the user which sizes are supported.

**4. Technical Syntax Rules for imageUrl**
- imageUrl (image-to-video only): Single image reference. See Specs for valid IDs (uploaded_image_N, generated_image_N, search_img_XXX, google_img_XXX).
- When calling image-to-video **immediately after** generating an image in the same turn (e.g. right after seedream_image_tool or gemini_image_tool), pass the **image URL from that tool's result** (e.g. images[0].imageUrl) as imageUrl, not "generated_image_1". The reference may not be available until the message is saved.
- Duration: See Specs.

**5. Execution Workflow**
1. Identify the task: Generate new video (text-to-video) or Animate image (image-to-video).
2. Analyze the desired motion and style based on user intent.
3. Craft a detailed prompt including camera movement and subject action.
4. For text-to-video: ensure size is one of the allowed values; if the user asked for another ratio/size, use the closest from the list and inform the user. Then call wan25_video with the correct model and parameters.
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
  - Video reference IDs (video-edit): uploaded_video_N, generated_video_N, or filename id (e.g. grok_1760_xxx, wan25_1760_xxx) from previous messages. Input video must be at most 8.7 seconds (API limit).

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
  * Use "video-edit" for modifying an existing video from the conversation (requires videoUrl; reference uploaded_video_N, generated_video_N, or filename id).
- Prompting: Be detailed and explicit. For edit, describe exactly what to change (instruction-following is a strength).
- videoUrl (video-edit only): Use uploaded_video_N, generated_video_N, or the video filename id from a prior result (e.g. grok_1760501931670_abc123, wan25_1760501931670_xyz789). Source video must be at most 8.7 seconds (API limit). Prefer conversation references over raw external links.

**4. Technical Syntax Rules**
- imageUrl (image-to-video only): Single image reference. uploaded_image_N, generated_image_N.
- When calling image-to-video **immediately after** generating an image in the same turn (e.g. right after seedream_image_tool or gemini_image_tool), pass the **image URL from that tool's result** (e.g. images[0].imageUrl) as imageUrl, not "generated_image_1". The reference may not be available until the message is saved.
- videoUrl (video-edit only): Single video reference from conversation. uploaded_video_N, generated_video_N, or filename id (grok_..., wan25_...). Source video max length 8.7 seconds.
- When calling video-edit **immediately after** generating/editing a video in the same turn, pass the **video URL from that tool's result** (e.g. videos[0].videoUrl) as videoUrl, not "generated_video_1". The reference may not be available until the message is saved.
- duration: 1-15 seconds. Optional; only for text-to-video and image-to-video. Not used for video-edit (edited output keeps original duration).
- aspect_ratio: Optional. One of 16:9, 4:3, 1:1, 9:16, 3:4, 3:2, 2:3. Default 16:9.
- resolution: Optional. 720p or 480p. Default 720p.

**5. Execution Workflow**
1. Identify the task: Generate (text-to-video), Animate image (image-to-video), or Edit video (video-edit).
2. For video-edit: Identify which previous video to edit (uploaded_video_1, generated_video_1, grok_..., wan25_...).
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

  videoUpscalerTool: `
#### WaveSpeed FlashVSR Video Upscaler Tool

**1. Capabilities and Output Protocol**
- Specs:
  - This tool upscales videos to **4K only** (fixed output).
  - Input can be either:
    - Conversation reference: uploaded_video_N, generated_video_N, or filename id (wan25_..., grok_..., upscaled_...)
    - Public URL (https://...)
- The tool uses asynchronous processing (submit + poll) and returns completed video result(s).

**2. Core Rules (CRITICAL)**
- Always treat this as fixed 4K output. Do not ask for or pass other resolutions.
- Prefer conversation references when the user refers to an earlier generated/uploaded video.
- If the user provides both a reference and URL, prefer the explicit reference from conversation context.

**3. Input Guidance**
- Prefer \`videoRef\` for conversation-local references.
- Use \`videoUrl\` for direct public links.
- Do not generate or pass any \`prompt\` field for this tool.
- When upscaling **immediately after** generating/editing a video in the same turn, pass the **video URL from the prior tool result** (e.g. videos[0].videoUrl) as \`videoUrl\`, not \`generated_video_1\`. The reference may not be available until the message is saved.
- At least one of \`videoRef\` or \`videoUrl\` must be provided.
- Valid examples:
  - videoRef: "generated_video_1"
  - videoRef: "grok_1760501931670_abc123"
  - videoUrl: "https://example.com/video.mp4"

**4. Execution Workflow**
1. Identify the source video from conversation reference or public URL.
2. Call \`video_upscaler\` with \`videoRef\` or \`videoUrl\`.
3. Do not specify resolution settings (the tool enforces 4K).
4. **IMMEDIATE DISPLAY**: As soon as the tool result is available, display the VIDEO_ID FIRST.

**5. CRITICAL - VIDEO_ID FORMAT**
- **MANDATORY**: Always include VIDEO_ID placeholder in your response immediately when result is available.
- **PRIORITY**: Display VIDEO_ID first, before explanations.
- **FORMAT**: [VIDEO_ID:upscaled_timestamp_random] (from result path filename without extension).
- **DO NOT**: Use markdown video syntax or full URLs.
- **TIMING**: Show it immediately when available.
  `,

  imageUpscalerTool: `
#### WaveSpeed Ultimate Image Upscaler Tool

**1. Capabilities and Output Protocol**
- Specs:
  - This tool upscales images to **8K only** (fixed output).
  - Input can be either:
    - Conversation reference: uploaded_image_N, generated_image_N (from Gemini/Seedream/Qwen or prior upscaler)
    - Public image URL (https://...)
- The tool uses asynchronous processing (submit + poll) and returns completed image result(s).

**2. Core Rules (CRITICAL)**
- Always treat this as fixed 8K output. Do not ask for or pass other resolutions.
- Prefer conversation references when the user refers to an earlier generated/uploaded image.
- If the user provides both a reference and URL, prefer the explicit reference from conversation context.

**3. Input Guidance**
- Prefer \`imageRef\` for conversation-local references (e.g. generated_image_1, uploaded_image_1).
- Use \`imageUrl\` for direct public image links.
- When upscaling **immediately after** generating an image in the same turn (e.g. right after gemini_image_tool or seedream_image_tool), pass the **image URL from that tool result** (e.g. images[0].imageUrl) as \`imageUrl\`, not \`generated_image_1\`. The reference may not be available until the message is saved.
- At least one of \`imageRef\` or \`imageUrl\` must be provided.
- Valid examples:
  - imageRef: "generated_image_1"
  - imageRef: "uploaded_image_1"
  - imageUrl: "https://example.com/photo.jpg"

**4. Execution Workflow**
1. Identify the source image from conversation reference or public URL.
2. Call \`image_upscaler\` with \`imageRef\` or \`imageUrl\`.
3. Do not specify resolution settings (the tool enforces 8K).
  `,

  fileEdit: `
#### File editing (read_file / write_file / grep_file / apply_edits / delete_file)

**1. Human-like Information Sharing (CRITICAL)**
- **Think like a person**: When you have a lot to say, code to share, or a structured report to give, don't dump it in the chat bubble.
- **The "File as Attachment" Pattern**: Use \`write_file\` or \`apply_edits\` to create/update the content in the workspace, then send a short, friendly message in chat like "I've updated the code for you" or "Here's the report you asked for in a file."
- **Brevity in Chat**: Keep chat messages to 1-2 sentences. Let the files do the heavy lifting.

**2. Workspace and paths**
- Workspace files are identified by **path** only. Use absolute paths (e.g. \`/home/user/workspace/main.py\`).
- When "Current workspace files" is present in the user message (list of paths), use those paths with \`read_file(path)\` to read content and \`write_file(path, content)\` to write.
- No file IDs or placeholders: reference files by path only.

**2. grep_file (find lines before reading or editing)**
- To find which lines to change **before** reading the whole file: use \`grep_file(path, pattern, useRegex?, contextLines?, maxResults?)\`. Returns matching line numbers and content (and optional context). E.g. \`grep_file(path, "#", false, 1)\` for comment lines with 1 line context; then use \`apply_edits\` to remove or change those ranges.
- Use literal pattern (e.g. \`"#"\`, \`"TODO"\`) or regex in slashes (e.g. \`"/#.*/"\`) with \`useRegex: true\`.

**3. read_file**
- Call \`read_file(path)\` or \`read_file(path, startLine, endLine)\` with the absolute path. For large files, use **range only**: \`read_file(path, startLine, endLine)\` in chunks; the response includes \`totalLines\` so you can plan the next range. If you already have line numbers from \`grep_file\`, read only those ranges to build exact \`newContent\` for \`apply_edits\`.

**4. apply_edits (partial edits without loading the whole file)**
- To edit specific sections (e.g. remove all comments) **without** loading the whole file: (1) Use \`grep_file(path, pattern)\` to find all matching line numbers. (2) Optionally \`read_file(path, startLine, endLine)\` only for those ranges if you need exact content to rewrite. (3) Build \`edits\` as an array of \`{ startLine, endLine, newContent }\` and call \`apply_edits(path, edits)\` once. Edits are applied in reverse order; use 1-based line numbers. Use empty \`newContent\` to delete lines.

**5. write_file**
- Use \`write_file(path, content)\` only for **new files** or when **replacing the entire file**. For partial changes across a large file, use \`grep_file\` to find ranges then \`read_file\` (if needed) + \`apply_edits\`. Parent directories are created if needed.

**6. delete_file**
- Call \`delete_file(path)\` to remove a file from the workspace. Use absolute paths from the workspace context.
- Prefer deleting only paths that appear in "Current workspace files". If the user asks to delete something ambiguous, confirm the path or inform them of the result.
  `,

  codeExecution: `
#### Code execution (run_python_code)

**1. Human-like Data Sharing**
- When performing data analysis or creating charts, keep the technical output and long summaries out of the chat.
- **Pattern**: Run the code, and if there's a lot of data or a detailed explanation, write it to a \`.md\` file in the workspace.
- **Chat**: Just give a quick, casual summary of the result and mention that the details/charts are available.

**2. When to use**
- Use \`run_python_code(code)\` when the user asks for data analysis, CSV processing, statistics, or charts.
- Workspace files (e.g. CSV) are under \`/home/user/workspace/\`. Use absolute paths like \`/home/user/workspace/data.csv\` or, if running in workspace context, relative paths may work.
- Attached CSV file(s) from the user are available in the workspace at the paths listed in "Current workspace files" above; use those paths in \`read_file\` and \`run_python_code\`.
- When analyzing a CSV in the workspace, use \`read_file(path)\` first if you need column names or sample data, then write \`run_python_code\` that loads that path and creates the visualization (e.g. with \`display(plt.gcf())\`).

**2. Python code**
- Write complete, runnable Python. Use pandas, matplotlib, and other pre-installed libraries as needed.
- To show a chart to the user, the code MUST end with \`plt.show()\` or \`display(plt.gcf())\` so the result is captured. Prefer creating the visualization directly; use print only when needed for short summaries.
- **Playwright in this sandbox**: Prefer \`async_playwright\` (not sync API), avoid strict \`networkidle\` waits on ad-heavy sites, and use \`wait_for_selector\` + explicit timeout/retry logic. If headless traffic is blocked, state that clearly and provide a local non-headless fallback command.
- **Playwright stability rules (mandatory)**:
  - Never rely on \`wait_for_load_state("networkidle")\` as a success condition for scraping targets.
  - Use domain selectors as readiness gates (e.g. key container, table, tab button), then short staged waits.
  - Implement retry with backoff for critical actions (navigation, tab click, data extraction), not just one-shot execution.
  - For event-data scraping, validate data presence explicitly (required keys/JSON shape) before declaring success.
  - If page title/body indicates anti-bot challenge (Cloudflare/CAPTCHA/verify human), treat as blocked and switch strategy instead of blind retries.

**3. Results**
- The tool returns stdout, stderr, and results (e.g. text, images from plt.show()). Summarize or explain these to the user; on error, use the returned error name, value, and traceback to explain what went wrong.
- Avoid duplicate visual outputs for the same user request. If one run already produced the needed chart/image, do not rerun equivalent code just to restate the same result.
- If retry is necessary, change the code meaningfully (bug fix or different analysis). Do not perform repeated runs that produce the same figure set.

**4. Memory Constraints**
- The sandbox has **limited RAM (~512 MB)**. Keep this in mind when processing large files or images.
- For image processing (Pillow/PIL), always **resize images to a reasonable resolution** (e.g., max 1500-2000px width) before performing operations like concatenation, compositing, or filtering.
- **Never load all images into memory at once.** Download images to disk first, then open/process/close one at a time using \`with Image.open(path) as img:\`.
- If you encounter a \`ContextRestarting\` error, it means the code **ran out of memory**. To fix: reduce image resolution, process files one-at-a-time, or use disk-backed processing instead of in-memory buffers.
- Avoid creating multiple large copies of images (e.g., keeping both original and resized versions in memory).
  `,

  pptGeneration: `
#### PPT / Presentation Generation Workflow (Image-Based Slides)

When the user requests a PPT, presentation, slide deck, or slides, use the following high-quality workflow that generates each slide as an image and assembles them into a downloadable PPTX file.

**Step 1: Plan the slide structure**
- Analyze the topic and design a clear slide structure (typically 8-12 slides).
- Standard structure: Title slide -> Table of contents -> Content slides (one key point per slide) -> Summary / Key takeaways -> Closing slide.
- Briefly share the slide outline with the user before generating.

**Step 2: Generate slide images with gemini_image_tool (Nano Banana Pro)**
- For EACH slide, call \`gemini_image_tool\` with the following settings:
  - \`aspectRatio\`: **"16:9"** (widescreen presentation format, mandatory)
  - \`imageSize\`: **"4K"** for crisp, high-resolution output
  - \`prompt\`: A detailed description of the slide's visual layout. Include:
    - The exact **title text** that should appear on the slide
    - The exact **body text / bullet points** that should appear
    - Layout direction (e.g. "left-aligned title with bullet points on the right", "centered title with large icon")
    - Visual style keywords (color scheme, font style, background)
- **Style consistency**: Define a style in the first slide prompt (e.g. "modern minimalist corporate style, dark blue gradient background, white sans-serif text, subtle geometric accents") and repeat these same style keywords in every subsequent slide prompt.
- **Language**: Include text in the user's language directly in the prompt. Nano Banana Pro handles Korean, Chinese, Japanese, and other languages natively.
- Generate ALL slides **in parallel** — call \`gemini_image_tool\` for every slide simultaneously in a single response.
- Do NOT generate one slide at a time. Emit all tool calls at once so they execute concurrently.

**Step 2.5: Review generated slides**
- You can see each generated image in the tool results. Quickly review all slides for:
  - Text accuracy (titles, bullet points match the intended content)
  - Style consistency across slides (colors, fonts, layout)
  - Missing or incorrect visual elements
- If any slide has obvious issues, regenerate only that slide with an improved prompt before proceeding.

**Step 3: Assemble into PPTX with run_python_code**
- After ALL slide images are generated and reviewed, call \`run_python_code\` with Python code that:
  1. Installs dependencies: \`subprocess.run(["pip", "install", "python-pptx", "requests"], capture_output=True)\`
  2. Downloads each slide image using **public URLs** (see below)
  3. Creates a widescreen (16:9) PPTX presentation
  4. Adds each image as a full-bleed slide (covering the entire slide area)
  5. Saves to \`/home/user/workspace/presentation.pptx\` (or a descriptive filename)

**CRITICAL — Image URL handling:**
- Each \`gemini_image_tool\` result contains \`publicUrl\` (direct download URL) and \`path\` (short path).
- **ALWAYS use \`publicUrl\`** from the tool result directly in Python code. Copy-paste it exactly as returned.
- **DO NOT** use \`imageUrl\` (signed URL with long token) — it WILL get corrupted in code.
- **DO NOT** manually construct URLs from the hostname + path — this risks typos in the hostname.

Example Python pattern:
\`\`\`python
import subprocess, requests, os
subprocess.run(["pip", "install", "python-pptx", "Pillow"], capture_output=True)
from pptx import Presentation
from pptx.util import Inches
from PIL import Image as PILImage

# Use the publicUrl from each gemini_image_tool result directly (copy-paste as-is)
image_urls = [
    # ... publicUrl values from each tool result
]

os.makedirs("/home/user/workspace", exist_ok=True)
prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

added = 0
for i, url in enumerate(image_urls):
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        img_path = f"/tmp/slide_{i}.png"
        with open(img_path, "wb") as f:
            f.write(resp.content)
        # Validate from disk (memory-efficient — don't load full image into memory buffer)
        with PILImage.open(img_path) as check:
            check.verify()
        slide = prs.slides.add_slide(prs.slide_layouts[6])
        slide.shapes.add_picture(img_path, Inches(0), Inches(0), prs.slide_width, prs.slide_height)
        added += 1
    except Exception as e:
        print(f"Slide {i+1} error: {e}")

output_path = "/home/user/workspace/presentation.pptx"
prs.save(output_path)
print(f"PPT saved: {output_path} ({added}/{len(image_urls)} slides)")
\`\`\`

**Important rules:**
- Always use **16:9** aspect ratio for all slide images — this is non-negotiable for presentations.
- **NEVER paste signed URLs (with ?token=...) into Python code** — always use \`publicUrl\` from each tool result directly.
- The PPTX file will be **automatically synced** to the workspace and available for download in the Canvas panel.
- If Nano Banana Pro (gemini_image_tool) fails for a slide, try \`seedream_image_tool\` as a fallback with the same prompt and 16:9 ratio.
- For text-heavy slides, ensure the text is large enough to be readable when projected (use prompts like "large bold title text", "clear readable bullet points").
- Always validate downloaded images before adding to PPTX — use \`response.raise_for_status()\` and PIL verification.
  `,

pdfReport: `
#### PDF Report Generation Workflow

When the user requests a report, PDF document, analysis report, or research paper, follow this workflow.

**Step 1: Research & Data Collection**
- Use \`google_search\` or \`web_search\` to gather relevant data, statistics, and sources on the topic.
- Summarize key findings and organize them into logical sections.

**Step 2: Data Analysis & Charts (if applicable)**
- Call \`run_python_code\` with matplotlib/seaborn to generate charts and visualizations.
- Save charts as PNG files in \`/home/user/workspace/\` for later embedding.

**Step 3: Cover Image (optional)**
- If an image tool is available, call \`gemini_image_tool\` with:
  - \`aspectRatio\`: **"3:4"** (portrait document format)
  - \`imageSize\`: **"4K"**
  - Professional cover design with the report title and visual elements.
- Follow the **PPT workflow's image URL rules** (use \`publicUrl\` from tool results, never signed URLs).

**Step 4: Assemble PDF with run_python_code**
- Call \`run_python_code\` with Python code that:
  1. Installs: \`subprocess.run(["pip", "install", "reportlab", "requests"], capture_output=True)\`
  2. Creates a professional PDF using reportlab with:
     - **Cover page** (with cover image if available, or styled text)
     - **Table of contents**
     - **Executive summary**
     - **Body sections** with text, bullet points, and embedded charts
     - **Conclusion / recommendations**
     - **Sources / references**
  3. Saves to \`/home/user/workspace/report.pptx\` (or descriptive filename)

Example Python pattern:
\`\`\`python
import subprocess, os
subprocess.run(["pip", "install", "reportlab", "requests"], capture_output=True)
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle
from reportlab.lib.units import cm, mm
from reportlab.lib import colors

os.makedirs("/home/user/workspace", exist_ok=True)
doc = SimpleDocTemplate("/home/user/workspace/report.pdf", pagesize=A4,
                        topMargin=2*cm, bottomMargin=2*cm, leftMargin=2.5*cm, rightMargin=2.5*cm)
styles = getSampleStyleSheet()
story = []

# Title
story.append(Paragraph("Report Title", styles['Title']))
story.append(Spacer(1, 1*cm))

# Sections with text and charts
story.append(Paragraph("1. Introduction", styles['Heading1']))
story.append(Paragraph("Content here...", styles['BodyText']))

# Embed chart if saved earlier
if os.path.exists("/home/user/workspace/chart1.png"):
    story.append(Image("/home/user/workspace/chart1.png", width=15*cm, height=10*cm))

doc.build(story)
print("PDF saved: /home/user/workspace/report.pdf")
\`\`\`

**Important rules:**
- Use **A4** page size for reports.
- For Korean/CJK text in reportlab, register a CJK font: \`from reportlab.pdfbase import pdfmetrics; from reportlab.pdfbase.cidfonts import UnicodeCIDFont; pdfmetrics.registerFont(UnicodeCIDFont('HeiseiMin-W3'))\` or download and register a TTF font like NanumGothic.
- Include page numbers and headers/footers for professional appearance.
- Always cite sources gathered from search tools.
  `,

infographic: `
#### Infographic Generation Workflow

When the user requests an infographic, follow this workflow.

**Step 1: Plan the infographic structure**
- Design 4-6 sections: Header/title → Key statistic blocks → Detail sections → Footer/source.
- Share the structure outline with the user before generating.

**Step 2: Generate section images with gemini_image_tool**
- For EACH section, call \`gemini_image_tool\` with:
  - \`aspectRatio\`: **"3:4"** (portrait, all sections must use the SAME ratio)
  - \`imageSize\`: **"2K"** (2K is sufficient for sections that will be concatenated; 4K would cause out-of-memory errors during assembly)
  - \`prompt\`: Detailed layout of that section — text, icons, data, colors.
- **Style consistency**: Define style in the first prompt (e.g., "flat design, coral and navy palette, white background, bold sans-serif headings, rounded icons") and repeat in every section.
- Generate ALL sections **in parallel** — call \`gemini_image_tool\` for every section simultaneously in a single response. Do NOT generate one section at a time.

**Step 2.5: Review generated sections**
- You can see each generated image in the tool results. Quickly review all sections for:
  - Content accuracy (data, text, icons match the intended design)
  - Style consistency across sections (color palette, font, layout style)
  - Visual flow (sections should look cohesive when stacked vertically)
- If any section has obvious issues (wrong data, broken text, style mismatch), regenerate only that section before proceeding.

**Step 3: Assemble with run_python_code**
- Call \`run_python_code\` to vertically concatenate all section images into one long infographic.
- **CRITICAL — Memory-efficient pattern**: The sandbox has limited RAM (~512 MB). Do NOT load all images into memory at once. Use the disk-backed, one-at-a-time pattern below:

\`\`\`python
import subprocess, requests, os
subprocess.run(["pip", "install", "Pillow"], capture_output=True)
from PIL import Image

# Use publicUrl from each gemini_image_tool result (copy-paste directly)
image_urls = [
    # ... publicUrl values from each tool result
]

os.makedirs("/home/user/workspace", exist_ok=True)
TARGET_WIDTH = 1500  # Resize for memory efficiency

# Phase 1: Download all images to disk (not into memory)
temp_files = []
for i, url in enumerate(image_urls):
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        path = f"/home/user/workspace/_tmp_section_{i}.png"
        with open(path, "wb") as f:
            f.write(resp.content)
        temp_files.append(path)
        print(f"Downloaded section {i+1}")
    except Exception as e:
        print(f"Section {i+1} error: {e}")

# Phase 2: Measure heights after resize (open one at a time)
heights = []
for path in temp_files:
    with Image.open(path) as img:
        ratio = TARGET_WIDTH / img.width
        heights.append(int(img.height * ratio))

# Phase 3: Create canvas and paste one-by-one (memory-efficient)
total_height = sum(heights)
result = Image.new('RGB', (TARGET_WIDTH, total_height), 'white')
y = 0
for i, path in enumerate(temp_files):
    with Image.open(path) as img:
        img = img.resize((TARGET_WIDTH, heights[i]), Image.LANCZOS)
        result.paste(img, (0, y))
        y += heights[i]
    # Image is closed by 'with' — memory freed immediately

output_path = "/home/user/workspace/infographic.png"
result.save(output_path, quality=95)
print(f"Infographic saved: {output_path} ({TARGET_WIDTH}x{total_height}px, {len(temp_files)} sections)")

# Cleanup temp files
for f in temp_files:
    os.remove(f)
\`\`\`

**Important rules:**
- All section images MUST use the same aspect ratio (**3:4**) for seamless vertical stitching.
- Follow the **PPT workflow's image URL rules** — use \`publicUrl\` from each tool result directly (never construct URLs manually).
- For very long infographics (7+ sections), also generate a PDF version for easier printing.
- **Memory**: Never load all images into memory simultaneously. Always download to disk first, then open/resize/paste one at a time.
  `,

socialMediaPack: `
#### Social Media Content Pack Workflow

When the user requests social media images, SNS content, Instagram posts, YouTube thumbnails, or a content pack, follow this workflow.

**Step 1: Define the concept**
- Clarify the topic, brand colors, style, and key message with the user.
- Plan which platforms to target.

**Step 2: Generate platform-specific images with gemini_image_tool**
- Generate one image per platform, each with the appropriate aspect ratio:
  - **Instagram Feed**: \`aspectRatio\`: **"1:1"**, \`imageSize\`: **"2K"**
  - **Instagram/TikTok Story**: \`aspectRatio\`: **"9:16"**, \`imageSize\`: **"2K"**
  - **YouTube Thumbnail**: \`aspectRatio\`: **"16:9"**, \`imageSize\`: **"2K"**
  - **Twitter/X Header**: \`aspectRatio\`: **"21:9"**, \`imageSize\`: **"2K"**
  - **Facebook Cover**: \`aspectRatio\`: **"16:9"**, \`imageSize\`: **"2K"**
- Use the SAME visual concept across all images — only adapt layout for each aspect ratio.
- Include attention-grabbing text directly in the prompt for each platform's best practices.
- Generate ALL platform images **in parallel** — call \`gemini_image_tool\` for every platform simultaneously in a single response. Do NOT generate one platform at a time.

**Step 2.5: Review generated images**
- You can see each generated image in the tool results. Quickly review all platform images for:
  - Brand consistency (same visual concept adapted per platform)
  - Text readability and accuracy for each platform's format
  - Appropriate layout for each aspect ratio
- If any platform image has issues, regenerate only that one before packaging.

**Step 3: Package as ZIP with run_python_code**
\`\`\`python
import subprocess, requests, os, io, zipfile
subprocess.run(["pip", "install", "Pillow"], capture_output=True)

# Platform images (use publicUrl from each tool result directly)
platform_files = [
    ("instagram_feed_1080x1080.png", "PUBLIC_URL_1"),
    ("instagram_story_1080x1920.png", "PUBLIC_URL_2"),
    ("youtube_thumbnail_3840x2160.png", "PUBLIC_URL_3"),
    ("twitter_header_2560x1080.png", "PUBLIC_URL_4"),
    ("facebook_cover_1920x1080.png", "PUBLIC_URL_5"),
]

os.makedirs("/home/user/workspace", exist_ok=True)
zip_path = "/home/user/workspace/social_media_pack.zip"
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for filename, url in platform_files:
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            zf.writestr(filename, resp.content)
            print(f"Added: {filename}")
        except Exception as e:
            print(f"Error for {filename}: {e}")

print(f"ZIP saved: {zip_path}")
\`\`\`

**Important rules:**
- Follow the **PPT workflow's image URL rules** — use \`publicUrl\` from each tool result directly (never construct URLs manually).
- Use descriptive filenames with platform name and dimensions.
- If the user only needs specific platforms, generate only those (don't generate all 5 by default — ask first).
  `,

excelReport: `
#### Excel Data Analysis Report Workflow

When the user requests an Excel report, data analysis spreadsheet, or asks to analyze data and output Excel, follow this workflow.

**Step 1: Data Analysis**
- If the user uploaded a CSV/data file, read it with \`read_file\` first.
- Call \`run_python_code\` to analyze with pandas: descriptive statistics, correlations, group-by summaries, trends.

**Step 2: Generate Charts**
- In the same or a follow-up \`run_python_code\` call, generate matplotlib charts and save as PNG:
  \`plt.savefig("/home/user/workspace/chart_name.png", dpi=150, bbox_inches='tight')\`

**Step 3: Build Excel with run_python_code**
\`\`\`python
import subprocess, os
subprocess.run(["pip", "install", "openpyxl", "pandas", "matplotlib"], capture_output=True)
import pandas as pd
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XlImage
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils.dataframe import dataframe_to_rows

os.makedirs("/home/user/workspace", exist_ok=True)
wb = Workbook()

# Sheet 1: Dashboard
ws_dash = wb.active
ws_dash.title = "Dashboard"
ws_dash['A1'] = "Data Analysis Report"
ws_dash['A1'].font = Font(size=16, bold=True)
# Embed chart images
if os.path.exists("/home/user/workspace/chart1.png"):
    img = XlImage("/home/user/workspace/chart1.png")
    img.width, img.height = 600, 400
    ws_dash.add_image(img, 'A3')

# Sheet 2: Raw Data
ws_raw = wb.create_sheet("Raw Data")
df = pd.read_csv("/home/user/workspace/data.csv")  # or construct from analysis
for r in dataframe_to_rows(df, index=False, header=True):
    ws_raw.append(r)
# Style header row
for cell in ws_raw[1]:
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = PatternFill(start_color="4472C4", fill_color="4472C4", end_color="4472C4", patternType="solid")

# Sheet 3: Statistics
ws_stats = wb.create_sheet("Statistics")
stats = df.describe()
for r in dataframe_to_rows(stats, index=True, header=True):
    ws_stats.append(r)

output_path = "/home/user/workspace/analysis_report.xlsx"
wb.save(output_path)
print(f"Excel saved: {output_path} ({len(wb.sheetnames)} sheets)")
\`\`\`

**Important rules:**
- Always style the Excel professionally — headers with colors, proper column widths (\`ws.column_dimensions['A'].width = 20\`), number formatting.
- Include at least 3 sheets: Dashboard (summary + charts), Raw Data, Statistics.
- If the dataset is large, include pivot table sheets with key groupings.
- Use conditional formatting for highlighting important values when relevant.
  `,

comicStrip: `
#### Storyboard / Comic Strip Generation Workflow

When the user requests a comic, manga, storyboard, webtoon, or illustrated story, follow this workflow.

**Step 1: Plan the story**
- Default layout policy (important for UX):
  - Unless the user explicitly requests a specific layout/style, use a **vertical single-column strip** (N x 1), like webtoon scrolling.
  - Do NOT default to 2x2 / 2x3 grids unless the user asks for grid/tile layout.
  - Use horizontal strip (1 x N) only when the user explicitly asks for horizontal layout.
- Optional structures when explicitly requested:
  - **4-panel comic (4컷)**: 2x2 grid
  - **6-panel strip**: 2x3 grid
  - **8-panel story**: 2x4 grid
  - **Webtoon style**: Vertical scroll (individual images)
- Write a brief description for each panel: scene, characters, dialogue/speech bubbles, action.
- Share the panel outline with the user before generating.

**Step 2: Generate panel images with gemini_image_tool**
- For EACH panel, call \`gemini_image_tool\` with:
  - \`aspectRatio\`:
    - Default vertical webtoon strip: **"3:4"**
    - Horizontal strip request: **"1:1"** panel tiles (assembled horizontally)
    - Use other ratios only when the user explicitly asks.
  - \`imageSize\`: **"2K"** (2K is sufficient for panels that will be assembled into a grid; 4K would cause out-of-memory errors during assembly)
  - \`prompt\`: Include the exact scene, character appearance, expression, speech bubble text, and art style.
- **Style consistency**: Define style in the first panel (e.g., "manga style, clean black outlines, cel shading, expressive characters, speech bubbles with Korean text") and repeat in every panel.
- **Character consistency**: Describe character appearance (hair, clothes, features) identically in every panel.
- Generate ALL panels **in parallel** — call \`gemini_image_tool\` for every panel simultaneously in a single response. Do NOT generate one panel at a time.

**Step 2.5: Review generated panels**
- You can see each generated image in the tool results. Quickly review all panels for:
  - Character consistency (same appearance across all panels)
  - Story accuracy (each panel matches the intended scene/dialogue)
  - Speech bubble text accuracy (correct text in each panel)
  - Art style consistency across panels
- If any panel has issues (wrong character appearance, missing dialogue, style break), regenerate only that panel before assembly.

**Step 3: Assemble grid with run_python_code**
- **CRITICAL — Memory-efficient pattern**: The sandbox has limited RAM (~512 MB). Do NOT load all panel images into memory at once. Download to disk first, then open/process/paste one at a time.

\`\`\`python
import subprocess, requests, os
subprocess.run(["pip", "install", "Pillow"], capture_output=True)
from PIL import Image, ImageDraw

# Download panel images (use publicUrl from each tool result directly)
panel_urls = [
    # ... publicUrl values from each gemini_image_tool result
]

os.makedirs("/home/user/workspace", exist_ok=True)
PANEL_SIZE = 750  # Uniform panel size for grid (memory-efficient)

# Phase 1: Download to disk
temp_files = []
for i, url in enumerate(panel_urls):
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        path = f"/home/user/workspace/_tmp_panel_{i}.png"
        with open(path, "wb") as f:
            f.write(resp.content)
        temp_files.append(path)
        print(f"Downloaded panel {i+1}")
    except Exception as e:
        print(f"Panel {i+1} error: {e}")

if temp_files:
    # Default: vertical webtoon strip (N x 1) unless user explicitly requested another layout
    layout_mode = "vertical"  # options: "vertical" (default), "row", "grid"

    if layout_mode == "vertical":
        cols = 1
        rows = len(temp_files)
    elif layout_mode == "grid":
        cols = 2
        rows = (len(temp_files) + cols - 1) // cols
    else:
        cols = len(temp_files)
        rows = 1
    gap = 20  # pixels between panels
    border = 40  # outer border

    canvas_w = cols * PANEL_SIZE + (cols - 1) * gap + 2 * border
    canvas_h = rows * PANEL_SIZE + (rows - 1) * gap + 2 * border
    canvas = Image.new('RGB', (canvas_w, canvas_h), 'white')

    # Phase 2: Open, resize, paste, close one at a time
    for idx, path in enumerate(temp_files):
        r, c = divmod(idx, cols)
        x = border + c * (PANEL_SIZE + gap)
        y = border + r * (PANEL_SIZE + gap)
        with Image.open(path) as panel:
            resized = panel.resize((PANEL_SIZE, PANEL_SIZE), Image.LANCZOS)
            canvas.paste(resized, (x, y))
        # Draw panel border
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([x-2, y-2, x+PANEL_SIZE+1, y+PANEL_SIZE+1], outline='black', width=3)

    output_path = "/home/user/workspace/comic.png"
    canvas.save(output_path, quality=95)
    print(f"Comic saved: {output_path} ({cols}x{rows}, mode={layout_mode}, {len(temp_files)} panels)")

    # Cleanup
    for f in temp_files:
        os.remove(f)
\`\`\`

**Important rules:**
- Follow the **PPT workflow's image URL rules** — use \`publicUrl\` from each tool result directly (never construct URLs manually).
- Default to **vertical strip (N x 1)** for comics when layout is not explicitly specified by the user.
- For explicit horizontal strip requests, switch to 1 x N.
- Include speech bubble text directly in the \`gemini_image_tool\` prompt — the model renders text natively.
- Maintain character consistency by repeating detailed appearance descriptions in every panel prompt.
- **Memory**: Never load all panel images into memory at once. Download to disk first, then open/resize/paste one at a time.
  `,

};
