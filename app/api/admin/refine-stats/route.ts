import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { ALLOWED_MEMORY_CATEGORY_ARRAY } from '@/utils/memory-bank';

export async function GET(req: NextRequest) {
  try {
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all memory_bank rows
    const { data: allRows } = await serviceSupabase
      .from('memory_bank')
      .select('user_id, updated_at, last_refined_at')
      .in('category', ALLOWED_MEMORY_CATEGORY_ARRAY)
      .order('user_id', { ascending: true });

    if (!allRows) {
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    // Group by user_id
    const userMap = new Map<string, { updated_at: string; last_refined_at: string | null }>();
    for (const row of allRows) {
      const existing = userMap.get(row.user_id);
      if (!existing || new Date(row.updated_at) > new Date(existing.updated_at)) {
        userMap.set(row.user_id, {
          updated_at: row.updated_at,
          last_refined_at: row.last_refined_at
        });
      }
    }

    // Categorize users
    const stats = {
      total_users: userMap.size,
      tier1_eligible: 0,
      tier1_selected: 0,
      tier2_eligible: 0,
      tier2_selected: 0,
      tier3_eligible: 0,
      tier3_selected: 0,
      never_refined: 0,
      refined_today: 0,
      refined_this_week: 0,
      avg_refine_age_hours: 0,
      next_run_users: [] as string[]
    };

    const tier1Users: string[] = [];
    const tier2Users: string[] = [];
    const tier3Users: string[] = [];
    let totalRefineAge = 0;
    let refinedCount = 0;

    for (const [userId, data] of userMap.entries()) {
      const updatedAt = new Date(data.updated_at);
      const lastRefinedAt = data.last_refined_at ? new Date(data.last_refined_at) : null;

      if (!lastRefinedAt) {
        stats.never_refined++;
      } else {
        refinedCount++;
        totalRefineAge += (now.getTime() - lastRefinedAt.getTime()) / (1000 * 60 * 60);
        
        if (lastRefinedAt > oneDayAgo) stats.refined_today++;
        if (lastRefinedAt > sevenDaysAgo) stats.refined_this_week++;
      }

      // Check if needs refinement
      const needsRefinement = !lastRefinedAt || 
        (lastRefinedAt < oneDayAgo && updatedAt > sevenDaysAgo) ||
        (lastRefinedAt < threeDaysAgo && updatedAt > thirtyDaysAgo) ||
        (lastRefinedAt < sevenDaysAgo && updatedAt <= thirtyDaysAgo);

      if (!needsRefinement) continue;

      // Categorize by tier
      if (updatedAt > sevenDaysAgo && (!lastRefinedAt || lastRefinedAt < oneDayAgo)) {
        tier1Users.push(userId);
        stats.tier1_eligible++;
      } else if (updatedAt > thirtyDaysAgo && (!lastRefinedAt || lastRefinedAt < threeDaysAgo)) {
        tier2Users.push(userId);
        stats.tier2_eligible++;
      } else if (!lastRefinedAt || lastRefinedAt < sevenDaysAgo) {
        tier3Users.push(userId);
        stats.tier3_eligible++;
      }
    }

    // Selected users for next run
    const nextRunUsers = [
      ...tier1Users.slice(0, 12),
      ...tier2Users.slice(0, 3),
      ...tier3Users.slice(0, 5)
    ];

    stats.tier1_selected = Math.min(tier1Users.length, 12);
    stats.tier2_selected = Math.min(tier2Users.length, 3);
    stats.tier3_selected = Math.min(tier3Users.length, 5);
    stats.next_run_users = nextRunUsers;
    stats.avg_refine_age_hours = refinedCount > 0 ? totalRefineAge / refinedCount : 0;

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching refine stats:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
