'use client';

import { useState, useEffect } from 'react';

interface RefineStats {
  total_users: number;
  tier1_eligible: number;
  tier1_selected: number;
  tier2_eligible: number;
  tier2_selected: number;
  tier3_eligible: number;
  tier3_selected: number;
  never_refined: number;
  refined_today: number;
  refined_this_week: number;
  avg_refine_age_hours: number;
  next_run_users: string[];
}

export default function RefineDashboard() {
  const [stats, setStats] = useState<RefineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/refine-stats');
      const data = await response.json();
      setStats(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold mb-6">Memory Refine Dashboard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Memory Refine Dashboard</h1>
        <p>Failed to load stats</p>
      </div>
    );
  }

  const totalSelected = stats.tier1_selected + stats.tier2_selected + stats.tier3_selected;
  const activeSelected = stats.tier1_selected + stats.tier2_selected;
  const activeRatio = totalSelected > 0 ? (activeSelected / totalSelected * 100).toFixed(0) : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Memory Refine Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-600 mb-2">Total Users</div>
          <div className="text-3xl font-bold">{stats.total_users}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-600 mb-2">Next Run</div>
          <div className="text-3xl font-bold">{totalSelected}</div>
          <div className="text-xs text-gray-500 mt-1">users queued</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-600 mb-2">Active Ratio</div>
          <div className="text-3xl font-bold">{activeRatio}%</div>
          <div className="text-xs text-gray-500 mt-1">{activeSelected} active users</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm font-medium text-gray-600 mb-2">Avg Age</div>
          <div className="text-3xl font-bold">{stats.avg_refine_age_hours.toFixed(1)}h</div>
          <div className="text-xs text-gray-500 mt-1">since last refine</div>
        </div>
      </div>

      {/* Priority Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Tier 1: Critical Active</h3>
            <p className="text-sm text-gray-500">Daily processing (&lt; 7 days old)</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Eligible</span>
              <span className="font-semibold">{stats.tier1_eligible}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Selected</span>
              <span className="font-semibold text-green-600">{stats.tier1_selected} / 12</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${(stats.tier1_selected / 12 * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Tier 2: Regular Active</h3>
            <p className="text-sm text-gray-500">Every 3 days (&lt; 30 days old)</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Eligible</span>
              <span className="font-semibold">{stats.tier2_eligible}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Selected</span>
              <span className="font-semibold text-blue-600">{stats.tier2_selected} / 3</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full" 
                style={{ width: `${(stats.tier2_selected / 3 * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Tier 3: Inactive</h3>
            <p className="text-sm text-gray-500">Weekly (&gt; 30 days old)</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Eligible</span>
              <span className="font-semibold">{stats.tier3_eligible}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Selected</span>
              <span className="font-semibold text-gray-600">{stats.tier3_selected} / 5</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gray-500 h-2 rounded-full" 
                style={{ width: `${(stats.tier3_selected / 5 * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Activity Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600">Never Refined</div>
            <div className="text-2xl font-bold text-orange-600">{stats.never_refined}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Refined Today</div>
            <div className="text-2xl font-bold text-green-600">{stats.refined_today}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Refined This Week</div>
            <div className="text-2xl font-bold text-blue-600">{stats.refined_this_week}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
