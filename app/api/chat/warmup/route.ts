import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getCachedUserMemory } from '@/app/api/chat/services/chatService'
import { checkSubscriptionFromDatabase } from '@/lib/subscription-db'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    // Anonymous or auth error: no-op warmup to keep client flow simple
    if (error || !user) {
      return NextResponse.json({ warmedUp: false, reason: 'anonymous' })
    }

    const userId = user.id

    // Prime caches in parallel
    await Promise.all([
      getCachedUserMemory(userId),
      checkSubscriptionFromDatabase(userId),
    ])

    return NextResponse.json({ warmedUp: true })
  } catch (e) {
    console.error('[warmup] Failed to warm up:', e)
    return NextResponse.json({ warmedUp: false }, { status: 500 })
  }
}


