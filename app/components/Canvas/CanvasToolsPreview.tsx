import React, { memo, useMemo, useState, useCallback, useEffect } from 'react'
import { Calculator, Link2, ImageIcon, Youtube } from 'lucide-react'
import { XLogo, YouTubeLogo } from '../CanvasFolder/CanvasLogo'
import { getTopicIconComponent, getTopicName } from '../MultiSearch'

// Shimmer animation styles
const shimmerStyles = `
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;

// Create CanvasToolsPreview component
export const CanvasToolsPreview = memo(function CanvasToolsPreview({
  webSearchData,
  mathCalculationData,
  linkReaderData,
  imageGeneratorData,

  xSearchData,
  youTubeSearchData,
  youTubeLinkAnalysisData,
  messageId,
  togglePanel,
  hideToggle = false,
  activePanel
}: {
  webSearchData?: any;
  mathCalculationData?: any;
  linkReaderData?: any;
  imageGeneratorData?: any;
  academicSearchData?: any;
  xSearchData?: any;
  youTubeSearchData?: any;
  youTubeLinkAnalysisData?: any;
  messageId: string;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number, toolType?: string, fileName?: string) => void;
  hideToggle?: boolean;
  activePanel?: { messageId: string; type: string; toolType?: string } | null;
}) {
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);

  // 패널이 닫힐 때 선택 상태 리셋
  useEffect(() => {
    if (!activePanel || activePanel.messageId !== messageId || activePanel.type !== 'canvas') {
      setSelectedToolId(null);
    }
  }, [activePanel, messageId]);

  const tools = useMemo(() => {
    const activeTools = [];
    
    if (webSearchData) {
      const queries = (webSearchData.args?.queries || []) as string[];
      const topics = (webSearchData.args?.topics || []) as string[];
      
      // Handle case where queries might be a JSON string
      let processedQueries: string[] = [];
      if (Array.isArray(queries)) {
        processedQueries = queries;
      } else if (typeof queries === 'string') {
        try {
          const parsed = JSON.parse(queries);
          processedQueries = Array.isArray(parsed) ? parsed : [queries];
        } catch {
          processedQueries = [queries];
        }
      } else {
        processedQueries = [];
      }
      
      // Handle case where topics might be a JSON string
      let processedTopics: string[] = [];
      if (Array.isArray(topics)) {
        processedTopics = topics;
      } else if (typeof topics === 'string') {
        try {
          const parsed = JSON.parse(topics);
          processedTopics = Array.isArray(parsed) ? parsed : [topics];
        } catch {
          processedTopics = [topics];
        }
      } else {
        processedTopics = [];
      }
      
      // MultiSearch-style real-time updates: Create a map to track all queries and their states
      const searchMap = new Map<string, any>();
      
      // 1. Initialize all queries from args as "in_progress" (like MultiSearch does)
      processedQueries.forEach((query, index) => {
        searchMap.set(query, {
          query,
          topic: processedTopics[index] || processedTopics[0] || 'general',
          topicIcon: 'search',
          results: [],
          status: 'in_progress'
        });
      });
      
      // 2. Update with streaming results as they come in (like MultiSearch's allCompletedSearches)
      if (webSearchData.results) {
        webSearchData.results.forEach((result: any) => {
          if (result.searches) {
            result.searches.forEach((search: any) => {
              // Update existing entry or create new one
              searchMap.set(search.query, {
                ...search,
                status: result.isComplete ? 'completed' : 'in_progress'
              });
            });
          }
        });
      }
      
      // 3. Convert map to array and group by topic
      const searchResults = Array.from(searchMap.values());
      const topicMap = new Map<string, { topic: string; topicIcon: string; queries: string[]; status: 'processing' | 'completed'; count: number }>();
      
      searchResults.forEach((search: any) => {
        const topic = search.topic || 'general';
        const topicIcon = search.topicIcon || 'search';
        const status: 'processing' | 'completed' = search.status === 'in_progress' ? 'processing' : 'completed';
        const count = Array.isArray(search.results) ? search.results.length : 0;
        
        if (!topicMap.has(topic)) {
          topicMap.set(topic, { topic, topicIcon, queries: [search.query].filter(Boolean), status, count });
        } else {
          const entry = topicMap.get(topic)!;
          if (search.query) entry.queries.push(search.query);
          entry.status = entry.status === 'processing' || status === 'processing' ? 'processing' : 'completed';
          entry.count += count;
        }
      });
      
      // 4. Create one tool per topic (unique)
      Array.from(topicMap.values()).forEach((entry) => {
        activeTools.push({
          id: `web-search:topic:${entry.topic}`,
          name: getTopicName(entry.topic),
          icon: getTopicIconComponent(entry.topicIcon),
          status: entry.status,
          displayText: entry.queries.map(q => `"${q}"`).join(', '),
          topic: entry.topic,
          count: entry.count
        });
      });
    }
    
    if (mathCalculationData) {
      const steps = mathCalculationData.calculationSteps || [];
      let displayText = '';
      
      if (steps.length > 0) {
        const expressions = steps.map((step: any) => step.expression).filter(Boolean);
        
        if (expressions.length > 0) {
          displayText = expressions.join(', ');
        } else {
          displayText = `${steps.length} calculation step${steps.length > 1 ? 's' : ''}`;
        }
      } else {
        displayText = 'Mathematical calculation';
      }
      
      let actualStatus = 'completed';
      if (mathCalculationData.status) {
        actualStatus = mathCalculationData.status;
      } else if (steps.length === 0) {
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'calculator',
        name: 'Calculator',
        icon: <Calculator size={14} />,
        status: actualStatus,
        displayText,
        count: steps.length
      });
    }
    
    if (linkReaderData) {
      const attempts = linkReaderData.linkAttempts || [];
      let displayText = '';
      
      if (attempts.length > 0) {
        const validAttempts = attempts.filter((attempt: any) => !attempt.error);
        
        if (validAttempts.length > 0) {
          const attempt = validAttempts[0];
          const url = attempt.url || '';
          const title = attempt.title || '';
          
          try {
            const domain = url ? new URL(url).hostname.replace('www.', '') : '';
            displayText = title || domain || url;
          } catch {
            displayText = url;
          }
        } else {
          displayText = `${attempts.length} link${attempts.length > 1 ? 's' : ''} (failed)`;
        }
      } else {
        displayText = 'Link analysis';
      }
      
      let actualStatus = 'completed';
      if (linkReaderData.status) {
        actualStatus = linkReaderData.status;
      } else if (attempts.length > 0) {
        const inProgressAttempts = attempts.filter((attempt: any) => attempt.status === 'in_progress');
        
        if (inProgressAttempts.length > 0) {
          actualStatus = 'processing';
        } else {
          const hasSuccess = attempts.some((a: any) => a.status === 'success');
          actualStatus = hasSuccess ? 'completed' : 'error';
        }
      }
      
      activeTools.push({
        id: 'link-reader',
        name: 'Link Reader',
        icon: <Link2 size={14} />,
        status: actualStatus,
        displayText,
        count: attempts.length
      });
    }
    
    if (imageGeneratorData) {
      const images = imageGeneratorData.generatedImages || [];
      let displayText = '';
      
      if (images.length > 0) {
        const firstImage = images[0];
        const prompt = firstImage.prompt || '';
        
        if (prompt) {
          displayText = prompt;
        } else {
          displayText = `${images.length} image${images.length > 1 ? 's' : ''} generated`;
        }
      } else {
        displayText = 'Image generation';
      }
      
      let actualStatus = 'completed';
      if (imageGeneratorData.status) {
        actualStatus = imageGeneratorData.status;
      } else if (images.length === 0) {
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'image-generator',
        name: 'Image Generator',
        icon: <ImageIcon size={14} />,
        status: actualStatus,
        displayText,
        count: images.length
      });
    }
    

    
    if (xSearchData) {
      const results = xSearchData.xResults || [];
      let displayText = '';
      
      if (results.length > 0) {
        const queries = results.map((r: { query: any }) => r.query).filter(Boolean);
        
        if (queries.length > 0) {
          displayText = queries.map((q: string) => `"${q}"`).join(', ');
        } else {
          displayText = `${results.length} X search${results.length > 1 ? 'es' : ''}`;
        }
      } else {
        displayText = 'X/Twitter search';
      }
      
      let actualStatus = 'completed';
      if (xSearchData.status) {
        actualStatus = xSearchData.status;
      } else if (results.length === 0) {
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'x-search',
        name: 'X Search',
        icon: <XLogo size={14} />,
        status: actualStatus,
        displayText,
        count: results.length
      });
    }
    
    if (youTubeSearchData) {
      const results = youTubeSearchData.youtubeResults || [];
      let displayText = '';
      
      if (results.length > 0) {
        const queries = results.map((r: { query: any }) => r.query).filter(Boolean);
        
        if (queries.length > 0) {
          displayText = queries.map((q: string) => `"${q}"`).join(', ');
        } else {
          displayText = `${results.length} YouTube search${results.length > 1 ? 'es' : ''}`;
        }
      } else {
        displayText = 'YouTube search';
      }
      
      let actualStatus = 'completed';
      if (youTubeSearchData.status) {
        actualStatus = youTubeSearchData.status;
      } else if (results.length === 0) {
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'youtube-search',
        name: 'YouTube Search',
        icon: <YouTubeLogo size={14} />,
        status: actualStatus,
        displayText,
        count: results.length
      });
    }
    
    if (youTubeLinkAnalysisData) {
      const results = youTubeLinkAnalysisData.analysisResults || [];
      let displayText = '';
      
      if (results.length > 0) {
        const firstResult = results[0];
        
        if (firstResult.error) {
          displayText = 'Analysis failed';
        } else {
          const title = firstResult.details?.title || '';
          const channel = firstResult.channel?.name || '';
          
          if (title) {
            displayText = title;
          } else if (channel) {
            displayText = `Video from ${channel}`;
          } else {
            displayText = 'YouTube video analyzed';
          }
        }
      } else {
        displayText = 'YouTube analysis';
      }
      
      let actualStatus = 'completed';
      if (youTubeLinkAnalysisData.status) {
        actualStatus = youTubeLinkAnalysisData.status;
      } else if (results.length === 0) {
        actualStatus = 'processing';
      } else {
        const hasIncompleteAnalysis = results.some((r: { error: any, details?: any }) => 
          !r.error && !r.details
        );
        
        if (hasIncompleteAnalysis) {
          actualStatus = 'processing';
        } else {
          const hasSuccess = results.some((r: { error: any }) => !r.error);
          actualStatus = hasSuccess ? 'completed' : 'error';
        }
      }
      
      activeTools.push({
        id: 'youtube-analyzer',
        name: 'YouTube Analyzer',
        icon: <Youtube size={14} />,
        status: actualStatus,
        displayText,
        count: results.length
      });
    }
    
    return activeTools;
  }, [webSearchData, mathCalculationData, linkReaderData, imageGeneratorData, xSearchData, youTubeSearchData, youTubeLinkAnalysisData]);
  


  const handleToolClick = useCallback((tool: any) => {
    // 같은 도구를 다시 클릭하면 선택 해제, 아니면 선택
    if (selectedToolId === tool.id) {
      setSelectedToolId(null);
    } else {
      setSelectedToolId(tool.id);
    }
    
    if (togglePanel) {
      if (typeof tool?.id === 'string' && tool.id.startsWith('web-search-')) {
        const topic = tool?.topic || 'general';
        togglePanel(messageId, 'canvas', undefined, `web-search:topic:${topic}`);
      } else if (typeof tool?.id === 'string') {
        togglePanel(messageId, 'canvas', undefined, tool.id);
      } else {
        togglePanel(messageId, 'canvas', undefined, undefined);
      }
    }
  }, [togglePanel, messageId, selectedToolId]);



  if (tools.length === 0) return null;


  return (
    <div className="my-0 text-sm font-sans max-w-[85%] md:max-w-[75%] lg:max-w-[65%] xl:max-w-[60%]">
      <style>{shimmerStyles}</style>
      
      {/* AI Analysis 제목과 도구 목록 */}
      <div className={hideToggle ? "pt-0 pb-8" : "pt-12 sm:pt-30 pb-8"}>
        
        <div className={hideToggle ? "text-base text-[var(--muted)]" : "mt-10 text-base text-[var(--muted)]"}>
          <div className="space-y-3 pl-1.5">
       {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool)}
            className="flex items-center gap-2 cursor-pointer"
          >
             {/* Tool 아이콘 */}
             <div className="text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
               {tool.icon}
             </div>
            
            <span 
              className={`text-base font-medium text-[var(--foreground)] ${
                (tool.status === 'processing' || tool.status === 'loading') 
                  ? 'bg-gradient-to-r from-transparent via-gray-400 to-transparent bg-clip-text text-transparent' 
                  : ''
              }`}
              style={tool.status === 'processing' || tool.status === 'loading' ? {
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s ease-in-out infinite'
              } : {}}
            >
              {tool.name}
            </span>
            
            {tool.count > 0 && (
              <span className="text-xs text-[var(--muted)]">
                {tool.count}
              </span>
            )}
           
          </button>
       ))}
          </div>
        </div>
      </div>
    </div>
  );
}); 