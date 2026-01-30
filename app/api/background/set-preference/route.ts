import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { userId, backgroundType, backgroundId } = await req.json();
    
    if (!userId || !backgroundType || !backgroundId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['default', 'custom', 'static'].includes(backgroundType)) {
      return NextResponse.json({ error: 'Invalid background type' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Check if user already has preferences
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update existing preference
      const { error: updateError } = await supabase
        .from('user_preferences')
        .update({
          selected_background_type: backgroundType,
          selected_background_id: backgroundId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to update preference:', updateError);
        return NextResponse.json({ error: 'Failed to update preference' }, { status: 500 });
      }
    } else {
      // Insert new preference
      const { error: insertError } = await supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          selected_background_type: backgroundType,
          selected_background_id: backgroundId
        });

      if (insertError) {
        console.error('Failed to insert preference:', insertError);
        return NextResponse.json({ error: 'Failed to save preference' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Set preference error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
