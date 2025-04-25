import { Message } from 'ai'


// Define data type for Data Processor results
type DataProcessorData = {
    processingResults: Array<{
      operation: string; // 'parse' | 'filter' | 'aggregate' | 'transform' | 'analyze'
      format: string; // 'csv' | 'json'
      timestamp: string;
      data: any;
      summary: any;
      error?: string;
    }>;
  };

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

    // 모든 웹 검색 결과를 병합합니다
    if (webSearchCompletions.length > 0) {
      // 각 검색 결과에서 모든 searches 항목을 추출
      const allSearches: any[] = [];
      
      // web_search_complete 어노테이션에서 검색 결과 수집
      webSearchCompletions.forEach(completion => {
        if (completion.data && completion.data.searches) {
          allSearches.push(...completion.data.searches);
        }
      });
      
      if (allSearches.length > 0) {
        // 중복 제거를 위한 맵 생성 (query와 URL 조합으로 유일성 확인)
        const uniqueResults = new Map<string, any>();
        
        // 모든 검색 결과를 정리하고 중복 제거
        allSearches.forEach(search => {
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
          
          // 결과 추가 (중복 제거)
          if (search.results) {
            search.results.forEach((result: any) => {
              if (!urlSet.has(result.url)) {
                currentSearch.results.push(result);
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
        
        return {
          result: { searches: Array.from(uniqueResults.values()) } as any,
          args: null,
          annotations: queryCompletions
        };
      }
    }
    
    // Check for stored tool results first
    if ((message as any).tool_results) {
      const toolResults = (message as any).tool_results;
      
      // Handle both new and legacy formats
      let mergedSearches: any[] = [];
      
      if (toolResults.webSearchResults) {
        // New format with webSearchResults key
        mergedSearches = Array.isArray(toolResults.webSearchResults)
          ? toolResults.webSearchResults.flatMap((r: any) => r.searches || [])
          : [];
      } else if (Array.isArray(toolResults) && toolResults[0]?.searches) {
        // Legacy format with searches key
        mergedSearches = toolResults.flatMap((r: any) => r.searches || []);
      }
      
      if (mergedSearches.length > 0) {
        return {
          result: { searches: mergedSearches } as any,
          args: null,
          annotations: queryCompletions
        };
      }
    }
    
    // If no parts property or it's empty, return null or loading state
    if (!message.parts || message.parts.length === 0) {
      // If we have query completions, we can show a loading state
      if (queryCompletions.length > 0) {
        return {
          result: null,
          args: { queries: [], maxResults: [], topics: [], searchDepth: [] },
          annotations: queryCompletions
        };
      }
      return null;
    }
    
    // Collect all results and args from tool invocations
    const allResults: any[] = [];
    const allArgs: any[] = [];
    
    for (const part of message.parts) {
      if (part?.type === 'tool-invocation' && part.toolInvocation?.toolName === 'web_search') {
        try {
          const invocation = part.toolInvocation as any;
          if (invocation.args) allArgs.push(JSON.parse(JSON.stringify(invocation.args)));
          if (invocation.result) allResults.push(JSON.parse(JSON.stringify(invocation.result)));
        } catch (error) {
          console.error('Error parsing web search results:', error);
        }
      }
    }
    
    // Check web_search_complete annotations
    if (message.annotations && allResults.length === 0) {
      const webSearchAnnotations = (message.annotations as any[])
        .filter(a => a?.type === 'web_search_complete');
      
      if (webSearchAnnotations.length > 0) {
        const searches = webSearchAnnotations
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
          return {
            result: { searches } as any,
            args: allArgs[0] || null,
            annotations: queryCompletions
          };
        }
      }
    }
    
    // Process real-time search results
    if (allResults.length > 0) {
      const mergedSearches = allResults.flatMap(result => result.searches || []);
      
      if (mergedSearches.length > 0) {
        return {
          result: { searches: mergedSearches } as any,
          args: allArgs[0] || null,
          annotations: queryCompletions
        };
      }
    }
    
    // Extract queries for loading state
    if (allArgs.length > 0) {
      return {
        result: null,
        args: allArgs[0],
        annotations: queryCompletions
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

  // Extract data processor results from message annotations and tool_results
  export const getDataProcessorData = (message: Message): DataProcessorData | null => {
    // 1. Check stored results in database (tool_results.dataProcessorResults)
    if ((message as any).tool_results?.dataProcessorResults) {
      const processingResults = (message as any).tool_results.dataProcessorResults;
      if (Array.isArray(processingResults) && processingResults.length > 0) {
        return { processingResults };
      }
    }
    
    // 2. Check snake case variant (data_processor_results)
    if ((message as any).tool_results?.data_processor_results) {
      const processingResults = (message as any).tool_results.data_processor_results;
      if (Array.isArray(processingResults) && processingResults.length > 0) {
        return { processingResults };
      }
    }
    
    // 3. Check if stored directly in tools object
    if ((message as any).tool_results?.tools?.data_processor?.processingResults) {
      const processingResults = (message as any).tool_results.tools.data_processor.processingResults;
      if (Array.isArray(processingResults) && processingResults.length > 0) {
        return { processingResults };
      }
    }
    
    // 4. Check real-time annotations
    if (message.annotations && message.annotations.length > 0) {
      // Check for completed data processing annotations
      const dataProcessorAnnotations = (message.annotations as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'data_processing_complete')
        .map(a => a.data)
        .filter(Boolean);
      
      if (dataProcessorAnnotations.length > 0) {
        // Convert annotation format to processingResults format
        const processingResults = dataProcessorAnnotations.map(annotation => {
          // Convert to consistent format
          return {
            operation: annotation.operation || 'parse',
            format: annotation.format || 'json',
            timestamp: annotation.timestamp || new Date().toISOString(),
            data: annotation.result?.data || annotation.data || {},
            summary: annotation.result?.summary || annotation.summary || {},
            error: annotation.error || undefined
          };
        });
        
        return { processingResults };
      }
      
      // Check for annotations of operations in progress
      const startAnnotations = (message.annotations as any[])
        .filter(a => a && typeof a === 'object' && a.type === 'data_processing_start')
        .map(a => a.data)
        .filter(Boolean);
      
      if (startAnnotations.length > 0) {
        // Include only information about started operations
        const processingResults = startAnnotations.map(annotation => ({
          operation: annotation.operation || 'parse',
          format: annotation.format || 'json',
          timestamp: annotation.timestamp || new Date().toISOString(),
          data: {}, // Use empty object instead of null
          summary: { status: 'processing' },
          error: undefined
        }));
        
        return { processingResults };
      }
    }
    
    // 5. Check for tool calls in parts object
    if (message.parts && message.parts.length > 0) {
      const dataProcessorInvocations = message.parts
        .filter(part => part?.type === 'tool-invocation' && 
                (part as any).toolInvocation?.toolName === 'data_processor')
        .map(part => {
          const invocation = (part as any).toolInvocation;
          try {
            const args = invocation.args ? JSON.parse(JSON.stringify(invocation.args)) : {};
            const result = invocation.result ? JSON.parse(JSON.stringify(invocation.result)) : {};
            
            return {
              operation: args.operation || 'parse',
              format: args.format || 'json',
              timestamp: result.timestamp || new Date().toISOString(),
              data: result.data || {},
              summary: result.summary || {},
              error: result.error || undefined
            };
          } catch (e) {
            console.error('Error parsing data processor invocation:', e);
            return null;
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      
      if (dataProcessorInvocations.length > 0) {
        return { processingResults: dataProcessorInvocations };
      }
    }
    
    // No data processor results
    return null;
  };
