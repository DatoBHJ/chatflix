import React, { memo, useMemo, useState, useCallback, useEffect } from 'react'
import { Search, Calculator, Link2, ImageIcon, BookOpen, Youtube, Wrench } from 'lucide-react'
import { XLogo, YouTubeLogo } from '../CanvasFolder/CanvasLogo'

// Create CanvasToolsPreview component
export const CanvasToolsPreview = memo(function CanvasToolsPreview({
  webSearchData,
  mathCalculationData,
  linkReaderData,
  imageGeneratorData,
  academicSearchData,
  xSearchData,
  youTubeSearchData,
  youTubeLinkAnalysisData,
  messageId,
  togglePanel,
  contentOnly = false
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
  contentOnly?: boolean; // 버블 없이 내용만 렌더링
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const tools = useMemo(() => {
    const activeTools = [];
    
    if (webSearchData) {
      const queries = (webSearchData.args?.queries || []) as string[];
      let displayText = '';
      
      if (queries.length > 0) {
        displayText = queries.slice(0, 2).map((q: string) => `"${q}"`).join(', ');
        if (queries.length > 2) {
          displayText += ` +${queries.length - 2} more`;
        }
      } else {
        const fallbackQueries = webSearchData.results?.flatMap((r: any) => 
          r.searches?.map((s: any) => s.query).filter(Boolean) || []
        ) || [];
        
        if (fallbackQueries.length > 0) {
          const uniqueQueries = [...new Set(fallbackQueries)] as string[];
          displayText = uniqueQueries.slice(0, 2).map((q: string) => `"${q}"`).join(', ');
          if (uniqueQueries.length > 2) {
            displayText += ` +${uniqueQueries.length - 2} more`;
          }
        } else {
          displayText = 'Web search performed';
        }
      }
      
      let actualStatus = 'completed';
      if (webSearchData.results && webSearchData.results.length > 0) {
        const hasInProgressSearch = webSearchData.results.some((r: any) => r.isComplete === false);
        if (hasInProgressSearch) {
          actualStatus = 'processing';
        }
      } else if (webSearchData.status) {
        actualStatus = webSearchData.status;
      } else if (queries.length > 0 && (!webSearchData.results || webSearchData.results.length === 0)) {
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'web-search',
        name: 'Web Search',
        icon: <Search size={14} />,
        status: actualStatus,
        displayText
      });
    }
    
    if (mathCalculationData) {
      const steps = mathCalculationData.calculationSteps || [];
      let displayText = '';
      
      if (steps.length > 0) {
        const expressions = steps.map((step: any) => step.expression).filter(Boolean);
        
        if (expressions.length > 0) {
          if (expressions.length === 1) {
            displayText = expressions[0].length > 30 ? expressions[0].substring(0, 30) + '...' : expressions[0];
          } else {
            const firstExpr = expressions[0].length > 20 ? expressions[0].substring(0, 20) + '...' : expressions[0];
            const secondExpr = expressions[1].length > 20 ? expressions[1].substring(0, 20) + '...' : expressions[1];
            displayText = `${firstExpr}, ${secondExpr}`;
            if (expressions.length > 2) {
              displayText += ` +${expressions.length - 2} more`;
            }
          }
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
        displayText
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
            displayText = title && title.length < 30 ? title : domain || url;
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
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    if (imageGeneratorData) {
      const images = imageGeneratorData.generatedImages || [];
      let displayText = '';
      
      if (images.length > 0) {
        const firstImage = images[0];
        const prompt = firstImage.prompt || '';
        
        if (prompt) {
          displayText = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
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
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    if (academicSearchData) {
      const results = academicSearchData.academicResults || [];
      let displayText = '';
      
      if (results.length > 0) {
        const queries = results.map((r: any) => r.query).filter(Boolean);
        
        if (queries.length > 0) {
          displayText = queries.length === 1 
            ? `"${queries[0]}"` 
            : `"${queries[0]}" +${queries.length - 1} more topics`;
        } else {
          displayText = `${results.length} academic search${results.length > 1 ? 'es' : ''}`;
        }
      } else {
        displayText = 'Academic research';
      }
      
      let actualStatus = 'completed';
      if (academicSearchData.status) {
        actualStatus = academicSearchData.status;
      } else if (results.length === 0) {
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'academic-search',
        name: 'Academic Search',
        icon: <BookOpen size={14} />,
        status: actualStatus,
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    if (xSearchData) {
      const results = xSearchData.xResults || [];
      let displayText = '';
      
      if (results.length > 0) {
        const queries = results.map((r: { query: any }) => r.query).filter(Boolean);
        
        if (queries.length > 0) {
          displayText = queries.length === 1 
            ? `"${queries[0]}"` 
            : `"${queries[0]}" +${queries.length - 1} more`;
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
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    if (youTubeSearchData) {
      const results = youTubeSearchData.youtubeResults || [];
      let displayText = '';
      
      if (results.length > 0) {
        const queries = results.map((r: { query: any }) => r.query).filter(Boolean);
        
        if (queries.length > 0) {
          displayText = queries.length === 1 
            ? `"${queries[0]}"` 
            : `"${queries[0]}" +${queries.length - 1} more`;
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
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
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
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    return activeTools;
  }, [webSearchData, mathCalculationData, linkReaderData, imageGeneratorData, academicSearchData, xSearchData, youTubeSearchData, youTubeLinkAnalysisData]);
  
  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const handleToolClick = useCallback((toolId: string) => {
    if (togglePanel) {
      togglePanel(messageId, 'canvas', undefined, toolId);
    }
  }, [togglePanel, messageId]);

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'processing':
      case 'loading':
        return (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        );
      case 'completed':
      case 'success':
        return <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>;
      case 'error':
      case 'failed':
        return <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>;
      default:
        return <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>;
    }
  };

  if (tools.length === 0) return null;

  const hasProcessingTool = tools.some(tool => tool.status === 'processing' || tool.status === 'loading');

  // 도구가 진행 중일 때 자동으로 툴팁 표시
  useEffect(() => {
    if (hasProcessingTool && !contentOnly) {
      setIsExpanded(true);
    }
  }, [hasProcessingTool, contentOnly]);

  // contentOnly가 true면 도구 목록만 렌더링
  if (contentOnly) {
    return (
      <div className="space-y-2">
        {tools.map((tool) => (
          <div
            key={tool.id}
            onClick={() => handleToolClick(tool.id)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--accent)] transition-colors cursor-pointer group/tool"
          >
            <div className="flex items-center justify-center w-7 h-7">
              {tool.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-[var(--foreground)] truncate">
                  {tool.name}
                </span>
                {getStatusIndicator(tool.status)}
              </div>
              <div className="text-xs text-[var(--muted)] truncate">
                {tool.displayText}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      {/* Apple 스타일 미니 캔버스 버블 */}
      <div 
        className="group relative cursor-pointer"
        onClick={handleToggle}
      >
        {/* 메인 캔버스 버블 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-black/30 rounded-full backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 ease-out">
          <Wrench className="h-3.5 w-3.5" style={{ color: 'var(--tools-color)' }} strokeWidth={2} />
          
          {/* 도구 아이콘들 미리보기 */}
          <div className="flex items-center gap-1">
            {tools.slice(0, 3).map((tool) => (
              <div key={tool.id} className="flex items-center justify-center w-4 h-4">
                <div className="text-[var(--muted)] scale-75">
                  {tool.icon}
                </div>
              </div>
            ))}
            {tools.length > 3 && (
              <div className="text-xs text-[var(--muted)] ml-1">
                +{tools.length - 3}
              </div>
            )}
          </div>

                     {/* 전체 상태 표시 */}
           {hasProcessingTool ? (
             <span className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
             </span>
           ) : (
             <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
           )}
        </div>

        {/* 작은 연결 버블들 */}
        <div className="absolute -bottom-0.5 left-4 flex gap-0.5">
          <div className="w-1 h-1 bg-white/60 dark:bg-black/20 rounded-full"></div>
          <div className="w-0.5 h-0.5 bg-white/40 dark:bg-black/15 rounded-full"></div>
        </div>

        {/* 확장된 상세 정보 툴팁 */}
        <div className={`absolute top-full left-0 mt-3 w-72 sm:w-96 bg-white/95 dark:bg-black/90 backdrop-blur-xl rounded-2xl border border-black/8 dark:border-white/10 shadow-xl p-4 z-50 transition-all duration-200 ease-out ${
          isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
        }`}>
          {/* 툴팁 화살표 */}
          <div className="absolute -top-1.5 left-6 w-3 h-3 bg-white/95 dark:bg-black/90 border-l border-t border-black/8 dark:border-white/10 rotate-45"></div>
          
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4" style={{ color: 'var(--tools-color)' }} strokeWidth={2} />
            <span className="text-sm font-medium text-[var(--foreground)]">Tools</span>
          </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePanel && togglePanel(messageId, 'canvas');
              }}
              className="text-xs px-2 py-1 rounded-full font-medium transition-colors"
              style={{ 
                backgroundColor: 'var(--status-bg-processing)', 
                color: 'var(--status-text-processing)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              View All
            </button>
          </div>
          
          {/* 도구 목록 */}
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {tools.map((tool) => (
              <div
                key={tool.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToolClick(tool.id);
                }}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--accent)] transition-colors cursor-pointer group/tool"
              >
                <div className="flex items-center justify-center w-7 h-7">
                  {tool.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-[var(--foreground)] truncate">
                      {tool.name}
                    </span>
                    {getStatusIndicator(tool.status)}
                  </div>
                  <div className="text-xs text-[var(--muted)] truncate">
                    {tool.displayText}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}); 