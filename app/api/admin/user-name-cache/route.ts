import { NextRequest, NextResponse } from 'next/server';
import { UserNameCache } from '@/lib/user-name-cache';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (you can implement your own admin check logic)
    const { data: userData, error: userError } = await supabase
      .from('all_user')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Get cache statistics
    const stats = await UserNameCache.getCacheStats();
    
    return NextResponse.json({
      success: true,
      stats,
      message: 'User name cache statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting user name cache stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check if user is admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('all_user')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      // Clear cache for specific user
      await UserNameCache.clearUserCache(userId);
      return NextResponse.json({
        success: true,
        message: `User name cache cleared for user: ${userId}`
      });
    } else {
      // Clear all cache
      await UserNameCache.clearAllCache();
      return NextResponse.json({
        success: true,
        message: 'All user name cache cleared successfully'
      });
    }

  } catch (error) {
    console.error('Error clearing user name cache:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
