'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ErrorStats {
  total_errors: number;
  unique_users_with_errors: number;
  error_types: Array<{
    type: string;
    count: number;
    unique_users: number;
    categories: string[];
  }>;
  recent_errors: Array<{
    user_id: string;
    category: string;
    error_message: string;
    error_type: string;
    created_at: string;
  }>;
  users_with_errors: Array<{
    user_id: string;
    total_errors: number;
    error_types: string[];
    categories: string[];
    last_error: string;
    first_error: string;
  }>;
}

export default function ErrorDashboard() {
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/error-stats');
      const data = await response.json();
      setStats(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching error stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const retryUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/memory-refine?mode=manual&user_id=${userId}`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        alert(`User ${userId} retry successful!`);
        fetchStats(); // 새로고침
      } else {
        alert(`User ${userId} retry failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Memory Refine Error Dashboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Memory Refine Error Dashboard</h1>
        <p>Failed to load error stats</p>
      </div>
    );
  }

  const getErrorTypeColor = (type: string) => {
    switch (type) {
      case 'ai_call_failed': return 'bg-red-100 text-red-800';
      case 'database_update': return 'bg-yellow-100 text-yellow-800';
      case 'process_failed': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Memory Refine Error Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.total_errors}</div>
            <div className="text-xs text-gray-500 mt-1">Last 7 days</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Affected Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.unique_users_with_errors}</div>
            <div className="text-xs text-gray-500 mt-1">users with errors</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Error Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.error_types.length}</div>
            <div className="text-xs text-gray-500 mt-1">different types</div>
          </CardContent>
        </Card>
      </div>

      {/* Error Types Breakdown */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Error Types Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.error_types.map((errorType, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getErrorTypeColor(errorType.type)}>
                      {errorType.type}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {errorType.unique_users} users affected
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Categories: {errorType.categories.join(', ')}
                  </div>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {errorType.count}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users with Errors */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Users with Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.users_with_errors.map((user, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm">{user.user_id.substring(0, 8)}...</span>
                    <Badge variant="outline">{user.total_errors} errors</Badge>
                  </div>
                  <div className="text-sm text-gray-500">
                    Types: {user.error_types.join(', ')} | 
                    Categories: {user.categories.join(', ')}
                  </div>
                  <div className="text-xs text-gray-400">
                    Last: {new Date(user.last_error).toLocaleString()}
                  </div>
                </div>
                <Button 
                  onClick={() => retryUser(user.user_id)}
                  size="sm"
                  variant="outline"
                >
                  Retry
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recent_errors.map((error, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{error.user_id.substring(0, 8)}...</span>
                    <Badge className={getErrorTypeColor(error.error_type)}>
                      {error.error_type}
                    </Badge>
                    <Badge variant="outline">{error.category}</Badge>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(error.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  {error.error_message}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
