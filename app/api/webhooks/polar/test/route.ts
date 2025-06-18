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

    // Create a mock webhook payload
    const mockEvent = {
      type: eventType,
      data: {
        object: 'subscription',
        id: 'test_subscription_123',
        external_customer_id: userId,
        customer: {
          external_id: userId
        },
        subscription: {
          status: eventType === 'subscription.active' ? 'active' : 'canceled',
          customer: {
            external_id: userId
          }
        }
      }
    }

    console.log('🧪 Simulating webhook for testing:', mockEvent)

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
      webhookResponse: result
    })

  } catch (error) {
    console.error('Error in webhook test:', error)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
} 