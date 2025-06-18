import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import crypto from 'crypto'

// Polar webhook event types
interface PolarWebhookEvent {
  type: string
  data: {
    object: string
    id: string
    external_customer_id?: string
    customer?: {
      external_id?: string
    }
    subscription?: {
      status: string
      customer: {
        external_id?: string
      }
    }
  }
}

// Verify webhook signature
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false
  }
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex')
    
    // Polar uses format: sha256=<hash>
    const receivedSignature = signature.replace('sha256=', '')
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    )
  } catch (error) {
    console.error('Error verifying webhook signature:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Enhanced logging for testing
    console.log('🎯 Polar webhook received!')
    console.log('Headers:', Object.fromEntries(request.headers.entries()))
    
    // Get raw body for signature verification
    const body = await request.text()
    
    // Verify webhook signature (if secret is configured)
    const signature = request.headers.get('x-polar-signature')
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET
    
    if (webhookSecret && signature) {
      const isValid = verifyWebhookSignature(body, signature, webhookSecret)
      if (!isValid) {
        console.error('❌ Invalid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      console.log('✅ Webhook signature verified')
    } else if (webhookSecret) {
      console.warn('⚠️ Webhook secret configured but no signature received')
    } else {
      console.warn('⚠️ No webhook secret configured - skipping signature verification')
    }
    
    // Parse webhook payload
    const event: PolarWebhookEvent = JSON.parse(body)
    
    console.log('📦 Webhook payload:', JSON.stringify(event, null, 2))
    
    console.log('Received Polar webhook:', {
      type: event.type,
      objectType: event.data.object,
      id: event.data.id
    })

    // Extract customer external ID
    let customerExternalId: string | undefined
    
    if (event.data.external_customer_id) {
      customerExternalId = event.data.external_customer_id
    } else if (event.data.customer?.external_id) {
      customerExternalId = event.data.customer.external_id
    } else if (event.data.subscription?.customer?.external_id) {
      customerExternalId = event.data.subscription.customer.external_id
    }

    if (!customerExternalId) {
      console.warn('⚠️ No customer external ID found in webhook event')
      return NextResponse.json({ received: true })
    }

    console.log('👤 Processing webhook for customer:', customerExternalId)

    // Initialize Supabase client
    const supabase = await createClient()

    // Handle different event types
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.active':
        console.log('✅ Handling subscription activation')
        await handleSubscriptionActivated(supabase, customerExternalId, event)
        break
        
      case 'subscription.canceled':
      case 'subscription.ended':
      case 'subscription.paused':
        console.log('❌ Handling subscription deactivation')
        await handleSubscriptionDeactivated(supabase, customerExternalId, event)
        break
        
      case 'customer.created':
      case 'customer.updated':
        console.log('👤 Handling customer update')
        await handleCustomerUpdated(supabase, customerExternalId, event)
        break
        
      default:
        console.log('❓ Unhandled webhook event type:', event.type)
    }

    console.log('🎉 Webhook processed successfully')
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('❌ Error processing Polar webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleSubscriptionActivated(
  supabase: any, 
  customerExternalId: string, 
  event: PolarWebhookEvent
) {
  console.log('Handling subscription activation for:', customerExternalId)
  
  try {
    // 🚀 CRITICAL: Clear all caches for this user
    // This is what makes webhooks actually useful!
    await clearUserSubscriptionCache(customerExternalId)
    
    console.log('Subscription activated - clearing caches for user:', customerExternalId)
    
    // Optional: Store subscription event in database for audit trail
    const { error } = await supabase
      .from('subscription_events')
      .insert({
        user_id: customerExternalId,
        event_type: event.type,
        event_data: event.data,
        processed_at: new Date().toISOString()
      })
    
    if (error && error.code !== '42P01') { // Ignore if table doesn't exist
      console.error('Error storing subscription event:', error)
    }
    
  } catch (error) {
    console.error('Error handling subscription activation:', error)
    throw error
  }
}

async function handleSubscriptionDeactivated(
  supabase: any, 
  customerExternalId: string, 
  event: PolarWebhookEvent
) {
  console.log('Handling subscription deactivation for:', customerExternalId)
  
  try {
    // 🚀 CRITICAL: Clear all caches for this user
    await clearUserSubscriptionCache(customerExternalId)
    
    console.log('Subscription deactivated - clearing caches for user:', customerExternalId)
    
    // Optional: Store subscription event in database for audit trail
    const { error } = await supabase
      .from('subscription_events')
      .insert({
        user_id: customerExternalId,
        event_type: event.type,
        event_data: event.data,
        processed_at: new Date().toISOString()
      })
    
    if (error && error.code !== '42P01') { // Ignore if table doesn't exist
      console.error('Error storing subscription event:', error)
    }
    
  } catch (error) {
    console.error('Error handling subscription deactivation:', error)
    throw error
  }
}

// 🔥 NEW: Cache clearing function
async function clearUserSubscriptionCache(customerExternalId: string) {
  try {
    // Clear server-side cache from polar.ts
    // This requires exposing the cache clearing function
    const { clearSubscriptionCacheForUser } = await import('@/lib/polar')
    clearSubscriptionCacheForUser(customerExternalId)
    
    console.log('✅ Server cache cleared for user:', customerExternalId)
    
    // Note: Client-side cache will be cleared when user refreshes or checks subscription
    // We could also implement a real-time notification system here
    
  } catch (error) {
    console.error('Error clearing subscription cache:', error)
  }
}

async function handleCustomerUpdated(
  supabase: any, 
  customerExternalId: string, 
  event: PolarWebhookEvent
) {
  console.log('Handling customer update for:', customerExternalId)
  
  try {
    // Handle customer data updates
    // This might be useful for keeping customer information in sync
    
    // Optional: Store customer event in database for audit trail
    const { error } = await supabase
      .from('subscription_events')
      .insert({
        user_id: customerExternalId,
        event_type: event.type,
        event_data: event.data,
        processed_at: new Date().toISOString()
      })
    
    if (error && error.code !== '42P01') { // Ignore if table doesn't exist
      console.error('Error storing customer event:', error)
    }
    
  } catch (error) {
    console.error('Error handling customer update:', error)
    throw error
  }
} 