import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type TrendsPreferences = {
  selected_country?: string | null
  selected_region?: string | null
  time_range: string
  selected_category?: string | null
  is_custom: boolean
}

/**
 * GET: Retrieve saved trends preferences for the current user
 * Returns saved preferences if is_custom = true, otherwise returns null to use IP-based defaults
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ preferences: null }, { status: 200 })
    }

    const { data: preferences, error } = await supabase
      .from('user_trends_preferences')
      .select('selected_country, selected_region, time_range, selected_category, is_custom')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // No preferences found is not an error
      if (error.code === 'PGRST116') {
        return NextResponse.json({ preferences: null }, { status: 200 })
      }
      console.error('[trends/preferences] Error fetching preferences:', error)
      return NextResponse.json(
        { error: 'Failed to fetch preferences', details: error.message },
        { status: 500 }
      )
    }

    // Only return preferences if user has customized them
    // If is_custom = false, return null to use IP-based defaults
    if (preferences && preferences.is_custom) {
      return NextResponse.json({ preferences }, { status: 200 })
    }

    return NextResponse.json({ preferences: null }, { status: 200 })
  } catch (error: any) {
    console.error('[trends/preferences] GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

/**
 * POST: Save or update trends preferences
 * If is_custom is not provided, defaults to true (user has modified settings)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const {
      selected_country,
      selected_region,
      time_range,
      selected_category,
      is_custom = true, // Default to true if not specified (user has modified)
    } = body as Partial<TrendsPreferences>

    // Validate time_range if provided
    if (time_range && !['past_4_hours', 'past_24_hours', 'past_48_hours', 'past_7_days'].includes(time_range)) {
      return NextResponse.json(
        { error: 'Invalid time_range value' },
        { status: 400 }
      )
    }

    // Check if preferences already exist
    const { data: existing } = await supabase
      .from('user_trends_preferences')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const updateData: Partial<TrendsPreferences> = {
      time_range: time_range || 'past_24_hours',
      is_custom,
    }

    if (selected_country !== undefined) {
      updateData.selected_country = selected_country || null
    }
    if (selected_region !== undefined) {
      updateData.selected_region = selected_region || null
    }
    if (selected_category !== undefined) {
      updateData.selected_category = selected_category || null
    }

    if (existing) {
      // Update existing preferences
      const { error: updateError } = await supabase
        .from('user_trends_preferences')
        .update(updateData)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('[trends/preferences] Error updating preferences:', updateError)
        return NextResponse.json(
          { error: 'Failed to update preferences', details: updateError.message },
          { status: 500 }
        )
      }
    } else {
      // Insert new preferences
      const { error: insertError } = await supabase
        .from('user_trends_preferences')
        .insert({
          user_id: user.id,
          ...updateData,
        })

      if (insertError) {
        console.error('[trends/preferences] Error inserting preferences:', insertError)
        return NextResponse.json(
          { error: 'Failed to save preferences', details: insertError.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[trends/preferences] POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Reset preferences to default (is_custom = false)
 * This allows users to revert to IP-based detection
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Set is_custom to false instead of deleting the record
    // This preserves the default values while allowing IP-based detection to take precedence
    const { error } = await supabase
      .from('user_trends_preferences')
      .update({ is_custom: false })
      .eq('user_id', user.id)

    if (error) {
      // If record doesn't exist, that's fine - user already has no custom preferences
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: true }, { status: 200 })
      }
      console.error('[trends/preferences] Error resetting preferences:', error)
      return NextResponse.json(
        { error: 'Failed to reset preferences', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[trends/preferences] DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

