"use client";

import { Brain, Search, Calculator, Link, Image, GraduationCap, Video, ArrowRight, Zap, Target, Layers, Sparkles, Play } from 'lucide-react';
import { useEffect } from 'react';
import NextImage from 'next/image';
import { getProviderLogo, hasLogo } from '../lib/models/logoUtils';

export default function AgentModePage() {
  useEffect(() => {
    document.title = 'Agent Mode - Advanced AI with Extended Tools';
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Header */}
      <header className="bg-[var(--accent)] pt-20">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="h-8 w-8 text-[var(--foreground)]" strokeWidth={1.5} />
            <h1 className="text-3xl font-bold">Agent Mode</h1>
          </div>
          <p className="text-lg text-[var(--muted)] leading-relaxed mb-8">
            Intelligent AI system that autonomously plans, researches, and executes complex multi-step tasks with dynamic workflow adaptation and specialized tool selection.
          </p>
          
          {/* Critical Notice */}
          <div className="p-6 rounded-xl bg-color-mix(in srgb, var(--foreground) 8%, transparent) border-l-4 border-[var(--foreground)]">
            <div className="flex items-start gap-3">
              {/* <div className="p-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] mt-0.5">
                <Brain className="h-5 w-5" strokeWidth={1.5} />
              </div> */}
              <div>
                <h3 className="font-semibold mb-2 text-[var(--foreground)] text-lg">⚠️ Critical: AI Model Dependency</h3>
                <p className="text-[var(--foreground)] font-medium leading-relaxed">
                  All Agent Mode results, analysis quality, and decision-making capabilities are <strong>completely dependent</strong> on your selected AI model. Different models produce vastly different levels of accuracy, depth, and insight when using identical tools. Your model choice directly determines the quality of Agent Mode performance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Overview Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
            <Target className="h-6 w-6 text-[var(--foreground)]" strokeWidth={1.5} />
            3-Stage Agentic Process
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="p-8 rounded-xl bg-[var(--accent)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-sm font-medium">1</div>
                <h3 className="font-medium">Strategic Planning</h3>
              </div>
              <p className="text-sm text-[var(--muted)]">
                AI analyzes your query complexity, creates detailed execution plans, and selects optimal workflow mode based on task requirements and desired output format.
              </p>
            </div>
            
            <div className="p-8 rounded-xl bg-[var(--accent)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-sm font-medium">2</div>
                <h3 className="font-medium">Tool Execution & Research</h3>
              </div>
              <p className="text-sm text-[var(--muted)]">
                Dynamically selects and executes multiple specialized tools simultaneously, gathering real-time data with intelligent routing based on model capabilities and query needs.
              </p>
            </div>
            
            <div className="p-8 rounded-xl bg-[var(--accent)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-sm font-medium">3</div>
                <h3 className="font-medium">Synthesis & Delivery</h3>
              </div>
              <p className="text-sm text-[var(--muted)]">
                Creates comprehensive responses with structured supporting files, follow-up questions, and organized deliverables tailored to the selected workflow mode.
              </p>
            </div>
          </div>

          <div className="p-8 rounded-xl bg-color-mix(in srgb, var(--foreground) 5%, transparent)">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-[var(--foreground)] mt-0.5 flex-shrink-0" strokeWidth={1.5} />
              <div>
                <h3 className="font-medium mb-2">Adaptive Workflow Intelligence</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  Agent automatically selects the optimal workflow based on task analysis: 
                  <strong className="text-[var(--foreground)]"> Information Response</strong> for research-focused queries requiring comprehensive answers, 
                  <strong className="text-[var(--foreground)]"> Content Creation</strong> for deliverable-focused tasks with organized file outputs, or 
                  <strong className="text-[var(--foreground)]"> Balanced</strong> for hybrid tasks requiring both detailed explanations and supporting materials.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Optimal Model Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-[var(--foreground)]" strokeWidth={1.5} />
            Optimal Agent Mode Experience
          </h2>
          
          <div className="p-8 rounded-xl bg-gradient-to-br from-[color-mix(in_srgb,var(--foreground)_8%,transparent)] to-[color-mix(in_srgb,var(--foreground)_3%,transparent)] border border-[var(--border)] mb-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[var(--foreground)] text-[var(--background)]">
                <Sparkles className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-3 text-[var(--foreground)] text-lg">Best Performance with Chatflix Models</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed mb-4">
                  For the superior Agent Mode experience, we recommend <strong>Chatflix (Deluxe)</strong> or <strong>Chatflix</strong> models. These models are specifically optimized for Agent Mode with advanced reasoning capabilities, full tool compatibility, and intelligent model selection that automatically chooses the best underlying AI for each task.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-[var(--accent)]">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-6 h-6 flex-shrink-0">
                        <NextImage 
                          src={getProviderLogo('anthropic', 'chatflix-ultimate-pro')}
                          alt="Chatflix (Deluxe) logo"
                          width={24}
                          height={24}
                          className="object-contain"
                        />
                      </div>
                      <h4 className="font-medium text-[var(--foreground)]">Chatflix (Deluxe)</h4>
                    </div>
                    <p className="text-xs text-[var(--muted)]">Optimized for complex technical tasks with superior reasoning</p>
                  </div>
                  <div className="p-4 rounded-lg bg-[var(--accent)]">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-6 h-6 flex-shrink-0">
                        <NextImage 
                          src={getProviderLogo('anthropic', 'chatflix-ultimate')}
                          alt="Chatflix logo"
                          width={24}
                          height={24}
                          className="object-contain"
                        />
                      </div>
                      <h4 className="font-medium text-[var(--foreground)]">Chatflix</h4>
                    </div>
                    <p className="text-xs text-[var(--muted)]">Balanced for everyday tasks with intelligent speed optimization</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tools Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
            <Layers className="h-6 w-6 text-[var(--foreground)]" strokeWidth={1.5} />
            Available Tools
          </h2>


          
          <div className="space-y-8">
            {/* Web Search */}
            <div className="p-8 rounded-xl bg-[var(--accent)] hover:bg-color-mix(in srgb, var(--foreground) 4%, var(--accent)) transition-colors duration-200">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-color-mix(in srgb, var(--foreground) 8%, transparent)">
                  <Search className="h-5 w-5 text-[var(--foreground)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium mb-2">Web Search</h3>
                  <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">
                    Real-time information from the internet with intelligent multi-query generation. Automatically creates 3-5 targeted search queries, prioritizes current events and breaking news, and aggregates results from multiple authoritative sources for comprehensive coverage.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Multi-Query Generation</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Real-time Data</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">News Prioritization</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Link Reader */}
            <div className="p-8 rounded-xl bg-[var(--accent)] hover:bg-color-mix(in srgb, var(--foreground) 4%, var(--accent)) transition-colors duration-200 relative">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-color-mix(in srgb, var(--foreground) 8%, transparent)">
                  <Link className="h-5 w-5 text-[var(--foreground)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">Link Reader</h3>
                    <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 rounded font-medium">Model Dependent</span>
                  </div>
                  <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">
                    Reading and analyzing web page content using Jina AI. Extracts and processes webpage text, documents, and various online content formats with AI-powered analysis. Note: Gemini 2.5 Pro/Flash models do not support this tool.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Webpage Analysis</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Content Extraction</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">AI Processing</span>
                  </div>
                </div>
              </div>
            </div>

            {/* YouTube Link Analyzer */}
            <div className="p-8 rounded-xl bg-[var(--accent)] hover:bg-color-mix(in srgb, var(--foreground) 4%, var(--accent)) transition-colors duration-200 relative">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-color-mix(in srgb, var(--foreground) 8%, transparent)">
                  <Link className="h-5 w-5 text-[var(--foreground)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">YouTube Link Analyzer</h3>
                    <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 rounded font-medium">Model Dependent</span>
                  </div>
                  <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">
                    Analyzing specific YouTube videos using direct video URLs. Extracts full transcripts, detailed metadata, engagement metrics, and content insights from provided YouTube links. Note: Gemini 2.5 Pro/Flash models do not support this tool.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Transcript Extraction</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Metadata Analysis</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">URL-Based</span>
                  </div>
                </div>
              </div>
            </div>

            {/* YouTube Search */}
            <div className="p-8 rounded-xl bg-[var(--accent)] hover:bg-color-mix(in srgb, var(--foreground) 4%, var(--accent)) transition-colors duration-200">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-color-mix(in srgb, var(--foreground) 8%, transparent)">
                  <Video className="h-5 w-5 text-[var(--foreground)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium mb-2">YouTube Search</h3>
                  <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">
                    Finding relevant video content by topic, keyword, or subject matter. Retrieves comprehensive video metadata including titles, descriptions, view counts, channel information, and engagement metrics for content discovery and research purposes.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Keyword-Based Discovery</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Comprehensive Metadata</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Content Research</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Image Generator */}
            <div className="p-8 rounded-xl bg-[var(--accent)] hover:bg-color-mix(in srgb, var(--foreground) 4%, var(--accent)) transition-colors duration-200">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-color-mix(in srgb, var(--foreground) 8%, transparent)">
                  <Image className="h-5 w-5 text-[var(--foreground)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium mb-2">Image Generator</h3>
                  <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">
                    Creating visual content using advanced AI models through Pollinations AI platform. Supports detailed prompts, custom dimensions, seed-based editing for consistent variations, and multiple model options including Flux and Turbo for different quality and speed requirements.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Prompt-to-Image</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Seed Control</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Multiple Models</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Academic Search */}
            <div className="p-8 rounded-xl bg-[var(--accent)] hover:bg-color-mix(in srgb, var(--foreground) 4%, var(--accent)) transition-colors duration-200">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-color-mix(in srgb, var(--foreground) 8%, transparent)">
                  <GraduationCap className="h-5 w-5 text-[var(--foreground)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium mb-2">Academic Search</h3>
                  <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">
                    Finding scholarly and research materials using Exa AI's academic database. Searches through peer-reviewed publications, research papers, academic abstracts, and scholarly content with automatic summarization, citation extraction, and credibility assessment.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Peer-Review Focus</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Citation Extraction</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Scholarly Database</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculator */}
            <div className="p-8 rounded-xl bg-[var(--accent)] hover:bg-color-mix(in srgb, var(--foreground) 4%, var(--accent)) transition-colors duration-200">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-color-mix(in srgb, var(--foreground) 8%, transparent)">
                  <Calculator className="h-5 w-5 text-[var(--foreground)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium mb-2">Calculator</h3>
                  <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">
                    Mathematical calculations and computations engine. Handles complex mathematical expressions, unit conversions, statistical operations, trigonometric functions, and advanced calculations with detailed step-by-step result tracking and verification.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Expression Evaluation</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Unit Conversion</span>
                    <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Step Tracking</span>
                  </div>
                </div>
              </div>
            </div>
{/* High-Quality Image Generator - Coming Soon */}
<div className="p-8 rounded-xl bg-[var(--accent)] opacity-60 relative">
  <div className="flex items-start gap-4">
    <div className="p-3 rounded-xl bg-color-mix(in srgb, var(--foreground) 8%, transparent)">
      <Sparkles className="h-5 w-5 text-[var(--foreground)]" strokeWidth={1.5} />
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-medium">High-Quality Image Generator</h3>
        <span className="px-2 py-1 text-xs bg-[var(--foreground)] text-[var(--background)] rounded font-medium">Coming Soon</span>
      </div>
      <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">
        Create premium high-quality images with advanced AI models. Delivers significantly higher quality results than standard image generation, with enhanced detail, better composition, and professional-grade output for demanding visual projects.
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Premium Quality</span>
        <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Advanced AI Models</span>
        <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Professional Output</span>
      </div>
    </div>
  </div>
</div>

{/* Video Generation - Coming Soon */}
<div className="p-8 rounded-xl bg-[var(--accent)] opacity-60 relative">
  <div className="flex items-start gap-4">
    <div className="p-3 rounded-xl bg-color-mix(in srgb, var(--foreground) 8%, transparent)">
      <Play className="h-5 w-5 text-[var(--foreground)]" strokeWidth={1.5} />
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-medium">Video Generation</h3>
        <span className="px-2 py-1 text-xs bg-[var(--foreground)] text-[var(--background)] rounded font-medium">Coming Soon</span>
      </div>
      <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">
        Advanced AI-powered video creation and editing capabilities. Generate custom videos from text prompts, edit existing content, and create professional-quality visual narratives with automated scene composition and effects.
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">AI Video Creation</span>
        <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Text-to-Video</span>
        <span className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--muted)] rounded">Professional Editing</span>
      </div>
    </div>
  </div>
</div>

          </div>
        </section>

        {/* Use Cases Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-8">Workflow-Optimized Use Cases</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 rounded-xl bg-[var(--accent)]">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                Information Response Mode
              </h3>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li>• Real-time market research and analysis</li>
                <li>• Academic literature reviews with citations</li>
                <li>• Current events and news synthesis</li>
                <li>• Technical documentation research</li>
                <li>• Competitive intelligence gathering</li>
              </ul>
            </div>
            
            <div className="p-8 rounded-xl bg-[var(--accent)]">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                Content Creation Mode
              </h3>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li>• Complete code projects with documentation</li>
                <li>• Technical guides and tutorials</li>
                <li>• Visual content and custom illustrations</li>
                <li>• Interactive data visualizations</li>
                <li>• Structured deliverables and reports</li>
              </ul>
            </div>
            
            <div className="p-8 rounded-xl bg-[var(--accent)]">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                Balanced Mode
              </h3>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li>• Complex problem-solving with implementation</li>
                <li>• Multi-step workflow automation design</li>
                <li>• Strategic analysis with actionable plans</li>
                <li>• Research-backed content creation</li>
                <li>• Educational materials with examples</li>
              </ul>
            </div>
            
            <div className="p-8 rounded-xl bg-[var(--accent)]">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                Multi-Tool Integration
              </h3>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li>• YouTube content analysis with web research</li>
                <li>• Image generation with mathematical calculations</li>
                <li>• Academic research with visual documentation</li>
                <li>• Web data analysis with chart generation</li>
                <li>• Cross-platform content synthesis</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <div className="p-12 rounded-2xl bg-color-mix(in srgb, var(--foreground) 5%, transparent)">
            <Brain className="h-12 w-12 text-[var(--foreground)] mx-auto mb-6" strokeWidth={1.5} />
            <h3 className="text-xl font-semibold mb-4">Ready to Experience Intelligent Automation?</h3>
            <p className="text-[var(--muted)] mb-8 max-w-2xl mx-auto leading-relaxed">
              Transform your approach to complex tasks with Agent Mode's 3-stage agentic process. 
              Enable Agent Mode in the chat interface to unlock intelligent planning, dynamic tool selection, and adaptive workflow management for superior results.
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
      <footer className="mt-20 py-12 bg-[var(--accent)]">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-center text-sm text-[var(--muted)]">
            Agent Mode leverages advanced AI planning, dynamic tool routing, and adaptive workflow management for autonomous multi-step task execution with intelligent model-specific optimization.
          </p>
        </div>
      </footer>
    </div>
  );
} 