'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Database, Search, Code, Eye } from 'lucide-react';

interface MemoryData {
  user_id: string;
  memory_data: string;
  timestamp: string;
}

interface PreferenceSessionMeta {
  sessionId: string;
  title: string;
  messageCount: number;
  durationMinutes: number;
  totalTokens: number;
  score: number;
}

export default function MemoryViewerPage() {
  const [userId, setUserId] = useState('');
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMarkdown, setShowMarkdown] = useState(true);
  const [isRefining, setIsRefining] = useState(false);
  const [lastRefined, setLastRefined] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [refineStatus, setRefineStatus] = useState<string | null>(null);
  const [preferenceSessions, setPreferenceSessions] = useState<PreferenceSessionMeta[]>([]);
  const [preferenceSessionsNote, setPreferenceSessionsNote] = useState<string | null>(null);
  const [preferenceAnalysisTimestamp, setPreferenceAnalysisTimestamp] = useState<string | null>(null);

  const CATEGORY_OPTIONS = [
    { value: '', label: 'All Categories' },
    { value: '00-personal-info', label: '00 - Personal Information' },
    { value: '01-preferences', label: '01 - Preferences' },
    { value: '02-interests', label: '02 - Interests' }
  ];

  const fetchUserMemory = async ({ resetPreferenceInsights = true }: { resetPreferenceInsights?: boolean } = {}) => {
    if (!userId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMemoryData(null);
    if (resetPreferenceInsights) {
      setPreferenceSessions([]);
      setPreferenceSessionsNote(null);
      setPreferenceAnalysisTimestamp(null);
    }

    try {
      const response = await fetch(`/api/admin/memory-viewer?user_id=${encodeURIComponent(userId.trim())}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user memory');
      }

      setMemoryData(data);
      toast.success('Memory data loaded successfully');
    } catch (error) {
      console.error('Error fetching user memory:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch user memory';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUserMemory();
  };

  const refineUserMemory = async () => {
    if (!userId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }

    const shouldTrackPreferenceInsights = !selectedCategory || selectedCategory === '01-preferences';
    setIsRefining(true);
    setRefineStatus('Step 1/4 · Gathering long-session analytics...');
    try {
      const payload: Record<string, string> = {
        mode: 'manual',
        user_id: userId.trim()
      };

      if (selectedCategory) {
        payload.category = selectedCategory;
      }

      setRefineStatus('Step 2/4 · Requesting refinement from the model...');
      const response = await fetch(`/api/admin/memory-refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      setRefineStatus('Step 3/4 · Saving refreshed memory to Supabase...');
      
      if (response.ok) {
        toast.success(`Memory refined successfully! Processed: ${result.processed}, Successful: ${result.successful}`);
        setLastRefined(new Date().toLocaleString());
        if (shouldTrackPreferenceInsights) {
          const matchedResult = Array.isArray(result.results)
            ? result.results.find((item: any) => item.user_id === userId.trim())
            : result;
          const sessionMeta = matchedResult?.preferenceSessions || [];
          setPreferenceSessions(sessionMeta);
          setPreferenceSessionsNote(sessionMeta.length === 0 ? 'No qualifying long sessions were available for this run.' : null);
          setPreferenceAnalysisTimestamp(new Date().toLocaleString());
        } else {
          setPreferenceSessions([]);
          setPreferenceSessionsNote(null);
          setPreferenceAnalysisTimestamp(null);
        }
        setRefineStatus('Step 4/4 · Completed!');
        // Refresh memory data
        await fetchUserMemory({ resetPreferenceInsights: false });
      } else {
        toast.error(`Refine failed: ${result.error}`);
        setRefineStatus(null);
      }
    } catch (error) {
      console.error('Error refining memory:', error);
      toast.error('Failed to refine memory');
      setRefineStatus(null);
    } finally {
      setIsRefining(false);
    }
  };


  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-8">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <Database className="w-8 h-8" style={{ color: 'var(--foreground)' }} />
          <h1 className="text-3xl font-bold">User Memory Viewer</h1>
        </div>
      </div>

      {/* Search Form */}
      <div className="mb-8 p-6 rounded-lg" style={{ backgroundColor: 'var(--accent)', border: '1px solid var(--border)' }}>
        <h2 className="text-xl font-semibold mb-4">Search User Memory</h2>
        <form onSubmit={handleSubmit} className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="userId" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              User ID
            </label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID..."
              className="w-full px-4 py-2 rounded border"
              style={{
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                borderColor: 'var(--border)'
              }}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 rounded transition-colors text-sm font-semibold flex items-center gap-2"
            style={{
              backgroundColor: isLoading ? 'var(--muted)' : 'var(--foreground)',
              color: 'var(--background)',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            <Search className="w-4 h-4" />
            {isLoading ? 'Loading...' : 'View Memory'}
          </button>
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 rounded-lg border" style={{ 
          backgroundColor: 'rgba(239, 68, 68, 0.1)', 
          borderColor: 'rgb(239, 68, 68)',
          color: 'rgb(239, 68, 68)'
        }}>
          <h3 className="font-semibold mb-2">Error</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Memory Data Display */}
      {memoryData && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg border" style={{ 
            backgroundColor: 'var(--accent)', 
            borderColor: 'var(--border)' 
          }}>
            <h3 className="text-lg font-semibold mb-2">User Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">User ID:</span> {memoryData.user_id}
              </div>
              <div>
                <span className="font-medium">Last Updated:</span> {new Date(memoryData.timestamp).toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Last Refined:</span> {lastRefined || 'Never'}
              </div>
            </div>
          </div>

          {/* Memory Data Display */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Memory Data (as sent to LLM)</h3>
              <div className="flex gap-3 flex-col sm:flex-row items-start sm:items-center">
                <div className="flex flex-col text-sm">
                  <span className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>Refine Scope</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 rounded border text-sm"
                    style={{
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)',
                      borderColor: 'var(--border)'
                    }}
                    disabled={isRefining || !memoryData}
                  >
                    {CATEGORY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={refineUserMemory}
                  disabled={isRefining || !memoryData}
                  className="px-3 py-1 rounded text-sm border transition-colors flex items-center gap-2"
                  style={{
                    backgroundColor: (isRefining || !memoryData) ? 'var(--muted)' : 'var(--accent)',
                    color: 'var(--foreground)',
                    borderColor: 'var(--border)',
                    cursor: (isRefining || !memoryData) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Database className="w-4 h-4" />
                  {isRefining ? 'Refining...' : 'Refine Memory'}
                </button>
                <button
                  onClick={() => setShowMarkdown(!showMarkdown)}
                  className={`px-3 py-1 rounded text-sm border transition-colors flex items-center gap-2`}
                  style={{
                    backgroundColor: showMarkdown ? 'var(--foreground)' : 'var(--background)',
                    color: showMarkdown ? 'var(--background)' : 'var(--foreground)',
                    borderColor: 'var(--border)'
                  }}
                >
                  {showMarkdown ? <Eye className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                  {showMarkdown ? 'Markdown View' : 'Raw Text'}
                </button>
              </div>
              {refineStatus && (
                <div className="text-xs text-right" style={{ color: 'var(--muted)' }}>
                  {refineStatus}
                </div>
              )}
            </div>

            {(preferenceSessions.length > 0 || preferenceSessionsNote) && (
              <div className="p-4 rounded border" style={{ 
                borderColor: 'var(--border)', 
                backgroundColor: 'var(--accent)'
              }}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-lg font-semibold">Long-session insights for 01-preferences</h4>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {preferenceAnalysisTimestamp ? `Last analyzed: ${preferenceAnalysisTimestamp}` : 'Run a refine to populate this section.'}
                    </p>
                  </div>
                </div>
                {preferenceSessions.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    {preferenceSessions.map(session => (
                      <div key={session.sessionId} className="p-3 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold">{session.title}</p>
                            <p className="text-xs" style={{ color: 'var(--muted)' }}>
                              {session.messageCount} msgs · {Number(session.durationMinutes || 0).toFixed(1)} min · {Math.round(session.totalTokens || 0)} tokens
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Score</p>
                            <p className="text-sm font-semibold">{Number(session.score || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm mt-3" style={{ color: 'var(--muted)' }}>
                    {preferenceSessionsNote || 'No qualifying long sessions were available for the last run.'}
                  </p>
                )}
              </div>
            )}
            
            {memoryData.memory_data ? (
              <div className="p-6 rounded-lg border" style={{ 
                backgroundColor: 'var(--background)', 
                borderColor: 'var(--border)' 
              }}>
                {showMarkdown ? (
                  <div className="space-y-6">
                    {memoryData.memory_data.split('---').map((section, index) => {
                      if (!section.trim()) return null;
                      
                      const lines = section.trim().split('\n');
                      const titleLine = lines.find(line => line.startsWith('## '));
                      const category = titleLine?.replace('## ', '').trim() || `Category ${index + 1}`;
                      
                      return (
                        <div key={index} className="border rounded-lg overflow-hidden" style={{ 
                          borderColor: 'var(--border)',
                          backgroundColor: 'var(--background)'
                        }}>
                          {/* Category Header */}
                          <div className="px-4 py-3 border-b font-semibold text-lg" style={{ 
                            backgroundColor: 'var(--accent)',
                            borderColor: 'var(--border)',
                            color: 'var(--foreground)'
                          }}>
                            {category}
                          </div>
                          
                          {/* Category Content */}
                          <div className="p-4">
                            <div className="prose prose-sm max-w-none" style={{ 
                              color: 'var(--foreground)'
                            } as React.CSSProperties}>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h1: ({ children }) => <h1 className="text-xl font-bold mb-3">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-base font-medium mb-2">{children}</h3>,
                                  p: ({ children }) => <p className="mb-2">{children}</p>,
                                  ul: ({ children }) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  code: ({ children }) => (
                                    <code className="px-1 py-0.5 rounded text-sm" style={{ 
                                      backgroundColor: 'var(--accent)',
                                      color: 'var(--foreground)'
                                    }}>
                                      {children}
                                    </code>
                                  ),
                                  pre: ({ children }) => (
                                    <pre className="p-3 rounded overflow-x-auto" style={{ 
                                      backgroundColor: 'var(--accent)',
                                      color: 'var(--foreground)'
                                    }}>
                                      {children}
                                    </pre>
                                  )
                                }}
                              >
                                {section.trim()}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm overflow-x-auto p-4 rounded border" style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--foreground)',
                    borderColor: 'var(--border)',
                    fontFamily: 'monospace'
                  }}>
                    {memoryData.memory_data}
                  </pre>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-lg border text-center" style={{ 
                backgroundColor: 'var(--accent)', 
                borderColor: 'var(--border)',
                color: 'var(--muted)'
              }}>
                No memory data available for this user.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--foreground)' }}></div>
            <span style={{ color: 'var(--muted)' }}>Loading user memory...</span>
          </div>
        </div>
      )}
    </div>
  );
}
