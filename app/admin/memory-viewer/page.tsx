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

export default function MemoryViewerPage() {
  const [userId, setUserId] = useState('');
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMarkdown, setShowMarkdown] = useState(true);
  const [isRefining, setIsRefining] = useState(false);
  const [lastRefined, setLastRefined] = useState<string | null>(null);

  const fetchUserMemory = async () => {
    if (!userId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMemoryData(null);

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

    setIsRefining(true);
    try {
      const response = await fetch(`/api/admin/memory-refine?mode=manual&user_id=${encodeURIComponent(userId.trim())}`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast.success(`Memory refined successfully! Processed: ${result.processed}, Successful: ${result.successful}`);
        setLastRefined(new Date().toLocaleString());
        // Refresh memory data
        await fetchUserMemory();
      } else {
        toast.error(`Refine failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error refining memory:', error);
      toast.error('Failed to refine memory');
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
              <div className="flex gap-2">
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
            </div>
            
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
