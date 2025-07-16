import { Message } from 'ai'

 // Find web search tool results to display
export const getWebSearchResults = (message: Message) => {
    if (!message) return null;
    
    // Get query completion annotations
    const queryCompletions = message.annotations 
      ? (message.annotations as any[]).filter(a => a?.type === 'query_completion')
      : [];
    
    // Get web search complete annotations
    const webSearchCompletions = message.annotations 
      ? (message.annotations as any[]).filter(a => a?.type === 'web_search_complete')
      : [];

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
          
          searchesForThisId.forEach(search => {
            const query = search.query;
            
            if (!uniqueResults.has(query)) {
              uniqueResults.set(query, {
                query,
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
        results: [], // 실제 결과는 web_search_complete 어노테이션에 있음
        images: []
      }));
      
      // 진행 중인 쿼리로 검색 결과 객체 생성
      const inProgressSearches = Array.from(inProgressQueries.values()).map(completion => ({
        query: completion.data.query,
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
        results: allResults
      };
    }
    
    // Check for stored tool results as a fallback
    if ((message as any).tool_results) {
      const toolResults = (message as any).tool_results;
      
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
          results: storedResults
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
          }]
        };
      }
      return null;
    }
    
    // Collect all results and args from tool invocations
    const allInvocationResults: any[] = [];
    const allArgs: any[] = [];
    const processedSearchIds = new Set<string>();
    
    for (const part of message.parts) {
      if (part?.type === 'tool-invocation' && part.toolInvocation?.toolName === 'web_search') {
        try {
          const invocation = part.toolInvocation as any;
          if (invocation.args) allArgs.push(JSON.parse(JSON.stringify(invocation.args)));
          if (invocation.result) {
            const result = JSON.parse(JSON.stringify(invocation.result));
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
    if (message.annotations && allInvocationResults.length === 0) {
      const webSearchAnnotations = (message.annotations as any[])
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
        results: allInvocationResults
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
        }]
      };
    }
    
    return null;
  };

// Extract math calculation annotations
export const getMathCalculationData = (message: Message) => {
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
  if (!message.annotations) return null;
  
  const mathAnnotations = (message.annotations as any[])
    .filter(a => a && typeof a === 'object' && a.type && 
      ['math_calculation', 'math_calculation_complete'].includes(a.type));
  
  if (mathAnnotations.length === 0) return null;
  
  // 최신 계산 단계 반환
  const calculationSteps = mathAnnotations
    .filter(a => a.type === 'math_calculation' && a.calculationSteps)
    .flatMap(a => a.calculationSteps)
    .filter((step, index, self) => 
      index === self.findIndex(s => s.step === step.step)
    )
    .sort((a, b) => a.step - b.step);
  
  return calculationSteps.length > 0 ? { calculationSteps } : null;
};

// Extract link reader attempts from message annotations and tool_results
export const getLinkReaderData = (message: Message) => {
  // Check if there are stored link reader attempts in tool_results
  if ((message as any).tool_results?.linkReaderAttempts) {
    const linkAttempts = (message as any).tool_results.linkReaderAttempts;
    if (Array.isArray(linkAttempts) && linkAttempts.length > 0) {
      return { linkAttempts };
    }
  }
  
  // Check for link reader annotations
  if (!message.annotations) return null;
  
  // Get initial attempts
  const linkReaderAnnotations = (message.annotations as any[])
    .filter(a => a && typeof a === 'object' && a.type === 'link_reader_attempt')
    .map(a => a.data)
    .filter(Boolean);
  
  if (linkReaderAnnotations.length === 0) return null;
  
  // Create a map of attempts by URL for easy updating
  const attemptsMap = new Map(
    linkReaderAnnotations.map(attempt => [attempt.url, attempt])
  );
  
  // Apply updates from annotations
  (message.annotations as any[])
    .filter(a => a && typeof a === 'object' && a.type === 'link_reader_attempt_update')
    .forEach(update => {
      const data = update.data;
      if (data?.url && attemptsMap.has(data.url)) {
        // Update the attempt with latest data
        Object.assign(attemptsMap.get(data.url), data);
      }
    });
  
  return { linkAttempts: Array.from(attemptsMap.values()) };
};

// Extract image generator data from message annotations and tool_results
export const getImageGeneratorData = (message: Message) => {
    // Check if there are stored generated images in tool_results
    if ((message as any).tool_results?.generatedImages) {
      const generatedImages = (message as any).tool_results.generatedImages;
      if (Array.isArray(generatedImages) && generatedImages.length > 0) {
        return { generatedImages };
      }
    }
    
    // Check for image generator annotations
    if (!message.annotations) return null;
    
    // Get image generation annotations
    const imageAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'generated_image')
      .map(a => a.data)
      .filter(Boolean);
    
    if (imageAnnotations.length === 0) return null;
    
    return { generatedImages: imageAnnotations };
  };

  

  // Extract academic search data from message annotations and tool_results
  export const getAcademicSearchData = (message: Message) => {
    // Check if there are stored academic search results in tool_results
    if ((message as any).tool_results?.academicSearchResults) {
      const academicResults = (message as any).tool_results.academicSearchResults;
      if (Array.isArray(academicResults) && academicResults.length > 0) {
        return { academicResults };
      }
    }
    
    // Check for academic search annotations
    if (!message.annotations) return null;
    
    // Get academic search annotations
    const academicAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'academic_search_complete')
      .map(a => a.data)
      .filter(Boolean);
    
    if (academicAnnotations.length === 0) return null;
    
    return { academicResults: academicAnnotations };
  };


  // Extract X search data from message annotations and tool_results
  export const getXSearchData = (message: Message) => {
    // Check if there are stored X search results in tool_results
    if ((message as any).tool_results?.xSearchResults) {
      const xResults = (message as any).tool_results.xSearchResults;
      if (Array.isArray(xResults) && xResults.length > 0) {
        return { xResults };
      }
    }
    
    // Check for X search annotations
    if (!message.annotations) return null;
    
    // Get X search annotations
    const xSearchAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'x_search_complete')
      .map(a => a.data)
      .filter(Boolean);
    
    if (xSearchAnnotations.length === 0) return null;
    
    return { xResults: xSearchAnnotations };
  };
  

  // Extract YouTube search data from message annotations and tool_results
  export const getYouTubeSearchData = (message: Message) => {
    // Check if there are stored YouTube search results in tool_results
    if ((message as any).tool_results?.youtubeSearchResults) {
      const youtubeResults = (message as any).tool_results.youtubeSearchResults;
      if (Array.isArray(youtubeResults) && youtubeResults.length > 0) {
        return { youtubeResults };
      }
    }
    
    // Check for YouTube search annotations
    if (!message.annotations) return null;
    
    // Get YouTube search annotations
    const youtubeSearchAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'youtube_search_complete')
      .map(a => a.data)
      .filter(Boolean);
    
    if (youtubeSearchAnnotations.length === 0) return null;
    
    return { youtubeResults: youtubeSearchAnnotations };
  };

  

  // Extract YouTube link analysis data from message annotations and tool_results
  export const getYouTubeLinkAnalysisData = (message: Message) => {
    // Check tool_results first
    if ((message as any).tool_results?.youtubeLinkAnalysisResults) {
      const analysisResults = (message as any).tool_results.youtubeLinkAnalysisResults;
      if (Array.isArray(analysisResults) && analysisResults.length > 0) {
        return { analysisResults };
      }
    }
    
    // Check annotations if no tool_results found
    if (!message.annotations) return null;
    
    const youtubeAnalysisAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && 
        (a.type === 'youtube_analysis_complete' || a.type === 'youtube_link_analysis_complete'))
      .map(a => a.data?.results || a.data)
      .filter(Boolean)
      .flat();
    
    return youtubeAnalysisAnnotations.length > 0 ? { analysisResults: youtubeAnalysisAnnotations } : null;
  };