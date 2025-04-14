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
export async function getModelUsageStats(startDate?: string, endDate?: string): Promise<ModelUsageStat[]> {
  let query = `
    SELECT 
      model, 
      COUNT(*) as usage_count,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT chat_session_id) as chat_sessions,
      MIN(created_at) as first_used,
      MAX(created_at) as last_used
    FROM messages
    WHERE role = 'assistant'
  `;
  
  // Add date filtering if provided
  if (startDate && endDate) {
    query += ` AND created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
  }
  
  query += `
    GROUP BY model
    ORDER BY usage_count DESC
  `;
  
  const { data, error } = await supabase.rpc('query_db', {
    sql_query: query
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
export async function getDailyActivityStats(days: number = 30, startDate?: string, endDate?: string): Promise<DailyActivityStat[]> {
  let query = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as message_count,
      COUNT(DISTINCT user_id) as active_users,
      COUNT(DISTINCT chat_session_id) as chat_sessions
    FROM messages
  `;
  
  // Add date filtering
  if (startDate && endDate) {
    query += ` WHERE created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
  } else {
    query += ` WHERE created_at > NOW() - INTERVAL '${days} days'`;
  }
  
  query += `
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;
  
  const { data, error } = await supabase.rpc('query_db', {
    sql_query: query
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
export async function getTopUserStats(limit: number = 20, startDate?: string, endDate?: string): Promise<UserActivityStat[]> {
  let whereClause = '';
  
  if (startDate && endDate) {
    whereClause = `WHERE created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
  }
  
  const query = `
    SELECT 
      user_id,
      COUNT(*) as total_messages,
      COUNT(DISTINCT chat_session_id) as chat_sessions,
      COUNT(DISTINCT model) as models_used,
      MIN(created_at) as first_activity,
      MAX(created_at) as last_activity
    FROM messages
    ${whereClause}
    GROUP BY user_id
    ORDER BY total_messages DESC
    LIMIT ${limit}
  `;
  
  const { data, error } = await supabase.rpc('query_db', {
    sql_query: query
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
export async function getUserModelPreferences(userId: string, startDate?: string, endDate?: string): Promise<any[]> {
  let whereClause = `WHERE user_id = '${userId}' AND role = 'assistant'`;
  
  if (startDate && endDate) {
    whereClause += ` AND created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
  }
  
  const query = `
    SELECT 
      model,
      COUNT(*) as message_count,
      COUNT(DISTINCT chat_session_id) as sessions_count,
      MIN(created_at) as first_used,
      MAX(created_at) as last_used
    FROM messages
    ${whereClause}
    GROUP BY model
    ORDER BY message_count DESC
  `;
  
  const { data, error } = await supabase.rpc('query_db', {
    sql_query: query
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
export async function getOverallStats(startDate?: string, endDate?: string): Promise<any> {
  let dateFilter = '';
  if (startDate && endDate) {
    dateFilter = ` WHERE created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
  }
  
  const dateFilterSessions = dateFilter ? 
    ` WHERE id IN (SELECT DISTINCT chat_session_id FROM messages${dateFilter})` : 
    '';
  
  const query = `
    SELECT
      (SELECT COUNT(*) FROM chat_sessions${dateFilterSessions}) as total_sessions,
      (SELECT COUNT(*) FROM messages${dateFilter}) as total_messages,
      (SELECT COUNT(DISTINCT user_id) FROM messages${dateFilter}) as total_users,
      (SELECT COUNT(DISTINCT model) FROM messages WHERE role = 'assistant'${dateFilter.replace('WHERE', 'AND')}) as total_models,
      (SELECT AVG(subquery.session_length) FROM (
        SELECT chat_session_id, COUNT(*) as session_length 
        FROM messages${dateFilter}
        GROUP BY chat_session_id
      ) as subquery) as avg_session_length,
      (SELECT MAX(created_at) FROM messages${dateFilter}) as last_activity
  `;
  
  // Log the query for debugging
  console.log('Overall stats query:', query);
  
  try {
    const { data, error } = await supabase.rpc('query_db', {
      sql_query: query
    });

    if (error) {
      console.error('SQL error in overall stats:', error);
      throw error;
    }

    return data?.[0] || null;
  } catch (error) {
    console.error('Error fetching overall stats:', error);
    return null;
  }
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