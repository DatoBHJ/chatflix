import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Polar webhook event types - Fixed to match actual webhook data structure
interface PolarWebhookEvent {
  type: string
  data: {
    object: string
    id: string
    external_customer_id?: string
    status?: string
    current_period_start?: string
    current_period_end?: string
    canceled_at?: string
    cancel_at_period_end?: boolean
    customer?: {
      external_id?: string
      id?: string
    }
    customer_id?: string
    product?: {
      id?: string
    }
    product_id?: string
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
    
    // Skip signature verification for test requests
    if (signature === 'test-signature') {
      console.log('🧪 Test webhook detected - skipping signature verification')
    } else if (webhookSecret && signature) {
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
    }

    if (!customerExternalId) {
      console.warn('⚠️ No customer external ID found in webhook event')
      return NextResponse.json({ received: true })
    }

    console.log('👤 Processing webhook for customer:', customerExternalId)

    // Initialize Supabase client with service role for webhook processing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_CUSTOM_DOMAIN || process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabase = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
      case 'subscription.revoked':
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
        // Still store the event for audit trail
        await storeWebhookEvent(supabase, customerExternalId, event)
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
    // Extract subscription details from webhook
    const subscriptionData = extractSubscriptionData(event)
    
    // Update subscription status in database
    await updateSubscriptionInDatabase(supabase, customerExternalId, {
      isActive: true,
      ...subscriptionData,
      eventType: event.type
    })
    
    // Store webhook event for audit trail
    await storeWebhookEvent(supabase, customerExternalId, event)
    
    // Clear caches for this user
    await clearUserSubscriptionCache(customerExternalId)
    
    console.log('✅ Subscription activated and stored for user:', customerExternalId)
    
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
    // Extract subscription details from webhook
    const subscriptionData = extractSubscriptionData(event)
    
    // Check if subscription period has actually ended
    const isActuallyInactive = checkIfSubscriptionActuallyInactive(subscriptionData)
    
    console.log('📅 Subscription status check:', {
      status: subscriptionData.status,
      currentPeriodEnd: subscriptionData.currentPeriodEnd,
      isActuallyInactive
    })
    
    // Update subscription status in database
    await updateSubscriptionInDatabase(supabase, customerExternalId, {
      isActive: !isActuallyInactive, // Only mark as inactive if period has ended
      ...subscriptionData,
      eventType: event.type
    })
    
    // Store webhook event for audit trail
    await storeWebhookEvent(supabase, customerExternalId, event)
    
    // Clear caches for this user
    await clearUserSubscriptionCache(customerExternalId)
    
    console.log(`📅 Subscription ${isActuallyInactive ? 'deactivated' : 'canceled but still active until period end'} for user:`, customerExternalId)
    
  } catch (error) {
    console.error('Error handling subscription deactivation:', error)
    throw error
  }
}

async function handleCustomerUpdated(
  supabase: any, 
  customerExternalId: string, 
  event: PolarWebhookEvent
) {
  console.log('Handling customer update for:', customerExternalId)
  
  try {
    // Store customer event for audit trail
    await storeWebhookEvent(supabase, customerExternalId, event)
    
    // If this customer update includes subscription info, update it
    if (event.data.status && event.data.id) {
      const subscriptionData = extractSubscriptionData(event)
      const isActive = event.data.status === 'active'
      
      await updateSubscriptionInDatabase(supabase, customerExternalId, {
        isActive,
        ...subscriptionData,
        eventType: event.type
      })
    }
    
    console.log('👤 Customer update processed for:', customerExternalId)
    
  } catch (error) {
    console.error('Error handling customer update:', error)
    throw error
  }
}

// Helper function to extract subscription data from webhook event
function extractSubscriptionData(event: PolarWebhookEvent) {
  // Polar webhook data is directly in event.data, not event.data.subscription
  const data = event.data
  
  return {
    subscriptionId: data.id,
    customerId: data.customer?.id || data.customer_id,
    productId: data.product?.id || data.product_id,
    status: data.status,
    currentPeriodStart: data.current_period_start ? new Date(data.current_period_start).toISOString() : undefined,
    currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end).toISOString() : undefined,
    canceledAt: data.canceled_at ? new Date(data.canceled_at).toISOString() : undefined,
    cancelAtPeriodEnd: data.cancel_at_period_end || false
  }
}

// Helper function to update subscription in database
async function updateSubscriptionInDatabase(
  supabase: any, 
  customerExternalId: string, 
  data: {
    isActive: boolean
    subscriptionId?: string
    customerId?: string
    productId?: string
    status?: string
    currentPeriodStart?: string
    currentPeriodEnd?: string
    canceledAt?: string
    cancelAtPeriodEnd?: boolean
    eventType: string
  }
) {
  try {
    // Use the database function to upsert subscription data
    const { error } = await supabase.rpc('upsert_user_subscription', {
      p_user_id: customerExternalId,
      p_is_active: data.isActive,
      p_subscription_id: data.subscriptionId,
      p_customer_id: data.customerId,
      p_product_id: data.productId,
      p_status: data.status,
      p_current_period_start: data.currentPeriodStart,
      p_current_period_end: data.currentPeriodEnd,
      p_canceled_at: data.canceledAt,
      p_cancel_at_period_end: data.cancelAtPeriodEnd,
      p_event_type: data.eventType
    })
    
    if (error) {
      console.error('Error updating subscription in database:', error)
      throw error
    }
    
    console.log('✅ Subscription data updated in database for user:', customerExternalId)
  } catch (error) {
    console.error('Error in updateSubscriptionInDatabase:', error)
    throw error
  }
}

// Helper function to store webhook event for audit trail
async function storeWebhookEvent(
  supabase: any, 
  customerExternalId: string, 
  event: PolarWebhookEvent
) {
  try {
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
    } else {
      console.log('📝 Webhook event stored for audit trail:', event.type)
    }
  } catch (error) {
    console.error('Error storing webhook event:', error)
    // Don't throw error here as this is not critical
  }
}

// Cache clearing function - Updated for Redis cache support
async function clearUserSubscriptionCache(customerExternalId: string) {
  try {
    // Clear server-side cache from polar.ts (Redis + Memory)
    const { clearSubscriptionCacheForUser } = await import('@/lib/polar')
    await clearSubscriptionCacheForUser(customerExternalId)
    
    // Clear database cache as well (Redis + Memory)
    const { clearDatabaseSubscriptionCache } = await import('@/lib/subscription-db')
    await clearDatabaseSubscriptionCache(customerExternalId)
    
    // Clear client-side cache by sending a cache-busting header
    // This will force the client to refetch subscription status
    console.log('✅ All caches cleared (Redis + Memory) for user:', customerExternalId)
    
    // 🔧 FIX: 구독 상태 변경 시 클라이언트에 즉시 알림
    // Note: This is a server-side function, so we can't directly dispatch events
    // The client will need to poll or use other mechanisms to detect changes
    
  } catch (error) {
    console.error('Error clearing subscription cache:', error)
  }
} 

// Helper function to check if subscription should actually be marked as inactive
function checkIfSubscriptionActuallyInactive(subscriptionData: any): boolean {
  const now = new Date()
  const periodEnd = subscriptionData.currentPeriodEnd ? new Date(subscriptionData.currentPeriodEnd) : null
  const status = subscriptionData.status
  
  // Immediately mark these statuses as inactive regardless of period
  const immediatelyInactiveStatuses = ['paused', 'ended', 'revoked']
  if (immediatelyInactiveStatuses.includes(status)) {
    console.log(`📅 Status "${status}" requires immediate deactivation`)
    return true
  }
  
  // For canceled status, check if period has ended
  if (status === 'canceled') {
    // If no period end date, assume it's inactive
    if (!periodEnd) {
      console.log('⚠️ No period end date found for canceled subscription, marking as inactive')
      return true
    }
    
    // Check if current period has ended
    const isPeriodEnded = now > periodEnd
    
    console.log('📅 Canceled subscription period check:', {
      now: now.toISOString(),
      periodEnd: periodEnd.toISOString(),
      isPeriodEnded
    })
    
    return isPeriodEnded
  }
  
  // For other statuses, if no period end date, assume it's inactive
  if (!periodEnd) {
    console.log('⚠️ No period end date found, marking as inactive')
    return true
  }
  
  // Default period check
  const isPeriodEnded = now > periodEnd
  
  console.log('📅 Default period check:', {
    status,
    now: now.toISOString(),
    periodEnd: periodEnd.toISOString(),
    isPeriodEnded
  })
  
  return isPeriodEnded
} 