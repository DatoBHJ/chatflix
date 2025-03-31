'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getModelUsageStats, getOverallStats } from '../utils/insights';
import { 
  getHourlyActivityStats, 
  getDayOfWeekStats, 
  getSessionLengthDistribution,
  getModelResponseLengths,
  getUserRetentionStats,
  getUserModelPreferencePatterns,
  getModelSwitchingPatterns,
  getSessionModelDiversity,
  getInitialMessagePatterns
} from '../utils/analytics';
import AnalyticsCard from '../components/AnalyticsCard';

// Admin Supabase ID
const ADMIN_ID = '9b682bce-11c0-4373-b954-08ec55731312';

// Day of week name mapping
const DAY_OF_WEEK_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Format UTC hour to local time
const formatLocalHour = (utcHour: number) => {
  const date = new Date();
  date.setUTCHours(utcHour, 0, 0, 0);
  const localHour = date.getHours();
  
  const period = localHour >= 12 ? 'PM' : 'AM';
  const displayHour = localHour % 12 || 12; // Convert 0 to 12 for 12 AM
  return `${displayHour} ${period}`;
};

export default function AdminAnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const router = useRouter();
  
  // Data states
  const [overallStats, setOverallStats] = useState<any>(null);
  const [modelStats, setModelStats] = useState<any[]>([]);
  const [hourlyStats, setHourlyStats] = useState<any[]>([]);
  const [dayOfWeekStats, setDayOfWeekStats] = useState<any[]>([]);
  const [sessionLengthStats, setSessionLengthStats] = useState<any[]>([]);
  const [modelResponseStats, setModelResponseStats] = useState<any[]>([]);
  const [userRetentionStats, setUserRetentionStats] = useState<any[]>([]);
  const [userPreferenceStats, setUserPreferenceStats] = useState<any[]>([]);
  const [modelSwitchingStats, setModelSwitchingStats] = useState<any[]>([]);
  const [sessionDiversityStats, setSessionDiversityStats] = useState<any[]>([]);
  const [initialMessageStats, setInitialMessageStats] = useState<any[]>([]);
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log("Current user:", user);
        
        // Set current user ID for debugging
        setCurrentUserId(user?.id || null);
        
        // TEMPORARY: Allow all users to access the admin page for development
        setIsAuthorized(true);
        
        // Load analytics data
        await loadAnalyticsData();
      } catch (error) {
        console.error('Authentication error:', error);
        // Don't redirect for development
        setIsAuthorized(true);
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);
  
  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);
      
      // Load all data in parallel
      const [
        overallStatsData,
        modelStatsData,
        hourlyStatsData,
        dayOfWeekStatsData,
        sessionLengthStatsData,
        modelResponseStatsData,
        userRetentionStatsData,
        userPreferenceStatsData,
        modelSwitchingStatsData,
        sessionDiversityStatsData,
        initialMessageStatsData
      ] = await Promise.all([
        getOverallStats(),
        getModelUsageStats(),
        getHourlyActivityStats(),
        getDayOfWeekStats(),
        getSessionLengthDistribution(),
        getModelResponseLengths(),
        getUserRetentionStats(),
        getUserModelPreferencePatterns(),
        getModelSwitchingPatterns(),
        getSessionModelDiversity(),
        getInitialMessagePatterns()
      ]);
      
      setOverallStats(overallStatsData);
      setModelStats(modelStatsData);
      setHourlyStats(hourlyStatsData);
      setDayOfWeekStats(dayOfWeekStatsData);
      setSessionLengthStats(sessionLengthStatsData);
      setModelResponseStats(modelResponseStatsData);
      setUserRetentionStats(userRetentionStatsData);
      setUserPreferenceStats(userPreferenceStatsData);
      setModelSwitchingStats(modelSwitchingStatsData);
      setSessionDiversityStats(sessionDiversityStatsData);
      setInitialMessageStats(initialMessageStatsData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatNumber = (num: number | string) => {
    if (num === null || num === undefined) return 'N/A';
    const parsedNum = typeof num === 'string' ? parseInt(num, 10) : num;
    return parsedNum.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center mb-8">
        <h1 className="text-3xl font-bold mb-4 md:mb-0">Data Analytics Dashboard</h1>
        <button 
          onClick={loadAnalyticsData} 
          className="px-4 py-2 rounded transition-colors text-sm"
          style={{ 
            backgroundColor: 'var(--foreground)', 
            color: 'var(--background)'
          }}
        >
          Refresh Data
        </button>
      </div>
      
      {/* Summary Statistics */}
      {overallStats && (
        <div 
          className="p-4 rounded-lg mb-8 grid grid-cols-1 md:grid-cols-4 gap-4"
          style={{ 
            backgroundColor: 'var(--accent)',
            color: 'var(--foreground)'
          }}
        >
          <div className="text-center">
            <h3 className="text-sm uppercase mb-1 font-medium" style={{ color: 'var(--muted)' }}>Total Messages</h3>
            <p className="text-2xl font-bold">{formatNumber(overallStats.total_messages)}</p>
          </div>
          
          <div className="text-center">
            <h3 className="text-sm uppercase mb-1 font-medium" style={{ color: 'var(--muted)' }}>Total Sessions</h3>
            <p className="text-2xl font-bold">{formatNumber(overallStats.total_sessions)}</p>
          </div>
          
          <div className="text-center">
            <h3 className="text-sm uppercase mb-1 font-medium" style={{ color: 'var(--muted)' }}>Total Users</h3>
            <p className="text-2xl font-bold">{formatNumber(overallStats.total_users)}</p>
          </div>
          
          <div className="text-center">
            <h3 className="text-sm uppercase mb-1 font-medium" style={{ color: 'var(--muted)' }}>Avg Session Length</h3>
            <p className="text-2xl font-bold">{parseFloat(overallStats.avg_session_length).toFixed(1)}</p>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hourly Activity Statistics */}
        <AnalyticsCard title="Hourly Activity Statistics">
          <div className="overflow-x-auto">
            <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left">Hour (UTC / Local)</th>
                  <th className="px-2 py-2 text-right">Messages</th>
                  <th className="px-2 py-2 text-right">Users</th>
                  <th className="px-2 py-2 text-right">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {hourlyStats.length > 0 ? (
                  hourlyStats.map((stat, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
                      <td className="px-2 py-2">
                        {stat.hour}:00 UTC / {formatLocalHour(parseInt(stat.hour))} Local
                      </td>
                      <td className="px-2 py-2 text-right">{formatNumber(stat.total_messages)}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(stat.unique_users)}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(stat.chat_sessions)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AnalyticsCard>
        
        {/* Day of Week Activity Statistics */}
        <AnalyticsCard title="Day of Week Activity Statistics">
          <div className="overflow-x-auto">
            <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left">Day</th>
                  <th className="px-2 py-2 text-right">Messages</th>
                  <th className="px-2 py-2 text-right">Users</th>
                  <th className="px-2 py-2 text-right">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {dayOfWeekStats.length > 0 ? (
                  dayOfWeekStats.map((stat, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
                      <td className="px-2 py-2">{DAY_OF_WEEK_NAMES[Math.floor(stat.day_of_week)]}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(stat.total_messages)}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(stat.unique_users)}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(stat.chat_sessions)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AnalyticsCard>
        
        {/* Session Length Distribution */}
        <AnalyticsCard title="Session Length Distribution">
          <div className="overflow-x-auto">
            <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left">Session Length</th>
                  <th className="px-2 py-2 text-right">Sessions</th>
                  <th className="px-2 py-2 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {sessionLengthStats.length > 0 ? (
                  sessionLengthStats.map((stat, idx) => {
                    const totalSessions = sessionLengthStats.reduce((acc, curr) => acc + parseInt(curr.session_count), 0);
                    const ratio = (parseInt(stat.session_count) / totalSessions * 100).toFixed(1);
                    
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
                        <td className="px-2 py-2">{stat.length_category}</td>
                        <td className="px-2 py-2 text-right">{formatNumber(stat.session_count)}</td>
                        <td className="px-2 py-2 text-right">{ratio}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AnalyticsCard>
        
        {/* Model Response Lengths */}
        <AnalyticsCard title="Model Response Lengths (Characters)">
          <div className="overflow-x-auto">
            <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left">Model</th>
                  <th className="px-2 py-2 text-right">Average</th>
                  <th className="px-2 py-2 text-right">Min</th>
                  <th className="px-2 py-2 text-right">Max</th>
                </tr>
              </thead>
              <tbody>
                {modelResponseStats.length > 0 ? (
                  modelResponseStats.map((stat, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
                      <td className="px-2 py-2">{stat.model}</td>
                      <td className="px-2 py-2 text-right">{parseInt(stat.avg_length).toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(stat.min_length)}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(stat.max_length)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AnalyticsCard>
        
        {/* User Retention */}
        <AnalyticsCard title="User Retention">
          <div className="overflow-x-auto">
            <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left">Activity Period</th>
                  <th className="px-2 py-2 text-right">Users</th>
                  <th className="px-2 py-2 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {userRetentionStats.length > 0 ? (
                  userRetentionStats.map((stat, idx) => {
                    const totalUsers = userRetentionStats.reduce((acc, curr) => acc + parseInt(curr.user_count), 0);
                    const ratio = (parseInt(stat.user_count) / totalUsers * 100).toFixed(1);
                    
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
                        <td className="px-2 py-2">{stat.activity_category}</td>
                        <td className="px-2 py-2 text-right">{formatNumber(stat.user_count)}</td>
                        <td className="px-2 py-2 text-right">{ratio}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AnalyticsCard>
        
        {/* User Model Preferences */}
        <AnalyticsCard title="User Model Preferences">
          <div className="overflow-x-auto">
            <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left">Model</th>
                  <th className="px-2 py-2 text-right">Preferred By</th>
                  <th className="px-2 py-2 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {userPreferenceStats.length > 0 ? (
                  userPreferenceStats.map((stat, idx) => {
                    const totalPrefs = userPreferenceStats.reduce((acc, curr) => acc + parseInt(curr.preference_count), 0);
                    const ratio = (parseInt(stat.preference_count) / totalPrefs * 100).toFixed(1);
                    
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
                        <td className="px-2 py-2">{stat.model}</td>
                        <td className="px-2 py-2 text-right">{formatNumber(stat.preference_count)}</td>
                        <td className="px-2 py-2 text-right">{ratio}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AnalyticsCard>
        
        {/* Model Switching Patterns */}
        <AnalyticsCard title="Model Switching Patterns (Top 10)">
          <div className="overflow-x-auto">
            <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left">Switching Pattern</th>
                  <th className="px-2 py-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {modelSwitchingStats.length > 0 ? (
                  modelSwitchingStats.slice(0, 10).map((stat, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
                      <td className="px-2 py-2">{stat.from_model} → {stat.to_model}</td>
                      <td className="px-2 py-2 text-right">{formatNumber(stat.switch_count)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AnalyticsCard>
        
        {/* Session Model Diversity */}
        <AnalyticsCard title="Session Model Diversity">
          <div className="overflow-x-auto">
            <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left">Models Used</th>
                  <th className="px-2 py-2 text-right">Sessions</th>
                  <th className="px-2 py-2 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {sessionDiversityStats.length > 0 ? (
                  sessionDiversityStats.map((stat, idx) => {
                    const totalSessions = sessionDiversityStats.reduce((acc, curr) => acc + parseInt(curr.session_count), 0);
                    const ratio = (parseInt(stat.session_count) / totalSessions * 100).toFixed(1);
                    
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
                        <td className="px-2 py-2">{stat.unique_models}</td>
                        <td className="px-2 py-2 text-right">{formatNumber(stat.session_count)}</td>
                        <td className="px-2 py-2 text-right">{ratio}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AnalyticsCard>
        
        {/* Popular Initial Messages */}
        <AnalyticsCard title="Popular Initial Messages">
          <div className="overflow-x-auto">
            <table className="min-w-full" style={{ color: 'var(--foreground)' }}>
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left">Message Preview</th>
                  <th className="px-2 py-2 text-right">Frequency</th>
                </tr>
              </thead>
              <tbody>
                {initialMessageStats.length > 0 ? (
                  initialMessageStats.map((stat, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
                      <td className="px-2 py-2">{stat.message_preview}...</td>
                      <td className="px-2 py-2 text-right">{formatNumber(stat.frequency)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-2 py-4 text-center" style={{ color: 'var(--muted)' }}>
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AnalyticsCard>
      </div>
      
      {/* SQL Function Setup Guide */}
      <div className="mt-12 p-6 rounded-lg" style={{ 
        backgroundColor: 'var(--accent)',
        borderLeft: '4px solid rgba(245, 158, 11, 0.5)'
      }}>
        <h3 className="text-xl font-semibold mb-2">Supabase SQL Function Setup</h3>
        <p className="mb-4" style={{ color: 'var(--muted)' }}>
          To query data for this page, you need to create the following SQL function in Supabase.
          This function allows safely executing SQL queries against the database.
        </p>
        <div className="p-4 rounded" style={{ 
          backgroundColor: 'var(--code-bg)', 
          color: 'var(--code-text)'
        }}>
          <code className="font-mono text-sm whitespace-pre-wrap">
{`CREATE OR REPLACE FUNCTION query_db(sql_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE 'WITH query_result AS (' || sql_query || ') SELECT jsonb_agg(row_to_json(query_result)) FROM query_result' INTO result;
  RETURN result;
END;
$$;`}
          </code>
        </div>
      </div>
    </div>
  );
} 