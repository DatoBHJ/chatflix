import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Test endpoint only available in development' }, { status: 403 })
  }

  try {
    const { userId, eventType = 'subscription.active' } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Create a mock webhook payload based on event type
    let mockEvent: any

    switch (eventType) {
      case 'subscription.active':
      case 'subscription.created':
      case 'subscription.updated':
        mockEvent = {
          type: eventType,
          data: {
            object: 'subscription',
            id: 'test_subscription_123',
            external_customer_id: userId,
            customer: {
              external_id: userId,
              id: 'test_customer_456'
            },
            subscription: {
              id: 'test_subscription_123',
              status: 'active',
              customer: {
                external_id: userId,
                id: 'test_customer_456'
              },
              product: {
                id: 'test_product_789'
              },
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
            }
          }
        }
        break

      case 'subscription.canceled':
      case 'subscription.ended':
      case 'subscription.paused':
      case 'subscription.revoked':
        mockEvent = {
          type: eventType,
          data: {
            object: 'subscription',
            id: 'test_subscription_123',
            external_customer_id: userId,
            customer: {
              external_id: userId,
              id: 'test_customer_456'
            },
            subscription: {
              id: 'test_subscription_123',
              status: eventType === 'subscription.canceled' ? 'canceled' : 
                      eventType === 'subscription.ended' ? 'ended' :
                      eventType === 'subscription.paused' ? 'paused' : 'revoked',
              customer: {
                external_id: userId,
                id: 'test_customer_456'
              },
              product: {
                id: 'test_product_789'
              },
              current_period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
              current_period_end: new Date().toISOString()
            }
          }
        }
        break

      case 'customer.created':
      case 'customer.updated':
        mockEvent = {
          type: eventType,
          data: {
            object: 'customer',
            id: 'test_customer_456',
            external_customer_id: userId,
            customer: {
              external_id: userId,
              id: 'test_customer_456'
            }
          }
        }
        break

      default:
        return NextResponse.json({ error: `Unsupported event type: ${eventType}` }, { status: 400 })
    }

    console.log('🧪 Simulating webhook for testing:', {
      userId,
      eventType,
      mockEvent
    })

    // Call the actual webhook handler
    const webhookUrl = `${request.nextUrl.origin}/api/webhooks/polar`
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-webhook': 'true' // Mark as test
      },
      body: JSON.stringify(mockEvent)
    })

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: `Webhook simulation sent for user ${userId}`,
      eventType,
      webhookResponse: result,
      mockEvent
    })

  } catch (error) {
    console.error('Error in webhook test:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
} 

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Test endpoint only available in development' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const eventType = searchParams.get('event') || 'subscription.active'
  const userId = searchParams.get('user') || '9b682bce-11c0-4373-b954-08ec55731312'

  console.log('🧪 Running webhook test for event:', eventType)

  try {
    // Generate mock event based on type
    const mockEvent = generateMockEvent(eventType, userId)
    
    // Send to webhook handler
    const response = await fetch(`${request.nextUrl.origin}/api/webhooks/polar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Polar-Signature': 'test-signature'
      },
      body: JSON.stringify(mockEvent)
    })

    const result = await response.json()
    
    console.log('✅ Test completed:', {
      eventType,
      status: response.status,
      result
    })

    return NextResponse.json({
      success: true,
      eventType,
      status: response.status,
      result,
      mockEvent
    })

  } catch (error) {
    console.error('❌ Test failed:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}

function generateMockEvent(eventType: string, userId: string) {
  const now = new Date()
  const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  const pastDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) // 1 day ago

  const baseEvent = {
    type: eventType,
    data: {
      object: 'subscription',
      id: `test_sub_${Date.now()}`,
      external_customer_id: userId,
      customer: {
        external_id: userId,
        id: `test_customer_${Date.now()}`
      }
    }
  }

  switch (eventType) {
    case 'subscription.active':
      return {
        ...baseEvent,
        data: {
          ...baseEvent.data,
          subscription: {
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: futureDate.toISOString(),
            customer: { external_id: userId }
          }
        }
      }

    case 'subscription.canceled':
      return {
        ...baseEvent,
        data: {
          ...baseEvent.data,
          subscription: {
            status: 'canceled',
            current_period_start: now.toISOString(),
            current_period_end: futureDate.toISOString(), // Still active until this date
            customer: { external_id: userId }
          }
        }
      }

    case 'subscription.canceled_expired':
      return {
        ...baseEvent,
        data: {
          ...baseEvent.data,
          subscription: {
            status: 'canceled',
            current_period_start: pastDate.toISOString(),
            current_period_end: pastDate.toISOString(), // Already expired
            customer: { external_id: userId }
          }
        }
      }

    case 'subscription.ended':
      return {
        ...baseEvent,
        data: {
          ...baseEvent.data,
          subscription: {
            status: 'ended',
            current_period_start: pastDate.toISOString(),
            current_period_end: pastDate.toISOString(),
            customer: { external_id: userId }
          }
        }
      }

    case 'customer.created':
      return {
        type: 'customer.created',
        data: {
          object: 'customer',
          id: `test_customer_${Date.now()}`,
          external_id: userId
        }
      }

    case 'customer.updated':
      return {
        type: 'customer.updated',
        data: {
          object: 'customer',
          id: `test_customer_${Date.now()}`,
          external_id: userId
        }
      }

    default:
      return baseEvent
  }
} 