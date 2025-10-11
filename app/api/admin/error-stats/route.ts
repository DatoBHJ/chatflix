import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 최근 7일간의 에러 통계
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 에러 통계 조회
    const { data: errorStats } = await serviceSupabase
      .from('refine_errors')
      .select('*')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (!errorStats) {
      return NextResponse.json({ error: 'Failed to fetch error data' }, { status: 500 });
    }

    // 에러 타입별 통계
    const errorTypeStats = errorStats.reduce((acc: any, error: any) => {
      const type = error.error_type || 'unknown';
      if (!acc[type]) {
        acc[type] = { count: 0, users: new Set(), categories: new Set() };
      }
      acc[type].count++;
      acc[type].users.add(error.user_id);
      acc[type].categories.add(error.category);
      return acc;
    }, {});

    // 사용자별 에러 통계
    const userErrorStats = errorStats.reduce((acc: any, error: any) => {
      const userId = error.user_id;
      if (!acc[userId]) {
        acc[userId] = {
          user_id: userId,
          total_errors: 0,
          error_types: new Set(),
          categories: new Set(),
          last_error: error.created_at,
          first_error: error.created_at
        };
      }
      acc[userId].total_errors++;
      acc[userId].error_types.add(error.error_type);
      acc[userId].categories.add(error.category);
      
      if (new Date(error.created_at) > new Date(acc[userId].last_error)) {
        acc[userId].last_error = error.created_at;
      }
      if (new Date(error.created_at) < new Date(acc[userId].first_error)) {
        acc[userId].first_error = error.created_at;
      }
      return acc;
    }, {});

    // 통계 정리
    const stats = {
      total_errors: errorStats.length,
      unique_users_with_errors: Object.keys(userErrorStats).length,
      error_types: Object.keys(errorTypeStats).map(type => ({
        type,
        count: errorTypeStats[type].count,
        unique_users: errorTypeStats[type].users.size,
        categories: Array.from(errorTypeStats[type].categories)
      })),
      recent_errors: errorStats.slice(0, 20), // 최근 20개 에러
      users_with_errors: Object.values(userErrorStats).map((user: any) => ({
        user_id: user.user_id,
        total_errors: user.total_errors,
        error_types: Array.from(user.error_types),
        categories: Array.from(user.categories),
        last_error: user.last_error,
        first_error: user.first_error
      }))
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching error stats:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
