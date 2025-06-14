import React, { memo, useMemo } from 'react'
import { Search, Calculator, Link2, ImageIcon, BookOpen, Youtube, Monitor } from 'lucide-react'
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
  togglePanel
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
}) {
  const tools = useMemo(() => {
    const activeTools = [];
    
    if (webSearchData) {
      // Extract search queries from args.queries
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
        icon: <Search size={16} />,
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
        icon: <Calculator size={16} />,
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
        icon: <Link2 size={16} />,
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
        icon: <ImageIcon size={16} />,
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
        icon: <BookOpen size={16} />,
        status: actualStatus,
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    if (xSearchData) {
      // Extract search queries from X results
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
      
      // Determine actual status - X search is completed when results exist
      let actualStatus = 'completed';
      if (xSearchData.status) {
        actualStatus = xSearchData.status;
      } else if (results.length === 0) {
        // If no results yet, it might be processing
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'x-search',
        name: 'X Search',
        icon: <XLogo size={16} />,
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
        icon: <YouTubeLogo size={16} />,
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
        icon: <Youtube size={16} />,
        status: actualStatus,
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    return activeTools;
  }, [webSearchData, mathCalculationData, linkReaderData, imageGeneratorData, academicSearchData, xSearchData, youTubeSearchData, youTubeLinkAnalysisData]);
  
  if (tools.length === 0) return null;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
      case 'loading':
        return 'text-amber-400';
      case 'completed':
      case 'success':
        return 'text-green-400';
      case 'error':
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-blue-400';
    }
  };
  
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
        return (
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        );
      case 'error':
      case 'failed':
        return (
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        );
      default:
        return (
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
        );
    }
  };
  
  return (
    <div className="mb-6 p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Monitor className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
          <h2 className="font-medium text-left tracking-tight">Canvas Preview</h2>
        </div>
        <button
          onClick={() => togglePanel && togglePanel(messageId, 'canvas')}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] rounded-lg transition-colors"
        >
          <span>View All</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </button>
      </div>
      
      <div className="grid gap-3">
        {tools.map((tool, index) => (
          <div
            key={tool.id}
            className="flex items-center gap-3 p-3 bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] rounded-lg min-w-0 cursor-pointer hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors"
            onClick={() => togglePanel && togglePanel(messageId, 'canvas', undefined, tool.id)}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] flex-shrink-0">
              {tool.icon}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <span className="text-sm font-medium truncate">{tool.name}</span>
                <div className="flex-shrink-0">
                  {getStatusIndicator(tool.status)}
                </div>
              </div>
              <div className="text-xs text-[var(--muted)] truncate">
                {tool.displayText}
              </div>
            </div>
            <div className={`text-xs font-medium flex-shrink-0 max-w-[80px] sm:max-w-none truncate ${getStatusColor(tool.status)}`}>
              <span className="hidden sm:inline">
                {tool.status === 'processing' || tool.status === 'loading' ? 'Processing' : 
                 tool.status === 'completed' || tool.status === 'success' ? 'Complete' :
                 tool.status === 'error' || tool.status === 'failed' ? 'Failed' : 'Ready'}
              </span>
              <span className="sm:hidden">
                {tool.status === 'processing' || tool.status === 'loading' ? 'Processing' : 
                 tool.status === 'completed' || tool.status === 'success' ? 'Complete' :
                 tool.status === 'error' || tool.status === 'failed' ? 'Error' : 'Ready'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}); 