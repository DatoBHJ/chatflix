import { UIMessage } from 'ai'

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

    // Extract imageMap from annotations
    let imageMap: { [key: string]: string } = {};
    webSearchCompletions.forEach(completion => {
      if (completion.data?.imageMap) {
        imageMap = { ...imageMap, ...completion.data.imageMap };
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
          score: result.score || undefined,
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
          return 'bar-chart'; // Financial report icon
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
                    score: result.score || undefined,
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
      return {
        result: null, // For backward compatibility
        args: null,
        annotations: queryCompletions,
        results: allResults,
        imageMap
      };
    }
    
    // Check for stored tool results as a fallback
    if ((message as any).tool_results) {
      const toolResults = (message as any).tool_results;
      
      // Extract imageMap from tool_results
      if (toolResults.webSearchResults) {
        toolResults.webSearchResults.forEach((result: any) => {
          if (result.imageMap) {
            imageMap = { ...imageMap, ...result.imageMap };
          }
        });
      } else if (Array.isArray(toolResults)) {
        toolResults.forEach((result: any) => {
          if (result.imageMap) {
            imageMap = { ...imageMap, ...result.imageMap };
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
        return {
          result: null, // For backward compatibility
          args: null,
          annotations: queryCompletions,
          results: storedResults,
          imageMap
        };
      }
    }
    
    // If no parts property or it's empty, return null or loading state
    if (!message.parts || message.parts.length === 0) {
      // If we have query completions, we can show a loading state
      if (queryCompletions.length > 0) {
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
      
      return {
        result: null, // For backward compatibility 
        args: allArgs[0] || null,
        annotations: queryCompletions,
        results: allInvocationResults,
        imageMap
      };
    }
    
    // Extract queries for loading state
    if (allArgs.length > 0) {
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
        imageMap
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
  let linkReaderStarted = false;
  
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
    
    linkReaderStarted = startAnnotations.length > 0;
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
    
    linkReaderStarted = linkReaderStarted || linkStartParts.length > 0;
  }
  
  // 시작 신호가 있거나 시도가 있으면 반환
  if (linkReaderStarted || linkReaderAnnotations.length > 0) {
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
    
    return { 
      linkAttempts,
      rawContent: linkReaderRawContent,
      status: hasSuccessfulAttempt ? 'completed' : 'processing'
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
    let imageStarted = false;
    
    // Check annotations array (legacy format)
    if ((message as any).annotations) {
      imageAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'generated_image')
        .map(a => a.data)
        .filter(Boolean);
      
      const startAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'image_generation_started');
      
      imageStarted = startAnnotations.length > 0;
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
      imageStarted = imageStarted || imageStartParts.length > 0;
    }
    
    // 시작 신호가 있거나 이미지가 있으면 반환
    if (imageStarted || imageAnnotations.length > 0) {
      return { 
        generatedImages: imageAnnotations,
        status: imageAnnotations.length > 0 ? 'completed' : 'processing'
      };
    }
    
    return null;
  };

  




  // Extract X search data from message annotations and tool_results
  export const getXSearchData = (message: UIMessage) => {
    // Check if there are stored X search results in tool_results
    if ((message as any).tool_results?.xSearchResults) {
      const xResults = (message as any).tool_results.xSearchResults;
      if (Array.isArray(xResults) && xResults.length > 0) {
        return { xResults };
      }
    }
    
    // Check for X search annotations and parts
    let xSearchAnnotations: any[] = [];
    let xSearchStarted = false;
    
    // Check annotations array (legacy format)
    if ((message as any).annotations) {
      const completeAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'x_search_complete')
        .map(a => a.data)
        .filter(Boolean);
      
      const startAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'x_search_started');
      
      xSearchAnnotations = completeAnnotations;
      xSearchStarted = startAnnotations.length > 0;
    }
    
    // Check parts array for streaming annotations (AI SDK 5 format)
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const xCompleteParts = ((message as any).parts as any[])
        .filter(p => p?.type === 'data-x_search_complete');
      
      const xStartParts = ((message as any).parts as any[])
        .filter(p => p?.type === 'data-x_search_started');
      
      xSearchAnnotations = [
        ...xSearchAnnotations,
        ...xCompleteParts.map(p => p.data).filter(Boolean)
      ];
      xSearchStarted = xSearchStarted || xStartParts.length > 0;
    }
    
    // 시작 신호가 있거나 완료 결과가 있으면 반환
    if (xSearchStarted || xSearchAnnotations.length > 0) {
      return { 
        xResults: xSearchAnnotations,
        status: xSearchAnnotations.length > 0 ? 'completed' : 'processing'
      };
    }
    
    return null;
  };
  

  // Extract YouTube search data from message annotations and tool_results
  export const getYouTubeSearchData = (message: UIMessage) => {
    // Check if there are stored YouTube search results in tool_results
    if ((message as any).tool_results?.youtubeSearchResults) {
      const youtubeResults = (message as any).tool_results.youtubeSearchResults;
      if (Array.isArray(youtubeResults) && youtubeResults.length > 0) {
        return { youtubeResults };
      }
    }
    
    // Check for YouTube search annotations and parts
    let youtubeSearchAnnotations: any[] = [];
    let youtubeSearchStarted = false;
    
    // Check annotations array (legacy format)
    if ((message as any).annotations) {
      const completeAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'youtube_search_complete')
        .map(a => a.data)
        .filter(Boolean);
      
      const startAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'youtube_search_started');
      
      youtubeSearchAnnotations = completeAnnotations;
      youtubeSearchStarted = startAnnotations.length > 0;
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
      youtubeSearchStarted = youtubeSearchStarted || youtubeStartParts.length > 0;
    }
    
    // 시작 신호가 있거나 완료 결과가 있으면 반환
    if (youtubeSearchStarted || youtubeSearchAnnotations.length > 0) {
      return { 
        youtubeResults: youtubeSearchAnnotations,
        status: youtubeSearchAnnotations.length > 0 ? 'completed' : 'processing'
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
        const processedResults = googleResults.map((result: any) => {
          if (result.searches && Array.isArray(result.searches)) {
            return {
              searchId: result.searchId,
              searches: result.searches.map((search: any) => ({
                query: search.query,
                topic: search.topic || 'google',
                topicIcon: 'google',
                results: search.results || [],
                images: search.images || []
              })),
              isComplete: true
            };
          }
          return null;
        }).filter(Boolean);
        
        if (processedResults.length > 0) {
          // linkMap, thumbnailMap, titleMap이 있는 객체 찾기 (배열에서 두 번째 객체)
          const resultWithMaps = googleResults.find((result: any) => result.linkMap || result.thumbnailMap || result.titleMap);
          
          return {
            result: null,
            args: null,
            annotations: [],
            results: processedResults,
            imageMap: googleResults[0]?.imageMap || {},
            linkMap: resultWithMaps?.linkMap || {},
            thumbnailMap: resultWithMaps?.thumbnailMap || {},
            titleMap: resultWithMaps?.titleMap || {}
          };
        }
      }
    }
    
    // Get query completion annotations - check both annotations and parts for AI SDK 5 compatibility
    let queryCompletions: any[] = [];
    let googleSearchCompletions: any[] = [];
    
    // Check annotations array (legacy format)
    if ((message as any).annotations) {
      queryCompletions = ((message as any).annotations as any[]).filter(a => a?.type === 'google_search_started');
      googleSearchCompletions = ((message as any).annotations as any[]).filter(a => a?.type === 'google_search_complete');
    }
    
    // Check parts array for streaming annotations (AI SDK 5 format)
    if ((message as any).parts && Array.isArray((message as any).parts)) {
      const queryParts = ((message as any).parts as any[]).filter(p => p?.type === 'data-google_search_started');
      const googleSearchParts = ((message as any).parts as any[]).filter(p => p?.type === 'data-google_search_complete');
      
      // Convert parts format to annotations format for consistency
      queryCompletions = [
        ...queryCompletions,
        ...queryParts.map(p => ({ type: 'google_search_started', data: p.data }))
      ];
      googleSearchCompletions = [
        ...googleSearchCompletions,
        ...googleSearchParts.map(p => ({ type: 'google_search_complete', data: p.data }))
      ];
    }

    // Extract imageMap, linkMap, thumbnailMap, titleMap from annotations
    let imageMap: { [key: string]: string } = {};
    let linkMap: { [key: string]: string } = {};
    let thumbnailMap: { [key: string]: string } = {};
    let titleMap: { [key: string]: string } = {};
    
    googleSearchCompletions.forEach(completion => {
      if (completion.data?.imageMap) {
        imageMap = { ...imageMap, ...completion.data.imageMap };
      }
      if (completion.data?.linkMap) {
        linkMap = { ...linkMap, ...completion.data.linkMap };
      }
      if (completion.data?.thumbnailMap) {
        thumbnailMap = { ...thumbnailMap, ...completion.data.thumbnailMap };
      }
      if (completion.data?.titleMap) {
        titleMap = { ...titleMap, ...completion.data.titleMap };
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
    
    // Helper function to process search results
    const processSearchResults = (results: any[]) => {
      return results.map(result => ({
        ...result,
        // Ensure Google-specific fields are preserved
        summary: result.summary || result.content || undefined,
        score: result.score || undefined,
        author: result.author || undefined,
        publishedDate: result.publishedDate || undefined,
      }));
    };

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
        const searchesForThisId: any[] = [];
        
        completions.forEach(completion => {
          if (completion.data && completion.data.results) {
            searchesForThisId.push({
              query: completion.data.query,
              results: completion.data.results,
              images: completion.data.images || []
            });
          }
        });
        
        if (searchesForThisId.length > 0) {
          // Add this completed searchId result to our collection
          allResults.push({
            searchId,
            searches: searchesForThisId.map(search => ({
              ...search,
              topic: 'google',
              topicIcon: 'google',
              results: processSearchResults(search.results || []),
              images: search.images || []
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
            topic: 'google',
            topicIcon: 'google',
            results: [],
            images: []
          }],
          isComplete: false,
          // 모든 쿼리 완료 어노테이션을 보존
          annotations: latestQueryCompletions
        });
      }
    }
    
    // If we've found results via annotations, return them
    if (allResults.length > 0) {
      return {
        result: null, // For backward compatibility
        args: null,
        annotations: queryCompletions,
        results: allResults,
        imageMap
      };
    }
    
    // Check for stored tool results as a fallback
    if ((message as any).tool_results) {
      const toolResults = (message as any).tool_results;
      
      // Extract imageMap from tool_results
      if (toolResults.googleSearchResults) {
        toolResults.googleSearchResults.forEach((result: any) => {
          if (result.imageMap) {
            imageMap = { ...imageMap, ...result.imageMap };
          }
        });
      }
      
      // Handle both new and legacy formats
      let storedResults: any[] = [];
      
      if (toolResults.googleSearchResults) {
        // New format with googleSearchResults key
        if (Array.isArray(toolResults.googleSearchResults)) {
          // Process all results with searchIds
          const resultsWithIds = toolResults.googleSearchResults.filter((r: any) => r.searchId);
          
          // Create a result entry for each unique searchId
          const processedIds = new Set<string>();
          
          resultsWithIds.forEach((result: any) => {
            const searchId = result.searchId;
            if (searchId && !processedIds.has(searchId)) {
              processedIds.add(searchId);
              storedResults.push({
                searchId,
                searches: [{
                  query: result.query,
                  topic: 'google',
                  topicIcon: 'google',
                  results: processSearchResults(result.results || []),
                  images: result.images || []
                }],
                isComplete: true
              });
            }
          });
          
          // Handle results without searchId (legacy)
          if (storedResults.length === 0) {
            const mergedSearches = toolResults.googleSearchResults.flatMap((r: any) => r.results || []);
            if (mergedSearches.length > 0) {
              storedResults.push({
                searchId: 'legacy',
                searches: [{
                  query: 'Google Search',
                  topic: 'google',
                  topicIcon: 'google',
                  results: processSearchResults(mergedSearches),
                  images: []
                }],
                isComplete: true
              });
            }
          }
        }
      }
      
      if (storedResults.length > 0) {
        return {
          result: null, // For backward compatibility
          args: null,
          annotations: queryCompletions,
          results: storedResults,
          imageMap
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
              images: []
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
                    results: processSearchResults(search.results || []),
                    images: search.images || []
                  })),
                  isComplete: true
                });
              } else {
                // Legacy single query structure
                allInvocationResults.push({
                  searchId: result.searchId,
                  searches: [{
                    query: result.query || 'Google Search',
                    topic: 'google',
                    topicIcon: 'google',
                    results: processSearchResults(result.results || []),
                    images: result.images || []
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
                  topic: 'google',
                  topicIcon: 'google',
                  results: processSearchResults(result.results || []),
                  images: result.images || []
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
              topic: 'google',
              topicIcon: 'google',
              results: processSearchResults(a.data.results || []),
              images: a.data.images || []
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
            images: []
          }],
          isComplete: false,
          annotations: queryCompletionsBySearchId.get(latestSearchId)
        });
      }
      
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
            images: []
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
      if (Array.isArray(analysisResults) && analysisResults.length > 0) {
        return { analysisResults };
      }
    }
    
    // Check annotations and parts for YouTube analysis
    let youtubeAnalysisAnnotations: any[] = [];
    let youtubeAnalysisStarted = false;
    
    // Check annotations array (legacy format)
    if ((message as any).annotations) {
      const completeAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && 
          (a.type === 'youtube_analysis_complete' || a.type === 'youtube_link_analysis_complete'))
        .map(a => a.data?.results || a.data)
        .filter(Boolean)
        .flat();
      
      const startAnnotations = (((message as any).annotations) as any[])
        .filter(a => a && typeof a === 'object' && 
          (a.type === 'youtube_analysis_started' || a.type === 'youtube_link_analysis_started'));
      
      youtubeAnalysisAnnotations = completeAnnotations;
      youtubeAnalysisStarted = startAnnotations.length > 0;
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
      youtubeAnalysisStarted = youtubeAnalysisStarted || youtubeStartParts.length > 0;
    }
    
    // 시작 신호가 있거나 완료 결과가 있으면 반환
    if (youtubeAnalysisStarted || youtubeAnalysisAnnotations.length > 0) {
      return { 
        analysisResults: youtubeAnalysisAnnotations,
        status: youtubeAnalysisAnnotations.length > 0 ? 'completed' : 'processing'
      };
    }
    
    return null;
  };