import { supabase } from '@/lib/supabase';

// Hourly Activity Statistics
export async function getHourlyActivityStats(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    let query = `
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as total_messages,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT chat_session_id) as chat_sessions
      FROM messages
    `;
    
    // Add date filtering if provided
    if (startDate && endDate) {
      query += `WHERE created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
    }
    
    query += `
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `;
    
    const { data, error } = await supabase.rpc('query_db', {
      sql_query: query
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching hourly activity stats:', error);
    return [];
  }
}

// Day of Week Activity Statistics
export async function getDayOfWeekStats(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    let query = `
      SELECT 
        EXTRACT(DOW FROM created_at) as day_of_week,
        COUNT(*) as total_messages,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT chat_session_id) as chat_sessions
      FROM messages
    `;
    
    // Add date filtering if provided
    if (startDate && endDate) {
      query += `WHERE created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
    }
    
    query += `
      GROUP BY EXTRACT(DOW FROM created_at)
      ORDER BY day_of_week
    `;
    
    const { data, error } = await supabase.rpc('query_db', {
      sql_query: query
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching day of week stats:', error);
    return [];
  }
}

// Session Length Distribution
export async function getSessionLengthDistribution(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `WHERE created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
    }
    
    const { data, error } = await supabase.rpc('query_db', {
      sql_query: `
        WITH session_messages AS (
          SELECT 
            chat_session_id,
            COUNT(*) as message_count
          FROM messages
          ${dateFilter}
          GROUP BY chat_session_id
        ),
        categorized_sessions AS (
          SELECT
            CASE
              WHEN message_count = 1 THEN '1 Message'
              WHEN message_count = 2 THEN '2 Messages'
              WHEN message_count BETWEEN 3 AND 5 THEN '3-5 Messages'
              WHEN message_count BETWEEN 6 AND 10 THEN '6-10 Messages'
              WHEN message_count BETWEEN 11 AND 20 THEN '11-20 Messages'
              ELSE '20+ Messages'
            END as length_category,
            message_count
          FROM session_messages
        )
        SELECT
          length_category,
          COUNT(*) as session_count
        FROM categorized_sessions
        GROUP BY length_category
        ORDER BY 
          CASE
            WHEN length_category = '1 Message' THEN 1
            WHEN length_category = '2 Messages' THEN 2
            WHEN length_category = '3-5 Messages' THEN 3
            WHEN length_category = '6-10 Messages' THEN 4
            WHEN length_category = '11-20 Messages' THEN 5
            ELSE 6
          END
      `
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching session length distribution:', error);
    return [];
  }
}

// Model Response Lengths
export async function getModelResponseLengths(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    let query = `
      SELECT 
        model,
        ROUND(AVG(LENGTH(content))) as avg_length,
        MIN(LENGTH(content)) as min_length,
        MAX(LENGTH(content)) as max_length
      FROM messages
      WHERE role = 'assistant' AND content IS NOT NULL
    `;
    
    // Add date filtering if provided
    if (startDate && endDate) {
      query += ` AND created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
    }
    
    query += `
      GROUP BY model
      ORDER BY avg_length DESC
    `;
    
    const { data, error } = await supabase.rpc('query_db', {
      sql_query: query
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching model response lengths:', error);
    return [];
  }
}

// User Retention Analysis
export async function getUserRetentionStats(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    // Build query
    let query = `
      WITH filtered_messages AS (
        SELECT 
          user_id,
          created_at
        FROM messages
        WHERE 1=1
    `;
    
    // Add date filtering if provided
    if (startDate && endDate) {
      query += ` AND created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
    }
    
    // Complete the query
    query += `
      ),
      user_activity AS (
        SELECT 
          user_id,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          MIN(created_at) as first_activity,
          MAX(created_at) as last_activity,
          DATE_PART('day', MAX(created_at) - MIN(created_at)) + 1 as days_span
        FROM filtered_messages
        GROUP BY user_id
      ),
      categorized_users AS (
        SELECT
          CASE
            WHEN active_days = 1 THEN 'Single Visit'
            WHEN active_days >= 2 AND active_days <= 3 THEN '2-3 Days'
            WHEN active_days >= 4 AND active_days <= 7 THEN '4-7 Days'
            WHEN active_days >= 8 AND active_days <= 14 THEN '8-14 Days'
            ELSE '15+ Days'
          END as activity_category
        FROM user_activity
      )
      SELECT
        activity_category,
        COUNT(*) as user_count
      FROM categorized_users
      GROUP BY activity_category
      ORDER BY 
        CASE
          WHEN activity_category = 'Single Visit' THEN 1
          WHEN activity_category = '2-3 Days' THEN 2
          WHEN activity_category = '4-7 Days' THEN 3
          WHEN activity_category = '8-14 Days' THEN 4
          ELSE 5
        END
    `;
    
    // Log the query for debugging
    console.log('User retention query:', query);
    
    const { data, error } = await supabase.rpc('query_db', {
      sql_query: query
    });

    if (error) {
      console.error('SQL error in user retention stats:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching user retention stats:', error);
    return [];
  }
}

// User Model Preferences
export async function getUserModelPreferencePatterns(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    // Build query
    let query = `
      WITH filtered_messages AS (
        SELECT 
          user_id,
          model
        FROM messages
        WHERE role = 'assistant'
    `;
    
    // Add date filtering if provided
    if (startDate && endDate) {
      query += ` AND created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
    }
    
    // Complete the query
    query += `
      ),
      user_model_counts AS (
        SELECT 
          user_id,
          model,
          COUNT(*) as usage_count,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY COUNT(*) DESC) as rank
        FROM filtered_messages
        GROUP BY user_id, model
      )
      SELECT 
        model,
        COUNT(*) as preference_count
      FROM user_model_counts
      WHERE rank = 1
      GROUP BY model
      ORDER BY preference_count DESC
    `;
    
    // Log the query for debugging
    console.log('User model preferences query:', query);
    
    const { data, error } = await supabase.rpc('query_db', {
      sql_query: query
    });

    if (error) {
      console.error('SQL error in user model preferences:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching user model preferences:', error);
    return [];
  }
}

// Model Switching Patterns
export async function getModelSwitchingPatterns(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
    }
    
    const { data, error } = await supabase.rpc('query_db', {
      sql_query: `
        WITH ordered_messages AS (
          SELECT 
            chat_session_id,
            model,
            LAG(model) OVER (PARTITION BY chat_session_id ORDER BY created_at) as previous_model
          FROM messages
          WHERE role = 'assistant' ${dateFilter}
          ORDER BY chat_session_id, created_at
        )
        SELECT 
          previous_model as from_model,
          model as to_model,
          COUNT(*) as switch_count
        FROM ordered_messages
        WHERE previous_model IS NOT NULL AND previous_model != model
        GROUP BY from_model, to_model
        ORDER BY switch_count DESC
      `
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching model switching patterns:', error);
    return [];
  }
}

// Model Usage Trends
export async function getModelUsageTrends(days: number = 30, startDate?: string, endDate?: string): Promise<any[]> {
  try {
    // Base WHERE clause
    let whereClause = "WHERE role = 'assistant'";
    
    // Add date filtering
    if (startDate && endDate) {
      whereClause += ` AND created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
    } else {
      whereClause += ` AND created_at > NOW() - INTERVAL '${days} days'`;
    }
    
    const query = `
      SELECT
        DATE(created_at) as date,
        model,
        COUNT(*) as usage_count
      FROM messages
      ${whereClause}
      GROUP BY date, model
      ORDER BY date, usage_count DESC
    `;
    
    // Log the query for debugging
    console.log('Model usage trends query:', query);
    
    const { data, error } = await supabase.rpc('query_db', {
      sql_query: query
    });

    if (error) {
      console.error('SQL error in model usage trends:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching model usage trends:', error);
    return [];
  }
}

// Session Model Diversity
export async function getSessionModelDiversity(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    // Build query with simpler structure
    let query = `
      WITH filtered_messages AS (
        SELECT 
          chat_session_id, 
          model
        FROM messages
        WHERE role = 'assistant'
    `;
    
    // Add date filtering if provided
    if (startDate && endDate) {
      query += ` AND created_at >= '${startDate}' AND created_at <= '${endDate} 23:59:59'`;
    }
    
    // Complete the query
    query += `
      ),
      session_models AS (
        SELECT 
          chat_session_id,
          COUNT(DISTINCT model) as unique_models
        FROM filtered_messages
        GROUP BY chat_session_id
      ),
      categorized_models AS (
        SELECT
          CASE
            WHEN unique_models = 1 THEN 'Single Model'
            WHEN unique_models = 2 THEN '2 Models'
            WHEN unique_models = 3 THEN '3 Models'
            ELSE '4+ Models'
          END as model_category,
          COUNT(*) as session_count
        FROM session_models
        GROUP BY model_category
      )
      SELECT 
        model_category as unique_models,
        session_count
      FROM categorized_models
      ORDER BY 
        CASE
          WHEN model_category = 'Single Model' THEN 1
          WHEN model_category = '2 Models' THEN 2
          WHEN model_category = '3 Models' THEN 3
          ELSE 4
        END
    `;
    
    // Log the query for debugging
    console.log('Session model diversity query:', query);
    
    const { data, error } = await supabase.rpc('query_db', {
      sql_query: query
    });

    if (error) {
      console.error('SQL error in session model diversity:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching session model diversity:', error);
    return [];
  }
}

// Initial Message Patterns
export async function getInitialMessagePatterns(startDate?: string, endDate?: string): Promise<any[]> {
  try {
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `AND m.created_at >= '${startDate}' AND m.created_at <= '${endDate} 23:59:59'`;
    }
    
    const { data, error } = await supabase.rpc('query_db', {
      sql_query: `
        WITH first_messages AS (
          SELECT 
            m.chat_session_id,
            m.content,
            ROW_NUMBER() OVER (PARTITION BY m.chat_session_id ORDER BY m.created_at) as msg_order
          FROM messages m
          WHERE m.role = 'user' ${dateFilter}
        ),
        cleaned_messages AS (
          SELECT 
            content,
            SUBSTRING(LOWER(content), 1, 50) as message_preview
          FROM first_messages
          WHERE msg_order = 1 AND content IS NOT NULL AND LENGTH(content) > 0
        )
        SELECT 
          message_preview,
          COUNT(*) as frequency
        FROM cleaned_messages
        GROUP BY message_preview
        ORDER BY frequency DESC
        LIMIT 20
      `
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching initial message patterns:', error);
    return [];
  }
} 