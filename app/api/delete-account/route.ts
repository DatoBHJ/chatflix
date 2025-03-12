import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { deleteCustomer } from '@/lib/polar'

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
      // Delete Polar customer data
      try {
        await deleteCustomer(user.id)
        console.log('Successfully deleted Polar customer data')
      } catch (polarError) {
        console.error('Error deleting Polar customer data:', polarError)
        // Continue with account deletion even if Polar deletion fails
      }

      // Delete all user data using the security definer function
      const { error: dataError } = await serviceClient.rpc('delete_user_data_and_account', {
        p_user_id: user.id
      })

      if (dataError) {
        console.error('Error deleting user data:', dataError)
        return NextResponse.json(
          { error: `Failed to delete user data: ${dataError.message}` }, 
          { status: 500 }
        )
      }

      console.log('Successfully deleted all user data')

      // Delete the user account using admin API
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id)
      if (deleteError) {
        console.error('Failed to delete user with admin API:', deleteError)
        return NextResponse.json(
          { error: `Failed to delete user account: ${deleteError.message}` }, 
          { status: 500 }
        )
      }
      
      console.log('Successfully deleted user account')
      
      return NextResponse.json({ 
        success: true,
        message: 'Your account and all associated data have been permanently deleted.'
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