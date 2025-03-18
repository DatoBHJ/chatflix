import { Dispatch, SetStateAction, useState, useRef, useEffect } from 'react';
import { getEnabledModels } from '@/lib/models/config';
import Image from 'next/image';
import type { ModelConfig } from '@/lib/models/config';

// Helper function to get the logo path based on provider
const getProviderLogo = (provider: ModelConfig['provider']) => {
  const logoMap: Partial<Record<ModelConfig['provider'], string>> = {
    anthropic: '/logo/anthropic.svg',
    openai: '/logo/openai.svg',
    google: '/logo/google.svg',
    together: '/logo/together.svg',
    xai: '/logo/grok.svg',
    deepseek: '/logo/deepseek.svg',
    groq: '/logo/groq.svg'
  };
  
  // For providers without specific logos, we'll use a text-based fallback
  return logoMap[provider] || '';
};

// Helper function to check if a logo exists for a provider
const hasLogo = (provider: ModelConfig['provider']) => {
  const providersWithLogos: ModelConfig['provider'][] = ['anthropic', 'openai', 'google', 'together', 'xai', 'deepseek', 'groq'];
  return providersWithLogos.includes(provider);
};

// Helper function to get color for provider
const getProviderColor = (provider: ModelConfig['provider']): string => {
  const colorMap: Record<string, string> = {
    anthropic: '#B33A3A', // reddish
    openai: '#000000',    // black
    google: '#34A853',    // green
    together: '#6366F1',  // purple/blue
    xai: '#000000',       // black
    deepseek: '#377CF7',  // blue
    groq: '#FF6B6B',      // coral
  };
  
  return colorMap[provider] || '#888888'; // Return gray as default
};

// Model Performance Graph component
const ModelPerformanceGraph = ({ 
  models, 
  isMobile,
  isFullscreen
}: { 
  models: ModelConfig[], 
  isMobile: boolean,
  isFullscreen?: boolean
}) => {
  // Filter models that have both TPS and intelligenceIndex
  const validModels = models.filter(model => typeof model.tps === 'number' && typeof model.intelligenceIndex === 'number');
  
  if (validModels.length === 0) return null;
  
  // Calculate graph dimensions and padding - adjust for mobile and fullscreen
  const width = isFullscreen ? 900 : (isMobile ? 320 : 550);
  const height = isFullscreen ? 500 : (isMobile ? 220 : 280);
  const padding = { 
    top: isFullscreen ? 40 : 20, 
    right: isFullscreen ? 50 : (isMobile ? 10 : 30), 
    bottom: isFullscreen ? 70 : 50, 
    left: isFullscreen ? 70 : (isMobile ? 40 : 50) 
  };
  
  // Font sizes based on display mode
  const labelFontSize = isFullscreen ? 14 : (isMobile ? 10 : 12);
  const tickFontSize = isFullscreen ? 12 : (isMobile ? 8 : 10);
  const modelNameFontSize = isFullscreen ? 14 : (isMobile ? 8 : 10);
  const dotRadius = isFullscreen ? 8 : (isMobile ? 4 : 6);
  
  // Find max values for scales
  const maxTps = Math.max(...validModels.map(m => m.tps as number)) * 1.1;
  const maxIntelligence = Math.max(...validModels.map(m => m.intelligenceIndex as number)) * 1.1;
  const minTps = 0;
  const minIntelligence = Math.min(...validModels.map(m => m.intelligenceIndex as number)) * 0.9;
  
  // Scale functions
  const scaleX = (value: number) => {
    return padding.left + ((value - minTps) / (maxTps - minTps)) * (width - padding.left - padding.right);
  };
  
  const scaleY = (value: number) => {
    return height - padding.bottom - ((value - minIntelligence) / (maxIntelligence - minIntelligence)) * (height - padding.top - padding.bottom);
  };

  // Generate X and Y axis ticks
  const xTicks = [0, Math.round(maxTps * 0.25), Math.round(maxTps * 0.5), Math.round(maxTps * 0.75), Math.round(maxTps)];
  const yTicks = [
    Math.round(minIntelligence), 
    Math.round(minIntelligence + (maxIntelligence - minIntelligence) * 0.33), 
    Math.round(minIntelligence + (maxIntelligence - minIntelligence) * 0.66), 
    Math.round(maxIntelligence)
  ];
  
  return (
    <div className={`${isFullscreen ? 'p-0' : `p-3 ${isMobile ? 'px-1' : 'px-4'}`} bg-[var(--background-secondary)]/30 rounded-md mt-3 mb-2 overflow-x-auto`}>
      <h3 className={`${isFullscreen ? 'text-xl' : 'text-sm'} font-medium mb-2 text-center`}>
        Performance Graph: Speed vs Intelligence
      </h3>
      <svg 
        width={width} 
        height={height} 
        viewBox={`0 0 ${width} ${height}`} 
        className="overflow-visible mx-auto"
        style={{ minWidth: isFullscreen ? '850px' : (isMobile ? '300px' : '500px') }}
      >
        {/* Grid lines */}
        {xTicks.map(tick => (
          <line 
            key={`x-${tick}`}
            x1={scaleX(tick)} 
            y1={padding.top} 
            x2={scaleX(tick)} 
            y2={height - padding.bottom} 
            stroke="var(--muted)" 
            strokeWidth={isFullscreen ? "0.7" : "0.5"} 
            strokeDasharray="4,4"
            opacity="0.3"
          />
        ))}
        {yTicks.map(tick => (
          <line 
            key={`y-${tick}`}
            x1={padding.left} 
            y1={scaleY(tick)} 
            x2={width - padding.right} 
            y2={scaleY(tick)} 
            stroke="var(--muted)" 
            strokeWidth={isFullscreen ? "0.7" : "0.5"} 
            strokeDasharray="4,4"
            opacity="0.3"
          />
        ))}
      
        {/* X and Y axis */}
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--muted)" strokeWidth={isFullscreen ? "1.5" : "1"} />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--muted)" strokeWidth={isFullscreen ? "1.5" : "1"} />
        
        {/* X axis label */}
        <text x={width / 2} y={height - (isFullscreen ? 20 : 10)} textAnchor="middle" fontSize={labelFontSize} fill="var(--muted)">
          Output Speed (Tokens per Second)
        </text>
        
        {/* X axis ticks */}
        {xTicks.map(tick => (
          <g key={`xtick-${tick}`}>
            <line 
              x1={scaleX(tick)} 
              y1={height - padding.bottom} 
              x2={scaleX(tick)} 
              y2={height - padding.bottom + 5} 
              stroke="var(--muted)" 
              strokeWidth={isFullscreen ? "1.2" : "1"} 
            />
            <text 
              x={scaleX(tick)} 
              y={height - padding.bottom + (isFullscreen ? 20 : 15)} 
              textAnchor="middle" 
              fontSize={tickFontSize} 
              fill="var(--muted)"
            >
              {tick}
            </text>
          </g>
        ))}
        
        {/* Y axis label */}
        <text 
          x={isFullscreen ? 25 : 15} 
          y={height / 2} 
          textAnchor="middle" 
          fontSize={labelFontSize} 
          fill="var(--muted)" 
          transform={`rotate(-90, ${isFullscreen ? 25 : 15}, ${height / 2})`}
        >
          Intelligence Index
        </text>
        
        {/* Y axis ticks */}
        {yTicks.map(tick => (
          <g key={`ytick-${tick}`}>
            <line 
              x1={padding.left - 5} 
              y1={scaleY(tick)} 
              x2={padding.left} 
              y2={scaleY(tick)} 
              stroke="var(--muted)" 
              strokeWidth={isFullscreen ? "1.2" : "1"} 
            />
            <text 
              x={padding.left - (isFullscreen ? 15 : 10)} 
              y={scaleY(tick)} 
              textAnchor="end" 
              fontSize={tickFontSize} 
              dominantBaseline="middle" 
              fill="var(--muted)"
            >
              {tick}
            </text>
          </g>
        ))}
        
        {/* Data points */}
        {validModels.map((model, index) => {
          const x = scaleX(model.tps as number);
          const y = scaleY(model.intelligenceIndex as number);
          const color = getProviderColor(model.provider);
          
          return (
            <g key={model.id}>
              {/* Model dot */}
              <circle 
                cx={x} 
                cy={y} 
                r={dotRadius} 
                fill={color} 
              />
              
              {/* Add connecting line to label for clarity */}
              <line 
                x1={x} 
                y1={y} 
                x2={x} 
                y2={y - (isFullscreen ? 14 : 8)} 
                stroke={color} 
                strokeWidth={isFullscreen ? "1.5" : "1"} 
                opacity="0.6" 
              />
              
              {/* Model name */}
              <text 
                x={x} 
                y={y - (isFullscreen ? 18 : 10)} 
                textAnchor="middle" 
                fontSize={modelNameFontSize} 
                fill="var(--foreground)" 
                className="pointer-events-none"
                fontWeight={isFullscreen ? "bold" : "normal"}
              >
                {model.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Model Bar Chart component
const ModelBarChart = ({
  models,
  isMobile,
  isFullscreen,
  metric = 'tps'
}: {
  models: ModelConfig[],
  isMobile: boolean,
  isFullscreen?: boolean,
  metric?: 'tps' | 'intelligenceIndex' | 'contextWindow' | 'MMLU_Pro' | 'Coding' | 'MATH' | 'GPQA' | 'multilingual' | 'HLE'
}) => {
  const [selectedMetric, setSelectedMetric] = useState<'tps' | 'intelligenceIndex' | 'contextWindow' | 'MMLU_Pro' | 'Coding' | 'MATH' | 'GPQA' | 'multilingual' | 'HLE'>(metric);
  
  // Filter models that have the selected metric
  const validModels = models
    .filter(model => typeof model[selectedMetric] === 'number')
    .sort((a, b) => (b[selectedMetric] as number) - (a[selectedMetric] as number))
    .slice(0, 15); // Limit to 15 models for clarity
  
  if (validModels.length === 0) return null;
  
  // Calculate chart dimensions
  const width = isFullscreen ? 900 : (isMobile ? 320 : 550);
  const barHeight = isFullscreen ? 26 : 20;
  const gap = isFullscreen ? 12 : 8;
  const height = validModels.length * (barHeight + gap) + 50; // Extra space for title
  const labelWidth = isFullscreen ? 160 : 120;
  const valueWidth = isFullscreen ? 60 : 40;
  
  // Find max value for scale
  const maxValue = Math.max(...validModels.map(m => m[selectedMetric] as number));
  
  // Scale function for bar width
  const scaleWidth = (value: number) => {
    return ((value / maxValue) * (width - labelWidth - valueWidth - 20));
  };
  
  // Format value based on metric
  const formatValue = (value: number, metric: string) => {
    switch(metric) {
      case 'tps':
        return `${value.toFixed(0)}`;
      case 'intelligenceIndex':
        return `${value.toFixed(1)}`;
      case 'contextWindow':
        return `${(value / 1000).toFixed(0)}K`;
      case 'MMLU_Pro':
        return `${value.toFixed(1)}`;
      case 'Coding':
        return `${value.toFixed(1)}`;
      case 'MATH':
        return `${value.toFixed(1)}`;
      case 'GPQA':
        return `${value.toFixed(1)}`;
      case 'multilingual':
        return `${value.toFixed(1)}`;
      case 'HLE':
        return `${value.toFixed(1)}`;
      default:
        return `${value}`;
    }
  };
  
  // Get metric name
  const getMetricName = (metric: string) => {
    switch(metric) {
      case 'tps':
        return 'Output Speed';
      case 'intelligenceIndex':
        return 'Intelligence Index';
      case 'contextWindow':
        return 'Context Window';
      case 'MMLU_Pro':
        return 'MMLU_Pro Score';
      case 'Coding':
        return 'Coding Index';
      case 'MATH':
        return 'Math Index';
      case 'GPQA':
        return 'GPQA Score';
      case 'multilingual':
        return 'Multilingual Index';
      case 'HLE':
        return 'HLE Score';
      default:
        return metric;
    }
  };

  return (
    <div className={`${isFullscreen ? 'p-0' : `p-3 ${isMobile ? 'px-1' : 'px-4'}`} bg-[var(--background-secondary)]/30 rounded-md mt-5 mb-2`}>
      <h3 className={`${isFullscreen ? 'text-xl' : 'text-sm'} font-medium mb-2 text-center`}>
        {getMetricName(selectedMetric)}
      </h3>
      <div className="flex items-center justify-center gap-2 flex-wrap px-10 py-6 ">
        <button 
          onClick={() => setSelectedMetric('tps')}
          className={`text-xs px-2 py-1 rounded-sm ${selectedMetric === 'tps' ? 'bg-[var(--accent)] text-[var(--foreground)]' : 'bg-[var(--accent)]/10'}`}
        >
          Speed
        </button>
        <button 
          onClick={() => setSelectedMetric('intelligenceIndex')}
          className={`text-xs px-2 py-1 rounded-sm ${selectedMetric === 'intelligenceIndex' ? 'bg-[var(--accent)] text-[var(--foreground)]' : 'bg-[var(--accent)]/10'}`}
        >
          Intelligence
        </button>
        <button 
          onClick={() => setSelectedMetric('contextWindow')}
          className={`text-xs px-2 py-1 rounded-sm ${selectedMetric === 'contextWindow' ? 'bg-[var(--accent)] text-[var(--foreground)]' : 'bg-[var(--accent)]/10'}`}
        >
          Context
        </button>
        <button 
          onClick={() => setSelectedMetric('MMLU_Pro')}
          className={`text-xs px-2 py-1 rounded-sm ${selectedMetric === 'MMLU_Pro' ? 'bg-[var(--accent)] text-[var(--foreground)]' : 'bg-[var(--accent)]/10'}`}
        >
          Knowledge
        </button>
        <button 
          onClick={() => setSelectedMetric('Coding')}
          className={`text-xs px-2 py-1 rounded-sm ${selectedMetric === 'Coding' ? 'bg-[var(--accent)] text-[var(--foreground)]' : 'bg-[var(--accent)]/10'}`}
        >
          Coding
        </button>
        <button 
          onClick={() => setSelectedMetric('MATH')}
          className={`text-xs px-2 py-1 rounded-sm ${selectedMetric === 'MATH' ? 'bg-[var(--accent)] text-[var(--foreground)]' : 'bg-[var(--accent)]/10'}`}
        >
          Math
        </button>
        <button 
          onClick={() => setSelectedMetric('GPQA')}
          className={`text-xs px-2 py-1 rounded-sm ${selectedMetric === 'GPQA' ? 'bg-[var(--accent)] text-[var(--foreground)]' : 'bg-[var(--accent)]/10'}`}
        >
          Science
        </button>
        <button 
          onClick={() => setSelectedMetric('multilingual')}
          className={`text-xs px-2 py-1 rounded-sm ${selectedMetric === 'multilingual' ? 'bg-[var(--accent)] text-[var(--foreground)]' : 'bg-[var(--accent)]/10'}`}
        >
          Multilingual
        </button>
        <button 
          onClick={() => setSelectedMetric('HLE')}
          className={`text-xs px-2 py-1 rounded-sm ${selectedMetric === 'HLE' ? 'bg-[var(--accent)] text-[var(--foreground)]' : 'bg-[var(--accent)]/10'}`}
        >
          Reasoning
        </button>
      </div>
      
      <div className="text-xs text-[var(--muted)] mb-6 text-center px-10">
        {selectedMetric === 'tps' ? 'Tokens per second received while the model is generating tokens - measure of real-time response speed after initial latency. Higher is better.' : 
         selectedMetric === 'intelligenceIndex' ? 'Combination metric covering multiple dimensions of intelligence - the simplest way to compare how smart models are. Higher is better.' :
         selectedMetric === 'contextWindow' ? 'Maximum context length in tokens - determines how much information the model can process in a single conversation. Higher is better.' :
         selectedMetric === 'MMLU_Pro' ? 'Massive Multitask Language Understanding Pro - measures knowledge across 12,000+ questions in academic and professional domains. Higher is better.' :
         selectedMetric === 'Coding' ? 'Average of coding evaluations including LiveCodeBench and SciCode - measures ability to write functional code that passes unit tests. Higher is better.' :
         selectedMetric === 'MATH' ? 'Average of math evaluations including AIME and MATH-500 - measures mathematical reasoning from basic to competition-level problems. Higher is better.' :
         selectedMetric === 'GPQA' ? 'Graduate-level Google-Proof Q&A - measures scientific reasoning on 198 expert-level questions in biology, physics, and chemistry. Higher is better.' :
         selectedMetric === 'multilingual' ? 'Average of Multilingual MMLU and MGSM across languages - measures performance across Spanish, German, Japanese, Chinese, and others. Higher is better.' :
         selectedMetric === 'HLE' ? 'Humanity\'s Last Exam - measures performance on 2,684 challenging questions across mathematics, humanities, and natural sciences. Higher is better.' :
         'Higher values indicate better performance across all metrics.'}
      </div>
      
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible mx-auto"
      >
        {validModels.map((model, index) => {
          const value = model[selectedMetric] as number;
          const barWidth = scaleWidth(value);
          const y = index * (barHeight + gap) + 10;
          const color = getProviderColor(model.provider);
          
          return (
            <g key={model.id}>
              {/* Model name */}
              <text
                x={0}
                y={y + barHeight / 2}
                fontSize={isFullscreen ? 12 : 10}
                fill="var(--foreground)"
                dominantBaseline="middle"
                textAnchor="start"
                className="font-medium"
              >
                {model.name}
              </text>
              
              {/* Bar */}
              <rect
                x={labelWidth}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                rx={4}
              />
              
              {/* Provider logo */}
              {hasLogo(model.provider) && (
                <image
                  href={getProviderLogo(model.provider)}
                  x={labelWidth + 5}
                  y={y + barHeight/2 - 8}
                  width={16}
                  height={16}
                />
              )}
              
              {/* Value */}
              <text
                x={labelWidth + barWidth + 10}
                y={y + barHeight / 2}
                fontSize={isFullscreen ? 12 : 10}
                fill="var(--foreground)"
                dominantBaseline="middle"
              >
                {formatValue(value, selectedMetric)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

interface ModelSelectorProps {
  currentModel: string;
  nextModel: string;
  setNextModel: Dispatch<SetStateAction<string>>;
  disabled?: boolean;
  position?: 'top' | 'bottom';
  disabledModels?: string[]; // Array of model IDs that should be disabled
  disabledLevel?: string; // Level that should be disabled (legacy)
  disabledLevels?: string[]; // Array of levels that should be disabled
  isWebSearchEnabled?: boolean; // Add prop for web search toggle
}

export function ModelSelector({ 
  currentModel, 
  nextModel, 
  setNextModel, 
  disabled, 
  position = 'bottom',
  disabledModels = [],
  disabledLevel,
  disabledLevels = [],
  isWebSearchEnabled = false // Default to false
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Get all models and filter based on web search enabled state
  const allModels = getEnabledModels();
  const MODEL_OPTIONS = allModels; // Show all models regardless of web search support

  // Combine disabledLevel and disabledLevels for backward compatibility
  const allDisabledLevels = [...disabledLevels];
  if (disabledLevel && !allDisabledLevels.includes(disabledLevel)) {
    allDisabledLevels.push(disabledLevel);
  }

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFullscreen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle ESC key to exit fullscreen mode
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
        if (!isOpen) {
          setIsOpen(false);
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);
  
  // Lock body scroll when in fullscreen mode
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Add styles to the document head
  useEffect(() => {
    const style = document.createElement('style');
    
    style.textContent = `
      /* 미래적인 선택 버튼 스타일 */
      .futuristic-select-button {
        position: relative;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      }
      
      /* 버튼 하단의 그라데이션 라인 효과 */
      .futuristic-select-button::after {
        content: "";
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 1px;
        background: linear-gradient(to right, transparent, var(--muted), transparent);
        opacity: 0;
        transform: scaleX(0.8);
        transition: all 0.3s ease;
      }
      
      /* 호버 상태와 활성 상태에서 라인 표시 */
      .futuristic-select-button:hover::after, 
      .futuristic-select-button.active::after {
        opacity: 0.7;
        transform: scaleX(1);
      }
      
      /* 드롭다운 메뉴 스타일 */
      .model-dropdown {
        animation: fadeInUp 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
        transform-origin: top center;
      }
      
      /* 전체 화면 모드 스타일 */
      .model-dropdown.fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw !important;
        height: 100vh !important;
        max-height: 100vh !important;
        border-radius: 0;
        border: none;
        animation: fadeIn 0.2s ease;
        z-index: 1000 !important;
        backdrop-filter: blur(10px);
        background: var(--background);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      /* 전체 화면 모드에서의 컨텐츠 영역 */
      .fullscreen-content {
        flex: 1;
        overflow-y: auto;
        padding: 0 1rem;
      }
      
      /* 전체 화면 모드에서의 그래프 컨테이너 */
      .fullscreen .graph-container {
        max-width: 1000px;
        margin: 0 auto;
        padding: 1rem 0;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      /* 확대 버튼 스타일 */
      .expand-button {
        cursor: pointer;
        padding: 6px;
        border-radius: 4px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        opacity: 0.7;
      }
      
      .expand-button:hover {
        opacity: 1;
        background: color-mix(in srgb, var(--accent) 10%, transparent);
      }
      
      /* 전체 화면 모드 헤더 */
      .fullscreen-header {
        position: sticky;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        background: var(--background);
        z-index: 10;
        border-bottom: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
      }
      
      /* 드롭다운 옵션 스타일 */
      .model-option {
        position: relative;
        overflow: hidden;
        transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
        padding: 16px 24px;
      }
      
      /* 선택된 모델 표시 효과 */
      .selected-indicator {
        position: absolute;
        right: 12px;
        opacity: 0;
        transition: opacity 0.25s ease, transform 0.25s ease;
      }
      
      .model-option.active .selected-indicator {
        opacity: 0.8;
        transform: scale(1);
      }
      
      /* 모델 이름 호버 효과 */
      .model-name {
        position: relative;
        display: inline-block;
        transition: all 0.3s ease;
      }
      
      .model-option.active {
        background: color-mix(in srgb, var(--accent) 30%, transparent);
      }
      
      .model-option:not(.disabled):hover {
        background: color-mix(in srgb, var(--accent) 20%, transparent);
      }
      
      /* 모델 이름 밑에 그라데이션 라인 */
      .model-name::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 1px;
        background: linear-gradient(to right, transparent, var(--foreground), transparent);
        transform: scaleX(0);
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
        transform-origin: center;
      }
      
      /* 호버 시 모델 이름 효과 */
      .model-option:not(.disabled):hover .model-name {
        transform: translateY(-1px);
      }
      
      /* 호버 시 밑줄 효과 */
      .model-option:not(.disabled):hover .model-name::after {
        transform: scaleX(1);
        opacity: 0.6;
      }
      
      /* 페이드 인 업 애니메이션 */
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* 스크롤바 스타일 */
      .model-selector-scroll::-webkit-scrollbar {
        width: 4px;
      }
      
      .model-selector-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .model-selector-scroll::-webkit-scrollbar-thumb {
        background: color-mix(in srgb, var(--foreground) 20%, transparent);
        border-radius: 4px;
      }
      
      .model-selector-scroll {
        scrollbar-width: thin;
        scrollbar-color: color-mix(in srgb, var(--foreground) 20%, transparent) transparent;
      }
      
      /* 모바일 스타일 */
      @media (max-width: 640px) {
        .mobile-handle {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 36px;
          height: 4px;
          background: var(--accent);
          opacity: 0.2;
          border-radius: 2px;
        }
      }
      
      /* 모델 옵션 내 로고 스타일 */
      .provider-logo {
        transition: all 0.3s ease;
        opacity: 0.7;
      }
      
      .model-option:not(.disabled):hover .provider-logo {
        opacity: 1;
      }
    `;
    
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const currentModelOption = MODEL_OPTIONS.find(option => option.id === nextModel);

  // Update nextModel if current model doesn't support web search when web search is enabled
  useEffect(() => {
    if (isWebSearchEnabled && nextModel && allModels.find(m => m.id === nextModel)?.isWebSearchEnabled === false) {
      // Find the first web search enabled model
      const firstWebSearchModel = allModels.find(model => model.isWebSearchEnabled);
      if (firstWebSearchModel) {
        setNextModel(firstWebSearchModel.id);
      }
    }
  }, [isWebSearchEnabled, nextModel, allModels, setNextModel]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-4 pb-2">
        <div className={`relative ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <button
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={`futuristic-select-button px-3 py-0 text-sm tracking-wide transition-all flex items-center ${isOpen ? 'text-[var(--foreground)] active' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
            disabled={disabled}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            <div className="flex items-center gap-2">
              {currentModelOption?.provider && (
                <div 
                  className="provider-logo w-4 h-4 flex-shrink-0"
                >
                  {hasLogo(currentModelOption.provider) ? (
                    <Image 
                      src={getProviderLogo(currentModelOption.provider)}
                      alt={`${currentModelOption.provider} logo`}
                      width={16}
                      height={16}
                      className="object-contain"
                    />
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center text-[8px] uppercase bg-[var(--accent)]/10 rounded-sm">
                      {currentModelOption.provider.substring(0, 1)}
                    </div>
                  )}
                </div>
              )}
              <span>{currentModelOption?.name || nextModel}</span>
            </div>
            <span className="ml-1 opacity-60 text-xl">▾</span>
          </button>
          
          {/* Selected model metrics */}
          {currentModelOption && (
            <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 mb-1 px-3 ${isMobile ? 'max-w-full overflow-x-auto' : ''}`}>
              {currentModelOption.tps && (
                <div className="inline-flex items-center gap-0.5">
                  <span className={`text-[9px] uppercase tracking-wider opacity-60 ${isMobile ? 'hidden sm:inline' : ''}`}>Speed</span>
                  <span className="text-[10px] uppercase font-medium bg-[var(--accent)]/10 px-1 py-0.5 rounded-sm flex items-center">
                    {typeof currentModelOption.tps === 'number' ? (
                      <>
                        {currentModelOption.tps >= 300 ? '⚡️ Very Fast' : 
                         currentModelOption.tps >= 200 ? 'Fast' : 
                         currentModelOption.tps >= 100 ? 'Medium' : 'Slow'}
                        <span className="text-[8px] ml-1 opacity-60">({currentModelOption.tps.toFixed(1)})</span>
                      </>
                    ) : currentModelOption.tps}
                  </span>
                </div>
              )}
              
              {currentModelOption.intelligenceIndex && (
                <div className="inline-flex items-center gap-0.5">
                  <span className={`text-[9px] uppercase tracking-wider opacity-60 ${isMobile ? 'hidden sm:inline' : ''}`}>Intelligence</span>
                  <span className="text-[10px] uppercase font-medium bg-[var(--accent)]/10 px-1 py-0.5 rounded-sm flex items-center">
                    {typeof currentModelOption.intelligenceIndex === 'number' ? (
                      <>
                        {currentModelOption.intelligenceIndex >= 55 ? '🧠 Superior' : 
                         currentModelOption.intelligenceIndex >= 45 ? 'Advanced' : 
                         currentModelOption.intelligenceIndex >= 35 ? 'Good' : 'Basic'}
                        <span className="text-[8px] ml-1 opacity-60">({currentModelOption.intelligenceIndex.toFixed(1)})</span>
                      </>
                    ) : currentModelOption.intelligenceIndex}
                  </span>
                </div>
              )}
              
              {currentModelOption.contextWindow && (
                <div className="inline-flex items-center gap-0.5">
                  <span className={`text-[9px] uppercase tracking-wider opacity-60 ${isMobile ? 'hidden sm:inline' : ''}`}>Context</span>
                  <span className="text-[10px] uppercase font-medium bg-[var(--accent)]/10 px-1 py-0.5 rounded-sm flex items-center">
                    {typeof currentModelOption.contextWindow === 'number' ? (
                      <>
                        {currentModelOption.contextWindow >= 1024000 ? '📚 Enormous' : 
                         currentModelOption.contextWindow >= 200000 ? 'Very Large' : 
                         currentModelOption.contextWindow >= 128000 ? 'Large' : 
                         currentModelOption.contextWindow >= 32000 ? 'Medium' : 'Standard'}
                        <span className="text-[8px] ml-1 opacity-60">({(currentModelOption.contextWindow / 1000).toFixed(0)}K)</span>
                      </>
                    ) : currentModelOption.contextWindow}
                  </span>
                </div>
              )}
            </div>
          )}
          
          {isOpen && !disabled && (
            <div 
              className={`
                model-dropdown
                ${isFullscreen ? 'fullscreen' : 
                  isMobile 
                    ? 'fixed inset-x-0 bottom-0 w-full max-h-[80vh] overflow-y-auto pb-6 model-selector-scroll rounded-t-xl bg-[var(--background)]' 
                    : `absolute left-1 ${position === 'top' ? 'bottom-full mb-2 w-[592px] max-h-[600px]' : 'top-full mt-20 w-[600px] max-h-[400px]'} left-0   overflow-y-auto model-selector-scroll rounded-md bg-[var(--background)]/95 backdrop-blur-xl`
                }
                z-50
              `}
              role="listbox"
            >
              {/* Fullscreen mode header */}
              {isFullscreen && (
                <div className="fullscreen-header">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium">Model Selection</h2>
                  </div>
                  <button 
                    onClick={() => setIsFullscreen(false)}
                    className="text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor"/>
                    </svg>
                    <span>Exit Fullscreen</span>
                  </button>
                </div>
              )}
              
              {/* Mobile mode header */}
              {isMobile && !isFullscreen && (
                <div className="sticky top-0 z-10 bg-[var(--background)] pt-6 pb-3">
                  <div className="mobile-handle"></div>
                  <div className="flex items-center justify-between px-4 mt-2">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wider opacity-70">Models</span>
                      <span className="mt-2 text-xs italic text-[var(--muted)]">Chatflix: The Ultimate Collection of Excellence</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* <button 
                        onClick={() => setIsFullscreen(true)}
                        className="expand-button"
                        aria-label="Expand to fullscreen"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor"/>
                        </svg>
                      </button> */}
                      <button 
                        onClick={() => setIsOpen(false)}
                        className="text-[var(--muted)] hover:text-[var(--foreground)] text-xs"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Desktop mode - add expand button */}
              {!isMobile && !isFullscreen && (
                <div className="sticky top-0 z-10 bg-[var(--background)] pb-2 pt-2 px-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs italic text-[var(--muted)]">Chatflix: The Ultimate Collection of Excellence</span>
                    <button 
                      onClick={() => setIsFullscreen(true)}
                      className="expand-button"
                      aria-label="Expand to fullscreen"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor"/>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Fullscreen content container */}
              <div className={isFullscreen ? "fullscreen-content" : ""}>
                {/* Graph container with enhanced styling for fullscreen mode */}
                <div className={`${isFullscreen ? 'graph-container' : ''}`}>
                  <ModelPerformanceGraph 
                    models={MODEL_OPTIONS} 
                    isMobile={isMobile && !isFullscreen} 
                    isFullscreen={isFullscreen}
                  />
                  
                  {/* Add Bar Chart below the scatter plot */}
                  <ModelBarChart
                    models={MODEL_OPTIONS}
                    isMobile={isMobile && !isFullscreen}
                    isFullscreen={isFullscreen}
                  />
                </div>
                
                {/* Model options list */}
                <div className={`py-1 space-y-10 ${isFullscreen ? 'max-w-4xl mx-auto px-4' : ''}`}>
                  {MODEL_OPTIONS.length > 0 ? (
                    MODEL_OPTIONS.map((option, index) => {
                      // Check if this model is disabled (either by ID, by level, or doesn't support web search)
                      const isModelDisabled = disabledModels.includes(option.id) || 
                                             (allDisabledLevels.length > 0 && allDisabledLevels.includes(option.rateLimit.level)) ||
                                             (isWebSearchEnabled && !option.isWebSearchEnabled);
                      
                      return (
                        <div 
                          key={option.id}
                          className={`model-option last:border-b-0 relative
                                   ${option.id === nextModel ? 'active' : ''}
                                   ${isModelDisabled 
                                     ? 'opacity-50 cursor-not-allowed disabled' 
                                     : 'cursor-pointer'}
                                   transition-all
                                   ${isMobile ? 'p-5' : ''}`}
                          onClick={() => {
                            if (!isModelDisabled) {
                              setNextModel(option.id);
                              setIsOpen(false);
                            }
                          }}
                          onMouseEnter={() => !isModelDisabled && setHoverIndex(index)}
                          onMouseLeave={() => !isModelDisabled && setHoverIndex(null)}
                          role="option"
                          aria-selected={option.id === nextModel}
                          aria-disabled={isModelDisabled ? 'true' : 'false'}
                        >
                          <div className="flex flex-col">
                            <div className="text-base font-normal mb-1 transition-all flex items-center gap-2">
                              {/* Provider Logo */}
                              {option.provider && (
                                <div 
                                  className="provider-logo w-4 h-4 flex-shrink-0"
                                >
                                  {hasLogo(option.provider) ? (
                                    <Image 
                                      src={getProviderLogo(option.provider)}
                                      alt={`${option.provider} logo`}
                                      width={16}
                                      height={16}
                                      className="object-contain"
                                    />
                                  ) : (
                                    <div className="w-4 h-4 flex items-center justify-center text-[8px] uppercase bg-[var(--accent)]/10 rounded-sm">
                                      {option.provider.substring(0, 1)}
                                    </div>
                                  )}
                                </div>
                              )}
                              <span className="model-name">
                                {option.name}
                              </span>
                            </div>
                       
                            
                            {/* Model metrics - TPS and Intelligence Index */}
                            <div className="flex items-start mt-2 mb-2">
                              <div className="w-4 mr-2 flex-shrink-0"></div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1">
                                {option.tps && (
                                  <div className="inline-flex items-center gap-1">
                                    <span className="text-[10px] uppercase tracking-wider opacity-60">Speed</span>
                                    <span className="text-base uppercase font-bold bg-[var(--accent)]/10 px-1.5 py-0.5 rounded-sm flex items-center">
                                      {typeof option.tps === 'number' ? (
                                        <>
                                          {option.tps >= 300 ? '⚡️ Very Fast' : 
                                           option.tps >= 200 ? 'Fast' : 
                                           option.tps >= 100 ? 'Medium' : 'Slow'}
                                          <span className="text-[9px] ml-1 opacity-60">({option.tps.toFixed(1)})</span>
                                        </>
                                      ) : option.tps}
                                    </span>
                                  </div>
                                )}
                                
                                {option.intelligenceIndex && (
                                  <div className="inline-flex items-center gap-1">
                                    <span className="text-[10px] uppercase tracking-wider opacity-60">Intelligence</span>
                                    <span className="text-base uppercase font-bold bg-[var(--accent)]/10 px-1.5 py-0.5 rounded-sm flex items-center">
                                      {typeof option.intelligenceIndex === 'number' ? (
                                        <>
                                          {option.intelligenceIndex >= 55 ? '🧠 Superior' : 
                                           option.intelligenceIndex >= 45 ? 'Advanced' : 
                                           option.intelligenceIndex >= 35 ? 'Good' : 'Basic'}
                                          <span className="text-[9px] ml-1 opacity-60">({option.intelligenceIndex.toFixed(1)})</span>
                                        </>
                                      ) : option.intelligenceIndex}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Web Search Support indicator */}
                                {/* {isWebSearchEnabled && (
                                  <div className="inline-flex items-center gap-1">
                                    <span className="text-[10px] uppercase tracking-wider opacity-60">Web Search</span>
                                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-sm flex items-center ${option.isWebSearchEnabled ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                                      {option.isWebSearchEnabled ? 'Supported' : 'Not Supported'}
                                    </span>
                                  </div>
                                )}
                                 */}
                                {option.contextWindow && (
                                  <div className="inline-flex items-center gap-1">
                                    <span className="text-[10px] uppercase tracking-wider opacity-60">Context</span>
                                    <span className="text-base uppercase font-bold bg-[var(--accent)]/10 px-1.5 py-0.5 rounded-sm flex items-center">
                                      {typeof option.contextWindow === 'number' ? (
                                        <>
                                          {option.contextWindow >= 1024000 ? '📚 Enormous' : 
                                           option.contextWindow >= 200000 ? 'Very Large' : 
                                           option.contextWindow >= 128000 ? 'Large' : 
                                           option.contextWindow >= 32000 ? 'Medium' : 'Standard'}
                                          <span className="text-[9px] ml-1 opacity-60">({(option.contextWindow / 1000).toFixed(0)}K)</span>
                                        </>
                                      ) : option.contextWindow}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                                 
                            {/* Description */}
                            <div className="flex items-start">
                              <div className="w-4 mr-2 flex-shrink-0"></div>
                              <div className={`text-xs transition-all
                                        ${option.id === nextModel || hoverIndex === index ? 'text-[var(--muted)]' : 'text-[var(--muted)] opacity-60'}`}>
                                {option.description}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-4 py-2 text-sm text-[var(--muted)]">
                      No models available
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}