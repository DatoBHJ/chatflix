import { UIMessage } from 'ai'

const buildThumbnailUrlMap = (
  rawThumbnailMap: Record<string, string>,
  linkMapSource: Record<string, string>
) => {
  const thumbnailUrlMap: Record<string, string> = {};
  Object.entries(rawThumbnailMap || {}).forEach(([key, value]) => {
    const url = linkMapSource[key] || key;
    if (url && !thumbnailUrlMap[url]) {
      thumbnailUrlMap[url] = value;
    }
  });
  return thumbnailUrlMap;
};

const extractImageIdFromPath = (path?: string) => {
  if (!path) return null;
  const filename = path.split('/').pop();
  if (!filename) return null;
  return filename.replace(/\.[^.]+$/, '');
};

const getMessageTextForImageOrder = (message: UIMessage | any) => {
  if (message?.content) return message.content as string;
  if (Array.isArray((message as any)?.parts)) {
    return (message as any).parts
      .filter((part: any) => part?.type === 'text' && part?.text)
      .map((part: any) => part.text)
      .join('\n');
  }
  return '';
};

const buildContentImageIndex = (content?: string) => {
  if (!content || !content.includes('[IMAGE_ID:')) return new Map<string, number>();
  const matches = [...content.matchAll(/\[IMAGE_ID:([^\]]+)\]/g)].map(match => match[1]);
  const indexMap = new Map<string, number>();
  matches.forEach((id, index) => {
    if (!indexMap.has(id)) {
      indexMap.set(id, index);
    }
  });
  return indexMap;
};

const buildImagePartIndexMap = (
  parts: any[] | undefined,
  toolName: string,
  completePartType: string
) => {
  const indexMap = new Map<string, number>();
  if (!Array.isArray(parts)) return indexMap;

  parts.forEach((part, idx) => {
    const isToolPart = part?.type?.startsWith(`tool-${toolName}`) || part?.toolName === toolName;
    if (isToolPart) {
      const result = part.output?.value || part.output || part.result;
      const images = Array.isArray(result)
        ? result
        : (result?.images || (result?.imageUrl ? [result] : []));
      images.forEach((img: any) => {
        const key = img?.path || img?.imageUrl;
        if (key && !indexMap.has(key)) {
          indexMap.set(key, idx);
        }
      });
    }

    if (part?.type === completePartType && part?.data) {
      const key = part.data.path || part.data.imageUrl;
      if (key && !indexMap.has(key)) {
        indexMap.set(key, idx);
      }
    }
  });

  return indexMap;
};

// Find web search tool results to display
export const getWebSearchResults = (message: UIMessage) => {
    if (!message) return null;
    
    // Get query completion annotations - check both annotations and parts for AI SDK 5 compatibility
    let queryCompletions: any[] = [];
    let webSearchCompletions: any[] = [];
    
    // Check annotations array (legacy format)
    if ((message as any).annotations) {
      queryCompletions = ((message as any).annotations as any[]).filter(a => a?.type === 'query_completion');
      webSearchCompletions = ((message as any).annotations as any[]).filter(a => a?.type === 'web_search_complete');
    }
    
    // Check parts array for streaming annotations (AI SDK 5 format)
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const queryParts = ((message as any).parts as any[]).filter(p => p?.type === 'data-query_completion');
      const webSearchParts = ((message as any).parts as any[]).filter(p => p?.type === 'data-web_search_complete');
      
      // Convert parts format to annotations format for consistency
      queryCompletions = [
        ...queryCompletions,
        ...queryParts.map(p => ({ type: 'query_completion', data: p.data }))
      ];
      webSearchCompletions = [
        ...webSearchCompletions,
        ...webSearchParts.map(p => ({ type: 'web_search_complete', data: p.data }))
      ];
    }

    // Extract imageMap, linkMap, thumbnailMap, titleMap from annotations
    let imageMap: { [key: string]: string } = {};
    let linkMap: { [key: string]: string } = {};
    let rawThumbnailMap: { [key: string]: string } = {};
    let titleMap: { [key: string]: string } = {};
    let linkMetaMap: { [key: string]: any } = {};
    
    webSearchCompletions.forEach(completion => {
      if (completion.data?.imageMap) {
        imageMap = { ...imageMap, ...completion.data.imageMap };
      }
      if (completion.data?.linkMap) {
        linkMap = { ...linkMap, ...completion.data.linkMap };
      }
      if (completion.data?.thumbnailMap) {
        rawThumbnailMap = { ...rawThumbnailMap, ...completion.data.thumbnailMap };
      }
      if (completion.data?.titleMap) {
        titleMap = { ...titleMap, ...completion.data.titleMap };
      }
      if (completion.data?.linkMetaMap) {
        linkMetaMap = { ...linkMetaMap, ...completion.data.linkMetaMap };
      }
    });

    // Group query completions by searchId
    const queryCompletionsBySearchId = new Map<string, any[]>();
    queryCompletions.forEach(completion => {
      const searchId = completion.data?.searchId || 'default';
      if (!queryCompletionsBySearchId.has(searchId)) {
        queryCompletionsBySearchId.set(searchId, []);
      }
      queryCompletionsBySearchId.get(searchId)?.push(completion);
    });

    // Get all searchIds from query completions (including the latest one)
    const searchIds = Array.from(queryCompletionsBySearchId.keys()).filter(id => id !== 'default');
    // Latest searchId for determining which search is currently in progress
    const latestSearchId = searchIds.length > 0 ? searchIds[searchIds.length - 1] : null;
    
    // Track completed searches and in-progress searches separately
    const completedSearchIdSet = new Set<string>();
    const allResults: any[] = [];
    
    // Helper function to process search results and ensure Exa fields are preserved
    const processSearchResults = (searches: any[]) => {
      return searches.map(search => ({
        ...search,
        topic: search.topic || 'general',
        topicIcon: getTopicIcon(search.topic || 'general'),
        results: (search.results || []).map((result: any) => ({
          ...result,
          // Ensure Exa-specific fields are preserved
          summary: result.summary || undefined,
          author: result.author || undefined,
          publishedDate: result.publishedDate || result.published_date || undefined,
        })),
        images: search.images || []
      }));
    };

    // Helper function to get topic icon
    const getTopicIcon = (topic: string) => {
      switch (topic) {
        case 'github':
          return 'github'; // GitHub icon
        case 'news':
          return 'newspaper'; // News icon
        case 'company':
          return 'building'; // Company icon
        case 'financial report':
          return 'bank'; // Financial report icon
        case 'pdf':
          return 'file-text'; // PDF icon
        case 'tweet':
          return 'twitter'; // Twitter/X icon
        case 'personal site':
          return 'user'; // Personal site icon
        case 'linkedin profile':
          return 'briefcase'; // LinkedIn icon
        case 'research paper':
          return 'book-open'; // Research paper icon
        default:
          return 'search'; // Default search icon
      }
    };
    
    // Process web search completions to determine which searches are complete
    if (webSearchCompletions.length > 0) {
      // Group web search completions by searchId
      const webSearchCompletionsBySearchId = new Map<string, any[]>();
      webSearchCompletions.forEach(completion => {
        const searchId = completion.data?.searchId || 'default';
        if (!webSearchCompletionsBySearchId.has(searchId)) {
          webSearchCompletionsBySearchId.set(searchId, []);
        }
        webSearchCompletionsBySearchId.get(searchId)?.push(completion);
        
        // Mark this searchId as completed
        if (searchId !== 'default') {
          completedSearchIdSet.add(searchId);
        }
      });
      
      // Process all completed web searches
      for (const [searchId, completions] of webSearchCompletionsBySearchId.entries()) {
        if (searchId === 'default') continue;
        
        // Extract all searches from this searchId
        const searchesForThisId: any[] = [];
        
        completions.forEach(completion => {
          if (completion.data && completion.data.searches) {
            searchesForThisId.push(...completion.data.searches);
          }
        });
        
        if (searchesForThisId.length > 0) {
          // Deduplicate results within this searchId
          const uniqueResults = new Map<string, any>();
          
          // Get topic information from query completions for this searchId
          const searchIdQueryCompletions = queryCompletionsBySearchId.get(searchId) || [];
          const queryTopicMap = new Map<string, string>();
          
          searchIdQueryCompletions.forEach(completion => {
            const query = completion.data?.query;
            const topic = completion.data?.topic || 'general';
            if (query) {
              queryTopicMap.set(query, topic);
            }
          });
          
          searchesForThisId.forEach(search => {
            const query = search.query;
            const topic = queryTopicMap.get(query) || 'general';
            
            if (!uniqueResults.has(query)) {
              uniqueResults.set(query, {
                query,
                topic,
                topicIcon: getTopicIcon(topic),
                results: [],
                images: []
              });
            }
            
            // 현재 저장된 결과
            const currentSearch = uniqueResults.get(query);
            
            // URL 기반으로 중복 체크를 위한 집합
            const urlSet = new Set(currentSearch.results.map((r: any) => r.url));
            const imageUrlSet = new Set(currentSearch.images.map((img: any) => 
              typeof img === 'string' ? img : img.url
            ));
            
            // 결과 추가 (중복 제거) with Exa field preservation
            if (search.results) {
              search.results.forEach((result: any) => {
                if (!urlSet.has(result.url)) {
                  currentSearch.results.push({
                    ...result,
                    // Preserve Exa-specific fields
                    summary: result.summary || undefined,
                    author: result.author || undefined,
                    publishedDate: result.publishedDate || result.published_date || undefined,
                  });
                  urlSet.add(result.url);
                }
              });
            }
            
            // 이미지 추가 (중복 제거)
            if (search.images) {
              search.images.forEach((image: any) => {
                const imageUrl = typeof image === 'string' ? image : image.url;
                if (!imageUrlSet.has(imageUrl)) {
                  currentSearch.images.push(image);
                  imageUrlSet.add(imageUrl);
                }
              });
            }
          });
          
          // Add this completed searchId result to our collection
          allResults.push({
            searchId,
            searches: Array.from(uniqueResults.values()),
            isComplete: true
          });
        }
      }
    }
    
    // 진행 중인 검색 처리 (각 쿼리별 상태 반영)
    // 진행 중인 검색 ID 찾기
    let inProgressSearchIds = new Set<string>();
    if (latestSearchId && !completedSearchIdSet.has(latestSearchId)) {
      inProgressSearchIds.add(latestSearchId);
    }
    
    // 모든 진행 중인 검색 ID에 대해 쿼리 상태 처리
    for (const searchId of inProgressSearchIds) {
      const latestQueryCompletions = queryCompletionsBySearchId.get(searchId) || [];
      
      // 쿼리별 상태를 쪼개서 추적 (completed/in_progress)
      const completedQueries = new Map<string, any>();
      const inProgressQueries = new Map<string, any>();
      
      // 각 쿼리의 최신 상태 추적
      latestQueryCompletions.forEach(completion => {
        const query = completion.data?.query;
        const status = completion.data?.status;
        
        if (!query) return;
        
        // 완료된 쿼리는 completedQueries에, 진행 중인 쿼리는 inProgressQueries에 저장
        if (status === 'completed') {
          completedQueries.set(query, completion);
        } else if (status === 'in_progress' && !completedQueries.has(query)) {
          // 이미 완료된 쿼리는 진행 중으로 표시하지 않음
          inProgressQueries.set(query, completion);
        }
      });
      
      // 완료된 쿼리로 검색 결과 객체 생성
      const completedSearches = Array.from(completedQueries.values()).map(completion => ({
        query: completion.data.query,
        topic: completion.data.topic || 'general',
        topicIcon: getTopicIcon(completion.data.topic || 'general'),
        results: [], // 실제 결과는 web_search_complete 어노테이션에 있음
        images: []
      }));
      
      // 진행 중인 쿼리로 검색 결과 객체 생성
      const inProgressSearches = Array.from(inProgressQueries.values()).map(completion => ({
        query: completion.data.query,
        topic: completion.data.topic || 'general',
        topicIcon: getTopicIcon(completion.data.topic || 'general'),
        results: [],
        images: []
      }));
      
      // 모든 쿼리를 합쳐서 하나의 결과 객체 생성
      const allSearches = [
        ...completedSearches,
        ...inProgressSearches
      ];
      
      // 진행 중인 검색이 있는 경우에만 추가
      if (allSearches.length > 0) {
        allResults.push({
          searchId,
          searches: allSearches,
          isComplete: false,
          // 모든 쿼리 완료 어노테이션을 보존
          annotations: latestQueryCompletions
        });
      }
    }
    
    // If we've found results via annotations, return them
    if (allResults.length > 0) {
      const thumbnailMap = buildThumbnailUrlMap(rawThumbnailMap, linkMap);
      return {
        result: null, // For backward compatibility
        args: null,
        annotations: queryCompletions,
        results: allResults,
        imageMap,
        linkMap,
        thumbnailMap,
        titleMap,
        linkMetaMap
      };
    }
    
    // Check for stored tool results as a fallback
    if ((message as any).tool_results) {
      const toolResults = (message as any).tool_results;
      
      // Extract imageMap, linkMap, thumbnailMap, titleMap from tool_results
      if (toolResults.webSearchResults) {
        toolResults.webSearchResults.forEach((result: any) => {
          if (result.imageMap) {
            imageMap = { ...imageMap, ...result.imageMap };
          }
          if (result.linkMap) {
            linkMap = { ...linkMap, ...result.linkMap };
          }
          if (result.thumbnailMap) {
            rawThumbnailMap = { ...rawThumbnailMap, ...result.thumbnailMap };
          }
          if (result.titleMap) {
            titleMap = { ...titleMap, ...result.titleMap };
          }
          if (result.linkMetaMap) {
            linkMetaMap = { ...linkMetaMap, ...result.linkMetaMap };
          }
        });
      } else if (Array.isArray(toolResults)) {
        toolResults.forEach((result: any) => {
          if (result.imageMap) {
            imageMap = { ...imageMap, ...result.imageMap };
          }
          if (result.linkMap) {
            linkMap = { ...linkMap, ...result.linkMap };
          }
          if (result.thumbnailMap) {
            rawThumbnailMap = { ...rawThumbnailMap, ...result.thumbnailMap };
          }
          if (result.titleMap) {
            titleMap = { ...titleMap, ...result.titleMap };
          }
          if (result.linkMetaMap) {
            linkMetaMap = { ...linkMetaMap, ...result.linkMetaMap };
          }
        });
      }
      
      // Handle both new and legacy formats
      let storedResults: any[] = [];
      
      if (toolResults.webSearchResults) {
        // New format with webSearchResults key
        if (Array.isArray(toolResults.webSearchResults)) {
          // Process all results with searchIds
          const resultsWithIds = toolResults.webSearchResults.filter((r: any) => r.searchId);
          
          // Create a result entry for each unique searchId
          const processedIds = new Set<string>();
          
          resultsWithIds.forEach((result: any) => {
            const searchId = result.searchId;
            if (searchId && !processedIds.has(searchId)) {
              processedIds.add(searchId);
              storedResults.push({
                searchId,
                searches: processSearchResults(result.searches || []),
                isComplete: true
              });
            }
          });
          
          // Handle results without searchId (legacy)
          if (storedResults.length === 0) {
            const mergedSearches = toolResults.webSearchResults.flatMap((r: any) => r.searches || []);
            if (mergedSearches.length > 0) {
              storedResults.push({
                searchId: 'legacy',
                searches: processSearchResults(mergedSearches),
                isComplete: true
              });
            }
          }
        }
      } else if (Array.isArray(toolResults) && toolResults[0]?.searches) {
        // Legacy format with searches key
        const resultsWithIds = toolResults.filter((r: any) => r.searchId);
        
        if (resultsWithIds.length > 0) {
          // Process each unique searchId
          const processedIds = new Set<string>();
          
          resultsWithIds.forEach(result => {
            const searchId = result.searchId;
            if (searchId && !processedIds.has(searchId)) {
              processedIds.add(searchId);
              storedResults.push({
                searchId,
                searches: processSearchResults(result.searches || []),
                isComplete: true
              });
            }
          });
        } else {
          // Handle legacy format without searchId
          const mergedSearches = toolResults.flatMap((r: any) => r.searches || []);
          if (mergedSearches.length > 0) {
            storedResults.push({
              searchId: 'legacy',
              searches: processSearchResults(mergedSearches),
              isComplete: true
            });
          }
        }
      }
      
      if (storedResults.length > 0) {
        const thumbnailMap = buildThumbnailUrlMap(rawThumbnailMap, linkMap);
        return {
          result: null, // For backward compatibility
          args: null,
          annotations: queryCompletions,
          results: storedResults,
          imageMap,
          linkMap,
          thumbnailMap,
          titleMap,
          linkMetaMap
        };
      }
    }
    
    // If no parts property or it's empty, return null or loading state
    if (!message.parts || message.parts.length === 0) {
      // If we have query completions, we can show a loading state
      if (queryCompletions.length > 0) {
        const thumbnailMap = buildThumbnailUrlMap(rawThumbnailMap, linkMap);
        return {
          result: null, // For backward compatibility
          args: { queries: [], maxResults: [], topics: [], searchDepth: [] },
          annotations: queryCompletions,
          results: [{
            searchId: latestSearchId || 'default',
            searches: [],
            isComplete: false,
            annotations: queryCompletions
          }],
          imageMap,
          linkMap,
          thumbnailMap,
          titleMap
        };
      }
      return null;
    }
    
    // Collect all results and args from tool invocations
    const allInvocationResults: any[] = [];
    const allArgs: any[] = [];
    const processedSearchIds = new Set<string>();
    
    for (const part of message.parts || []) {
      // v5 UI tool parts are typed as `tool-<name>`; handle both dynamic and static
      if (part && typeof (part as any).type === 'string' && (part as any).type.startsWith('tool-')) {
        try {
          const toolName = (part as any).type.slice('tool-'.length);
          if (toolName !== 'web_search') continue;
          const input = (part as any).input;
          const output = (part as any).output;
          if (input) allArgs.push(JSON.parse(JSON.stringify(input)));
          if (output) {
            const result = JSON.parse(JSON.stringify(output));
            
            // Extract imageMap from invocation result
            if (result.imageMap) {
              imageMap = { ...imageMap, ...result.imageMap };
            }
            
            if (result.searchId && !processedSearchIds.has(result.searchId)) {
              processedSearchIds.add(result.searchId);
              allInvocationResults.push({
                searchId: result.searchId,
                searches: processSearchResults(result.searches || []),
                isComplete: true
              });
            } else if (!result.searchId) {
              // Legacy result without searchId
              allInvocationResults.push({
                searchId: 'legacy_invocation',
                searches: processSearchResults(result.searches || []),
                isComplete: true
              });
            }
          }
        } catch (error) {
          console.error('Error parsing web search results:', error);
        }
      }
    }
    
    // Check web_search_complete annotations if we didn't find results in invocations
    if ((message as any).annotations && allInvocationResults.length === 0) {
      const webSearchAnnotations = ((message as any).annotations as any[])
        .filter(a => a?.type === 'web_search_complete');
      
      if (webSearchAnnotations.length > 0) {
        // Group annotations by searchId
        const annotationsBySearchId = new Map<string, any[]>();
        
        webSearchAnnotations.forEach(annotation => {
          const searchId = annotation.data?.searchId || 'default';
          if (!annotationsBySearchId.has(searchId)) {
            annotationsBySearchId.set(searchId, []);
          }
          annotationsBySearchId.get(searchId)?.push(annotation);
        });
        
        // Process each searchId group
        for (const [searchId, annotations] of annotationsBySearchId.entries()) {
          if (searchId === 'default') continue;
          
          const searches = annotations
            .filter(a => a.data?.searches)
            .flatMap(a => {
              // Ensure each search has an images array
              if (a.data.searches) {
                a.data.searches.forEach((s: any) => {
                  if (!s.images) s.images = [];
                });
              }
              return a.data.searches || [];
            });
          
          if (searches.length > 0) {
            allInvocationResults.push({
              searchId,
              searches: processSearchResults(searches),
              isComplete: true
            });
          }
        }
      }
    }
    
    // If we have results from invocations or annotations
    if (allInvocationResults.length > 0) {
      // Check if latest searchId is still in progress
      if (latestSearchId && !processedSearchIds.has(latestSearchId) && 
          queryCompletionsBySearchId.has(latestSearchId)) {
        // Add in-progress search
        allInvocationResults.push({
          searchId: latestSearchId,
          searches: [],
          isComplete: false,
          annotations: queryCompletionsBySearchId.get(latestSearchId)
        });
      }
      
      const thumbnailMap = buildThumbnailUrlMap(rawThumbnailMap, linkMap);
      return {
        result: null, // For backward compatibility 
        args: allArgs[0] || null,
        annotations: queryCompletions,
        results: allInvocationResults,
        imageMap,
        linkMap,
        thumbnailMap,
        titleMap
      };
    }
    
    // Extract queries for loading state
    if (allArgs.length > 0) {
      const thumbnailMap = buildThumbnailUrlMap(rawThumbnailMap, linkMap);
      return {
        result: null, // For backward compatibility
        args: allArgs[0],
        annotations: queryCompletions,
        results: [{
          searchId: latestSearchId || 'default',
          searches: [],
          isComplete: false,
          annotations: queryCompletions
        }],
        imageMap,
        linkMap,
        thumbnailMap,
        titleMap
      };
    }
    
    return null;
  };

// Extract math calculation annotations
export const getMathCalculationData = (message: UIMessage) => {
  // 1. 데이터베이스에서 저장된 tool_results가 있는지 확인
  if ((message as any).tool_results) {
    const toolResults = (message as any).tool_results;
    
    // 새로운 구조: calculationSteps 키 확인
    if (toolResults.calculationSteps && Array.isArray(toolResults.calculationSteps) && 
        toolResults.calculationSteps.length > 0) {
      return {
        calculationSteps: toolResults.calculationSteps
      };
    }
    
    // 이전 구조와의 호환성 유지
    else if (Array.isArray(toolResults) && toolResults.length > 0 && 
        typeof toolResults[0] === 'object' && 
        'step' in toolResults[0] && 
        'expression' in toolResults[0] && 
        'result' in toolResults[0]) {
      return {
        calculationSteps: toolResults
      };
    }
    
    // tool_results가 있지만 수학 계산 결과가 아니면 반환하지 않음
    return null;
  }
  
  // 2. 실시간 주석에서 계산 단계 추출
  let mathAnnotations: any[] = [];
  let mathStarted = false;
  
  // Check annotations array (legacy format)
  if ((message as any).annotations) {
    const calculationAnnotations = (((message as any).annotations) as any[])
      .filter(a => a && typeof a === 'object' && a.type && 
        ['math_calculation', 'math_calculation_complete'].includes(a.type));
    
    const startAnnotations = (((message as any).annotations) as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'math_calculation_started');
    
    mathAnnotations = calculationAnnotations;
    mathStarted = startAnnotations.length > 0;
  }
  
  // Check parts array for streaming annotations (AI SDK 5 format)
  if ((message as any).parts && Array.isArray((message as any).parts)) {
    const mathParts = ((message as any).parts as any[])
      .filter(p => p?.type === 'data-math_calculation');
    
    const mathStartParts = ((message as any).parts as any[])
      .filter(p => p?.type === 'data-math_calculation_started');
    
    // Convert parts format to annotations format for consistency
    mathAnnotations = [
      ...mathAnnotations,
      ...mathParts.map(p => ({ type: 'math_calculation', ...p.data }))
    ];
    mathStarted = mathStarted || mathStartParts.length > 0;
  }
  
  // 시작 신호가 있거나 계산 단계가 있으면 반환
  if (mathStarted || mathAnnotations.length > 0) {
    // 최신 계산 단계 반환
    const calculationSteps = mathAnnotations
      .filter(a => a.type === 'math_calculation' && a.calculationSteps)
      .flatMap(a => a.calculationSteps)
      .filter((step, index, self) => 
        index === self.findIndex(s => s.step === step.step)
      )
      .sort((a, b) => a.step - b.step);
    
    return { 
      calculationSteps,
      status: calculationSteps.length > 0 ? 'completed' : 'processing'
    };
  }
  
  return null;
};

// Extract link reader attempts from message annotations and tool_results
export const getLinkReaderData = (message: UIMessage) => {
  // Check if there are stored link reader attempts in tool_results
  if ((message as any).tool_results?.linkReaderAttempts) {
    const linkAttempts = (message as any).tool_results.linkReaderAttempts;
    const rawContent = (message as any).tool_results.linkReaderRawContent;
    if (Array.isArray(linkAttempts) && linkAttempts.length > 0) {
      return { 
        linkAttempts,
        rawContent: Array.isArray(rawContent) ? rawContent : []
      };
    }
  }
  
  // Check for link reader annotations
  let linkReaderAnnotations: any[] = [];
  let linkReaderUpdates: any[] = [];
  let linkReaderRawContent: any[] = [];
  let startedCount = 0;
  
  // Check annotations array (legacy format)
  if ((message as any).annotations) {
    linkReaderAnnotations = (((message as any).annotations) as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'link_reader_attempt')
      .map(a => a.data)
      .filter(Boolean);
      
    linkReaderUpdates = (((message as any).annotations) as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'link_reader_attempt_update');
    
    linkReaderRawContent = (((message as any).annotations) as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'link_reader_complete')
      .map(a => a.data)
      .filter(Boolean);
    
    const startAnnotations = (((message as any).annotations) as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'link_reader_started');
    
    startedCount = startAnnotations.length;
  }
  
  // Check parts array for streaming annotations (AI SDK 5 format)
  if ((message as any).parts && Array.isArray((message as any).parts)) {
    const linkAttemptParts = ((message as any).parts as any[])
      .filter(p => p?.type === 'data-link_reader_attempt');
    const linkUpdateParts = ((message as any).parts as any[])
      .filter(p => p?.type === 'data-link_reader_attempt_update');
    const linkRawContentParts = ((message as any).parts as any[])
      .filter(p => p?.type === 'data-link_reader_complete');
    const linkStartParts = ((message as any).parts as any[])
      .filter(p => p?.type === 'data-link_reader_started');
    
    linkReaderAnnotations = [
      ...linkReaderAnnotations,
      ...linkAttemptParts.map(p => p.data).filter(Boolean)
    ];
    
    linkReaderUpdates = [
      ...linkReaderUpdates,
      ...linkUpdateParts.map(p => ({ type: 'link_reader_attempt_update', data: p.data }))
    ];
    
    linkReaderRawContent = [
      ...linkReaderRawContent,
      ...linkRawContentParts.map(p => p.data).filter(Boolean)
    ];
    
    startedCount = Math.max(startedCount, linkStartParts.length);
  }
  
  // 시작 신호가 있거나 시도가 있으면 반환
  if (startedCount > 0 || linkReaderAnnotations.length > 0) {
    // Create a map of attempts by URL for easy updating
    const attemptsMap = new Map(
      linkReaderAnnotations.map(attempt => [attempt.url, attempt])
    );
    
    // Apply updates from annotations
    linkReaderUpdates.forEach(update => {
      const data = update.data;
      if (data?.url && attemptsMap.has(data.url)) {
        // Update the attempt with latest data
        Object.assign(attemptsMap.get(data.url), data);
      }
    });
    
    const linkAttempts = Array.from(attemptsMap.values());
    const hasSuccessfulAttempt = linkAttempts.some(attempt => 
      attempt.status === 'success' || (attempt.title && !attempt.error)
    );
    
    const completedCount = linkAttempts.length;
    const pendingCount = Math.max(0, startedCount - completedCount);
    
    return { 
      linkAttempts,
      rawContent: linkReaderRawContent,
      status: hasSuccessfulAttempt ? 'completed' : 'processing',
      startedCount,
      pendingCount
    };
  }
  
  return null;
};

// Extract Gemini image data from message tool_results
export const getGeminiImageData = (message: UIMessage) => {
    // 1. tool_results 확인 (DB 저장된 데이터 - 최우선)
    if ((message as any).tool_results?.geminiImageResults) {
      const generatedImages = (message as any).tool_results.geminiImageResults;
      if (Array.isArray(generatedImages) && generatedImages.length > 0) {
        const contentIndexMap = buildContentImageIndex(getMessageTextForImageOrder(message));
        const partIndexMap = buildImagePartIndexMap(
          (message as any).parts,
          'gemini_image_tool',
          'data-gemini_image_complete'
        );
        const enrichedImages = generatedImages.map((image: any) => {
          const key = image?.path || image?.imageUrl;
          const imageId = extractImageIdFromPath(image?.path);
          return {
            ...image,
            ...(key && partIndexMap.has(key) ? { partIndex: partIndexMap.get(key) } : {}),
            ...(imageId && contentIndexMap.has(imageId) ? { contentIndex: contentIndexMap.get(imageId) } : {})
          };
        });
        return { generatedImages: enrichedImages };
      }
    }
    
    // 2. parts 배열의 tool-result 확인 (스트리밍 중 데이터)
    let imagesFromToolResults: any[] = [];
    let errorCount = 0;
    // 🔥 toolCallId로 고유 식별 추가
    let failedImages: Array<{ prompt: string; error: string; editImageUrl?: string | string[]; toolCallId?: string; index?: number }> = [];
    // 🔥 완료된 toolCallId 추적
    let completedToolCallIds: Set<string> = new Set();
    let failedToolCallIds: Set<string> = new Set();
    
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const partsArray = (message as any).parts as any[];
      
      // 🔥 parts 배열 순회하면서 원본 인덱스(partIndex) 추적
      let toolPartIndex = 0; // tool-result 파트 중에서의 순서
      for (let partIdx = 0; partIdx < partsArray.length; partIdx++) {
        const part = partsArray[partIdx];
        
        // tool-result 또는 tool-gemini_image_tool 타입 확인
        const isToolResult = part?.type === 'tool-result' || 
                            part?.type?.startsWith('tool-gemini_image_tool');
        const isGeminiTool = part?.toolName === 'gemini_image_tool' || 
                            part?.type?.includes('gemini_image_tool');
        
        if (!isToolResult || !isGeminiTool) continue;
        
        const result = part.output?.value || part.output || part.result;
        const toolCallId = part.toolCallId;
        
        // 에러 케이스 체크
        if (result?.success === false) {
          errorCount++;
          if (toolCallId) failedToolCallIds.add(toolCallId);
          failedImages.push({
            prompt: result.prompt || 'Unknown prompt',
            error: result.error || 'Unknown error',
            editImageUrl: result.editImageUrl,
            toolCallId, // 🔥 toolCallId 추가
            index: toolPartIndex // 🔥 순서 인덱스 추가
          });
          toolPartIndex++;
          continue;
        }
        
        // 성공 케이스: 이미지 데이터 추출
        if (result?.imageUrl && result?.path) {
          if (toolCallId) completedToolCallIds.add(toolCallId);
          imagesFromToolResults.push({
            imageUrl: result.imageUrl,
            path: result.path,
            prompt: result.prompt,
            timestamp: result.timestamp || new Date().toISOString(),
            generatedBy: 'gemini',
            toolCallId, // 🔥 toolCallId 추가
            partIndex: partIdx, // 🔥 원본 parts 배열에서의 인덱스
            ...(result.isEdit && { isEdit: true, originalImageUrl: result.originalImageUrl })
          });
        }
        // 배열 형식 (Seedream 스타일)
        if (result?.images && Array.isArray(result.images)) {
          if (toolCallId) completedToolCallIds.add(toolCallId);
          for (const img of result.images) {
            if (img.imageUrl && img.path) {
              imagesFromToolResults.push({
                ...img,
                toolCallId, // 🔥 toolCallId 추가
                partIndex: partIdx // 🔥 원본 parts 배열에서의 인덱스
              });
            }
          }
        }
        
        toolPartIndex++;
      }
    }
    
    // 3. 기존 data-gemini_image_complete 확인 (항상 실행하여 pending 정보 수집)
    // Check for streaming Gemini image annotations
    let imageAnnotations: any[] = [];
    let startedCount = 0;
    
    // Check annotations array (legacy format)
    if ((message as any).annotations) {
      imageAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'gemini_image_complete')
        .map(a => a.data)
        .filter(Boolean);
      
      const startAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'gemini_image_started');
      
      startedCount = startAnnotations.length;
    }
    
    // Check parts array for streaming annotations (AI SDK 5 format)
    // 🔥 pendingItems로 개별 항목 추적
    let pendingPrompts: string[] = [];
    let pendingEditImageUrls: (string | string[] | undefined)[] = [];
    let pendingItems: Array<{ prompt: string; editImageUrl?: string; index: number; id?: string }> = [];
    
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const partsArr = (message as any).parts as any[];
      
      // 🔥 parts 배열 순회하면서 각 타입별로 partIndex 추적
      const imageParts: Array<{ part: any; partIndex: number }> = [];
      const imageStartParts: Array<{ part: any; partIndex: number }> = [];
      const errorParts: Array<{ part: any; partIndex: number }> = [];
      
      for (let idx = 0; idx < partsArr.length; idx++) {
        const p = partsArr[idx];
        if (p?.type === 'data-gemini_image_complete') {
          imageParts.push({ part: p, partIndex: idx });
        } else if (p?.type === 'data-gemini_image_started') {
          imageStartParts.push({ part: p, partIndex: idx });
        } else if (p?.type === 'data-gemini_image_error') {
          errorParts.push({ part: p, partIndex: idx });
        }
      }
      
      // Check for error annotations
      // Extract failed images from error annotations
      for (let i = 0; i < errorParts.length; i++) {
        const { part: errorPart } = errorParts[i];
        if (errorPart.data) {
          // 🔥 중복 방지: toolCallId로 이미 추가된 에러인지 확인
          const existingError = failedImages.find(f => 
            f.prompt === errorPart.data.prompt && 
            f.editImageUrl === errorPart.data.editImageUrl
          );
          if (!existingError) {
            failedImages.push({
              prompt: errorPart.data.prompt || 'Unknown prompt',
              error: errorPart.data.error || 'Unknown error',
              editImageUrl: errorPart.data.editImageUrl,
              index: failedImages.length
            });
            errorCount++;
          }
        }
      }
      
      // 🔥 imageAnnotations에 partIndex 포함
      imageAnnotations = [
        ...imageAnnotations,
        ...imageParts.map(({ part, partIndex }) => part.data ? { ...part.data, partIndex } : null).filter(Boolean)
      ];
      startedCount = Math.max(startedCount, imageStartParts.length);
      
      // 🔥 개별 pending 항목 추적 (인덱스 기반)
      for (let i = 0; i < imageStartParts.length; i++) {
        const { part: startPart } = imageStartParts[i];
        pendingItems.push({
          prompt: startPart.data?.prompt || '',
          editImageUrl: startPart.data?.resolvedEditImageUrl || startPart.data?.editImageUrl,
          index: i,
          id: startPart.id
        });
      }
      
      // Extract prompts and editImageUrls from started signals
      pendingPrompts = imageStartParts
        .map(({ part: p }) => p.data?.prompt)
        .filter(Boolean);
      
      // Use resolved URL if available, otherwise fall back to editImageUrl reference
      pendingEditImageUrls = imageStartParts
        .map(({ part: p }) => {
          // Prefer resolved URL (actual URL) over reference
          if (p.data?.resolvedEditImageUrl) {
            return p.data.resolvedEditImageUrl;
          }
          return p.data?.editImageUrl;
        })
        .filter(url => url !== undefined);
    }
    
    // 🔥 모든 이미지 소스 통합 (tool-result + data-annotations)
    // ⚠️ 중복 제거: tool-result와 data-annotation에 같은 이미지가 있을 수 있음
    // 🔥 path를 우선적으로 사용 (같은 path를 가진 이미지는 같은 이미지로 간주)
    const seenKeys = new Set<string>();
    const allGeneratedImages = [...imagesFromToolResults, ...imageAnnotations].filter(img => {
      // path가 있으면 path를 우선 사용, 없으면 imageUrl 사용
      const key = img.path || img.imageUrl;
      if (!key || seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    
    // 🔥 완료+에러 수를 고려한 정확한 pending 계산
    const completedCount = allGeneratedImages.length;
    const actualPendingCount = Math.max(0, startedCount - completedCount - errorCount);
    
    // 🔥 실제로 pending인 항목만 필터링 (완료되지도 실패하지도 않은 것)
    const trulyPendingItems = pendingItems.filter((item, idx) => {
      // 인덱스 기반으로 완료 또는 실패 여부 확인
      const isCompleted = idx < completedCount;
      const isFailed = failedImages.some(f => f.index === idx);
      return !isCompleted && !isFailed;
    });
    
    // Return streaming data if available
    if (startedCount > 0 || allGeneratedImages.length > 0 || errorCount > 0) {
      // 상태 결정: 모든 작업이 완료되었는지 확인
      let status: 'processing' | 'completed' | 'error';
      if (actualPendingCount > 0) {
        status = 'processing';
      } else if (allGeneratedImages.length > 0) {
        status = 'completed';
      } else if (errorCount > 0) {
        status = 'error';
      } else {
        status = 'processing';
      }
      
      return { 
        generatedImages: allGeneratedImages,
        status,
        startedCount,
        pendingCount: actualPendingCount,
        pendingPrompts,
        pendingEditImageUrls,
        pendingItems: trulyPendingItems, // 🔥 실제 pending 항목만
        errorCount: errorCount > 0 ? errorCount : undefined,
        failedImages: failedImages.length > 0 ? failedImages : undefined
      };
    }
    
    return null;
};

// Extract Seedream image data from message tool_results
export const getSeedreamImageData = (message: UIMessage) => {
    // 1. tool_results 확인 (DB 저장된 데이터 - 최우선)
    if ((message as any).tool_results?.seedreamImageResults) {
      const generatedImages = (message as any).tool_results.seedreamImageResults;
      if (Array.isArray(generatedImages) && generatedImages.length > 0) {
        const contentIndexMap = buildContentImageIndex(getMessageTextForImageOrder(message));
        const partIndexMap = buildImagePartIndexMap(
          (message as any).parts,
          'seedream_image_tool',
          'data-seedream_image_complete'
        );
        const enrichedImages = generatedImages.map((image: any) => {
          const key = image?.path || image?.imageUrl;
          const imageId = extractImageIdFromPath(image?.path);
          return {
            ...image,
            ...(key && partIndexMap.has(key) ? { partIndex: partIndexMap.get(key) } : {}),
            ...(imageId && contentIndexMap.has(imageId) ? { contentIndex: contentIndexMap.get(imageId) } : {})
          };
        });
        return { generatedImages: enrichedImages };
      }
    }
    
    // 2. parts 배열의 tool-result 확인 (스트리밍 중 데이터)
    let imagesFromToolResults: any[] = [];
    let errorCount = 0;
    // 🔥 toolCallId로 고유 식별 추가
    let failedImages: Array<{ prompt: string; error: string; editImageUrl?: string | string[]; toolCallId?: string; index?: number }> = [];
    // 🔥 완료된 toolCallId 추적
    let completedToolCallIds: Set<string> = new Set();
    let failedToolCallIds: Set<string> = new Set();
    
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const partsArray = (message as any).parts as any[];
      
      // 🔥 parts 배열 순회하면서 원본 인덱스(partIndex) 추적
      let toolPartIndex = 0; // tool-result 파트 중에서의 순서
      for (let partIdx = 0; partIdx < partsArray.length; partIdx++) {
        const part = partsArray[partIdx];
        
        // tool-result 또는 tool-seedream_image_tool 타입 확인
        const isToolResult = part?.type === 'tool-result' || 
                            part?.type?.startsWith('tool-seedream_image_tool');
        const isSeedreamTool = part?.toolName === 'seedream_image_tool' || 
                              part?.type?.includes('seedream_image_tool');
        
        if (!isToolResult || !isSeedreamTool) continue;
        
        const result = part.output?.value || part.output || part.result;
        const toolCallId = part.toolCallId;
        
        // 에러 케이스 체크
        if (result?.success === false) {
          errorCount++;
          if (toolCallId) failedToolCallIds.add(toolCallId);
          failedImages.push({
            prompt: result.prompt || 'Unknown prompt',
            error: result.error || 'Unknown error',
            editImageUrl: result.editImageUrl,
            toolCallId, // 🔥 toolCallId 추가
            index: toolPartIndex // 🔥 순서 인덱스 추가
          });
          toolPartIndex++;
          continue;
        }
        
        // 성공 케이스: 이미지 데이터 추출
        // Seedream은 images 배열로 반환하는 경우가 많음
        if (result?.images && Array.isArray(result.images)) {
          if (toolCallId) completedToolCallIds.add(toolCallId);
          for (const img of result.images) {
            if (img.imageUrl && img.path) {
              imagesFromToolResults.push({
                imageUrl: img.imageUrl,
                path: img.path,
                prompt: img.prompt || result.prompt,
                timestamp: img.timestamp || result.timestamp || new Date().toISOString(),
                generatedBy: 'seedream',
                toolCallId, // 🔥 toolCallId 추가
                partIndex: partIdx, // 🔥 원본 parts 배열에서의 인덱스
                ...(img.isEdit && { isEdit: true, originalImageUrl: img.originalImageUrl }),
                ...(img.size && { size: img.size }),
                ...(img.aspectRatio && { aspectRatio: img.aspectRatio })
              });
            }
          }
        }
        // 단일 이미지 형식
        else if (result?.imageUrl && result?.path) {
          if (toolCallId) completedToolCallIds.add(toolCallId);
          imagesFromToolResults.push({
            imageUrl: result.imageUrl,
            path: result.path,
            prompt: result.prompt,
            timestamp: result.timestamp || new Date().toISOString(),
            generatedBy: 'seedream',
            toolCallId, // 🔥 toolCallId 추가
            partIndex: partIdx, // 🔥 원본 parts 배열에서의 인덱스
            ...(result.isEdit && { isEdit: true, originalImageUrl: result.originalImageUrl }),
            ...(result.size && { size: result.size }),
            ...(result.aspectRatio && { aspectRatio: result.aspectRatio })
          });
        }
        
        toolPartIndex++;
      }
    }
    
    // 3. 기존 data-seedream_image_complete 확인 (항상 실행하여 pending 정보 수집)
    // Check for streaming Seedream image annotations
    let imageAnnotations: any[] = [];
    let startedCount = 0;
    
    // Check annotations array (legacy format)
    if ((message as any).annotations) {
      imageAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'seedream_image_complete')
        .map(a => a.data)
        .filter(Boolean);
      
      const startAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'seedream_image_started');
      
      startedCount = startAnnotations.length;
    }
    
    // Check parts array for streaming annotations (AI SDK 5 format)
    // 🔥 pendingItems로 개별 항목 추적
    let pendingPrompts: string[] = [];
    let pendingEditImageUrls: (string | string[] | undefined)[] = [];
    let pendingItems: Array<{ prompt: string; editImageUrl?: string; index: number; id?: string }> = [];
    
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const partsArr = (message as any).parts as any[];
      
      // 🔥 parts 배열 순회하면서 각 타입별로 partIndex 추적
      const imageParts: Array<{ part: any; partIndex: number }> = [];
      const imageStartParts: Array<{ part: any; partIndex: number }> = [];
      const errorParts: Array<{ part: any; partIndex: number }> = [];
      
      for (let idx = 0; idx < partsArr.length; idx++) {
        const p = partsArr[idx];
        if (p?.type === 'data-seedream_image_complete') {
          imageParts.push({ part: p, partIndex: idx });
        } else if (p?.type === 'data-seedream_image_started') {
          imageStartParts.push({ part: p, partIndex: idx });
        } else if (p?.type === 'data-seedream_image_error') {
          errorParts.push({ part: p, partIndex: idx });
        }
      }
      
      // Check for error annotations
      // Extract failed images from error annotations
      for (let i = 0; i < errorParts.length; i++) {
        const { part: errorPart } = errorParts[i];
        if (errorPart.data) {
          // 🔥 중복 방지: toolCallId로 이미 추가된 에러인지 확인
          const existingError = failedImages.find(f => 
            f.prompt === errorPart.data.prompt && 
            f.editImageUrl === errorPart.data.editImageUrl
          );
          if (!existingError) {
            failedImages.push({
              prompt: errorPart.data.prompt || 'Unknown prompt',
              error: errorPart.data.error || 'Unknown error',
              editImageUrl: errorPart.data.editImageUrl,
              index: failedImages.length
            });
            errorCount++;
          }
        }
      }
      
      // 🔥 imageAnnotations에 partIndex 포함
      imageAnnotations = [
        ...imageAnnotations,
        ...imageParts.map(({ part, partIndex }) => part.data ? { ...part.data, partIndex } : null).filter(Boolean)
      ];
      startedCount = Math.max(startedCount, imageStartParts.length);
      
      // 🔥 개별 pending 항목 추적 (인덱스 기반)
      for (let i = 0; i < imageStartParts.length; i++) {
        const { part: startPart } = imageStartParts[i];
        pendingItems.push({
          prompt: startPart.data?.prompt || '',
          editImageUrl: startPart.data?.resolvedEditImageUrl || startPart.data?.editImageUrl,
          index: i,
          id: startPart.id
        });
      }
      
      // Extract prompts and editImageUrls from started signals
      pendingPrompts = imageStartParts
        .map(({ part: p }) => p.data?.prompt)
        .filter(Boolean);
      
      // Use resolved URL if available, otherwise fall back to editImageUrl reference
      pendingEditImageUrls = imageStartParts
        .map(({ part: p }) => {
          // Prefer resolved URL (actual URL) over reference
          if (p.data?.resolvedEditImageUrl) {
            return p.data.resolvedEditImageUrl;
          }
          return p.data?.editImageUrl;
        })
        .filter(url => url !== undefined);
    }
    
    // 🔥 모든 이미지 소스 통합 (tool-result + data-annotations)
    // ⚠️ 중복 제거: tool-result와 data-annotation에 같은 이미지가 있을 수 있음
    // 🔥 path를 우선적으로 사용 (같은 path를 가진 이미지는 같은 이미지로 간주)
    const seenKeys = new Set<string>();
    const allGeneratedImages = [...imagesFromToolResults, ...imageAnnotations].filter(img => {
      // path가 있으면 path를 우선 사용, 없으면 imageUrl 사용
      const key = img.path || img.imageUrl;
      if (!key || seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    
    // 🔥 완료+에러 수를 고려한 정확한 pending 계산
    const completedCount = allGeneratedImages.length;
    const actualPendingCount = Math.max(0, startedCount - completedCount - errorCount);
    
    // 🔥 실제로 pending인 항목만 필터링 (완료되지도 실패하지도 않은 것)
    const trulyPendingItems = pendingItems.filter((item, idx) => {
      // 인덱스 기반으로 완료 또는 실패 여부 확인
      const isCompleted = idx < completedCount;
      const isFailed = failedImages.some(f => f.index === idx);
      return !isCompleted && !isFailed;
    });
    
    // Return streaming data if available
    if (startedCount > 0 || allGeneratedImages.length > 0 || errorCount > 0) {
      // 상태 결정: 모든 작업이 완료되었는지 확인
      let status: 'processing' | 'completed' | 'error';
      if (actualPendingCount > 0) {
        status = 'processing';
      } else if (allGeneratedImages.length > 0) {
        status = 'completed';
      } else if (errorCount > 0) {
        status = 'error';
      } else {
        status = 'processing';
      }
      
      return { 
        generatedImages: allGeneratedImages,
        status,
        startedCount,
        pendingCount: actualPendingCount,
        pendingPrompts,
        pendingEditImageUrls,
        pendingItems: trulyPendingItems, // 🔥 실제 pending 항목만
        errorCount: errorCount > 0 ? errorCount : undefined,
        failedImages: failedImages.length > 0 ? failedImages : undefined
      };
    }
    
    return null;
};

// 🔥 Qwen Image Edit 데이터 추출
export const getQwenImageData = (message: UIMessage) => {
    // 1. tool_results 확인 (DB 저장된 데이터)
    if ((message as any).tool_results?.qwenImageResults) {
      const generatedImages = (message as any).tool_results.qwenImageResults;
      if (Array.isArray(generatedImages) && generatedImages.length > 0) {
        const contentIndexMap = buildContentImageIndex(getMessageTextForImageOrder(message));
        const partIndexMap = buildImagePartIndexMap(
          (message as any).parts,
          'qwen_image_edit',
          'data-qwen_image_complete'
        );
        const enrichedImages = generatedImages.map((image: any) => {
          const key = image?.path || image?.imageUrl;
          const imageId = extractImageIdFromPath(image?.path);
          return {
            ...image,
            ...(key && partIndexMap.has(key) ? { partIndex: partIndexMap.get(key) } : {}),
            ...(imageId && contentIndexMap.has(imageId) ? { contentIndex: contentIndexMap.get(imageId) } : {})
          };
        });
        return { generatedImages: enrichedImages };
      }
    }
    
    // 2. parts 배열의 tool-result 확인 (스트리밍 중 데이터)
    let imagesFromToolResults: any[] = [];
    let errorCount = 0;
    let failedImages: Array<{ prompt: string; error: string; editImageUrl?: string | string[]; toolCallId?: string; index?: number }> = [];
    let completedToolCallIds: Set<string> = new Set();
    let failedToolCallIds: Set<string> = new Set();
    
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const partsArray = (message as any).parts as any[];
      let toolPartIndex = 0;
      
      for (let partIdx = 0; partIdx < partsArray.length; partIdx++) {
        const part = partsArray[partIdx];
        const isToolResult = part?.type === 'tool-result' || part?.type?.startsWith('tool-qwen_image_edit');
        const isQwenTool = part?.toolName === 'qwen_image_edit' || part?.type?.includes('qwen_image_edit');
        
        if (!isToolResult || !isQwenTool) continue;
        
        const result = part.output?.value || part.output || part.result;
        const toolCallId = part.toolCallId;
        
        if (result?.success === false) {
          errorCount++;
          if (toolCallId) failedToolCallIds.add(toolCallId);
          failedImages.push({
            prompt: result.prompt || 'Unknown prompt',
            error: result.error || 'Unknown error',
            editImageUrl: result.editImageUrl,
            toolCallId,
            index: toolPartIndex
          });
          toolPartIndex++;
          continue;
        }
        
        if (result?.images && Array.isArray(result.images)) {
          if (toolCallId) completedToolCallIds.add(toolCallId);
          for (const img of result.images) {
            if (img.imageUrl && img.path) {
              imagesFromToolResults.push({
                ...img,
                generatedBy: 'qwen',
                toolCallId,
                partIndex: partIdx
              });
            }
          }
        } else if (result?.imageUrl && result?.path) {
          if (toolCallId) completedToolCallIds.add(toolCallId);
          imagesFromToolResults.push({
            ...result,
            generatedBy: 'qwen',
            toolCallId,
            partIndex: partIdx
          });
        }
        toolPartIndex++;
      }
    }
    
    // 3. streaming annotations 확인
    // 🔥 pendingItems로 개별 항목 추적
    let pendingPrompts: string[] = [];
    let pendingEditImageUrls: (string | string[] | undefined)[] = [];
    let pendingItems: Array<{ prompt: string; editImageUrl?: string | string[]; index: number; id?: string }> = [];
    
    let imageAnnotations: any[] = [];
    let startedCount = 0;
    
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const partsArr = (message as any).parts as any[];
      
      // 🔥 parts 배열 순회하면서 각 타입별로 partIndex 추적
      const imageParts: Array<{ part: any; partIndex: number }> = [];
      const imageStartParts: Array<{ part: any; partIndex: number }> = [];
      const errorParts: Array<{ part: any; partIndex: number }> = [];
      
      for (let idx = 0; idx < partsArr.length; idx++) {
        const p = partsArr[idx];
        if (p?.type === 'data-qwen_image_complete') {
          imageParts.push({ part: p, partIndex: idx });
        } else if (p?.type === 'data-qwen_image_started') {
          imageStartParts.push({ part: p, partIndex: idx });
        } else if (p?.type === 'data-qwen_image_error') {
          errorParts.push({ part: p, partIndex: idx });
        }
      }
      
      // Check for error annotations
      // Extract failed images from error annotations
      for (let i = 0; i < errorParts.length; i++) {
        const { part: errorPart } = errorParts[i];
        if (errorPart.data) {
          // 🔥 중복 방지: toolCallId로 이미 추가된 에러인지 확인
          const existingError = failedImages.find(f => 
            f.prompt === errorPart.data.prompt && 
            f.editImageUrl === errorPart.data.editImageUrl
          );
          if (!existingError) {
            failedImages.push({
              prompt: errorPart.data.prompt || 'Unknown prompt',
              error: errorPart.data.error || 'Unknown error',
              editImageUrl: errorPart.data.editImageUrl,
              index: failedImages.length
            });
            errorCount++;
          }
        }
      }
      
      // 🔥 imageAnnotations에 partIndex 포함
      imageAnnotations = [
        ...imageAnnotations,
        ...imageParts.map(({ part, partIndex }) => part.data ? { ...part.data, partIndex } : null).filter(Boolean)
      ];
      startedCount = Math.max(startedCount, imageStartParts.length);
      
      // 🔥 개별 pending 항목 추적 (인덱스 기반)
      for (let i = 0; i < imageStartParts.length; i++) {
        const { part: startPart } = imageStartParts[i];
        pendingItems.push({
          prompt: startPart.data?.prompt || '',
          editImageUrl: startPart.data?.resolvedEditImageUrl || startPart.data?.editImageUrl,
          index: i,
          id: startPart.id
        });
      }
      
      // Extract prompts and editImageUrls from started signals
      pendingPrompts = imageStartParts
        .map(({ part: p }) => p.data?.prompt)
        .filter(Boolean);
      
      // Use resolved URL if available, otherwise fall back to editImageUrl reference
      pendingEditImageUrls = imageStartParts
        .map(({ part: p }) => {
          // Prefer resolved URL (actual URL) over reference
          if (p.data?.resolvedEditImageUrl) {
            return p.data.resolvedEditImageUrl;
          }
          return p.data?.editImageUrl;
        })
        .filter(url => url !== undefined);
    }
    
    // 🔥 모든 이미지 소스 통합 (tool-result + data-annotations)
    // ⚠️ 중복 제거: tool-result와 data-annotation에 같은 이미지가 있을 수 있음
    // 🔥 path를 우선적으로 사용 (같은 path를 가진 이미지는 같은 이미지로 간주)
    const seenKeys = new Set<string>();
    const allGeneratedImages = [...imagesFromToolResults, ...imageAnnotations].filter(img => {
      // path가 있으면 path를 우선 사용, 없으면 imageUrl 사용
      const key = img.path || img.imageUrl;
      if (!key || seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    
    // 🔥 완료+에러 수를 고려한 정확한 pending 계산
    const completedCount = allGeneratedImages.length;
    const actualPendingCount = Math.max(0, startedCount - completedCount - errorCount);
    
    // 🔥 실제로 pending인 항목만 필터링 (완료되지도 실패하지도 않은 것)
    const trulyPendingItems = pendingItems.filter((item, idx) => {
      // 인덱스 기반으로 완료 또는 실패 여부 확인
      const isCompleted = idx < completedCount;
      const isFailed = failedImages.some(f => f.index === idx);
      return !isCompleted && !isFailed;
    });
    
    // Return streaming data if available
    if (startedCount > 0 || allGeneratedImages.length > 0 || errorCount > 0) {
      // 상태 결정: 모든 작업이 완료되었는지 확인
      let status: 'processing' | 'completed' | 'error';
      if (actualPendingCount > 0) {
        status = 'processing';
      } else if (allGeneratedImages.length > 0) {
        status = 'completed';
      } else if (errorCount > 0) {
        status = 'error';
      } else {
        status = 'processing';
      }
      
      return { 
        generatedImages: allGeneratedImages,
        status,
        startedCount,
        pendingCount: actualPendingCount,
        pendingPrompts,
        pendingEditImageUrls,
        pendingItems: trulyPendingItems, // 🔥 실제 pending 항목만
        errorCount: errorCount > 0 ? errorCount : undefined,
        failedImages: failedImages.length > 0 ? failedImages : undefined
      };
    }
    
    return null;
};

// Extract image generator data from message annotations and tool_results
export const getImageGeneratorData = (message: UIMessage) => {
    // Check if there are stored generated images in tool_results
    if ((message as any).tool_results?.generatedImages) {
      const generatedImages = (message as any).tool_results.generatedImages;
      if (Array.isArray(generatedImages) && generatedImages.length > 0) {
        return { generatedImages };
      }
    }
    
    // Check for image generator annotations
    let imageAnnotations: any[] = [];
    let startedCount = 0;
    
    // Check annotations array (legacy format)
    if ((message as any).annotations) {
      imageAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'generated_image')
        .map(a => a.data)
        .filter(Boolean);
      
      const startAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'image_generation_started');
      
      startedCount = startAnnotations.length;
    }
    
    // Check parts array for streaming annotations (AI SDK 5 format)
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const imageParts = ((message as any).parts as any[])
        .filter(p => p?.type === 'data-generated_image');
      
      const imageStartParts = ((message as any).parts as any[])
        .filter(p => p?.type === 'data-image_generation_started');
      
      imageAnnotations = [
        ...imageAnnotations,
        ...imageParts.map(p => p.data).filter(Boolean)
      ];
      startedCount = Math.max(startedCount, imageStartParts.length);
    }
    
    // 시작 신호가 있거나 이미지가 있으면 반환
    if (startedCount > 0 || imageAnnotations.length > 0) {
      const completedCount = imageAnnotations.length;
      const pendingCount = Math.max(0, startedCount - completedCount);
      
      return { 
        generatedImages: imageAnnotations,
        status: completedCount > 0 ? 'completed' : 'processing',
        startedCount,
        pendingCount
      };
    }
    
    return null;
  };

  




  // Extract Twitter search data from message annotations and tool_results
  export const getTwitterSearchData = (message: UIMessage) => {
    if (!message) return null;
  
    const normalizeSearches = (searches: any[]) => {
      if (!Array.isArray(searches)) return [];
      return searches.map(search => ({
        ...search,
        topic: search.topic || 'twitter',
        topicIcon: 'twitter',
        results: (search.results || []).map((result: any) => ({
          ...result,
          topic: 'twitter',
          topicIcon: 'twitter'
        })),
        images: search.images || []
      }));
    };
  
  const mapFromToolResults = () => {
    if ((message as any).tool_results?.twitterSearchResults) {
      const twitterResults = (message as any).tool_results.twitterSearchResults;
      if (Array.isArray(twitterResults) && twitterResults.length > 0) {
        const resultWithMaps = twitterResults.find((result: any) => 
          result.linkMap || result.thumbnailMap || result.titleMap || result.imageMap || result.linkMetaMap
        ) || twitterResults[0];

        const processedResults = twitterResults
          .filter((result: any) => result.searches && Array.isArray(result.searches))
          .map((result: any) => ({
            searchId: result.searchId || `twitter_${Date.now()}`,
            searches: normalizeSearches(result.searches),
            isComplete: true
          }));

        if (processedResults.length > 0) {
          const thumbnailMap = buildThumbnailUrlMap(resultWithMaps?.thumbnailMap || {}, resultWithMaps?.linkMap || {});
          const finalData = {
            result: null,
            args: null,
            annotations: [],
            results: processedResults,
            imageMap: resultWithMaps?.imageMap || {},
            linkMap: resultWithMaps?.linkMap || {},
            thumbnailMap,
            titleMap: resultWithMaps?.titleMap || {},
            linkMetaMap: resultWithMaps?.linkMetaMap || {}
          };
          
          return finalData;
        }
      }
    }
    return null;
  };
  
    const storedResult = mapFromToolResults();
    if (storedResult) return storedResult;
  
    // Gather streaming annotations
    let twitterCompletions: any[] = [];
    let startedCount = 0;
    
    if ((message as any).annotations) {
      twitterCompletions = ((message as any).annotations as any[]).filter(
        a => a?.type === 'twitter_search_complete'
      );
      
      const startAnnotations = ((message as any).annotations as any[]).filter(
        a => a?.type === 'twitter_search_started'
      );
      startedCount = startAnnotations.length;
    }
  
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const completionParts = ((message as any).parts as any[]).filter(
        p => p?.type === 'data-twitter_search_complete'
      );
      const startParts = ((message as any).parts as any[]).filter(
        p => p?.type === 'data-twitter_search_started'
      );
      
      twitterCompletions = [
        ...twitterCompletions,
        ...completionParts.map(p => ({ type: 'twitter_search_complete', data: p.data }))
      ];
      startedCount = Math.max(startedCount, startParts.length);
    }
  
    if (twitterCompletions.length > 0) {
      const processedResults = twitterCompletions
        .filter(completion => completion.data?.searches)
        .map(completion => ({
          searchId: completion.data?.searchId || `twitter_${Date.now()}`,
          searches: normalizeSearches(completion.data.searches),
          isComplete: true
        }));

      if (processedResults.length > 0) {
        // Extract imageMap, linkMap, thumbnailMap, titleMap, linkMetaMap from annotations
        let imageMap: { [key: string]: string } = {};
        let linkMap: { [key: string]: string } = {};
        let rawThumbnailMap: { [key: string]: string } = {};
        let titleMap: { [key: string]: string } = {};
        let linkMetaMap: { [key: string]: any } = {};
        
        twitterCompletions.forEach(completion => {
          if (completion.data?.imageMap) {
            imageMap = { ...imageMap, ...completion.data.imageMap };
          }
          if (completion.data?.linkMap) {
            linkMap = { ...linkMap, ...completion.data.linkMap };
          }
          if (completion.data?.thumbnailMap) {
            rawThumbnailMap = { ...rawThumbnailMap, ...completion.data.thumbnailMap };
          }
          if (completion.data?.titleMap) {
            titleMap = { ...titleMap, ...completion.data.titleMap };
          }
          if (completion.data?.linkMetaMap) {
            linkMetaMap = { ...linkMetaMap, ...completion.data.linkMetaMap };
          }
        });

        const thumbnailMap = buildThumbnailUrlMap(rawThumbnailMap, linkMap);
        
        const completedCount = processedResults.length;
        const pendingCount = Math.max(0, startedCount - completedCount);

        return {
          result: null,
          args: null,
          annotations: twitterCompletions,
          results: processedResults,
          imageMap,
          linkMap,
          thumbnailMap,
          titleMap,
          linkMetaMap,
          startedCount,
          pendingCount
        };
      }
    }
    
    // Return started signal even if no completions yet
    if (startedCount > 0) {
      return {
        result: null,
        args: null,
        annotations: [],
        results: [],
        imageMap: {},
        linkMap: {},
        thumbnailMap: {},
        titleMap: {},
        linkMetaMap: {},
        startedCount,
        pendingCount: startedCount
      };
    }
  
    return null;
  };
  

  // Extract YouTube search data from message annotations and tool_results
  export const getYouTubeSearchData = (message: UIMessage) => {
    // Check if there are stored YouTube search results in tool_results
    if ((message as any).tool_results?.youtubeSearchResults) {
      const youtubeResults = (message as any).tool_results.youtubeSearchResults;
      if (Array.isArray(youtubeResults)) {
        return { 
          youtubeResults,
          status: youtubeResults.length > 0 ? 'completed' : 'processing',
          startedCount: youtubeResults.length > 0 ? youtubeResults.length : 1,
          pendingCount: youtubeResults.length > 0 ? 0 : 1
        };
      }
    }
    
    // Check for YouTube search annotations and parts
    let youtubeSearchAnnotations: any[] = [];
    let startedCount = 0;
    
    // Check annotations array (legacy format)
    if ((message as any).annotations) {
      const completeAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'youtube_search_complete')
        .map(a => a.data)
        .filter(Boolean);
      
      const startAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'youtube_search_started');
      
      youtubeSearchAnnotations = completeAnnotations;
      startedCount = startAnnotations.length;
    }
    
    // Check parts array for streaming annotations (AI SDK 5 format)
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const youtubeCompleteParts = ((message as any).parts as any[])
        .filter(p => p?.type === 'data-youtube_search_complete');
      
      const youtubeStartParts = ((message as any).parts as any[])
        .filter(p => p?.type === 'data-youtube_search_started');
      
      youtubeSearchAnnotations = [
        ...youtubeSearchAnnotations,
        ...youtubeCompleteParts.map(p => p.data).filter(Boolean)
      ];
      startedCount = Math.max(startedCount, youtubeStartParts.length);
      
      // Extract query from started parts for loading state display
      const startedQueries = youtubeStartParts
        .map(p => p.data?.query)
        .filter(Boolean);
      
      // If we have started signals but no complete results, include query info
      if (startedQueries.length > 0 && youtubeSearchAnnotations.length === 0) {
        // Return structure with query info for loading display
        return {
          youtubeResults: [],
          status: 'processing',
          startedCount: startedCount,
          pendingCount: startedCount,
          query: startedQueries[0] // Use first query for display
        };
      }
    }
    
    // 시작 신호가 있거나 완료 결과가 있으면 반환
    if (startedCount > 0 || youtubeSearchAnnotations.length > 0) {
      const completedCount = youtubeSearchAnnotations.length;
      const pendingCount = Math.max(0, startedCount - completedCount);
      
      return { 
        youtubeResults: youtubeSearchAnnotations,
        status: completedCount > 0 ? 'completed' : 'processing',
        startedCount,
        pendingCount
      };
    }
    
    return null;
  };

  

  // Extract Google search data from message annotations and tool_results
  export const getGoogleSearchData = (message: UIMessage) => {
    if (!message) return null;
    
    // Check if there are stored Google search results in tool_results
    if ((message as any).tool_results?.googleSearchResults) {
      const googleResults = (message as any).tool_results.googleSearchResults;
      if (Array.isArray(googleResults) && googleResults.length > 0) {
        // Process stored results to match the expected format
        // Since we now use a single unified object, get maps from the first result that has them
        const resultWithMaps = googleResults.find((result: any) => 
          result.linkMap || result.thumbnailMap || result.titleMap || result.imageMap || result.linkMetaMap
        ) || googleResults[0];
        
        const processedResults = googleResults
          .filter((result: any) => result.searches && Array.isArray(result.searches))
          .map((result: any) => ({
            searchId: result.searchId,
            searches: result.searches.map((search: any) => ({
              ...search,
              topic: search.topic || search.engine || 'google',
              topicIcon: 'google',
              results: search.results || [],
              images: search.images || [],
              videos: search.videos || []
            })),
            isComplete: true
          }));
        
        if (processedResults.length > 0) {
          // IMPORTANT:
          // Some DB-saved `tool_results.googleSearchResults` entries do not persist `linkMap`,
          // but the same message often contains `parts` with `data-google_search_complete` which DOES.
          // Merge both sources so chat rendering can resolve `[LINK_ID:...]` reliably.
          let imageMap: { [key: string]: string } = { ...(resultWithMaps?.imageMap || {}) };
          let linkMap: { [key: string]: string } = { ...(resultWithMaps?.linkMap || {}) };
          let rawThumbnailMap: { [key: string]: string } = { ...(resultWithMaps?.thumbnailMap || {}) };
          let titleMap: { [key: string]: string } = { ...(resultWithMaps?.titleMap || {}) };
          let linkMetaMap: { [key: string]: any } = { ...(resultWithMaps?.linkMetaMap || {}) };

          // Legacy annotations (if present on the in-memory UIMessage)
          if ((message as any).annotations && Array.isArray((message as any).annotations)) {
            (((message as any).annotations) as any[])
              .filter((a: any) => a?.type === 'google_search_complete' && a?.data)
              .forEach((a: any) => {
                if (a.data.imageMap) imageMap = { ...imageMap, ...a.data.imageMap };
                if (a.data.linkMap) linkMap = { ...linkMap, ...a.data.linkMap };
                if (a.data.thumbnailMap) rawThumbnailMap = { ...rawThumbnailMap, ...a.data.thumbnailMap };
                if (a.data.titleMap) titleMap = { ...titleMap, ...a.data.titleMap };
                if (a.data.linkMetaMap) linkMetaMap = { ...linkMetaMap, ...a.data.linkMetaMap };
              });
          }

          // AI SDK v5 streaming parts
          if ((message as any).parts && Array.isArray((message as any).parts)) {
            (((message as any).parts) as any[])
              .filter((p: any) => p?.type === 'data-google_search_complete' && p?.data)
              .forEach((p: any) => {
                const data = p.data;
                if (data.imageMap) imageMap = { ...imageMap, ...data.imageMap };
                if (data.linkMap) linkMap = { ...linkMap, ...data.linkMap };
                if (data.thumbnailMap) rawThumbnailMap = { ...rawThumbnailMap, ...data.thumbnailMap };
                if (data.titleMap) titleMap = { ...titleMap, ...data.titleMap };
                if (data.linkMetaMap) linkMetaMap = { ...linkMetaMap, ...data.linkMetaMap };
              });
          }

          const thumbnailMap = buildThumbnailUrlMap(rawThumbnailMap || {}, linkMap || {});
          return {
            result: null,
            args: null,
            annotations: [],
            results: processedResults,
            imageMap,
            linkMap,
            thumbnailMap,
            titleMap,
            linkMetaMap
          };
        }
      }
    }
    
    // Get query completion annotations - check both annotations and parts for AI SDK 5 compatibility
    let queryCompletions: any[] = [];
    let googleSearchCompletions: any[] = [];
    let startedCount = 0;
    
    // Check annotations array (legacy format)
    if ((message as any).annotations) {
      queryCompletions = ((message as any).annotations as any[]).filter(a => 
        a?.type === 'google_search_started' || a?.type === 'google_search_query_complete'
      );
      googleSearchCompletions = ((message as any).annotations as any[]).filter(a => a?.type === 'google_search_complete');
      
      const startAnnotations = ((message as any).annotations as any[]).filter(a => 
        a?.type === 'google_search_started'
      );
      startedCount = startAnnotations.length;
    }
    
    // Check parts array for streaming annotations (AI SDK 5 format)
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const queryParts = ((message as any).parts as any[]).filter(p => 
        p?.type === 'data-google_search_started' || p?.type === 'data-google_search_query_complete'
      );
      const googleSearchParts = ((message as any).parts as any[]).filter(p => p?.type === 'data-google_search_complete');
      const startParts = ((message as any).parts as any[]).filter(p => 
        p?.type === 'data-google_search_started'
      );
      
      // Convert parts format to annotations format for consistency
      queryCompletions = [
        ...queryCompletions,
        ...queryParts.map(p => ({ 
          type: p.type === 'data-google_search_started' ? 'google_search_started' : 'google_search_query_complete', 
          data: p.data 
        }))
      ];
      googleSearchCompletions = [
        ...googleSearchCompletions,
        ...googleSearchParts.map(p => ({ type: 'google_search_complete', data: p.data }))
      ];
      startedCount = Math.max(startedCount, startParts.length);
    }

    // Extract imageMap, linkMap, thumbnailMap, titleMap from annotations
    let imageMap: { [key: string]: string } = {};
    let linkMap: { [key: string]: string } = {};
    let rawThumbnailMap: { [key: string]: string } = {};
    let titleMap: { [key: string]: string } = {};
    let linkMetaMap: { [key: string]: any } = {};
    
    googleSearchCompletions.forEach(completion => {
      if (completion.data?.imageMap) {
        imageMap = { ...imageMap, ...completion.data.imageMap };
      }
      if (completion.data?.linkMap) {
        linkMap = { ...linkMap, ...completion.data.linkMap };
      }
      if (completion.data?.thumbnailMap) {
        rawThumbnailMap = { ...rawThumbnailMap, ...completion.data.thumbnailMap };
      }
      if (completion.data?.titleMap) {
        titleMap = { ...titleMap, ...completion.data.titleMap };
      }
      if (completion.data?.linkMetaMap) {
        linkMetaMap = { ...linkMetaMap, ...completion.data.linkMetaMap };
      }
    });

    // Group query completions by searchId
    const queryCompletionsBySearchId = new Map<string, any[]>();
    queryCompletions.forEach(completion => {
      const searchId = completion.data?.searchId || 'default';
      if (!queryCompletionsBySearchId.has(searchId)) {
        queryCompletionsBySearchId.set(searchId, []);
      }
      queryCompletionsBySearchId.get(searchId)?.push(completion);
    });

    // Get all searchIds from query completions (including the latest one)
    const searchIds = Array.from(queryCompletionsBySearchId.keys()).filter(id => id !== 'default');
    // Latest searchId for determining which search is currently in progress
    const latestSearchId = searchIds.length > 0 ? searchIds[searchIds.length - 1] : null;
    
    // Track completed searches and in-progress searches separately
    const completedSearchIdSet = new Set<string>();
    const allResults: any[] = [];

    // Process Google search completions to determine which searches are complete
    if (googleSearchCompletions.length > 0) {
      // Group Google search completions by searchId
      const googleSearchCompletionsBySearchId = new Map<string, any[]>();
      googleSearchCompletions.forEach(completion => {
        const searchId = completion.data?.searchId || 'default';
        if (!googleSearchCompletionsBySearchId.has(searchId)) {
          googleSearchCompletionsBySearchId.set(searchId, []);
        }
        googleSearchCompletionsBySearchId.get(searchId)?.push(completion);
        
        // Mark this searchId as completed
        if (searchId !== 'default') {
          completedSearchIdSet.add(searchId);
        }
      });
      
      // Process all completed Google searches
      for (const [searchId, completions] of googleSearchCompletionsBySearchId.entries()) {
        if (searchId === 'default') continue;
        
        // Extract all searches from this searchId
        // completion.data.searches already contains the correct format
        const searchesForThisId: any[] = [];
        
        completions.forEach(completion => {
          if (completion.data && completion.data.searches) {
            searchesForThisId.push(...completion.data.searches);
          }
        });
        
        if (searchesForThisId.length > 0) {
          // Add this completed searchId result to our collection
          // searches already have the correct format, just ensure topicIcon is set
          allResults.push({
            searchId,
            searches: searchesForThisId.map(search => ({
              ...search,
              topic: search.topic || search.engine || 'google',
              topicIcon: 'google',
              results: search.results || [],
              images: search.images || [],
              videos: search.videos || []
            })),
            isComplete: true
          });
        }
      }
    }
    
    // 진행 중인 검색 처리
    let inProgressSearchIds = new Set<string>();
    if (latestSearchId && !completedSearchIdSet.has(latestSearchId)) {
      inProgressSearchIds.add(latestSearchId);
    }
    
    // 모든 진행 중인 검색 ID에 대해 쿼리 상태 처리
    for (const searchId of inProgressSearchIds) {
      const latestQueryCompletions = queryCompletionsBySearchId.get(searchId) || [];
      
      // 진행 중인 검색이 있는 경우에만 추가
      if (latestQueryCompletions.length > 0) {
        allResults.push({
          searchId,
          searches: [{
            query: latestQueryCompletions[0]?.data?.query || 'Searching...',
            topic: latestQueryCompletions[0]?.data?.topic || 'google',
            topicIcon: 'google',
            results: [],
            images: [],
            videos: []
          }],
          isComplete: false,
          // 모든 쿼리 완료 어노테이션을 보존
          annotations: latestQueryCompletions
        });
      }
    }
    
    // If we've found results via annotations, return them
    if (allResults.length > 0 || startedCount > 0) {
      const thumbnailMap = buildThumbnailUrlMap(rawThumbnailMap, linkMap);
      const completedCount = allResults.filter(r => r.isComplete).length;
      const pendingCount = Math.max(0, startedCount - completedCount);
      
      return {
        result: null, // For backward compatibility
        args: null,
        annotations: queryCompletions,
        results: allResults,
        imageMap,
        linkMap,
        thumbnailMap,
        titleMap,
        linkMetaMap,
        startedCount,
        pendingCount
      };
    }
    
    // Check for stored tool results as a fallback
    if ((message as any).tool_results) {
      const toolResults = (message as any).tool_results;
      
      // Extract maps from tool_results
      if (toolResults.googleSearchResults) {
        toolResults.googleSearchResults.forEach((result: any) => {
          if (result.imageMap) {
            imageMap = { ...imageMap, ...result.imageMap };
          }
          if (result.linkMap) {
            linkMap = { ...linkMap, ...result.linkMap };
          }
          if (result.thumbnailMap) {
            rawThumbnailMap = { ...rawThumbnailMap, ...result.thumbnailMap };
          }
          if (result.titleMap) {
            titleMap = { ...titleMap, ...result.titleMap };
          }
          if (result.linkMetaMap) {
            linkMetaMap = { ...linkMetaMap, ...result.linkMetaMap };
          }
        });
      }
      
      // Handle both new and legacy formats
      let storedResults: any[] = [];
      
      if (toolResults.googleSearchResults) {
        // New format with googleSearchResults key
        if (Array.isArray(toolResults.googleSearchResults)) {
          // Process all results with searchIds
          // If result already has searches array, use it directly
          const resultsWithIds = toolResults.googleSearchResults.filter((r: any) => r.searchId);
          
          // Create a result entry for each unique searchId
          const processedIds = new Set<string>();
          
          resultsWithIds.forEach((result: any) => {
            const searchId = result.searchId;
            if (searchId && !processedIds.has(searchId)) {
              processedIds.add(searchId);
              
              // If result already has searches array, use it directly
              if (result.searches && Array.isArray(result.searches)) {
                storedResults.push({
                  searchId,
                  searches: result.searches.map((search: any) => ({
                    ...search,
                    topic: search.topic || search.engine || 'google',
                    topicIcon: 'google',
                    results: search.results || [],
                    images: search.images || [],
                    videos: search.videos || []
                  })),
                  isComplete: true
                });
              } else {
                // Legacy format: single query/result structure
                storedResults.push({
                  searchId,
                  searches: [{
                    query: result.query || 'Google Search',
                    topic: result.topic || 'google',
                    topicIcon: 'google',
                    results: result.results || [],
                    images: result.images || [],
                    videos: result.videos || []
                  }],
                  isComplete: true
                });
              }
            }
          });
          
          // Handle results without searchId (legacy)
          if (storedResults.length === 0) {
            const mergedSearches = toolResults.googleSearchResults.flatMap((r: any) => {
              // If result has searches array, use it
              if (r.searches && Array.isArray(r.searches)) {
                return r.searches;
              }
              // Otherwise, treat as legacy format (results array)
              return r.results || [];
            });
            if (mergedSearches.length > 0) {
              // Check if mergedSearches contains search objects or result objects
              const firstItem = mergedSearches[0];
              const isSearchObjects = firstItem && (firstItem.query !== undefined || firstItem.topic !== undefined);
              
              storedResults.push({
                searchId: 'legacy',
                searches: isSearchObjects ? mergedSearches : [{
                  query: 'Google Search',
                  topic: 'google',
                  topicIcon: 'google',
                  results: mergedSearches,
                  images: [],
                  videos: []
                }],
                isComplete: true
              });
            }
          }
        }
      }
      
      if (storedResults.length > 0) {
        const thumbnailMap = buildThumbnailUrlMap(rawThumbnailMap, linkMap);
        return {
          result: null, // For backward compatibility
          args: null,
          annotations: queryCompletions,
          results: storedResults,
          imageMap,
          linkMap,
          thumbnailMap,
          titleMap,
          linkMetaMap
        };
      }
    }
    
    // If no parts property or it's empty, return null or loading state
    if (!message.parts || message.parts.length === 0) {
      // If we have query completions, we can show a loading state
      if (queryCompletions.length > 0) {
        return {
          result: null, // For backward compatibility
          args: { q: '', location: '', gl: '' },
          annotations: queryCompletions,
          results: [{
            searchId: latestSearchId || 'default',
            searches: [{
              query: 'Searching...',
              topic: 'google',
              topicIcon: 'google',
              results: [],
              images: [],
              videos: []
            }],
            isComplete: false,
            annotations: queryCompletions
          }],
          imageMap
        };
      }
      return null;
    }
    
    // Collect all results and args from tool invocations
    const allInvocationResults: any[] = [];
    const allArgs: any[] = [];
    const processedSearchIds = new Set<string>();
    
    for (const part of message.parts || []) {
      // v5 UI tool parts are typed as `tool-<name>`; handle both dynamic and static
      if (part && typeof (part as any).type === 'string' && (part as any).type.startsWith('tool-')) {
        try {
          const toolName = (part as any).type.slice('tool-'.length);
          if (toolName !== 'google_search') continue;
          const input = (part as any).input;
          const output = (part as any).output;
          if (input) allArgs.push(JSON.parse(JSON.stringify(input)));
          if (output) {
            const result = JSON.parse(JSON.stringify(output));
            
            // Extract imageMap from invocation result
            if (result.imageMap) {
              imageMap = { ...imageMap, ...result.imageMap };
            }
            
            if (result.searchId && !processedSearchIds.has(result.searchId)) {
              processedSearchIds.add(result.searchId);
              
              // Check if new structure with searches array
              if (result.searches && Array.isArray(result.searches)) {
                allInvocationResults.push({
                  searchId: result.searchId,
                  searches: result.searches.map((search: any) => ({
                    query: search.query,
                    topic: search.topic || 'google',
                    topicIcon: 'google',
                    results: search.results || [],
                    images: search.images || [],
                    videos: search.videos || []
                  })),
                  isComplete: true
                });
              } else {
                // Legacy single query structure
                allInvocationResults.push({
                  searchId: result.searchId,
                  searches: [{
                    query: result.query || 'Google Search',
                    topic: result.topic || 'google',
                    topicIcon: 'google',
                    results: result.results || [],
                    images: result.images || [],
                    videos: result.videos || []
                  }],
                  isComplete: true
                });
              }
            } else if (!result.searchId) {
              // Legacy result without searchId
              allInvocationResults.push({
                searchId: 'legacy_invocation',
                searches: [{
                  query: 'Google Search',
                  topic: result.topic || 'google',
                  topicIcon: 'google',
                  results: result.results || [],
                  images: result.images || [],
                  videos: result.videos || []
                }],
                isComplete: true
              });
            }
          }
        } catch (error) {
          console.error('Error parsing Google search results:', error);
        }
      }
    }
    
    // Check google_search_complete annotations if we didn't find results in invocations
    if ((message as any).annotations && allInvocationResults.length === 0) {
      const googleSearchAnnotations = ((message as any).annotations as any[])
        .filter(a => a?.type === 'google_search_complete');
      
      if (googleSearchAnnotations.length > 0) {
        // Group annotations by searchId
        const annotationsBySearchId = new Map<string, any[]>();
        
        googleSearchAnnotations.forEach(annotation => {
          const searchId = annotation.data?.searchId || 'default';
          if (!annotationsBySearchId.has(searchId)) {
            annotationsBySearchId.set(searchId, []);
          }
          annotationsBySearchId.get(searchId)?.push(annotation);
        });
        
        // Process each searchId group
        for (const [searchId, annotations] of annotationsBySearchId.entries()) {
          if (searchId === 'default') continue;
          
          const searches = annotations
            .filter(a => a.data?.results)
            .map(a => ({
              query: a.data.query,
              topic: a.data.topic || 'google',
              topicIcon: 'google',
              results: a.data.results || [],
              images: a.data.images || [],
              videos: a.data.videos || []
            }));
          
          if (searches.length > 0) {
            allInvocationResults.push({
              searchId,
              searches,
              isComplete: true
            });
          }
        }
      }
    }
    
    // If we have results from invocations or annotations
    if (allInvocationResults.length > 0) {
      // Check if latest searchId is still in progress
      if (latestSearchId && !processedSearchIds.has(latestSearchId) && 
          queryCompletionsBySearchId.has(latestSearchId)) {
        // Add in-progress search
        allInvocationResults.push({
          searchId: latestSearchId,
          searches: [{
            query: 'Searching...',
            topic: 'google',
            topicIcon: 'google',
            results: [],
            images: [],
            videos: []
          }],
          isComplete: false,
          annotations: queryCompletionsBySearchId.get(latestSearchId)
        });
      }
      
      const thumbnailMap = buildThumbnailUrlMap(rawThumbnailMap, linkMap);
      return {
        result: null, // For backward compatibility 
        args: allArgs[0] || null,
        annotations: queryCompletions,
        results: allInvocationResults,
        imageMap,
        linkMap,
        thumbnailMap,
        titleMap
      };
    }
    
    // Extract queries for loading state
    if (allArgs.length > 0) {
      const thumbnailMap = buildThumbnailUrlMap(rawThumbnailMap, linkMap);
      return {
        result: null, // For backward compatibility
        args: allArgs[0],
        annotations: queryCompletions,
        results: [{
          searchId: latestSearchId || 'default',
          searches: [{
            query: 'Searching...',
            topic: 'google',
            topicIcon: 'google',
            results: [],
            images: [],
            videos: []
          }],
          isComplete: false,
          annotations: queryCompletions
        }],
        imageMap,
        linkMap,
        thumbnailMap,
        titleMap
      };
    }
    
    return null;
  };

  // Extract YouTube link analysis data from message annotations and tool_results
  export const getYouTubeLinkAnalysisData = (message: UIMessage) => {
    // Check tool_results first
    if ((message as any).tool_results?.youtubeLinkAnalysisResults) {
      const analysisResults = (message as any).tool_results.youtubeLinkAnalysisResults;
      if (Array.isArray(analysisResults)) {
        return { 
          analysisResults,
          status: analysisResults.length > 0 ? 'completed' : 'processing',
          startedCount: analysisResults.length > 0 ? analysisResults.length : 1,
          pendingCount: analysisResults.length > 0 ? 0 : 1
        };
      }
    }
    
    // Check annotations and parts for YouTube analysis
    let youtubeAnalysisAnnotations: any[] = [];
    let startedCount = 0;
    
    // Check annotations array (legacy format - for backward compatibility)
    if ((message as any).annotations) {
      const completeAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && 
          (a.type === 'youtube_analysis_complete' || a.type === 'youtube_link_analysis_complete' || a.type === 'data-youtube_analysis_complete'))
        .map(a => a.data?.results || a.data)
        .filter(Boolean)
        .flat();
      
      const startAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && 
          (a.type === 'youtube_analysis_started' || a.type === 'youtube_link_analysis_started' || a.type === 'data-youtube_analysis_started'));
      
      youtubeAnalysisAnnotations = completeAnnotations;
      startedCount = Math.max(startedCount, startAnnotations.length);
    }
    
    // Check parts array for streaming annotations (AI SDK 5 format)
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const youtubeCompleteParts = ((message as any).parts as any[])
        .filter(p => p?.type === 'data-youtube_analysis_complete');
      
      const youtubeStartParts = ((message as any).parts as any[])
        .filter(p => p?.type === 'data-youtube_analysis_started');
      
      const partsResults = youtubeCompleteParts
        .map(p => p.data?.results || p.data)
        .filter(Boolean)
        .flat();
        
      youtubeAnalysisAnnotations = [
        ...youtubeAnalysisAnnotations,
        ...partsResults
      ];
      startedCount = Math.max(startedCount, youtubeStartParts.length);
      
      // Extract URLs from started parts for loading state display
      const startedUrls = youtubeStartParts
        .map(p => p.data?.urls)
        .filter(Boolean)
        .flat();
      
      // If we have started signals but no complete results, include URL info
      if (startedUrls.length > 0 && youtubeAnalysisAnnotations.length === 0) {
        // Return structure with URL info for loading display
        return {
          analysisResults: [],
          status: 'processing',
          startedCount: startedCount,
          pendingCount: startedCount,
          urls: startedUrls
        };
      }
    }
    
    // 시작 신호가 있거나 완료 결과가 있으면 반환
    if (startedCount > 0 || youtubeAnalysisAnnotations.length > 0) {
      const completedCount = youtubeAnalysisAnnotations.length;
      const pendingCount = Math.max(0, startedCount - completedCount);
      
      return { 
        analysisResults: youtubeAnalysisAnnotations,
        status: completedCount > 0 ? 'completed' : 'processing',
        startedCount,
        pendingCount
      };
    }
    
    return null;
  };

// Extract Wan 2.5 video data from message tool_results and streaming annotations
export const getWan25VideoData = (message: UIMessage): {
  generatedVideos: {
    videoUrl: string;
    prompt: string;
    timestamp: string;
    resolution?: string;
    size?: string;
    duration?: number;
    isImageToVideo?: boolean;
    sourceImageUrl?: string;
    path?: string;
  }[];
  status?: 'processing' | 'completed' | 'error';
  startedCount?: number;
  pendingCount?: number;
  pendingPrompts?: string[];
  pendingSourceImages?: string[];
  errorCount?: number;
  failedVideos?: Array<{ prompt: string; error: string }>;
  isImageToVideo: boolean;
  progress?: {
    status: string;
    elapsedSeconds: number;
    requestId: string;
  };
} | null => {
  // 1. tool_results 확인 (DB 저장된 데이터 - 최우선)
  if ((message as any).tool_results?.wan25VideoResults) {
    const generatedVideos = (message as any).tool_results.wan25VideoResults;
    if (Array.isArray(generatedVideos) && generatedVideos.length > 0) {
      const isImageToVideo = generatedVideos.some(v => v.isImageToVideo);
      return { 
        generatedVideos, 
        isImageToVideo,
        status: 'completed' as const
      };
    }
  }
  
  // 2. parts 배열의 tool-result 확인 (스트리밍 중 데이터)
  let videosFromToolResults: any[] = [];
  let errorCount = 0;
  let failedVideos: Array<{ prompt: string; error: string }> = [];
  
  if ((message as any).parts && Array.isArray((message as any).parts)) {
    const toolResultParts = ((message as any).parts as any[])
      .filter(p => {
        const isToolResult = p?.type === 'tool-result' || 
                            p?.type?.startsWith('tool-wan25_');
        const isWan25Tool = p?.toolName === 'wan25_video' ||
                          p?.type?.includes('wan25_');
        return isToolResult && isWan25Tool;
      });
    
    for (const part of toolResultParts) {
      const result = part.output?.value || part.output || part.result;
      
      if (result?.success === false) {
        errorCount++;
        failedVideos.push({
          prompt: result.prompt || 'Unknown prompt',
          error: result.error || 'Unknown error'
        });
        continue;
      }
      
      if (result?.videos && Array.isArray(result.videos)) {
        for (const vid of result.videos) {
          if (vid.videoUrl && vid.path) {
            videosFromToolResults.push({
              videoUrl: vid.videoUrl,
              path: vid.path,
              prompt: vid.prompt || result.prompt,
              timestamp: vid.timestamp || new Date().toISOString(),
              resolution: vid.resolution,
              size: vid.size,
              duration: vid.duration,
              isImageToVideo: vid.isImageToVideo,
              sourceImageUrl: vid.sourceImageUrl
            });
          }
        }
      }
    }
    
    if (videosFromToolResults.length > 0) {
      // Determine tool type from videos
      const hasImageToVideo = videosFromToolResults.some(v => v.isImageToVideo);

      return { 
        generatedVideos: videosFromToolResults,
        status: 'completed' as const,
        errorCount,
        failedVideos: failedVideos.length > 0 ? failedVideos : undefined,
        isImageToVideo: hasImageToVideo
      };
    }
  }
  
  // 3. streaming annotations 확인 (fallback)
  let videoAnnotations: any[] = [];
  let startedCount = 0;
  let pendingPrompts: string[] = [];
  let pendingSourceImages: string[] = [];
  let hasImageToVideoStreaming = false;
  let progressData: { status: string; elapsedSeconds: number; requestId: string } | undefined;
  
  if ((message as any).annotations) {
    const completeAnnotations = (((message as any).annotations) as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'wan25_video_complete')
      .map(a => a.data)
      .filter(Boolean);
    
    videoAnnotations = [...videoAnnotations, ...completeAnnotations];
    if (completeAnnotations.some(v => v.isImageToVideo)) hasImageToVideoStreaming = true;
    
    const startAnnotations = (((message as any).annotations) as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'wan25_video_started');
    
    startedCount = startAnnotations.length;
    
    startAnnotations.forEach(a => {
      if (a.data?.prompt) pendingPrompts.push(a.data.prompt);
      if (a.data?.resolvedImageUrl) {
        pendingSourceImages.push(a.data.resolvedImageUrl);
        hasImageToVideoStreaming = true;
      }
      else pendingSourceImages.push(''); // 텍스트-비디오의 경우 빈 값
    });
    
    // 🚀 Progress annotation 추출 (annotations에서)
    const progressAnnotations = (((message as any).annotations) as any[])
      .filter(a => a && typeof a === 'object' && 
        (a.type === 'wan25_video_progress' || a.type === 'data-wan25_video_progress'));
    
    if (progressAnnotations.length > 0) {
      // 가장 최신 progress 사용 (마지막 항목)
      const latestProgress = progressAnnotations[progressAnnotations.length - 1];
      if (latestProgress.data && latestProgress.data.status && 
          typeof latestProgress.data.elapsedSeconds === 'number' && 
          latestProgress.data.requestId) {
        progressData = {
          status: latestProgress.data.status,
          elapsedSeconds: latestProgress.data.elapsedSeconds,
          requestId: latestProgress.data.requestId
        };
      }
    }
  }
  
  if ((message as any).parts && Array.isArray((message as any).parts)) {
    const videoParts = ((message as any).parts as any[])
      .filter(p => p?.type === 'data-wan25_video_complete');
    
    const videoStartParts = ((message as any).parts as any[])
      .filter(p => p?.type === 'data-wan25_video_started');

    if (videoParts.some(p => p.data?.isImageToVideo)) hasImageToVideoStreaming = true;
    if (videoStartParts.some(p => p.data?.resolvedImageUrl)) hasImageToVideoStreaming = true;
    
    const errorParts = ((message as any).parts as any[])
      .filter(p => p?.type === 'data-wan25_video_error');
    
    for (const errorPart of errorParts) {
      if (errorPart.data) {
        failedVideos.push({
          prompt: errorPart.data.prompt || 'Unknown prompt',
          error: errorPart.data.error || 'Unknown error'
        });
        errorCount++;
      }
    }
    
    // 🚀 Progress annotation 추출 (parts에서 - annotations보다 우선)
    const progressParts = ((message as any).parts as any[])
      .filter(p => p?.type === 'data-wan25_video_progress');
    
    if (progressParts.length > 0) {
      // 가장 최신 progress 사용 (마지막 항목)
      const latestProgress = progressParts[progressParts.length - 1];
      if (latestProgress.data && latestProgress.data.status && 
          typeof latestProgress.data.elapsedSeconds === 'number' && 
          latestProgress.data.requestId) {
        progressData = {
          status: latestProgress.data.status,
          elapsedSeconds: latestProgress.data.elapsedSeconds,
          requestId: latestProgress.data.requestId
        };
      }
    }
    
    videoAnnotations = [
      ...videoAnnotations,
      ...videoParts.map(p => p.data).filter(Boolean)
    ];
    startedCount = Math.max(startedCount, videoStartParts.length);
    
    videoStartParts.forEach(p => {
      const prompt = p.data?.prompt;
      const sourceImage = p.data?.resolvedImageUrl || '';
      
      if (prompt && !pendingPrompts.includes(prompt)) {
        pendingPrompts.push(prompt);
        pendingSourceImages.push(sourceImage);
        if (sourceImage) hasImageToVideoStreaming = true;
      }
    });
  }
  
  if (startedCount > 0 || videoAnnotations.length > 0) {
    const completedCount = videoAnnotations.length;
    const pendingCount = Math.max(0, startedCount - completedCount);
    
    const isImageToVideo = hasImageToVideoStreaming || videoAnnotations.some(v => v.isImageToVideo);

    return { 
      generatedVideos: videoAnnotations,
      status: (completedCount > 0 && pendingCount === 0 ? 'completed' : 'processing') as 'completed' | 'processing',
      startedCount,
      pendingCount,
      pendingPrompts,
      pendingSourceImages,
      errorCount: errorCount > 0 ? errorCount : undefined,
      failedVideos: failedVideos.length > 0 ? failedVideos : undefined,
      isImageToVideo,
      progress: progressData
    };
  }
  
  if (errorCount > 0) {
    // Determine if it's image-to-video from available context
    let isImageToVideoError = hasImageToVideoStreaming;
    
    // Check parts for image-to-video tool calls
    if (!isImageToVideoError && (message as any).parts && Array.isArray((message as any).parts)) {
      const toolResultParts = ((message as any).parts as any[])
        .filter(p => {
          const isToolResult = p?.type === 'tool-result' || 
                              p?.type?.startsWith('tool-wan25_');
          const isWan25Tool = p?.toolName === 'wan25_video' ||
                            p?.type?.includes('wan25_');
          return isToolResult && isWan25Tool;
        });
      
      // Check if any tool result indicates image-to-video mode
      isImageToVideoError = toolResultParts.some(p => 
        p.output?.isImageToVideo || p.input?.model === 'image-to-video'
      );
    }
    
    return {
      generatedVideos: [],
      errorCount,
      failedVideos: failedVideos.length > 0 ? failedVideos : undefined,
      status: 'error' as const,
      isImageToVideo: isImageToVideoError
    };
  }
  
  return null;
};

// Extract Grok video data from message tool_results and streaming annotations
export const getGrokVideoData = (message: UIMessage): {
  generatedVideos: {
    videoUrl: string;
    prompt: string;
    timestamp: string;
    resolution?: string;
    duration?: number;
    aspect_ratio?: string;
    isImageToVideo?: boolean;
    isVideoEdit?: boolean;
    sourceImageUrl?: string;
    sourceVideoUrl?: string;
    path?: string;
  }[];
  status?: 'processing' | 'completed' | 'error';
  startedCount?: number;
  pendingCount?: number;
  pendingPrompts?: string[];
  pendingSourceImages?: string[];
  pendingSourceVideos?: string[];
  errorCount?: number;
  failedVideos?: Array<{ prompt: string; error: string }>;
  isImageToVideo: boolean;
  isVideoEdit: boolean;
  progress?: { status: string; elapsedSeconds: number; requestId: string };
} | null => {
  if ((message as any).tool_results?.grokVideoResults) {
    const generatedVideos = (message as any).tool_results.grokVideoResults;
    if (Array.isArray(generatedVideos) && generatedVideos.length > 0) {
      const isImageToVideo = generatedVideos.some((v: any) => v.isImageToVideo);
      const isVideoEdit = generatedVideos.some((v: any) => v.isVideoEdit);
      return { generatedVideos, isImageToVideo, isVideoEdit, status: 'completed' as const };
    }
  }
  let videosFromToolResults: any[] = [];
  let errorCount = 0;
  let failedVideos: Array<{ prompt: string; error: string }> = [];
  if ((message as any).parts && Array.isArray((message as any).parts)) {
    const toolResultParts = ((message as any).parts as any[])
      .filter((p: any) => {
        const isToolResult = p?.type === 'tool-result' || p?.type?.startsWith('tool-grok_');
        const isGrokTool = p?.toolName === 'grok_video' || p?.type?.includes('grok_');
        return isToolResult && isGrokTool;
      });
    for (const part of toolResultParts) {
      const result = part.output?.value || part.output || part.result;
      if (result?.success === false) {
        errorCount++;
        failedVideos.push({ prompt: result.prompt || 'Unknown prompt', error: result.error || 'Unknown error' });
        continue;
      }
      if (result?.videos && Array.isArray(result.videos)) {
        for (const vid of result.videos) {
          if (vid.videoUrl && vid.path) {
            videosFromToolResults.push({
              videoUrl: vid.videoUrl,
              path: vid.path,
              prompt: vid.prompt || result.prompt,
              timestamp: vid.timestamp || new Date().toISOString(),
              resolution: vid.resolution,
              duration: vid.duration,
              aspect_ratio: vid.aspect_ratio,
              isImageToVideo: vid.isImageToVideo,
              isVideoEdit: vid.isVideoEdit,
              sourceImageUrl: vid.sourceImageUrl,
              sourceVideoUrl: vid.sourceVideoUrl,
            });
          }
        }
      }
    }
    if (videosFromToolResults.length > 0) {
      const hasImageToVideo = videosFromToolResults.some((v: any) => v.isImageToVideo);
      const hasVideoEdit = videosFromToolResults.some((v: any) => v.isVideoEdit);
      return {
        generatedVideos: videosFromToolResults,
        status: 'completed' as const,
        errorCount,
        failedVideos: failedVideos.length > 0 ? failedVideos : undefined,
        isImageToVideo: hasImageToVideo,
        isVideoEdit: hasVideoEdit,
      };
    }
  }
  let videoAnnotations: any[] = [];
  let startedCount = 0;
  let pendingPrompts: string[] = [];
  let pendingSourceImages: string[] = [];
  let pendingSourceVideos: string[] = [];
  let hasImageToVideoStreaming = false;
  let hasVideoEditStreaming = false;
  let progressData: { status: string; elapsedSeconds: number; requestId: string } | undefined;
  if ((message as any).annotations) {
    const completeAnnotations = (((message as any).annotations) as any[])
      .filter((a: any) => a && typeof a === 'object' && (a.type === 'grok_video_complete' || a.type === 'data-grok_video_complete'))
      .map((a: any) => a.data)
      .filter(Boolean);
    videoAnnotations = [...videoAnnotations, ...completeAnnotations];
    if (completeAnnotations.some((v: any) => v.isImageToVideo)) hasImageToVideoStreaming = true;
    if (completeAnnotations.some((v: any) => v.isVideoEdit)) hasVideoEditStreaming = true;
    const startAnnotations = (((message as any).annotations) as any[])
      .filter((a: any) => a && typeof a === 'object' && (a.type === 'grok_video_started' || a.type === 'data-grok_video_started'));
    startedCount = startAnnotations.length;
    startAnnotations.forEach((a: any) => {
      if (a.data?.prompt) pendingPrompts.push(a.data.prompt);
      if (a.data?.resolvedImageUrl) {
        pendingSourceImages.push(a.data.resolvedImageUrl);
        hasImageToVideoStreaming = true;
      } else pendingSourceImages.push('');
      if (a.data?.resolvedVideoUrl) {
        pendingSourceVideos.push(a.data.resolvedVideoUrl);
        hasVideoEditStreaming = true;
      } else pendingSourceVideos.push('');
    });
    const progressAnnotations = (((message as any).annotations) as any[])
      .filter((a: any) => a && typeof a === 'object' && (a.type === 'grok_video_progress' || a.type === 'data-grok_video_progress'));
    if (progressAnnotations.length > 0) {
      const latest = progressAnnotations[progressAnnotations.length - 1];
      if (latest.data?.status && typeof latest.data.elapsedSeconds === 'number' && latest.data.requestId) {
        progressData = { status: latest.data.status, elapsedSeconds: latest.data.elapsedSeconds, requestId: latest.data.requestId };
      }
    }
  }
  if ((message as any).parts && Array.isArray((message as any).parts)) {
    const videoParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-grok_video_complete');
    const videoStartParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-grok_video_started');
    if (videoParts.some((p: any) => p.data?.isImageToVideo)) hasImageToVideoStreaming = true;
    if (videoParts.some((p: any) => p.data?.isVideoEdit)) hasVideoEditStreaming = true;
    if (videoStartParts.some((p: any) => p.data?.resolvedImageUrl)) hasImageToVideoStreaming = true;
    if (videoStartParts.some((p: any) => p.data?.resolvedVideoUrl)) hasVideoEditStreaming = true;
    const errorParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-grok_video_error');
    for (const errorPart of errorParts) {
      if (errorPart.data) {
        failedVideos.push({ prompt: errorPart.data.prompt || 'Unknown prompt', error: errorPart.data.error || 'Unknown error' });
        errorCount++;
      }
    }
    const progressParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-grok_video_progress');
    if (progressParts.length > 0) {
      const latest = progressParts[progressParts.length - 1];
      if (latest.data?.status && typeof latest.data.elapsedSeconds === 'number' && latest.data.requestId) {
        progressData = { status: latest.data.status, elapsedSeconds: latest.data.elapsedSeconds, requestId: latest.data.requestId };
      }
    }
    videoAnnotations = [...videoAnnotations, ...videoParts.map((p: any) => p.data).filter(Boolean)];
    startedCount = Math.max(startedCount, videoStartParts.length);
    videoStartParts.forEach((p: any) => {
      const prompt = p.data?.prompt;
      const sourceImage = p.data?.resolvedImageUrl || '';
      const sourceVideo = p.data?.resolvedVideoUrl || '';
      if (prompt && !pendingPrompts.includes(prompt)) {
        pendingPrompts.push(prompt);
        pendingSourceImages.push(sourceImage);
        pendingSourceVideos.push(sourceVideo);
        if (sourceImage) hasImageToVideoStreaming = true;
        if (sourceVideo) hasVideoEditStreaming = true;
      }
    });
  }
  if (startedCount > 0 || videoAnnotations.length > 0) {
    const completedCount = videoAnnotations.length;
    const pendingCount = Math.max(0, startedCount - completedCount);
    const isImageToVideo = hasImageToVideoStreaming || videoAnnotations.some((v: any) => v.isImageToVideo);
    const isVideoEdit = hasVideoEditStreaming || videoAnnotations.some((v: any) => v.isVideoEdit);
    return {
      generatedVideos: videoAnnotations,
      status: (completedCount > 0 && pendingCount === 0 ? 'completed' : 'processing') as 'completed' | 'processing',
      startedCount,
      pendingCount,
      pendingPrompts,
      pendingSourceImages,
      pendingSourceVideos,
      errorCount: errorCount > 0 ? errorCount : undefined,
      failedVideos: failedVideos.length > 0 ? failedVideos : undefined,
      isImageToVideo,
      isVideoEdit,
      progress: progressData,
    };
  }
  if (errorCount > 0) {
    let isVideoEditError = false;
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const toolResultParts = ((message as any).parts as any[]).filter((p: any) => {
        const isToolResult = p?.type === 'tool-result' || p?.type?.startsWith('tool-grok_');
        const isGrokTool = p?.toolName === 'grok_video' || p?.type?.includes('grok_');
        return isToolResult && isGrokTool;
      });
      isVideoEditError = toolResultParts.some((p: any) => p.output?.isVideoEdit || p.input?.model === 'video-edit');
    }
    return {
      generatedVideos: [],
      errorCount,
      failedVideos: failedVideos.length > 0 ? failedVideos : undefined,
      status: 'error' as const,
      isImageToVideo: false,
      isVideoEdit: isVideoEditError,
    };
  }
  return null;
};

export const getVideoUpscalerData = (message: UIMessage): {
  generatedVideos: {
    videoUrl: string;
    prompt: string;
    timestamp: string;
    targetResolution?: string;
    sourceVideoUrl?: string;
    sourceVideoRef?: string;
    path?: string;
  }[];
  status?: 'processing' | 'completed' | 'error';
  startedCount?: number;
  pendingCount?: number;
  pendingPrompts?: string[];
  pendingSourceVideos?: string[];
  errorCount?: number;
  failedVideos?: Array<{ prompt: string; error: string }>;
  progress?: { status: string; elapsedSeconds: number; requestId: string };
} | null => {
  if ((message as any).tool_results?.videoUpscalerResults) {
    const generatedVideos = (message as any).tool_results.videoUpscalerResults;
    if (Array.isArray(generatedVideos) && generatedVideos.length > 0) {
      return { generatedVideos, status: 'completed' as const };
    }
  }

  let videosFromToolResults: any[] = [];
  let errorCount = 0;
  const failedVideos: Array<{ prompt: string; error: string }> = [];

  if ((message as any).parts && Array.isArray((message as any).parts)) {
    const toolResultParts = ((message as any).parts as any[]).filter((p: any) => {
      const isToolResult = p?.type === 'tool-result' || p?.type?.startsWith('tool-video_upscaler');
      const isUpscalerTool = p?.toolName === 'video_upscaler' || p?.type?.includes('video_upscaler');
      return isToolResult && isUpscalerTool;
    });
    for (const part of toolResultParts) {
      const result = part.output?.value || part.output || part.result;
      if (result?.success === false) {
        errorCount++;
        failedVideos.push({ prompt: result.prompt || 'Unknown prompt', error: result.error || 'Unknown error' });
        continue;
      }
      if (result?.videos && Array.isArray(result.videos)) {
        for (const vid of result.videos) {
          if (vid.videoUrl && (vid.path || vid.videoUrl)) {
            videosFromToolResults.push({
              videoUrl: vid.videoUrl,
              path: vid.path,
              prompt: vid.prompt || result.prompt,
              timestamp: vid.timestamp || new Date().toISOString(),
              targetResolution: vid.targetResolution || result.targetResolution,
              sourceVideoUrl: vid.sourceVideoUrl,
              sourceVideoRef: vid.sourceVideoRef,
            });
          }
        }
      }
    }
    if (videosFromToolResults.length > 0) {
      return {
        generatedVideos: videosFromToolResults,
        status: 'completed' as const,
        errorCount: errorCount > 0 ? errorCount : undefined,
        failedVideos: failedVideos.length > 0 ? failedVideos : undefined,
      };
    }
  }

  let videoAnnotations: any[] = [];
  let startedCount = 0;
  const pendingPrompts: string[] = [];
  const pendingSourceVideos: string[] = [];
  let progressData: { status: string; elapsedSeconds: number; requestId: string } | undefined;

  if ((message as any).annotations) {
    const completeAnnotations = (((message as any).annotations) as any[])
      .filter((a: any) => a && typeof a === 'object' && (a.type === 'video_upscaler_complete' || a.type === 'data-video_upscaler_complete'))
      .map((a: any) => a.data)
      .filter(Boolean);
    videoAnnotations = [...videoAnnotations, ...completeAnnotations];

    const startAnnotations = (((message as any).annotations) as any[])
      .filter((a: any) => a && typeof a === 'object' && (a.type === 'video_upscaler_started' || a.type === 'data-video_upscaler_started'));
    startedCount = startAnnotations.length;
    startAnnotations.forEach((a: any) => {
      if (a.data?.prompt) pendingPrompts.push(a.data.prompt);
      pendingSourceVideos.push(a.data?.resolvedVideoUrl || '');
    });

    const progressAnnotations = (((message as any).annotations) as any[])
      .filter((a: any) => a && typeof a === 'object' && (a.type === 'video_upscaler_progress' || a.type === 'data-video_upscaler_progress'));
    if (progressAnnotations.length > 0) {
      const latest = progressAnnotations[progressAnnotations.length - 1];
      if (latest.data?.status && typeof latest.data.elapsedSeconds === 'number' && latest.data.requestId) {
        progressData = { status: latest.data.status, elapsedSeconds: latest.data.elapsedSeconds, requestId: latest.data.requestId };
      }
    }
  }

  if ((message as any).parts && Array.isArray((message as any).parts)) {
    const videoParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-video_upscaler_complete');
    const videoStartParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-video_upscaler_started');
    const errorParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-video_upscaler_error');
    const progressParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-video_upscaler_progress');

    for (const errorPart of errorParts) {
      if (errorPart.data) {
        failedVideos.push({ prompt: errorPart.data.prompt || 'Unknown prompt', error: errorPart.data.error || 'Unknown error' });
        errorCount++;
      }
    }

    if (progressParts.length > 0) {
      const latest = progressParts[progressParts.length - 1];
      if (latest.data?.status && typeof latest.data.elapsedSeconds === 'number' && latest.data.requestId) {
        progressData = { status: latest.data.status, elapsedSeconds: latest.data.elapsedSeconds, requestId: latest.data.requestId };
      }
    }

    videoAnnotations = [...videoAnnotations, ...videoParts.map((p: any) => p.data).filter(Boolean)];
    startedCount = Math.max(startedCount, videoStartParts.length);
    videoStartParts.forEach((p: any) => {
      const prompt = p.data?.prompt;
      const sourceVideo = p.data?.resolvedVideoUrl || '';
      if (prompt && !pendingPrompts.includes(prompt)) {
        pendingPrompts.push(prompt);
        pendingSourceVideos.push(sourceVideo);
      }
    });
  }

  if (startedCount > 0 || videoAnnotations.length > 0) {
    const completedCount = videoAnnotations.length;
    const pendingCount = Math.max(0, startedCount - completedCount);
    return {
      generatedVideos: videoAnnotations,
      status: (completedCount > 0 && pendingCount === 0 ? 'completed' : 'processing') as 'completed' | 'processing',
      startedCount,
      pendingCount,
      pendingPrompts,
      pendingSourceVideos,
      errorCount: errorCount > 0 ? errorCount : undefined,
      failedVideos: failedVideos.length > 0 ? failedVideos : undefined,
      progress: progressData,
    };
  }

  if (errorCount > 0) {
    return {
      generatedVideos: [],
      errorCount,
      failedVideos: failedVideos.length > 0 ? failedVideos : undefined,
      status: 'error' as const,
    };
  }

  return null;
};

export const getImageUpscalerData = (message: UIMessage): {
  generatedImages: {
    imageUrl: string;
    path?: string;
    prompt: string;
    timestamp: string;
    targetResolution?: string;
    sourceImageUrl?: string;
    sourceImageRef?: string;
  }[];
  status?: 'processing' | 'completed' | 'error';
  startedCount?: number;
  pendingCount?: number;
  pendingPrompts?: string[];
  pendingSourceImages?: string[];
  errorCount?: number;
  failedImages?: Array<{ prompt: string; error: string }>;
  progress?: { status: string; elapsedSeconds: number; requestId: string };
} | null => {
  if ((message as any).tool_results?.imageUpscalerResults) {
    const generatedImages = (message as any).tool_results.imageUpscalerResults;
    if (Array.isArray(generatedImages) && generatedImages.length > 0) {
      return { generatedImages, status: 'completed' as const };
    }
  }

  let imagesFromToolResults: any[] = [];
  let errorCount = 0;
  const failedImages: Array<{ prompt: string; error: string }> = [];

  if ((message as any).parts && Array.isArray((message as any).parts)) {
    const toolResultParts = ((message as any).parts as any[]).filter((p: any) => {
      const isToolResult = p?.type === 'tool-result' || p?.type?.startsWith('tool-image_upscaler');
      const isUpscalerTool = p?.toolName === 'image_upscaler' || p?.type?.includes('image_upscaler');
      return isToolResult && isUpscalerTool;
    });
    for (const part of toolResultParts) {
      const result = part.output?.value || part.output || part.result;
      if (result?.success === false) {
        errorCount++;
        failedImages.push({ prompt: result.prompt || 'Unknown prompt', error: result.error || 'Unknown error' });
        continue;
      }
      if (result?.images && Array.isArray(result.images)) {
        for (const img of result.images) {
          if (img.imageUrl && (img.path || img.imageUrl)) {
            imagesFromToolResults.push({
              imageUrl: img.imageUrl,
              path: img.path,
              prompt: img.prompt || result.prompt,
              timestamp: img.timestamp || new Date().toISOString(),
              targetResolution: img.targetResolution || result.targetResolution,
              sourceImageUrl: img.sourceImageUrl,
              sourceImageRef: img.sourceImageRef,
            });
          }
        }
      }
    }
    if (imagesFromToolResults.length > 0) {
      return {
        generatedImages: imagesFromToolResults,
        status: 'completed' as const,
        errorCount: errorCount > 0 ? errorCount : undefined,
        failedImages: failedImages.length > 0 ? failedImages : undefined,
      };
    }
  }

  let imageAnnotations: any[] = [];
  let startedCount = 0;
  const pendingPrompts: string[] = [];
  const pendingSourceImages: string[] = [];
  let progressData: { status: string; elapsedSeconds: number; requestId: string } | undefined;

  if ((message as any).annotations) {
    const completeAnnotations = (((message as any).annotations) as any[])
      .filter((a: any) => a && typeof a === 'object' && (a.type === 'image_upscaler_complete' || a.type === 'data-image_upscaler_complete'))
      .map((a: any) => a.data)
      .filter(Boolean);
    imageAnnotations = [...imageAnnotations, ...completeAnnotations];

    const startAnnotations = (((message as any).annotations) as any[])
      .filter((a: any) => a && typeof a === 'object' && (a.type === 'image_upscaler_started' || a.type === 'data-image_upscaler_started'));
    startedCount = startAnnotations.length;
    startAnnotations.forEach((a: any) => {
      if (a.data?.prompt) pendingPrompts.push(a.data.prompt);
      pendingSourceImages.push(a.data?.resolvedImageUrl || '');
    });

    const progressAnnotations = (((message as any).annotations) as any[])
      .filter((a: any) => a && typeof a === 'object' && (a.type === 'image_upscaler_progress' || a.type === 'data-image_upscaler_progress'));
    if (progressAnnotations.length > 0) {
      const latest = progressAnnotations[progressAnnotations.length - 1];
      if (latest.data?.status && typeof latest.data.elapsedSeconds === 'number' && latest.data.requestId) {
        progressData = { status: latest.data.status, elapsedSeconds: latest.data.elapsedSeconds, requestId: latest.data.requestId };
      }
    }
  }

  if ((message as any).parts && Array.isArray((message as any).parts)) {
    const imageParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-image_upscaler_complete');
    const imageStartParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-image_upscaler_started');
    const errorParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-image_upscaler_error');
    const progressParts = ((message as any).parts as any[]).filter((p: any) => p?.type === 'data-image_upscaler_progress');

    for (const errorPart of errorParts) {
      if (errorPart.data) {
        failedImages.push({ prompt: errorPart.data.prompt || 'Unknown prompt', error: errorPart.data.error || 'Unknown error' });
        errorCount++;
      }
    }

    if (progressParts.length > 0) {
      const latest = progressParts[progressParts.length - 1];
      if (latest.data?.status && typeof latest.data.elapsedSeconds === 'number' && latest.data.requestId) {
        progressData = { status: latest.data.status, elapsedSeconds: latest.data.elapsedSeconds, requestId: latest.data.requestId };
      }
    }

    imageAnnotations = [...imageAnnotations, ...imageParts.map((p: any) => p.data).filter(Boolean)];
    startedCount = Math.max(startedCount, imageStartParts.length);
    imageStartParts.forEach((p: any) => {
      const prompt = p.data?.prompt;
      const sourceImage = p.data?.resolvedImageUrl || '';
      if (prompt && !pendingPrompts.includes(prompt)) {
        pendingPrompts.push(prompt);
        pendingSourceImages.push(sourceImage);
      }
    });
  }

  if (startedCount > 0 || imageAnnotations.length > 0) {
    const completedCount = imageAnnotations.length;
    const pendingCount = Math.max(0, startedCount - completedCount);
    return {
      generatedImages: imageAnnotations,
      status: (completedCount > 0 && pendingCount === 0 ? 'completed' : 'processing') as 'completed' | 'processing',
      startedCount,
      pendingCount,
      pendingPrompts,
      pendingSourceImages,
      errorCount: errorCount > 0 ? errorCount : undefined,
      failedImages: failedImages.length > 0 ? failedImages : undefined,
      progress: progressData,
    };
  }

  if (errorCount > 0) {
    return {
      generatedImages: [],
      errorCount,
      failedImages: failedImages.length > 0 ? failedImages : undefined,
      status: 'error' as const,
    };
  }

  return null;
};

/**
 * Extract tool data from a tool-call/tool-result pair for InlineToolPreview
 * Used in interleaved rendering mode
 */
export interface ToolPartData {
  toolName: string;
  displayName: string;
  args: any;
  result: any | null;
  status: 'processing' | 'completed' | 'error';
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  'web_search': 'Web Search',
  'multi_search': 'Web Search',
  'calculator': 'Calculator',
  'math_calculation': 'Calculator',
  'link_reader': 'Link Reader',
  'gemini_image_tool': 'Nano Banana Pro',
  'seedream_image_tool': 'Seedream 4.5',
  'qwen_image_edit': 'Qwen Image Edit',
  'twitter_search': 'X Search',
  'youtube_search': 'YouTube Search',
  'youtube_link_analysis': 'YouTube Analyzer',
  'youtube_link_analyzer': 'YouTube Analyzer',
  'google_search': 'Google Search',
  'wan25_video': 'Wan 2.5 Video',
  'grok_video': 'Grok Imagine Video',
  'video_upscaler': '4K Video Upscaler',
  'image_upscaler': '8K Image Upscaler',
};

function getDisplayNameForTool(toolName: string, args: any, result: any | null): string {
  if (toolName === 'wan25_video') {
    const model = result?.model ?? args?.model;
    const isImageToVideo =
      result?.isImageToVideo ?? result?.videos?.[0]?.isImageToVideo ?? model === 'image-to-video';
    return isImageToVideo ? 'Wan 2.5 Image to Video' : 'Wan 2.5 Text to Video';
  }
  if (toolName === 'grok_video') {
    const model = result?.model ?? args?.model;
    const isVideoEdit = result?.isVideoEdit ?? model === 'video-edit';
    const isImageToVideo = result?.isImageToVideo ?? model === 'image-to-video';
    if (isVideoEdit) return 'Grok Video to Video';
    if (isImageToVideo) return 'Grok Image to Video';
    return 'Grok Text to Video';
  }
  if (toolName === 'video_upscaler') {
    return '4K Video Upscaler';
  }
  if (toolName === 'image_upscaler') {
    return '8K Image Upscaler';
  }
  return TOOL_DISPLAY_NAMES[toolName] || toolName;
}

const FILE_EDIT_PART_TYPES = ['tool-read_file', 'tool-write_file', 'tool-get_file_info', 'tool-list_workspace', 'tool-delete_file', 'tool-grep_file', 'tool-apply_edits'] as const;

export type FileEditFileEntry = {
  toolName: string;
  path: string;
  content?: string;
  /** Original file content before write/edit (null = new file) */
  originalContent?: string | null;
  success: boolean;
  error?: string;
  size?: number;
  entries?: Array<{ name: string; path: string; isDir?: boolean }>;
  input?: { path?: string; content?: string };
  /** grep_file: formatted output, totalLines, truncated, matches count */
  output?: string;
  totalLines?: number;
  truncated?: boolean;
  matchesCount?: number;
  /** grep_file: matching lines for full-file highlight */
  matches?: { lineNumber: number; line: string }[];
  /** apply_edits: number of edits applied */
  applied?: number;
  /** read_file: line range read (1-based) */
  startLine?: number;
  endLine?: number;
};

export type FileEditData = {
  files: FileEditFileEntry[];
};

/** Map tool part type to the matching data part type (result in next part when loading from DB). */
const TOOL_TO_DATA_PART: Record<string, string> = {
  write_file: 'data-file_written',
  apply_edits: 'data-apply_edits',
  read_file: 'data-file_read',
  grep_file: 'data-grep_file',
  delete_file: 'data-file_deleted',
};

/** Extract file-edit tool results (read_file, write_file, get_file_info, list_workspace) from message.parts for Canvas. */
export const getFileEditData = (message: UIMessage): FileEditData | null => {
  if (!message) return null;
  const parts = (message as any).parts;
  if (!Array.isArray(parts)) return null;

  const files: FileEditFileEntry[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const type = part?.type;
    if (!type || !FILE_EDIT_PART_TYPES.includes(type as any)) continue;

    const toolName = type.replace('tool-', '');
    let raw = part.output?.value ?? part.output ?? part.result ?? null;
    // When loading from DB, result can be in the next part (e.g. data-file_written, data-apply_edits)
    if (!raw && i + 1 < parts.length) {
      const next = parts[i + 1];
      const expectedDataPart = TOOL_TO_DATA_PART[toolName];
      if (expectedDataPart && next?.type === expectedDataPart && next.data) {
        raw = next.data;
      }
    }
    const path = raw?.path ?? part.input?.path ?? '';
    const success = raw?.success === true;
    const error = typeof raw?.error === 'string' ? raw.error : undefined;
    const content = typeof raw?.content === 'string' ? raw.content : undefined;
    const size = typeof raw?.size === 'number' ? raw.size : undefined;
    const entries = Array.isArray(raw?.entries)
      ? raw.entries
      : (Array.isArray(raw?.paths)
        ? raw.paths.map((p: unknown) => ({
            name: typeof p === 'string' ? p.split('/').pop() || p : String(p ?? ''),
            path: typeof p === 'string' ? p : String(p ?? ''),
            isDir: false,
          }))
        : undefined);
    const output = typeof raw?.output === 'string' ? raw.output : undefined;
    const totalLines = typeof raw?.totalLines === 'number' ? raw.totalLines : undefined;
    const truncated = raw?.truncated === true;
    const matchesCount = Array.isArray(raw?.matches) ? raw.matches.length : undefined;
    const matches = Array.isArray(raw?.matches) ? raw.matches : undefined;
    const applied = typeof raw?.applied === 'number' ? raw.applied : undefined;
    const originalContent = raw?.originalContent !== undefined ? raw.originalContent : undefined;
    const startLine = typeof raw?.startLine === 'number' ? raw.startLine : part.input?.startLine;
    const endLine = typeof raw?.endLine === 'number' ? raw.endLine : part.input?.endLine;

    const entry: FileEditFileEntry = {
      toolName,
      path,
      content,
      originalContent,
      success,
      error,
      size,
      entries,
      input: part.input,
      output,
      totalLines,
      truncated,
      matchesCount,
      matches,
      applied,
      startLine,
      endLine,
    };
    const existingIdx = files.findIndex((f) => f.toolName === toolName && f.path === path);
    if (existingIdx >= 0) {
      files[existingIdx] = entry;
    } else {
      files.push(entry);
    }
  }
  if (files.length === 0) return null;
  return { files };
};

const RUN_CODE_PART_TYPES = ['tool-run_python_code'] as const;
const BROWSER_OBSERVE_PART_TYPES = ['tool-browser_observe'] as const;

export type RunCodeResultItem = {
  text?: string;
  html?: string;
  png?: string;
  jpeg?: string;
  chart?: unknown;
  json?: unknown;
};

export type RunCodeSyncedFile = {
  path: string;
  isText: boolean;
  bytes: number;
};

export type RunCodeData = {
  stdout: string[];
  stderr: string[];
  results: RunCodeResultItem[];
  error?: { name?: string; value?: string; traceback?: string[] };
  success: boolean;
  syncedFiles?: RunCodeSyncedFile[];
  /** true when data comes from incremental streaming events (no data-run_code_complete yet) */
  isStreaming?: boolean;
  /** The Python code being executed (available during streaming) */
  code?: string;
};

export type BrowserObserveAttempt = {
  phase?: string;
  title?: string;
  finalUrl?: string;
  htmlLength?: number;
  score?: number;
  matchedMarkers?: string[];
  clickedCookie?: string | null;
  clickedTab?: string | null;
};

export type BrowserObserveData = {
  success: boolean;
  url: string;
  finalUrl?: string;
  title?: string;
  htmlPath?: string;
  screenshotPath?: string;
  htmlLength?: number;
  attemptCount?: number;
  selectedAttempt?: string;
  attempts?: BrowserObserveAttempt[];
  error?: string;
  isStreaming?: boolean;
  progressPhase?: string;
  progressMessage?: string;
};

function parseBrowserObserveRaw(raw: any): BrowserObserveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const attempts = Array.isArray(raw.attempts)
    ? raw.attempts.map((a: any) => ({
        phase: typeof a?.phase === 'string' ? a.phase : undefined,
        title: typeof a?.title === 'string' ? a.title : undefined,
        finalUrl: typeof a?.finalUrl === 'string'
          ? a.finalUrl
          : (typeof a?.final_url === 'string' ? a.final_url : undefined),
        htmlLength: typeof a?.htmlLength === 'number'
          ? a.htmlLength
          : (typeof a?.html_length === 'number' ? a.html_length : undefined),
        score: typeof a?.score === 'number' ? a.score : undefined,
        matchedMarkers: Array.isArray(a?.matchedMarkers)
          ? a.matchedMarkers.filter((x: unknown) => typeof x === 'string')
          : (Array.isArray(a?.matched_markers)
            ? a.matched_markers.filter((x: unknown) => typeof x === 'string')
            : undefined),
        clickedCookie: typeof a?.clickedCookie === 'string'
          ? a.clickedCookie
          : (a?.clicked_cookie === null || typeof a?.clicked_cookie === 'string' ? a.clicked_cookie : undefined),
        clickedTab: typeof a?.clickedTab === 'string'
          ? a.clickedTab
          : (a?.clicked_tab === null || typeof a?.clicked_tab === 'string' ? a.clicked_tab : undefined),
      }))
    : undefined;

  return {
    success: raw.success === true,
    url: typeof raw.url === 'string' ? raw.url : '',
    finalUrl: typeof raw.finalUrl === 'string'
      ? raw.finalUrl
      : (typeof raw.final_url === 'string' ? raw.final_url : undefined),
    title: typeof raw.title === 'string' ? raw.title : undefined,
    htmlPath: typeof raw.htmlPath === 'string'
      ? raw.htmlPath
      : (typeof raw.html_path === 'string' ? raw.html_path : undefined),
    screenshotPath: typeof raw.screenshotPath === 'string'
      ? raw.screenshotPath
      : (typeof raw.screenshot_path === 'string' ? raw.screenshot_path : undefined),
    htmlLength: typeof raw.htmlLength === 'number'
      ? raw.htmlLength
      : (typeof raw.html_length === 'number' ? raw.html_length : undefined),
    attemptCount: typeof raw.attemptCount === 'number'
      ? raw.attemptCount
      : (typeof raw.attempt_count === 'number' ? raw.attempt_count : undefined),
    selectedAttempt: typeof raw.selectedAttempt === 'string'
      ? raw.selectedAttempt
      : (typeof raw.selected_attempt === 'string' ? raw.selected_attempt : undefined),
    attempts,
    error: typeof raw.error === 'string' ? raw.error : undefined,
  };
}

function parseRunCodeRaw(raw: any): RunCodeData {
  const stdout = Array.isArray(raw.stdout) ? raw.stdout : [];
  const stderr = Array.isArray(raw.stderr) ? raw.stderr : [];
  const results = Array.isArray(raw.results)
    ? raw.results.map((r: unknown) => {
        const x = (r as Record<string, unknown>) || {};
        const item: RunCodeResultItem = {};
        if (typeof x.text === 'string') item.text = x.text;
        if (typeof x.html === 'string') item.html = x.html;
        if (typeof x.png === 'string') item.png = x.png;
        if (typeof x.jpeg === 'string') item.jpeg = x.jpeg;
        if (x.chart !== undefined) item.chart = x.chart;
        if (x.json !== undefined) item.json = x.json;
        return item;
      })
    : [];
  const err =
    raw.error && typeof raw.error === 'object'
      ? {
          name: typeof (raw.error as any).name === 'string' ? (raw.error as any).name : undefined,
          value: typeof (raw.error as any).value === 'string' ? (raw.error as any).value : undefined,
          traceback: Array.isArray((raw.error as any).traceback) ? (raw.error as any).traceback : undefined,
        }
      : undefined;
  const success = raw.success === true;
  return { stdout, stderr, results, error: err, success };
}

/** Extract run_python_code tool results from message.parts for Canvas/InlineToolPreview.
 *  When `targetToolCallId` is provided, returns results for that specific invocation only.
 *  Without it, falls back to the last result (backward compatible).
 *  Falls back to message.tool_results.runCodeResults when parts are missing or minimal (e.g. after refresh). */
export const getRunCodeData = (
  message: UIMessage,
  targetToolCallId?: string,
  targetInvocationIndex?: number
): RunCodeData | null => {
  if (!message) return null;
  const parts = (message as any).parts;
  const effectiveTargetToolCallId = (() => {
    if (targetToolCallId) return targetToolCallId;
    if (typeof targetInvocationIndex === 'number') return undefined;
    if (!Array.isArray(parts)) return undefined;

    let lastRunToolCallId: string | undefined;
    let lastSuccessfulRunToolCallId: string | undefined;

    for (const part of parts) {
      if (RUN_CODE_PART_TYPES.includes(part?.type as any) && typeof part?.toolCallId === 'string') {
        lastRunToolCallId = part.toolCallId;
      }
      if (part?.type === 'data-run_code_complete') {
        const callId = typeof part?.data?.toolCallId === 'string' ? part.data.toolCallId : undefined;
        if (callId) {
          lastRunToolCallId = callId;
          if (part?.data?.success === true) {
            lastSuccessfulRunToolCallId = callId;
          }
        }
      }
    }

    return lastSuccessfulRunToolCallId ?? lastRunToolCallId;
  })();
  let out: RunCodeData | null = null;
  let syncedFiles: RunCodeSyncedFile[] | undefined;

  if (Array.isArray(parts)) {
    // When targetToolCallId is provided, we use positional association:
    // data-run_code_* events that appear AFTER a tool-run_python_code part
    // (and BEFORE the next tool-run_python_code part) belong to that invocation.
    // Events with explicit toolCallId are matched directly.
    let currentToolCallId: string | null = null;
    let currentInvocationIndex = -1;
    let isTargetInvocation = false;

    for (const part of parts) {
      const type = part?.type;
      if (!type) continue;

      // Track which tool invocation we're currently in
      if (RUN_CODE_PART_TYPES.includes(type as any)) {
        currentInvocationIndex += 1;
        currentToolCallId = part.toolCallId ?? null;
        isTargetInvocation = effectiveTargetToolCallId
          ? currentToolCallId === effectiveTargetToolCallId
          : (typeof targetInvocationIndex === 'number'
              ? currentInvocationIndex === targetInvocationIndex
              : true);

        // If targeting a specific invocation, only use matching tool parts
        if (!isTargetInvocation) continue;

        const raw = part.output?.value ?? part.output ?? part.result ?? null;
        if (!raw) continue;
        out = parseRunCodeRaw(raw);
        continue;
      }

      if (type === 'data-run_code_complete') {
        // Match by explicit toolCallId inside data (new messages)
        // or by positional association (legacy messages without toolCallId)
        const eventToolCallId = part.data?.toolCallId ?? currentToolCallId;
        const matches = effectiveTargetToolCallId
          ? eventToolCallId === effectiveTargetToolCallId
          : (typeof targetInvocationIndex === 'number'
              ? isTargetInvocation
              : true);
        if (!matches) continue;

        const raw = part.data ?? null;
        if (!raw) continue;
        out = parseRunCodeRaw(raw);
      }

      // Capture files synced after run_python_code execution
      if (type === 'data-run_code_files_synced') {
        const eventToolCallId = part.data?.toolCallId ?? currentToolCallId;
        const matches = effectiveTargetToolCallId
          ? eventToolCallId === effectiveTargetToolCallId
          : (typeof targetInvocationIndex === 'number'
              ? isTargetInvocation
              : true);
        if (!matches) continue;

        const raw = part.data ?? null;
        if (raw && Array.isArray(raw.files)) {
          syncedFiles = raw.files.map((f: any) => ({
            path: typeof f.path === 'string' ? f.path : '',
            isText: f.isText === true,
            bytes: typeof f.bytes === 'number' ? f.bytes : 0,
          }));
        }
      }
    }
  }

  const isMinimal = out && out.results.length === 0 && out.stdout.length === 0 && out.stderr.length === 0 && !out.error;
  if (out !== null && !isMinimal) {
    if (syncedFiles && syncedFiles.length > 0) out.syncedFiles = syncedFiles;
    return out;
  }

  // ── Streaming fallback: collect incremental stdout/stderr when no complete event yet ──
  // This enables the Canvas to show real-time output while code is still running.
  if (out === null && Array.isArray(parts)) {
    const streamingStdout: string[] = [];
    const streamingStderr: string[] = [];
    let streamingCode: string | undefined;
    let foundToolPart = false;
    let streamCurrentToolCallId: string | null = null;
    let streamIsTarget = false;

    for (const part of parts) {
      const type = part?.type;
      if (!type) continue;

      // Track tool invocation parts to find the code and associate events
      if (RUN_CODE_PART_TYPES.includes(type as any)) {
        streamCurrentToolCallId = part.toolCallId ?? null;
        streamIsTarget = effectiveTargetToolCallId
          ? streamCurrentToolCallId === effectiveTargetToolCallId
          : true;
        if (streamIsTarget) {
          foundToolPart = true;
          // Extract the code from the tool call's input/args
          const code = part.input?.code ?? part.args?.code;
          if (typeof code === 'string') streamingCode = code;
        }
        continue;
      }

      // Collect incremental stdout lines
      if (type === 'data-run_code_stdout') {
        const eventToolCallId = part.data?.toolCallId ?? streamCurrentToolCallId;
        const matches = effectiveTargetToolCallId
          ? eventToolCallId === effectiveTargetToolCallId
          : streamIsTarget;
        if (matches && typeof part.data?.line === 'string') {
          streamingStdout.push(part.data.line);
        }
        continue;
      }

      // Collect incremental stderr lines
      if (type === 'data-run_code_stderr') {
        const eventToolCallId = part.data?.toolCallId ?? streamCurrentToolCallId;
        const matches = effectiveTargetToolCallId
          ? eventToolCallId === effectiveTargetToolCallId
          : streamIsTarget;
        if (matches && typeof part.data?.line === 'string') {
          streamingStderr.push(part.data.line);
        }
        continue;
      }
    }

    // Only return streaming data if we found a matching tool part (execution was invoked)
    if (foundToolPart) {
      return {
        stdout: streamingStdout,
        stderr: streamingStderr,
        results: [],
        success: false,
        isStreaming: true,
        code: streamingCode,
      };
    }
  }

  // Fallback: stored tool_results (no per-invocation matching available here)
  const stored = (message as any).tool_results?.runCodeResults;
  if (Array.isArray(stored) && stored.length > 0) {
    if (effectiveTargetToolCallId) {
      // Try to find by index: toolCallId format is "functions.run_python_code:N"
      const idxMatch = effectiveTargetToolCallId.match(/:(\d+)$/);
      if (idxMatch) {
        // Find which stored result corresponds to this invocation
        // Count run_python_code invocations to determine the offset
        const allToolParts = ((message as any).parts ?? []).filter((p: any) =>
          RUN_CODE_PART_TYPES.includes(p?.type)
        );
        const invocationIndex = allToolParts.findIndex((p: any) => p.toolCallId === effectiveTargetToolCallId);
        if (invocationIndex >= 0 && invocationIndex < stored.length) {
          const match = stored[invocationIndex];
          if (match && typeof match === 'object') {
            out = parseRunCodeRaw(match);
            if (out && syncedFiles && syncedFiles.length > 0) out.syncedFiles = syncedFiles;
            return out;
          }
        }
      }
    }
    if (typeof targetInvocationIndex === 'number') {
      const match = stored[targetInvocationIndex];
      if (match && typeof match === 'object') {
        out = parseRunCodeRaw(match);
        if (out && syncedFiles && syncedFiles.length > 0) out.syncedFiles = syncedFiles;
        return out;
      }
    }

    // Final fallback: last stored result
    const last = stored[stored.length - 1];
    if (last && typeof last === 'object') {
      out = parseRunCodeRaw(last);
      if (out && syncedFiles && syncedFiles.length > 0) out.syncedFiles = syncedFiles;
    }
  }
  return out;
};

/** Extract browser_observe tool results from message.parts/tool_results for Canvas/InlineToolPreview. */
export const getBrowserObserveData = (
  message: UIMessage,
  targetToolCallId?: string
): BrowserObserveData | null => {
  if (!message) return null;
  const parts = (message as any).parts;
  let out: BrowserObserveData | null = null;
  let currentToolCallId: string | null = null;

  if (Array.isArray(parts)) {
    let sawStreamingLine = false;
    let lastStreamingLine = '';

    for (const part of parts) {
      const type = part?.type;
      if (!type) continue;

      if (BROWSER_OBSERVE_PART_TYPES.includes(type as any)) {
        currentToolCallId = typeof part?.toolCallId === 'string' ? part.toolCallId : null;
        if (targetToolCallId && currentToolCallId !== targetToolCallId) continue;
        const raw = part.output?.value ?? part.output ?? part.result ?? null;
        const parsed = parseBrowserObserveRaw(raw);
        if (parsed) out = parsed;
        continue;
      }

      if (type === 'tool-result' && part?.toolName === 'browser_observe') {
        const callId = typeof part?.toolCallId === 'string' ? part.toolCallId : currentToolCallId;
        if (targetToolCallId && callId !== targetToolCallId) continue;
        const raw = part.output?.value ?? part.output ?? part.result ?? null;
        const parsed = parseBrowserObserveRaw(raw);
        if (parsed) out = parsed;
        continue;
      }

      if (type === 'data-run_code_stdout') {
        const line = typeof part?.data?.line === 'string' ? part.data.line : '';
        if (!line.includes('[browser_observe]')) continue;
        const callId = typeof part?.data?.toolCallId === 'string' ? part.data.toolCallId : currentToolCallId;
        if (targetToolCallId && callId !== targetToolCallId) continue;
        sawStreamingLine = true;
        lastStreamingLine = line;
        continue;
      }

      if (type === 'data-browser_observe_progress') {
        const callId = typeof part?.data?.toolCallId === 'string' ? part.data.toolCallId : currentToolCallId;
        if (targetToolCallId && callId !== targetToolCallId) continue;
        const phase = typeof part?.data?.phase === 'string' ? part.data.phase : undefined;
        const message = typeof part?.data?.message === 'string' ? part.data.message : undefined;
        const progressUrl = typeof part?.data?.url === 'string' ? part.data.url : '';
        const status = typeof part?.data?.status === 'string' ? part.data.status : undefined;
        if (!out) {
          out = {
            success: false,
            url: progressUrl,
            isStreaming: status !== 'completed' && status !== 'error',
            progressPhase: phase,
            progressMessage: message,
            error: status === 'error' ? message : undefined,
          };
        } else {
          out.progressPhase = phase ?? out.progressPhase;
          out.progressMessage = message ?? out.progressMessage;
          if (!out.url && progressUrl) out.url = progressUrl;
          if (status === 'error' && message) out.error = message;
          out.isStreaming = status !== 'completed' && status !== 'error';
        }
        continue;
      }

      if (type === 'data-run_code_stderr') {
        const line = typeof part?.data?.line === 'string' ? part.data.line : '';
        if (!line.includes('[browser_observe]')) continue;
        const callId = typeof part?.data?.toolCallId === 'string' ? part.data.toolCallId : currentToolCallId;
        if (targetToolCallId && callId !== targetToolCallId) continue;
        sawStreamingLine = true;
        lastStreamingLine = line;
      }
    }

    if (!out && sawStreamingLine) {
      out = {
        success: false,
        url: '',
        error: lastStreamingLine,
        isStreaming: true,
        progressPhase: 'running',
        progressMessage: lastStreamingLine,
      };
    }
  }

  if (out && (out.url || out.title || out.htmlPath || out.screenshotPath || out.error || out.isStreaming)) {
    return out;
  }

  const stored = (message as any).tool_results?.observeResults;
  if (Array.isArray(stored) && stored.length > 0) {
    if (targetToolCallId) {
      const allToolParts = ((message as any).parts ?? []).filter((p: any) =>
        BROWSER_OBSERVE_PART_TYPES.includes(p?.type)
      );
      const invocationIndex = allToolParts.findIndex((p: any) => p.toolCallId === targetToolCallId);
      if (invocationIndex >= 0 && invocationIndex < stored.length) {
        const parsed = parseBrowserObserveRaw(stored[invocationIndex]);
        if (parsed) return parsed;
      }
    }
    const parsed = parseBrowserObserveRaw(stored[stored.length - 1]);
    if (parsed) return parsed;
  }

  return null;
};

export const getToolDataFromPart = (
  toolCall: { toolName: string; args: any; toolCallId: string },
  toolResult: { result: any; toolCallId: string } | null
): ToolPartData => {
  const toolName = toolCall.toolName;
  const result = toolResult?.result ?? null;
  const displayName = getDisplayNameForTool(toolName, toolCall.args, result);

  let status: 'processing' | 'completed' | 'error' = 'processing';

  if (toolResult) {
    if (toolResult.result?.error) {
      status = 'error';
    } else {
      status = 'completed';
    }
  }

  return {
    toolName,
    displayName,
    args: toolCall.args,
    result,
    status,
  };
};


