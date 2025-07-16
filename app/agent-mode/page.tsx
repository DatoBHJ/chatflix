"use client";

import { Brain, Search, Calculator, Link, Image, GraduationCap, Video, Sparkles, FileText, FileVideo, Library, Columns, TrendingUp, BatteryCharging, MapPin, Coffee, BookOpen, ChevronDown, ChevronRight, Palette, X, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import NextImage from 'next/image';
import { getProviderLogo } from '../../lib/models/logoUtils';
import { getIcon } from 'material-file-icons';
import { fileHelpers } from '../components/ChatInput/FileUpload';

// Tool definitions with their identifiers
const TOOLS = [
  { id: 'web_search', icon: <Search strokeWidth={1.5} />, name: 'Web Search' },
  { id: 'link_reader', icon: <Link strokeWidth={1.5} />, name: 'Link Reader' },
  { id: 'youtube_search', icon: <Video strokeWidth={1.5} />, name: 'YouTube Search' },
  { id: 'youtube_analyzer', icon: <Video strokeWidth={1.5} />, name: 'YouTube Analyzer' },
  { id: 'academic_search', icon: <GraduationCap strokeWidth={1.5} />, name: 'Academic Search' },
  { id: 'image_generator', icon: <Image strokeWidth={1.5} />, name: 'Image Generator' },
  { id: 'calculator', icon: <Calculator strokeWidth={1.5} />, name: 'Calculator' },
];

const PROMPT_EXAMPLES = [
  {
    icon: <FileVideo strokeWidth={1.5} />,
    prompt: "Find the 3 most popular review videos for the M4 iPad Pro and create a document summarizing the pros and cons from each.",
    outcome: "Perfect! I'll search YouTube for the most popular M4 iPad Pro reviews, analyze the top 3 videos, and create a comprehensive summary document with all the pros and cons mentioned in each review.",
    tools: ['YouTube Search', 'Analysis'],
    hasFile: true,
    fileData: {
      fileName: "M4-iPad-Pro-Reviews.md",
      fileSize: "8.2 KB",
      fileType: "markdown"
    }
  },
  {
    icon: <Columns strokeWidth={1.5} />,
    prompt: "Analyze Framework Laptop's product page [link], find its two main competitors, and create a spec comparison file.",
    outcome: "Got it! I'll read the Framework Laptop page content, identify its main competitors through web search, and generate a detailed specification comparison file for you.",
    tools: ['Link Reader', 'Web Search'],
    hasFile: true,
    fileData: {
      fileName: "Framework-Comparison.md",
      fileSize: "6.5 KB",
      fileType: "markdown"
    }
  },
  {
    icon: <Coffee strokeWidth={1.5} />,
    prompt: "I'm looking for a good coffee machine under $200. Find the top 3 models, compare their features and user reviews in a table, and recommend the best one.",
    outcome: "I'll help you find the perfect coffee machine! Let me search for the top-rated models under $200, compare their features and reviews, and create a detailed buying guide with my recommendation.",
    tools: ['Web Search', 'Analysis'],
    hasFile: true,
    fileData: {
      fileName: "Coffee-Machine-Buying-Guide.md",
      fileSize: "7.1 KB",
      fileType: "markdown"
    }
  },
  {
    icon: <BookOpen strokeWidth={1.5} />,
    prompt: "I want to learn Python. Find the best free online courses for beginners and create a 4-week study plan for me.",
    outcome: "Great choice! I'll search for the best free Python courses for beginners across web and YouTube, then create a personalized 4-week study plan that fits your learning style.",
    tools: ['Web Search', 'YouTube Search'],
    hasFile: true,
    fileData: {
      fileName: "Python-4week-plan.txt",
      fileSize: "4.2 KB",
      fileType: "text"
    }
  },
  {
    icon: <BatteryCharging strokeWidth={1.5} />,
    prompt: "Find the latest academic papers on solid-state EV battery technology and list car models that plan to use it.",
    outcome: "Fascinating topic! I'll search academic databases for the latest solid-state battery research and combine it with web search to find which car manufacturers are planning to implement this technology.",
    tools: ['Academic Search', 'Web Search'],
    hasFile: false
  },
  {
    icon: <MapPin strokeWidth={1.5} />,
    prompt: "Plan a 3-day weekend trip to Paris next month. Find highly-rated dinner restaurants and create a daily itinerary file.",
    outcome: "Exciting! I'll search for the best flights, accommodations, and highly-rated restaurants in Paris, then create a complete 3-day itinerary file with all the details you need.",
    tools: ['Web Search', 'Planning'],
    hasFile: true,
    fileData: {
      fileName: "Paris-3day-itinerary.md",
      fileSize: "5.9 KB",
      fileType: "markdown"
    }
  },
  {
    icon: <Palette strokeWidth={1.5} />,
    prompt: "Create a minimalist logo design for a sustainable coffee brand called 'GreenBean' with earthy tones.",
    outcome: "Love the concept! I'll create a beautiful minimalist logo for GreenBean using earthy colors that perfectly captures the sustainable coffee brand aesthetic you're looking for.",
    tools: ['Image Generator'],
    hasFile: false
  },
  {
    icon: <Calculator strokeWidth={1.5} />,
    prompt: "I'm planning to buy a house for &#36;450,000 with a 20% down payment. Calculate my monthly mortgage payment with a 6.5% interest rate for 30 years.",
    outcome: "I'll calculate your exact monthly mortgage payment including principal and interest, plus show you the total cost breakdown over the 30-year term so you can plan your budget accordingly.",
    tools: ['Calculator'],
    hasFile: false
  },
  {
    icon: <Video strokeWidth={1.5} />,
    prompt: "Analyze this YouTube video about climate change solutions [youtube link] and find related academic research to fact-check the claims.",
    outcome: "I'll analyze the video content to extract the key claims, then search academic databases to find peer-reviewed research that supports or contradicts these claims, giving you a fact-checked summary.",
    tools: ['YouTube Analyzer', 'Academic Search'],
    hasFile: false
  }
];

// FilePreview 컴포넌트 (클릭 효과 없음)
const FilePreview = ({ fileName, fileSize, fileType }: { fileName: string; fileSize: string; fileType: string }) => {
  const getFileIconElement = (fileName: string) => {
    const icon = getIcon(fileName);
    return (
      <div 
        style={{ width: '24px', height: '24px' }}
        dangerouslySetInnerHTML={{ __html: icon.svg }}
      />
    );
  };

  return (
    <div className="imessage-file-bubble" style={{ cursor: 'default' }}>
      {/* File Icon */}
      <div className="flex-shrink-0">
        {getFileIconElement(fileName)}
      </div>
      {/* File Info */}
      <div className="flex-1 text-left overflow-hidden">
        <p className="font-medium truncate text-sm text-black/60 dark:text-white/80">
          {fileName}
        </p>
        <p className="text-xs text-black/40 dark:text-white/60">
          {fileSize}
        </p>
      </div>
      {/* Download Icon */}
      <div className="p-1">
        <Download className="text-neutral-500" size={20} />
      </div>
    </div>
  );
};

// ConversationExample 컴포넌트는 그대로
const ConversationExample = ({ example }: { example: typeof PROMPT_EXAMPLES[0] }) => {
  return (
    <div className="space-y-4">
      {/* User Prompt */}
      <div className="flex justify-end">
        <div className="imessage-send-bubble max-w-md">
          <p className="text-sm md:text-base leading-relaxed">{example.prompt}</p>
        </div>
      </div>
      
      {/* AI Response */}
      <div className="flex justify-start">
        <div className="imessage-receive-bubble max-w-lg">
          <p className="text-sm md:text-base leading-relaxed">{example.outcome}</p>
          <div className="flex flex-wrap gap-2 mt-4 border-t border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] dark:border-white/10 pt-3">
            {example.tools.map((tool, toolIndex) => (
              <span key={toolIndex} className="text-xs px-2.5 py-1 bg-[var(--background)] text-[var(--muted)] dark:bg-white/10 dark:text-white/80 rounded-full font-medium tracking-wide">
                {tool}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* File Preview (if applicable) */}
      {example.hasFile && example.fileData && (
        <div className="flex justify-start">
          <div className="max-w-lg">
            <FilePreview 
              fileName={example.fileData.fileName}
              fileSize={example.fileData.fileSize}
              fileType={example.fileData.fileType}
            />
          </div>
        </div>
      )}
    </div>
  );
};
// A reusable component for displaying tool cards
const ToolCard = ({ tool, isSelected, onClick }: { tool: typeof TOOLS[0]; isSelected: boolean; onClick: () => void }) => (
  <div 
    className={`flex flex-col items-center justify-center text-center gap-3 p-4 rounded-xl transition-all duration-200 h-full cursor-pointer ${
      isSelected 
        ? 'bg-[var(--foreground)] text-[var(--background)]' 
        : 'bg-[var(--accent)] hover:bg-color-mix(in srgb, var(--foreground) 4%, var(--accent))'
    }`}
    onClick={onClick}
  >
    <div className="h-8 w-8">
      {tool.icon}
    </div>
    <span className="text-sm font-medium">{tool.name}</span>
  </div>
);

export default function AgentModePage() {
  // Changed: Set default selected tool to 'web_search'
  const [selectedTool, setSelectedTool] = useState<string | null>('web_search');

  useEffect(() => {
    document.title = 'Agent Mode - From Request to Result';
  }, []);

  // Filter prompts based on selected tool
  const filteredPrompts = selectedTool 
    ? PROMPT_EXAMPLES.filter(example => 
        example.tools.some(tool => 
          TOOLS.find(t => t.id === selectedTool)?.name === tool
        )
      )
    : PROMPT_EXAMPLES;

  const handleToolClick = (toolId: string) => {
    setSelectedTool(selectedTool === toolId ? null : toolId);
  };

  const clearFilter = () => {
    setSelectedTool(null);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="bg-transparent pt-20 pb-12">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <div className="flex justify-center items-center gap-4 mb-6">
            <Brain className="h-10 w-10 text-[var(--foreground)]" strokeWidth={1.5} />
            <h1 className="text-5xl font-bold tracking-tight">Agent Mode</h1>
          </div>
          <p className="text-xl text-[var(--muted)] leading-relaxed max-w-2xl mx-auto">
            From a single request to a finished result. 
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* Tools Section */}
        <section className="mb-20 text-center">
          <h2 className="text-2xl font-semibold mb-8">Available Tools</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-4">
            {TOOLS.map((tool) => (
              <ToolCard 
                key={tool.id}
                tool={tool}
                isSelected={selectedTool === tool.id}
                onClick={() => handleToolClick(tool.id)}
              />
            ))}
          </div>
        </section>

        {/* Conversations Section */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              {/* <h2 className="text-3xl font-semibold">See It In Action</h2> */}
              {selectedTool && (
                <button
                  onClick={clearFilter}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-[var(--accent)] text-[var(--foreground)] rounded-full hover:bg-color-mix(in srgb, var(--foreground) 8%, var(--accent)) transition-colors duration-200"
                >
                  <X className="w-3 h-3" strokeWidth={1.5} />
                  Clear filter
                </button>
              )}
            </div>
            <p className="text-md text-[var(--muted)] max-w-3xl mx-auto mb-8">
              {selectedTool 
                ? `Conversations using ${TOOLS.find(t => t.id === selectedTool)?.name}.`
                : 'Real conversations showing how Agent Mode transforms complex requests into finished results.'
              }
            </p>
          </div>
          
          <div className="space-y-8">
            {filteredPrompts.map((example, index) => (
              <ConversationExample key={index} example={example} />
            ))}
          </div>
        </section>
        
        {/* How it works */}
        <section className="mb-24 text-center">
          <h2 className="text-3xl font-semibold mb-12">Effortless power. Three simple steps.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-lg font-medium mb-4">1</div>
              <h3 className="font-medium text-lg mb-2">It Understands</h3>
              <p className="text-sm text-[var(--muted)]">
                Starts by deeply analyzing your request to uncover your true goal.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-lg font-medium mb-4">2</div>
              <h3 className="font-medium text-lg mb-2">It Strategizes</h3>
              <p className="text-sm text-[var(--muted)]">
                Dynamically selects the right tools and crafts the optimal plan for the job.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-lg font-medium mb-4">3</div>
              <h3 className="font-medium text-lg mb-2">It Delivers</h3>
              <p className="text-sm text-[var(--muted)]">
                Builds and presents the final result—a detailed answer or a ready-to-use file.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <div className="p-12 rounded-2xl bg-color-mix(in srgb, var(--foreground) 5%, transparent)">
            <Brain className="h-12 w-12 text-[var(--foreground)] mx-auto mb-6" strokeWidth={1.5} />
            <h3 className="text-2xl font-semibold mb-4">Ready to Create?</h3>
            <p className="text-[var(--muted)] mb-8 max-w-2xl mx-auto leading-relaxed">
              Enable Agent Mode in the chat interface and transform how you work.
            </p>
            <button 
              onClick={() => window.close()}
              className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--foreground)] text-[var(--background)] rounded-xl hover:opacity-90 transition-opacity duration-200 font-medium"
            >
              <Brain className="h-4 w-4" strokeWidth={1.5} />
              Back to Chat
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-20 py-12">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-center text-sm text-[var(--muted)]">
            Agent Mode by Chatflix. The intelligent way to get things done.
          </p>
        </div>
      </footer>
    </div>
  );
}
