"use client";

import { Brain, Search, Calculator, Link, Image, GraduationCap, Video, Sparkles, FileText, FileVideo, Library, Columns, TrendingUp, BatteryCharging, MapPin, Coffee, BookOpen, ChevronDown, ChevronRight, Palette, X, Download, Github, Building, BarChart3, FileText as FileTextIcon, User, Briefcase, BookOpen as BookOpenIcon, Newspaper, Zap, Target, Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import NextImage from 'next/image';
import { getProviderLogo } from '../../lib/models/logoUtils';
import { getIcon } from 'material-file-icons';
import { fileHelpers } from '../components/ChatInput/FileUpload';

// Tool definitions with their identifiers and descriptions
const TOOLS = [
  { 
    id: 'web_search', 
    icon: <Search strokeWidth={1.5} />, 
    name: 'Web Search',
    description: 'Search the web for current information and facts',
    examples: ['Find latest news about AI', 'Research product reviews', 'Look up current events']
  },
  { 
    id: 'github_search', 
    icon: <Github strokeWidth={1.5} />, 
    name: 'GitHub Search',
    description: 'Search GitHub repositories and code',
    examples: ['Find React libraries', 'Explore open source projects', 'Search code examples']
  },
  { 
    id: 'news_search', 
    icon: <Newspaper strokeWidth={1.5} />, 
    name: 'News Search',
    description: 'Find latest news and articles',
    examples: ['Get breaking news', 'Find industry updates', 'Search recent articles']
  },
  { 
    id: 'company_search', 
    icon: <Building strokeWidth={1.5} />, 
    name: 'Company Search',
    description: 'Find company information and profiles',
    examples: ['Research company details', 'Find business information', 'Look up corporate data']
  },
  { 
    id: 'financial_search', 
    icon: <BarChart3 strokeWidth={1.5} />, 
    name: 'Financial Reports',
    description: 'Search financial data and market reports',
    examples: ['Find stock information', 'Research market trends', 'Get financial analysis']
  },
  { 
    id: 'pdf_search', 
    icon: <FileTextIcon strokeWidth={1.5} />, 
    name: 'PDF Search',
    description: 'Search PDF documents and reports',
    examples: ['Find research papers', 'Search legal documents', 'Look up technical reports']
  },
  { 
    id: 'personal_site_search', 
    icon: <User strokeWidth={1.5} />, 
    name: 'Personal Sites',
    description: 'Find personal websites and blogs',
    examples: ['Find expert blogs', 'Search personal portfolios', 'Look up individual websites']
  },
  { 
    id: 'linkedin_search', 
    icon: <Briefcase strokeWidth={1.5} />, 
    name: 'LinkedIn Profiles',
    description: 'Search LinkedIn profiles and professional information',
    examples: ['Find industry experts', 'Research career paths', 'Look up professional profiles']
  },
  { 
    id: 'academic_search', 
    icon: <BookOpenIcon strokeWidth={1.5} />, 
    name: 'Academic Papers',
    description: 'Find academic research papers and studies',
    examples: ['Find scientific studies', 'Research academic topics', 'Look up peer-reviewed papers']
  },
  { 
    id: 'link_reader', 
    icon: <Link strokeWidth={1.5} />, 
    name: 'Link Reader',
    description: 'Read and analyze web page content',
    examples: ['Analyze article content', 'Extract information from pages', 'Summarize web content']
  },
  { 
    id: 'youtube_search', 
    icon: <Video strokeWidth={1.5} />, 
    name: 'YouTube Search',
    description: 'Search YouTube videos and content',
    examples: ['Find tutorial videos', 'Search product reviews', 'Look up educational content']
  },
  { 
    id: 'youtube_analyzer', 
    icon: <Video strokeWidth={1.5} />,
    name: 'YouTube Analyzer',
    description: 'Analyze YouTube video content and transcripts',
    examples: ['Analyze video content', 'Extract key points', 'Summarize video information']
  },
  { 
    id: 'image_generator', 
    icon: <Image strokeWidth={1.5} />, 
    name: 'Image Generator',
    description: 'Generate images from text descriptions',
    examples: ['Create logos', 'Generate illustrations', 'Design graphics']
  },
  { 
    id: 'calculator', 
    icon: <Calculator strokeWidth={1.5} />, 
    name: 'Calculator',
    description: 'Perform mathematical calculations',
    examples: ['Calculate mortgage payments', 'Solve equations', 'Convert units']
  },
];

// Tool explanation examples in iMessage style
const TOOL_EXAMPLES = [
  {
    userPrompt: "I want to plan a trip to Japan",
    agentResponse: "I'll help you plan your Japan trip! Let me gather current travel information, find the best places to visit, and get practical travel tips for you.",
    selectedTools: ['Web Search', 'News Search'],
    reasoning: "Web Search for general travel information and current events, News Search for any recent travel advisories or updates about Japan."
  },
  {
    userPrompt: "Research the latest AI developments",
    agentResponse: "I'll keep you updated on the latest AI developments! Let me find the most recent news, research papers, and expert opinions on this topic.",
    selectedTools: ['News Search', 'Academic Papers', 'Web Search'],
    reasoning: "News Search for breaking AI news, Academic Papers for recent research findings, Web Search for comprehensive coverage and expert blogs."
  },
  {
    userPrompt: "Find the best React state management solution",
    agentResponse: "I'll help you find the perfect React state management solution! Let me compare popular libraries, read documentation, and find community opinions.",
    selectedTools: ['GitHub Search', 'Web Search', 'Link Reader'],
    reasoning: "GitHub Search to find popular libraries and their stats, Web Search for comparisons and reviews, Link Reader to analyze documentation pages."
  },
  {
    userPrompt: "Learn about sustainable coffee practices",
    agentResponse: "I'll help you understand sustainable coffee practices! Let me find educational content, expert opinions, and practical guides on this topic.",
    selectedTools: ['Web Search', 'YouTube Search', 'Academic Papers'],
    reasoning: "Web Search for comprehensive information, YouTube Search for visual tutorials and expert interviews, Academic Papers for scientific research on sustainability."
  },
  {
    userPrompt: "Analyze Tesla's financial performance",
    agentResponse: "I'll analyze Tesla's financial performance for you! Let me gather financial data, market analysis, and recent news about the company.",
    selectedTools: ['Financial Reports', 'Company Search', 'News Search'],
    reasoning: "Financial Reports for quantitative data, Company Search for company profile and history, News Search for recent developments and market sentiment."
  },
  {
    userPrompt: "Create a minimalist logo design",
    agentResponse: "I'll create a beautiful minimalist logo for you! Let me understand your requirements and generate a visual design based on your description.",
    selectedTools: ['Image Generator'],
    reasoning: "Image Generator is the perfect tool for creating visual designs from text descriptions. No other tools needed for this creative task."
  }
];

// Tool Card Component
const ToolCard = ({ tool, isSelected, onClick }: { tool: typeof TOOLS[0]; isSelected: boolean; onClick: () => void }) => (
  <div 
    className={`flex flex-col items-center justify-center text-center gap-2 p-3 rounded-xl transition-all duration-200 h-20 cursor-pointer ${
      isSelected 
        ? 'bg-[var(--foreground)] text-[var(--background)]' 
        : 'bg-[var(--accent)] hover:bg-color-mix(in srgb, var(--foreground) 4%, var(--accent))'
    }`}
    onClick={onClick}
  >
    <div className="h-6 w-6">
      {tool.icon}
    </div>
    <span className="text-xs font-medium leading-tight">{tool.name}</span>
  </div>
);

// Tool Detail Component
const ToolDetail = ({ tool }: { tool: typeof TOOLS[0] }) => (
  <div className="bg-[var(--accent)] rounded-xl p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="h-8 w-8 text-[var(--foreground)]">
        {tool.icon}
      </div>
      <h3 className="text-lg font-semibold">{tool.name}</h3>
    </div>
    <p className="text-[var(--muted)] mb-4 leading-relaxed">
      {tool.description}
    </p>
    <div>
      <h4 className="text-sm font-medium mb-2">Example uses:</h4>
      <ul className="space-y-1">
        {tool.examples.map((example, index) => (
          <li key={index} className="text-sm text-[var(--muted)] flex items-center gap-2">
            <div className="w-1 h-1 bg-[var(--muted)] rounded-full"></div>
            {example}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

// iMessage Style Example Component
const ConversationExample = ({ example }: { example: typeof TOOL_EXAMPLES[0] }) => {
  return (
    <div className="space-y-4">
      {/* User Prompt */}
      <div className="flex justify-end">
        <div className="imessage-send-bubble max-w-md">
          <p className="text-sm md:text-base leading-relaxed">{example.userPrompt}</p>
        </div>
      </div>
      
      {/* AI Response */}
      <div className="flex justify-start">
        <div className="imessage-receive-bubble max-w-lg">
          <p className="text-sm md:text-base leading-relaxed">{example.agentResponse}</p>
          
          {/* Tool Selection Info */}
          <div className="mt-4 border-t border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] dark:border-white/10 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
              <span className="text-xs font-medium text-[var(--muted)]">Selected Tools:</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {example.selectedTools.map((tool, toolIndex) => (
                <span key={toolIndex} className="text-xs px-2.5 py-1 bg-[var(--background)] text-[var(--muted)] dark:bg-white/10 dark:text-white/80 rounded-full font-medium tracking-wide">
                  {tool}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-3 w-3 text-[var(--foreground)]" strokeWidth={1.5} />
              <span className="text-xs text-[var(--muted)] leading-relaxed">{example.reasoning}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AgentModePage() {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Agent Mode - Intelligent Tool Selection';
  }, []);

  const handleToolClick = (toolId: string) => {
    setSelectedTool(selectedTool === toolId ? null : toolId);
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
            Intelligent tool selection that understands your needs and chooses the perfect tools automatically.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* How Agent Mode Works */}
        <section className="mb-20 text-center">
          <h2 className="text-3xl font-semibold mb-12">How Agent Mode Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-lg font-medium mb-4">1</div>
              <h3 className="font-medium text-lg mb-2">Analyzes Your Request</h3>
              <p className="text-sm text-[var(--muted)]">
                Deeply understands what you're trying to accomplish and identifies the best approach.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-lg font-medium mb-4">2</div>
              <h3 className="font-medium text-lg mb-2">Selects Optimal Tools</h3>
              <p className="text-sm text-[var(--muted)]">
                Intelligently chooses the right combination of tools for your specific task.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-lg font-medium mb-4">3</div>
              <h3 className="font-medium text-lg mb-2">Delivers Results</h3>
              <p className="text-sm text-[var(--muted)]">
                Uses the selected tools to provide you with comprehensive, accurate answers.
              </p>
            </div>
          </div>
        </section>

        {/* Available Tools */}
        <section className="mb-20">
          <h2 className="text-2xl font-semibold mb-8 text-center">Available Tools</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4 mb-8">
            {TOOLS.map((tool) => (
              <ToolCard 
                key={tool.id}
                tool={tool}
                isSelected={selectedTool === tool.id}
                onClick={() => handleToolClick(tool.id)}
              />
            ))}
          </div>
          
          {/* Tool Detail */}
          {selectedTool && (
            <div className="mt-8">
              <ToolDetail tool={TOOLS.find(t => t.id === selectedTool)!} />
            </div>
          )}
        </section>

        {/* Examples Section */}
        <section className="mb-24">
          <h2 className="text-3xl font-semibold mb-12 text-center">See How Agent Mode Thinks</h2>
          <p className="text-md text-[var(--muted)] text-center max-w-3xl mx-auto mb-12">
            Watch how Agent Mode analyzes your requests and intelligently selects the perfect tools for each task.
          </p>
          
          <div className="space-y-8">
            {TOOL_EXAMPLES.map((example, index) => (
              <ConversationExample key={index} example={example} />
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <div className="p-12 rounded-2xl bg-color-mix(in srgb, var(--foreground) 5%, transparent)">
            <Brain className="h-12 w-12 text-[var(--foreground)] mx-auto mb-6" strokeWidth={1.5} />
            <h3 className="text-2xl font-semibold mb-4">Ready to Experience Intelligent Tool Selection?</h3>
            <p className="text-[var(--muted)] mb-8 max-w-2xl mx-auto leading-relaxed">
              Enable Agent Mode in the chat interface and let AI intelligently choose the perfect tools for your tasks.
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
            Agent Mode by Chatflix. Intelligent tool selection for smarter conversations.
          </p>
        </div>
      </footer>
    </div>
  );
}
