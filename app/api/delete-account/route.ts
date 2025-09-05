import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { deleteCustomer, checkSubscription, getCustomerPortalUrl } from '@/lib/polar'

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('User error:', userError)
      return NextResponse.json({ error: 'Unauthorized or user not found' }, { status: 401 })
    }

    // Check if we have the required environment variables
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing service role key')
      return NextResponse.json(
        { error: 'Server configuration error. Please contact support.' }, 
        { status: 500 }
      )
    }

    console.log('Starting data deletion process for user:', user.id)

    // Create a service client with admin rights
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    try {
      // Step 1: Check if user has active subscription
      let hasActiveSubscription = false;
      try {
        hasActiveSubscription = await checkSubscription(user.id);
        console.log('User subscription status:', hasActiveSubscription);
      } catch (subscriptionCheckError) {
        console.error('Error checking subscription status:', subscriptionCheckError);
        // Continue anyway - we'll try to delete customer data regardless
      }

      // Step 2: Handle Polar customer data with better error handling
      let polarDeletionSuccess = false;
      let polarError: any = null;
      
      try {
        await deleteCustomer(user.id);
        polarDeletionSuccess = true;
        console.log('Successfully deleted Polar customer data');
      } catch (error) {
        polarError = error;
        console.error('Error deleting Polar customer data:', error);
        
        // If user has active subscription, this is more serious
        if (hasActiveSubscription) {
          console.error('CRITICAL: User has active subscription but Polar deletion failed');
          
          // Try to get customer portal URL to give user a way to cancel manually
          try {
            const portalUrl = await getCustomerPortalUrl(user.id);
            return NextResponse.json({
              error: 'Cannot delete account with active subscription. Please cancel your subscription first.',
              action: 'cancel_subscription',
              portalUrl: portalUrl,
              message: 'You have an active subscription. Please use the link provided to cancel your subscription before deleting your account.'
            }, { status: 400 });
          } catch (portalError) {
            console.error('Failed to get customer portal URL:', portalError);
            return NextResponse.json({
              error: 'Cannot delete account with active subscription. Please contact support to cancel your subscription first.',
              action: 'contact_support',
              message: 'You have an active subscription that needs to be cancelled before account deletion. Please contact our support team.'
            }, { status: 400 });
          }
        }
        
        // If no active subscription, we can continue but log the issue
        console.warn('Continuing with account deletion despite Polar deletion failure (no active subscription)');
      }

      // Step 3: Delete all user data using the security definer function
      const { error: dataError } = await serviceClient.rpc('delete_user_data_and_account', {
        p_user_id: user.id
      })

      if (dataError) {
        console.error('Error deleting user data:', dataError)
        
        // If Polar deletion succeeded but database deletion failed, this is problematic
        if (polarDeletionSuccess) {
          console.error('CRITICAL: Polar data deleted but user data deletion failed - data inconsistency!');
        }
        
        return NextResponse.json(
          { error: `Failed to delete user data: ${dataError.message}` }, 
          { status: 500 }
        )
      }

      console.log('Successfully deleted all user data')

      // Step 4: Delete the user account using admin API
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id)
      if (deleteError) {
        console.error('Failed to delete user with admin API:', deleteError)
        return NextResponse.json(
          { error: `Failed to delete user account: ${deleteError.message}` }, 
          { status: 500 }
        )
      }
      
      console.log('Successfully deleted user account')
      
      const responseMessage = polarDeletionSuccess 
        ? 'Your account and all associated data have been permanently deleted.'
        : 'Your account has been deleted. Note: Some billing data may remain in our payment system.';
      
      return NextResponse.json({ 
        success: true,
        message: responseMessage,
        warnings: polarDeletionSuccess ? [] : ['Billing data deletion incomplete - contact support if needed']
      })
    } catch (error) {
      console.error('Detailed error in account deletion:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        userId: user.id
      })
      
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to delete account. Please try again.' }, 
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in account deletion:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    })
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    )
  }
}