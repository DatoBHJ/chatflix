import { supabase } from '@/lib/supabase';

export interface ModelUsageStat {
  model: string;
  usage_count: number;
  unique_users: number;
  chat_sessions: number;
  first_used: string;
  last_used: string;
}

export interface DailyActivityStat {
  date: string;
  message_count: number;
  active_users: number;
  chat_sessions: number;
}

export interface UserActivityStat {
  user_id: string;
  total_messages: number;
  chat_sessions: number;
  models_used: number;
  first_activity: string;
  last_activity: string;
}

/**
 * 모델별 사용 통계를 가져옵니다
 */
export async function getModelUsageStats(): Promise<ModelUsageStat[]> {
  const { data, error } = await supabase.rpc('query_db', {
    sql_query: `
      SELECT 
        model, 
        COUNT(*) as usage_count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT chat_session_id) as chat_sessions,
        MIN(created_at) as first_used,
        MAX(created_at) as last_used
      FROM messages
      WHERE role = 'assistant'
      GROUP BY model
      ORDER BY usage_count DESC
    `
  });

  if (error) {
    console.error('Error fetching model usage stats:', error);
    return [];
  }

  return data || [];
}

/**
 * 날짜별 활동 통계를 가져옵니다
 */
export async function getDailyActivityStats(days: number = 30): Promise<DailyActivityStat[]> {
  const { data, error } = await supabase.rpc('query_db', {
    sql_query: `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as message_count,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(DISTINCT chat_session_id) as chat_sessions
      FROM messages
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `
  });

  if (error) {
    console.error('Error fetching daily activity stats:', error);
    return [];
  }

  return data || [];
}

/**
 * 상위 활동 사용자 통계를 가져옵니다
 */
export async function getTopUserStats(limit: number = 20): Promise<UserActivityStat[]> {
  const { data, error } = await supabase.rpc('query_db', {
    sql_query: `
      SELECT 
        user_id,
        COUNT(*) as total_messages,
        COUNT(DISTINCT chat_session_id) as chat_sessions,
        COUNT(DISTINCT model) as models_used,
        MIN(created_at) as first_activity,
        MAX(created_at) as last_activity
      FROM messages
      GROUP BY user_id
      ORDER BY total_messages DESC
      LIMIT ${limit}
    `
  });

  if (error) {
    console.error('Error fetching top user stats:', error);
    return [];
  }

  return data || [];
}

/**
 * 사용자별 모델 사용 통계를 가져옵니다
 */
export async function getUserModelPreferences(userId: string): Promise<any[]> {
  const { data, error } = await supabase.rpc('query_db', {
    sql_query: `
      SELECT 
        model,
        COUNT(*) as message_count,
        COUNT(DISTINCT chat_session_id) as sessions_count,
        MIN(created_at) as first_used,
        MAX(created_at) as last_used
      FROM messages
      WHERE user_id = '${userId}' AND role = 'assistant'
      GROUP BY model
      ORDER BY message_count DESC
    `
  });

  if (error) {
    console.error('Error fetching user model preferences:', error);
    return [];
  }

  return data || [];
}

/**
 * 전체 통계 요약을 가져옵니다
 */
export async function getOverallStats(): Promise<any> {
  const { data, error } = await supabase.rpc('query_db', {
    sql_query: `
      SELECT
        (SELECT COUNT(*) FROM chat_sessions) as total_sessions,
        (SELECT COUNT(*) FROM messages) as total_messages,
        (SELECT COUNT(DISTINCT user_id) FROM messages) as total_users,
        (SELECT COUNT(DISTINCT model) FROM messages WHERE role = 'assistant') as total_models,
        (SELECT AVG(subquery.session_length) FROM (
          SELECT chat_session_id, COUNT(*) as session_length 
          FROM messages 
          GROUP BY chat_session_id
        ) as subquery) as avg_session_length,
        (SELECT MAX(created_at) FROM messages) as last_activity
    `
  });

  if (error) {
    console.error('Error fetching overall stats:', error);
    return null;
  }

  return data?.[0] || null;
}

// Supabase 함수 생성 스크립트
export const CREATE_QUERY_DB_FUNCTION = `
CREATE OR REPLACE FUNCTION query_db(sql_query TEXT)
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
$$;
`; 