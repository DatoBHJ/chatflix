import { useState, useMemo, memo, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import mermaid from 'mermaid';
import { MathJaxEquation } from './math/MathJaxEquation';
import React from 'react';

// Initialize mermaid with dark theme support
const initMermaid = () => {
  try {
    // Detect current theme
    const isDarkMode = () => {
      if (typeof window === 'undefined') return false; // Default to light in SSR
      
      const theme = document.documentElement.getAttribute('data-theme');
      if (theme === 'dark') return true;
      if (theme === 'light') return false;
      
      // For system theme, check media query
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    };
    
    const dark = isDarkMode();
    
    // Theme configuration based on current mode
    const themeConfig = {
      // Light theme colors
      light: {
        background: '#ffffff',
        nodeBkg: '#f8f9fa',
        nodeText: '#333333',
        mainBkg: '#f5f5f5',
        mainText: '#111111',
        secondaryBkg: '#e9ecef',
        secondaryText: '#444444',
        tertiaryBkg: '#dee2e6',
        tertiaryText: '#555555',
        primaryColor: '#4C566A',
        primaryTextColor: '#333333',
        primaryBorderColor: '#adb5bd',
        lineColor: '#5E81AC',
        secondaryColor: '#81A1C1', 
        tertiaryColor: '#88C0D0',
        noteBkgColor: '#fff8dc',
        noteTextColor: '#333333',
        titleColor: '#333333',
        edgeLabelBackground: '#ffffff',
        edgeColor: '#333333'
      },
      // Dark theme colors
      dark: {
        background: 'transparent',
        nodeBkg: '#2a2a2a',
        nodeText: '#e5e5e5',
        mainBkg: '#1a1a1a',
        mainText: '#e5e5e5',
        secondaryBkg: '#262626',
        secondaryText: '#d4d4d4',
        tertiaryBkg: '#333333',
        tertiaryText: '#cccccc',
        primaryColor: '#4C566A',
        primaryTextColor: '#ECEFF4',
        primaryBorderColor: '#D8DEE9',
        lineColor: '#81A1C1',
        secondaryColor: '#5E81AC', 
        tertiaryColor: '#88C0D0',
        noteBkgColor: '#464646',
        noteTextColor: '#e5e5e5',
        titleColor: '#e5e5e5',
        edgeLabelBackground: '#1a1a1a',
        edgeColor: '#d4d4d4'
      }
    };
    
    // Select appropriate theme colors
    const theme = dark ? themeConfig.dark : themeConfig.light;
    
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      fontFamily: 'system-ui, sans-serif',
      fontSize: 14,
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
        useMaxWidth: true,
        diagramPadding: 8,
        nodeSpacing: 40,
        rankSpacing: 40,
      },
      themeVariables: {
        // Core colors
        primaryColor: theme.primaryColor,
        primaryTextColor: theme.primaryTextColor,
        primaryBorderColor: theme.primaryBorderColor,
        lineColor: theme.lineColor,
        secondaryColor: theme.secondaryColor, 
        tertiaryColor: theme.tertiaryColor,
        
        // Background and text colors
        background: theme.background,
        mainBkg: theme.mainBkg,
        mainText: theme.mainText,
        secondaryBkg: theme.secondaryBkg,
        secondaryText: theme.secondaryText,
        tertiaryBkg: theme.tertiaryBkg,
        tertiaryText: theme.tertiaryText,
        
        // Node colors
        nodeBkg: theme.nodeBkg,
        nodeBorder: theme.primaryBorderColor,
        nodeTextColor: theme.nodeText,
        
        // Note colors
        noteBkgColor: theme.noteBkgColor,
        noteTextColor: theme.noteTextColor,
        noteBorderColor: dark ? '#555555' : '#999999',
        
        // Edge and label colors
        edgeLabelBackground: theme.edgeLabelBackground,
        edgeColor: theme.edgeColor,
        titleColor: theme.titleColor,
        
        // Class diagram colors
        classText: theme.mainText,
        
        // Entity relation colors
        entityBorder: theme.primaryBorderColor,
        entityText: theme.mainText,
        
        // State colors
        labelColor: theme.mainText,
        altBackground: dark ? '#333333' : '#f8f9fa',
      },
      // 다이어그램별 설정 추가
      sequence: {
        useMaxWidth: true,
        boxMargin: 10,
        mirrorActors: false,
        actorMargin: 100,
        messageMargin: 40,
        boxTextMargin: 8,
        noteMargin: 10,
        messageAlign: 'center',
        actorFontWeight: 'bold',
        actorFontSize: 14,
        noteFontSize: 14,
        messageFontSize: 13,
      },
      gantt: {
        titleTopMargin: 25,
        barHeight: 20,
        barGap: 4,
        useMaxWidth: true,
        topPadding: 50,
        leftPadding: 75,
        rightPadding: 20,
        gridLineStartPadding: 35,
        fontSize: 14,
        sectionFontSize: 14,
        numberSectionStyles: 4,
      },
      pie: {
        useMaxWidth: true,
        textPosition: 0.5,
      },
      class: {
        useMaxWidth: true,
        textHeight: 14,
      },
      // 전역 설정으로 더 안정적인 파싱
      logLevel: 'error',
      deterministicIds: false
    });
    
    // Add listener for theme changes
    if (typeof window !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              mutation.attributeName === 'data-theme') {
            // Re-initialize mermaid with new theme
            initMermaid();
          }
        });
      });
      
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
      });
      
      // Also listen for system preference changes
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', initMermaid);
    }
  } catch (error) {
    console.error('Mermaid initialization error:', error);
  }
};

// Mermaid component for rendering diagrams
const MermaidDiagram = memo(({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [renderAttempts, setRenderAttempts] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<string>(chart);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoCompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const id = useMemo(() => `mermaid-${Math.random().toString(36).substring(2, 11)}`, []);

  // List of valid diagram types for validation
  const diagramTypes = [
    'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 
    'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie', 
    'requirementDiagram', 'gitGraph', 'timeline', 'mindmap'
  ];

  // Clean up all timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      if (autoCompleteTimeoutRef.current) clearTimeout(autoCompleteTimeoutRef.current);
    };
  }, []);

  // Always update the chart ref when the chart changes
  useEffect(() => {
    chartRef.current = chart;
    
    // Clear existing timeouts
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = null;
    }
    
    if (autoCompleteTimeoutRef.current) {
      clearTimeout(autoCompleteTimeoutRef.current);
      autoCompleteTimeoutRef.current = null;
    }
    
    // Reset to initial state on new chart content
    setRenderAttempts(0);
    
    // Don't start loading for very short content (likely incomplete)
    if (!chart || chart.trim().length < 10) {
      return;
    }
    
    setIsLoading(true);
    
    // Most important check: Is this a complete markdown code block?
    // This is the most reliable way to ensure the diagram is complete
    const isCodeBlockComplete = () => {
      // For a complete mermaid block in markdown, we need:
      // 1. Starting with ```mermaid (with possible spaces before)
      // 2. Ending with ``` (with possible spaces after)
      const trimmedChart = chart.trim();
      const hasStart = /^\s*```\s*mermaid/i.test(trimmedChart);
      const hasEnd = /```\s*$/m.test(trimmedChart);
      
      // Only consider it complete if it has proper start and end
      return hasStart && hasEnd;
    };
    
    // Check completeness in multiple ways
    const isContentLikelyComplete = () => {
      const trimmedChart = chart.trim();
      
      // If it's not a complete code block, it's definitely not complete
      if (!isCodeBlockComplete()) {
        return false;
      }
      
      // Extract diagram content (content between ```mermaid and ```)
      let diagramContent = trimmedChart;
      const startMatch = diagramContent.match(/^\s*```\s*mermaid\s*\n/i);
      if (startMatch) {
        diagramContent = diagramContent.substring(startMatch[0].length);
      }
      const endMatch = diagramContent.match(/\n\s*```\s*$/);
      if (endMatch) {
        diagramContent = diagramContent.substring(0, diagramContent.length - endMatch[0].length);
      }
      
      // Sanity check on content
      if (diagramContent.trim().length < 5) {
        return false;
      }
      
      // Check for diagram type (should be first word in content)
      const firstWord = diagramContent.trim().split(/\s+/)[0]?.toLowerCase();
      if (!diagramTypes.some(type => firstWord === type.toLowerCase())) {
        return false;
      }
      
      // Check minimum content based on type
      if (firstWord === 'flowchart' || firstWord === 'graph') {
        // Flowcharts need at least one arrow or node
        return (diagramContent.includes('-->') || diagramContent.includes('->')) && 
               diagramContent.includes('[') && diagramContent.includes(']');
      } else if (firstWord === 'sequencediagram') {
        // Sequence diagrams need at least one participant and one arrow
        return diagramContent.toLowerCase().includes('participant') && 
               (diagramContent.includes('->>') || diagramContent.includes('->'));
      } else if (firstWord === 'classdiagram') {
        // Class diagrams need at least one class definition
        return diagramContent.toLowerCase().includes('class');
      } else if (firstWord === 'gantt') {
        // Gantt charts need at least one section and one task
        return diagramContent.toLowerCase().includes('section') && 
               diagramContent.split('\n').length > 3;
      } else if (firstWord === 'pie') {
        // Pie charts need at least one segment
        return diagramContent.includes(':') && diagramContent.includes('"');
      }
      
      // For other diagram types, just check number of lines
      return diagramContent.split('\n').length >= 3;
    };
    
    // Always set a timeout to end loading state after max wait time (5 seconds)
    // This ensures UI won't be stuck in loading state indefinitely
    autoCompleteTimeoutRef.current = setTimeout(() => {
      // If still loading after timeout, force complete
      if (isLoading) {
        setIsComplete(true);
        setIsLoading(false);
        console.log('Mermaid rendering timeout - forcing completion');
      }
    }, 5000);
    
    // If content seems complete, schedule rendering with a significant delay
    if (isContentLikelyComplete()) {
      setIsComplete(true);
      
      // Wait a bit to ensure streaming is done (conservative approach)
      renderTimeoutRef.current = setTimeout(() => {
        renderDiagram();
      }, 300);
    } else {
      setIsComplete(false);
      
      // For incomplete content, set a long delay
      renderTimeoutRef.current = setTimeout(() => {
        // Check again if the content seems complete now
        if (isContentLikelyComplete()) {
          setIsComplete(true);
          renderDiagram();
        } else {
          // Still incomplete, check one more time after a short delay
          renderTimeoutRef.current = setTimeout(() => {
            setIsComplete(true); // Assume it's complete after max wait
            renderDiagram();
          }, 1000);
        }
      }, 1000);
    }
  }, [chart]);

  const renderDiagram = async () => {
    try {
      // Defensive check - don't render if no content
      if (!chartRef.current.trim()) {
        setIsLoading(false);
        return;
      }
      
      // Track attempts
      setRenderAttempts(prev => prev + 1);
      
      // Process the diagram content
      // Extract the actual diagram content (without markdown code block markers)
      let diagramContent = chartRef.current.trim();
      
      // Remove markdown code block markers if present
      const startMatch = diagramContent.match(/^\s*```\s*mermaid\s*\n/i);
      if (startMatch) {
        diagramContent = diagramContent.substring(startMatch[0].length);
      }
      const endMatch = diagramContent.match(/\n\s*```\s*$/);
      if (endMatch) {
        diagramContent = diagramContent.substring(0, diagramContent.length - endMatch[0].length);
      }
      
      // Clean up content
      let cleanChart = diagramContent.trim();
      
      // Ensure diagram type is specified
      const hasType = diagramTypes.some(type => 
        cleanChart.trim().toLowerCase().startsWith(type.toLowerCase())
      );
      
      if (!hasType) {
        // Default to flowchart if no type is specified
        cleanChart = 'flowchart TD\n' + cleanChart;
      }
      
      // Standardize syntax - upgrade older graph syntax to flowchart
      cleanChart = cleanChart.replace(/^graph\s+/i, 'flowchart ');
      
      // Enhanced handling for Korean and special characters in nodes
      if (cleanChart.startsWith('flowchart') || cleanChart.startsWith('graph')) {
        // 1. 다이아몬드 노드(중괄호) 처리: B{사용량 측정} 형태를 B["사용량 측정"] 형태로 변환
        cleanChart = cleanChart.replace(/([A-Za-z0-9_]+)\{([^}]+)\}/g, (match, id, content) => {
          return `${id}["${content}"]`;
        });
        
        // 2. 화살표 주변의 노드 ID에 따옴표 추가 (A --> B{내용} 형태 처리)
        cleanChart = cleanChart.replace(/(-->|==>|-.->|===>|-.->)\s*([A-Za-z0-9_]+)\{([^}]+)\}/g, 
          (match, arrow, id, content) => `${arrow} ${id}["${content}"]`);
          
        // 3. 일반 대괄호 노드 처리: 모든 노드 내용에 따옴표 추가
        cleanChart = cleanChart.replace(/\[([^\]"]+)\]/g, (match, content) => {
          return `["${content}"]`;
        });
        
        // 4. 화살표 레이블 처리 (A -->|레이블| B 형태)
        cleanChart = cleanChart.replace(/-->\|([^|]+)\|/g, (match, label) => {
          return `-->|"${label}"|`;
        });
      }
      
      // 시퀀스 다이어그램 한글 처리 강화
      if (cleanChart.startsWith('sequenceDiagram')) {
        // 참여자(Participant)의 한글 이름 따옴표 처리
        cleanChart = cleanChart.replace(/(participant|actor)\s+([^"<:\s]+[^\s]*)/g, 
          (match, type, name) => {
            // 이미 따옴표가 있는 경우 그대로 유지
            if (name.startsWith('"') && name.endsWith('"')) return match;
            return `${type} "${name}"`;
          });
          
        // 메시지 화살표에서 한글 처리
        cleanChart = cleanChart.replace(/([^\s"]+)\s*(->>|->|-->>|-->|=>|==>|x)\s*([^\s":]+)\s*:/g, 
          (match, from, arrow, to) => {
            let newFrom = from;
            let newTo = to;
            
            // 따옴표로 감싸져 있지 않으면 추가
            if (!(from.startsWith('"') && from.endsWith('"'))) {
              newFrom = `"${from}"`;
            }
            
            if (!(to.startsWith('"') && to.endsWith('"'))) {
              newTo = `"${to}"`;
            }
            
            return `${newFrom}${arrow}${newTo}:`;
          });
      }
      
      // 클래스 다이어그램 한글 처리
      if (cleanChart.startsWith('classDiagram')) {
        // 클래스 이름 따옴표 처리
        cleanChart = cleanChart.replace(/class\s+([^\s"]+)/g, 
          (match, name) => {
            if (name.startsWith('"') && name.endsWith('"')) return match;
            return `class "${name}"`;
          });
      }
      
      // 간트 차트 한글 처리
      if (cleanChart.startsWith('gantt')) {
        // 섹션 이름 따옴표 처리
        cleanChart = cleanChart.replace(/section\s+([^\n"]+)/g, 
          (match, name) => {
            if (name.startsWith('"') && name.endsWith('"')) return match;
            return `section "${name}"`;
          });
      }
      
      // 파이 차트 한글 처리
      if (cleanChart.startsWith('pie')) {
        // 레이블 따옴표 처리
        cleanChart = cleanChart.replace(/title\s+([^\n"]+)/g, 
          (match, title) => {
            if (title.startsWith('"') && title.endsWith('"')) return match;
            return `title "${title}"`;
          });
      }
      
      // Handle newlines in node text - 이 부분은 기존 코드 유지
      cleanChart = cleanChart.replace(/\\n/g, '<br>');
      
      // Clean up whitespace - 이 부분은 기존 코드 유지
      cleanChart = cleanChart.replace(/^\s+/gm, line => ' '.repeat(Math.min(line.length, 2)));
      
      console.log('Processed mermaid chart:', cleanChart);
      
      // Render with a controlled approach
      try {
        // Wrap in a promise with timeout for safety
        const renderPromise = new Promise<{ svg: string }>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Rendering timed out'));
          }, 3000); // 3 second timeout
          
          // Attempt to render
          mermaid.render(id, cleanChart)
            .then(result => {
              clearTimeout(timeout);
              resolve(result);
            })
            .catch(err => {
              clearTimeout(timeout);
              reject(err);
            });
        });
        
        const { svg } = await renderPromise;
        setSvg(svg);
        setError(null);
        setIsLoading(false);
      } catch (renderError) {
        // 디버깅을 위한 로그 추가
        console.error('Mermaid rendering error details:', renderError);
        
        // If rendering fails, try again once with a delay
        if (renderAttempts < 2) {
          renderTimeoutRef.current = setTimeout(() => {
            renderDiagram();
          }, 500);
          return;
        }
        
        throw renderError; // Re-throw if max retries reached
      }
    } catch (err: any) {
      console.error('Mermaid rendering error:', err);
      
      // Always end loading state on error, but only show error if 
      // we've determined content is complete and made multiple attempts
      setIsLoading(false);
      
      // 오류 표시 조건 완화 - 첫 번째 시도에서도 오류 표시
      if (isComplete) {
        setError(err?.message || 'Failed to render diagram');
      }
    }
  };

  // Adjust container size when svg changes
  useEffect(() => {
    if (svg && containerRef.current) {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svg, "image/svg+xml");
      const svgElement = svgDoc.documentElement;
      
      if (svgElement) {
        const width = svgElement.getAttribute('width');
        const height = svgElement.getAttribute('height');
        
        if (width && height) {
          containerRef.current.style.width = '100%';
          containerRef.current.style.maxWidth = '100%';
          containerRef.current.style.overflowX = 'auto';
        }
      }
    }
  }, [svg]);

  // Show loading indicator only if loading and no SVG yet
  if (isLoading && !svg) {
    return (
      <div className="my-6 p-4 bg-[var(--accent)] rounded-lg overflow-x-auto">
        <div className="flex flex-col items-center justify-center h-40">
          <div className="animate-pulse flex space-x-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-[var(--muted)]"></div>
            <div className="w-3 h-3 rounded-full bg-[var(--muted)]"></div>
            <div className="w-3 h-3 rounded-full bg-[var(--muted)]"></div>
          </div>
          <div className="text-[var(--muted)] text-sm">
            {isComplete ? 'Rendering diagram...' : 'Receiving diagram data...'}
          </div>
        </div>
      </div>
    );
  }

  // Show error only after diagram is considered complete and rendering failed
  if (error && !svg) {
    return (
      <div className="p-4 rounded-md bg-[var(--accent)] border border-red-500 text-[var(--muted)]">
        <p className="font-bold mb-2">Diagram Error:</p>
        <pre className="whitespace-pre-wrap overflow-x-auto text-sm">{error}</pre>
        <div className="mt-3 text-xs">
          <p>Try one of these diagram formats:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>flowchart TD</li>
            <li>sequenceDiagram</li>
            <li>classDiagram</li>
            <li>gantt</li>
            <li>pie</li>
          </ul>
        </div>
        <pre className="mt-4 p-3 bg-[var(--code-bg)] text-[var(--code-text)] overflow-x-auto rounded text-xs">{chart}</pre>
      </div>
    );
  }

  // Show the rendered diagram - display as soon as we have SVG, regardless of loading state
  if (svg) {
    return (
      <div ref={containerRef} className="my-6 p-4 bg-[var(--accent)] rounded-lg overflow-x-auto">
        <div 
          dangerouslySetInnerHTML={{ __html: svg }} 
          className="flex justify-center"
        />
      </div>
    );
  }

  // Fallback empty container (should rarely happen)
  return (
    <div className="my-6 p-4 bg-[var(--accent)] rounded-lg overflow-x-auto">
      <div className="h-20 flex items-center justify-center text-[var(--muted)]">
        Diagram placeholder
      </div>
    </div>
  );
});

// 더 정교한 LaTeX 전처리 함수 추가
const preprocessLaTeX = (content: string) => {
  if (!content) return '';
  
  // 이미 이스케이프된 구분자 처리
  let processedContent = content
    .replace(/\\\[/g, '___BLOCK_OPEN___')
    .replace(/\\\]/g, '___BLOCK_CLOSE___')
    .replace(/\\\(/g, '___INLINE_OPEN___')
    .replace(/\\\)/g, '___INLINE_CLOSE___');

  // 블록 수식 ($$...$$) 보존
  const blockRegex = /(\$\$[\s\S]*?\$\$)/g;
  const blocks: string[] = [];
  processedContent = processedContent.replace(blockRegex, (match) => {
    const id = blocks.length;
    blocks.push(match);
    return `___LATEX_BLOCK_${id}___`;
  });

  // 인라인 수식 ($...$) 보존 - 화폐 값과 구분
  const inlineRegex = /(\$(?!\s*\d+[.,\s]*\d*\s*$)(?:[^\$]|\\.)*?\$)/g;
  const inlines: string[] = [];
  processedContent = processedContent.replace(inlineRegex, (match) => {
    const id = inlines.length;
    inlines.push(match);
    return `___LATEX_INLINE_${id}___`;
  });

  // 이스케이프된 구분자 복원
  processedContent = processedContent
    .replace(/___BLOCK_OPEN___/g, '\\[')
    .replace(/___BLOCK_CLOSE___/g, '\\]')
    .replace(/___INLINE_OPEN___/g, '\\(')
    .replace(/___INLINE_CLOSE___/g, '\\)');

  // 화폐 기호 처리 (단순화된 버전)
  processedContent = escapeCurrencyDollars(processedContent);

  // LaTeX 블록 복원
  processedContent = processedContent.replace(/___LATEX_BLOCK_(\d+)___/g, (_, id) => {
    return blocks[parseInt(id)];
  });
  
  processedContent = processedContent.replace(/___LATEX_INLINE_(\d+)___/g, (_, id) => {
    return inlines[parseInt(id)];
  });

  return processedContent;
};

// 단순화된 화폐 기호 처리 함수
function escapeCurrencyDollars(text: string): string {
  // 이미 LaTeX로 처리된 항목은 건너뛰기
  if (text.includes('___LATEX_') || !text.includes('$')) return text;
  
  // 금액 패턴 (예: $100, $1,000.50)
  return text.replace(/\$(\d[\d,\.]*)/g, '&#36;$1');
}

interface MarkdownContentProps {
  content: string;
}

// Image component with loading state
const ImageWithLoading = memo(function ImageWithLoadingComponent({ 
  src, 
  alt, 
  className = "",
  ...props 
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // 로딩 애니메이션 효과를 위한 상태
  const [loadingTime, setLoadingTime] = useState(0);
  
  // 로딩이 시작되면 진행 상태를 시뮬레이션
  useEffect(() => {
    if (!isLoaded && !error) {
      const timer = setInterval(() => {
        setLoadingTime(prev => {
          const newTime = prev + 1;
          // 진행률 계산 (0-95% 범위, 실제 로딩 완료 시 100%로 점프)
          const progress = Math.min(95, Math.floor(newTime * 1.5));
          setLoadingProgress(progress);
          return newTime;
        });
      }, 100);
      
      return () => clearInterval(timer);
    }
  }, [isLoaded, error]);
  
  // URL이 유효한지 확인 (간단한 체크)
  const isValidUrl = src && (
    src.startsWith('http://') || 
    src.startsWith('https://') || 
    src.startsWith('data:')
  );

  if (!isValidUrl) {
    return (
      <div className="bg-[var(--accent)] rounded-lg p-4 text-center text-[var(--muted)]">
        <svg className="w-8 h-8 mx-auto mb-2 text-[var(--muted)]" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <div>Invalid image URL</div>
      </div>
    );
  }
  
  return (
    <div className="relative w-full">
      {!isLoaded && !error && (
        <div className="bg-[var(--accent)] animate-pulse rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
          {/* 스켈레톤 로딩 효과 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {/* 이미지 로딩 아이콘 */}
            <svg 
              className="w-12 h-12 text-[var(--muted)] mb-2 animate-spin" 
              fill="none" 
              strokeWidth="1.5" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              style={{ animationDuration: '2s' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            
            {/* 로딩 텍스트 - div로 변경하여 nested <p> 방지 */}
            <div className="text-[var(--muted)] text-sm font-medium">
              Loading image... {loadingProgress}%
            </div>
            
            {/* 로딩 진행 표시기 */}
            <div className="w-3/4 h-1.5 bg-[var(--muted)] bg-opacity-20 rounded-full mt-3 overflow-hidden">
              <div 
                className="h-full bg-[var(--muted)] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            
            {/* 이미지 설명 표시 (있는 경우) */}
            {alt && (
              <div className="mt-3 text-xs text-[var(--muted)] italic opacity-70">
                {alt}
              </div>
            )}
          </div>
          
          {/* 배경 패턴 */}
          <div className="absolute inset-0 opacity-5">
            <div className="h-full w-full" 
              style={{ 
                backgroundImage: 'radial-gradient(var(--muted) 1px, transparent 1px)', 
                backgroundSize: '20px 20px' 
              }}>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-[var(--accent)] rounded-lg p-6 text-center text-[var(--muted)]">
          <svg className="w-10 h-10 mx-auto mb-3 text-[var(--muted)]" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="mb-1">Image failed to load</div>
          {alt && <div className="text-sm italic mb-2 opacity-75">{alt}</div>}
          {src && (
            <a 
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--muted-foreground)] hover:underline mt-1 block"
            >
              View image directly
            </a>
          )}
        </div>
      )}
      
      <img
        src={src}
        alt={alt || ""}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500 rounded-lg`}
        onLoad={() => {
          setLoadingProgress(100);
          setTimeout(() => setIsLoaded(true), 200); // 약간의 지연으로 부드러운 전환 효과
        }}
        onError={() => {
          console.log('Image load error:', src);
          setError(true);
          setIsLoaded(true);
        }}
        loading="lazy"
        referrerPolicy="no-referrer"
        {...props}
      />
    </div>
  );
});

interface MathProps {
  value: string;
  inline?: boolean;
}

// Create a custom wrapper to ensure proper nesting
const SafeWrapper = ({ children }: { children: React.ReactNode }) => {
  // Render with fragment to avoid adding any unnecessary elements
  return <>{children}</>;
};

// Special component to handle math blocks with better isolation
const MathBlock = ({ content }: { content: string }) => {
  // Create a more stable ID that doesn't change across renders
  const id = useMemo(() => `math-block-${content.slice(0, 10).replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 6)}`, [content]);
  
  return (
    <div 
      className="math-block-wrapper my-6" 
      key={id}
      // Use flex layout and isolation for better rendering stability
      style={{ 
        isolation: 'isolate' // Create a new stacking context
      }}
    >
      <MathJaxEquation equation={content} display={true} />
    </div>
  );
};

// Simpler math component for inline math
const InlineMath = ({ content }: { content: string }) => {
  // Create a more stable ID that doesn't change across renders
  const id = useMemo(() => `math-inline-${content.slice(0, 10).replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 6)}`, [content]);
  
  return (
    <span 
      className="math-inline-wrapper"
      key={id}
      style={{ isolation: 'isolate' }} // Create a new stacking context
    >
      <MathJaxEquation equation={content} display={false} />
    </span>
  );
};

// Memoize the MarkdownContent component to prevent unnecessary re-renders
export const MarkdownContent = memo(function MarkdownContentComponent({ content }: MarkdownContentProps) {
  // Add Katex styles on component mount
  useEffect(() => {
    initMermaid();
  }, []);

  // Pre-process the content to handle LaTeX and escape currency dollar signs
  const processedContent = useMemo(() => {
    return preprocessLaTeX(content);
  }, [content]);

  // Memoize the styleMentions function to avoid recreating it on every render
  const styleMentions = useCallback((text: string) => {
    if (!text.includes('@')) return text; // Quick check to avoid unnecessary regex processing
    
    const jsonMentionRegex = /\{"displayName":"([^"]+)","promptContent":"[^"]+"}/g;
    const legacyMentionRegex = /@([\w?!.,_\-+=@#$%^&*()<>{}\[\]|/\\~`]+)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = jsonMentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      parts.push(
        <span key={match.index} className="mention-tag">
          @{match[1]}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex === 0) {
      while ((match = legacyMentionRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.slice(lastIndex, match.index));
        }
        
        parts.push(
          <span key={match.index} className="mention-tag">
            {match[0]}
          </span>
        );
        
        lastIndex = match.index + match[0].length;
      }
    }
    
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  }, []);

  // Function to detect image URLs (from original code)
  const styleImageUrls = useCallback((text: string) => {
    if (!text.includes('image.pollinations.ai')) return text;
    
    const pollinationsUrlRegex = /(https:\/\/image\.pollinations\.ai\/[^\s]+)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = pollinationsUrlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const imageUrl = match[1];
      const decodedUrl = decodeURIComponent(imageUrl);
      
      parts.push({
        type: 'image_link',
        key: match.index,
        url: decodedUrl,
        display: decodedUrl
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  }, []);

  // Memoize the extractText function
  const extractText = useCallback((node: any): string => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node?.props?.children) return extractText(node.props.children);
    return '';
  }, []);

  // 복사 기능 구현 - 텍스트 변경만 적용
  const handleCopy = useCallback((text: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const btn = event.currentTarget;
    
    // 텍스트 복사
    navigator.clipboard.writeText(text)
      .then(() => {
        // 복사 성공 시 텍스트만 변경 (색상 변경 없음)
        btn.textContent = 'Copied!';
        
        // 2초 후 원래 상태로 복원
        setTimeout(() => {
          btn.textContent = 'Copy';
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy code:', err);
      });
  }, []);

  // Memoize the components object to avoid recreating it on every render
  const components = useMemo<Components>(() => ({
    // Use a simple div as the root component to properly handle all elements
    root: SafeWrapper,
    
    p: ({ children, ...props }) => {
      // Check if this is a text-only paragraph
      const childArray = React.Children.toArray(children);
      
      // If there are no children or only a single text child, it's safe to render as paragraph
      const isSafeParagraph = 
        childArray.length === 0 || 
        (childArray.length === 1 && typeof childArray[0] === 'string');
      
      // If it's not a simple text paragraph, render without p to avoid potential nesting issues
      if (!isSafeParagraph) {
        return <>{children}</>;
      }
      
      // Process text content to detect image generation links
      if (typeof children === 'string') {
        // Handle image markdown pattern
        const pollinationsRegex = /!\[([^\]]*)\]\((https:\/\/image\.pollinations\.ai\/[^)]+)\)/g;
        const match = pollinationsRegex.exec(children);
        
        if (match) {
          const [fullMatch, altText, imageUrl] = match;
          const decodedUrl = decodeURIComponent(imageUrl);
          
          return (
            <div className="my-4">
              <a 
                href={decodedUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                <ImageWithLoading 
                  src={decodedUrl} 
                  alt={altText || "Generated image"} 
                  className="rounded-lg max-w-full hover:opacity-90 transition-opacity cursor-pointer border border-[var(--accent)] shadow-md" 
                />
              </a>
              <div className="text-sm text-[var(--muted)] mt-2 italic text-center">{altText}</div>
            </div>
          );
        }
        
        // Process raw image URLs
        const rawPollinationsRegex = /(https:\/\/image\.pollinations\.ai\/[^\s)]+)/g;
        const rawMatch = rawPollinationsRegex.exec(children);
        
        if (rawMatch) {
          const [, imageUrl] = rawMatch;
          const decodedUrl = decodeURIComponent(imageUrl);
          
          return (
            <div className="my-4">
              <a 
                href={decodedUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                <ImageWithLoading 
                  src={decodedUrl} 
                  alt="Generated image" 
                  className="rounded-lg max-w-full hover:opacity-90 transition-opacity cursor-pointer border border-[var(--accent)] shadow-md" 
                />
              </a>
              <div className="text-sm text-[var(--muted)] mt-2 italic text-center">Generated Image</div>
            </div>
          );
        }
        
        // Process for raw image URLs
        const processedContent = styleImageUrls(children);
        
        // Handle special image links
        if (Array.isArray(processedContent)) {
          const elements = processedContent.map((part, index) => {
            if (typeof part === 'string') {
              return <span key={index}>{styleMentions(part)}</span>;
            } else if (part && typeof part === 'object' && 'type' in part && part.type === 'image_link') {
              return (
                <div key={part.key} className="my-4">
                  <a 
                    href={part.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <ImageWithLoading 
                      src={part.url} 
                      alt="Generated image" 
                      className="rounded-lg max-w-full hover:opacity-90 transition-opacity cursor-pointer border border-[var(--accent)] shadow-md" 
                    />
                    <div className="text-xs text-[var(--muted)] mt-2 text-center break-all">
                      {part.display}
                    </div>
                  </a>
                </div>
              );
            }
            return null;
          });
          
          return <>{elements}</>;
        }
        
        // For regular text, just render with styleMentions
        return <p className="my-3 leading-relaxed" {...props}>{styleMentions(children)}</p>;
      }
      
      // If children is not a string, render as-is
      return <p className="my-3 leading-relaxed" {...props}>{children}</p>;
    },
    img: ({ src, alt, ...props }) => {
      // Agent 도구에서 생성된 이미지 URL을 처리합니다
      if (src && (src.includes('image.pollinations.ai'))) {
        return (
          <a 
            href={src} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block my-4"
          >
            <ImageWithLoading 
              src={src} 
              alt={alt || "Generated image"} 
              className="rounded-lg max-w-full hover:opacity-90 transition-opacity cursor-pointer border border-[var(--accent)] shadow-md" 
              {...props}
            />
            {alt && <div className="text-sm text-[var(--muted)] mt-2 italic text-center">{alt}</div>}
          </a>
        );
      }
      
      // Regular image rendering with loading state
      return src ? (
        <ImageWithLoading src={src} alt={alt} className="my-4 rounded-lg max-w-full" {...props} />
      ) : (
        <span className="text-[var(--muted)]">[Unable to load image]</span>
      );
    },
    a: ({ href, children, ...props }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-[var(--foreground)] border-b border-[var(--muted)] hover:border-[var(--foreground)] transition-colors"
        {...props}
      >
        {children}
      </a>
    ),
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;
      
      if (isInline) {
        return (
          <code className="font-mono text-sm bg-[var(--inline-code-bg)] text-[var(--inline-code-text)] px-1.5 py-0.5 rounded" {...props}>
            {children}
          </code>
        );
      }
      
      const language = match?.[1] || '';
      const codeText = extractText(children);
      
      // Handle Mermaid diagrams
      if (language === 'mermaid') {
        return <MermaidDiagram chart={codeText} />;
      }
      
      // Handle math code blocks - with dedicated wrapper component
      if (language === 'math') {
        // Use a stable key based on content to avoid unnecessary remounts
        const key = `math-code-${codeText.slice(0, 20).replace(/\W/g, '')}`;
        
        // Remove the MathBlock from any potential paragraph by wrapping in a div with a key
        return (
          <div className="non-paragraph-wrapper" key={key}>
            <MathBlock content={codeText} />
          </div>
        );
      }
      
      // Render code blocks in a div instead of a pre inside p to avoid hydration issues
      return (
        <div className="message-code group relative my-6 max-w-full overflow-hidden">
          <div className="message-code-header flex items-center justify-between px-4 py-2">
            <span className="text-xs uppercase tracking-wider text-[var(--muted)] break-all">
              {language || 'text'}
            </span>
            <button
              onClick={(e) => handleCopy(codeText, e)}
              className="text-xs uppercase tracking-wider px-2 py-1 
                       text-[var(--muted)] hover:text-[var(--foreground)] 
                       transition-colors whitespace-nowrap ml-2"
            >
              Copy
            </button>
          </div>
          <pre className="overflow-x-auto p-4 m-0 bg-[var(--code-bg)] text-[var(--code-text)] max-w-full whitespace-pre-wrap break-all">
            {children}
          </pre>
        </div>
      );
    },
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-6">
        <table className="w-full border-collapse" {...props}>{children}</table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th className="bg-[var(--accent)] font-medium text-[var(--muted)] uppercase tracking-wider p-3 border border-[var(--accent)]" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="p-3 border border-[var(--accent)]" {...props}>{children}</td>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote className="border-l-2 border-[var(--muted)] pl-4 my-6 text-[var(--muted)] italic" {...props}>
        {children}
      </blockquote>
    ),
    ul: ({ children, ...props }) => (
      <ul className="my-4 pl-5" style={{ listStylePosition: 'outside', listStyleType: 'disc' }} {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="my-4 pl-5" style={{ listStylePosition: 'outside', listStyleType: 'decimal' }} {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="my-2" style={{ display: 'list-item' }} {...props}>{children}</li>
    ),
    h1: ({ children, ...props }) => (
      <h1 className="text-2xl font-bold mt-8 mb-4" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-xl font-bold mt-6 mb-3" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-lg font-bold mt-5 mb-2" {...props}>{children}</h3>
    ),
    math: ({ value, inline }: MathProps) => {
      // For block math, use the dedicated wrapper component
      if (!inline) {
        return <MathBlock content={value} />;
      }
      
      // For inline math, use the simpler inline wrapper
      return <InlineMath content={value} />;
    },
  }), [styleMentions, styleImageUrls, extractText, handleCopy]);

  // Memoize the remarkPlugins and rehypePlugins
  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  
  // Updated rehypePlugins with proper configuration
  const rehypePlugins = useMemo(() => {
    return [
      [rehypeRaw, { passThrough: ['math', 'inlineMath'] }],
      rehypeSanitize,
      rehypeHighlight,
    ] as any;
  }, []);

  return (
    <ReactMarkdown
      className="message-content break-words"
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {processedContent}
    </ReactMarkdown>
  );
}); 