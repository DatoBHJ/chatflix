import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Return default prompts for anonymous users
      return NextResponse.json({
        prompts: [
          "What is today's biggest global news?",
          "Send me funny minions gifs",
        ]
      });
    }

    // Fetch user's custom prompts
    const { data, error } = await supabase
      .from('initial_prompts')
      .select('prompts')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching prompts:', error);
      return NextResponse.json({ prompts: [] }, { status: 500 });
    }

    return NextResponse.json({
      prompts: data?.prompts || []
    });

  } catch (error) {
    console.error('Error in prompts GET:', error);
    return NextResponse.json({ prompts: [] }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompts } = await request.json();

    if (!Array.isArray(prompts)) {
      return NextResponse.json({ error: 'Prompts must be an array' }, { status: 400 });
    }

    // Upsert user's prompts
    const { error } = await supabase
      .from('initial_prompts')
      .upsert({
        user_id: user.id,
        prompts: prompts
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving prompts:', error);
      return NextResponse.json({ error: 'Failed to save prompts' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in prompts PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
