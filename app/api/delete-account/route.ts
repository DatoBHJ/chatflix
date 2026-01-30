import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { deleteCustomer, checkSubscription, getCustomerPortalUrl } from '@/lib/polar'

// Storage URL에서 파일 경로 추출
function extractStoragePath(url: string, bucketName: string): string | null {
  if (!url || !url.includes(bucketName)) return null;
  
  try {
    // URL 패턴: .../bucketName/FILE_PATH?token=... 또는 .../bucketName/FILE_PATH
    const path = url.split(`${bucketName}/`)[1]?.split('?')[0];
    return path || null;
  } catch (error) {
    console.error(`Error extracting path from URL: ${url}`, error);
    return null;
  }
}

// 메시지에서 모든 Storage 파일 경로 수집
function collectStorageFiles(messages: any[]): {
  chatAttachments: string[];
  generatedImages: Array<{ path: string, bucket: string }>;
} {
  const chatAttachments: string[] = [];
  const generatedImages: Array<{ path: string, bucket: string }> = [];

  for (const message of messages) {
    // 1. experimental_attachments에서 chat_attachments 파일 수집
    if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
      for (const attachment of message.experimental_attachments) {
        if (attachment.path) {
          // path 필드가 있으면 직접 사용
          chatAttachments.push(attachment.path);
        } else if (attachment.url) {
          // path가 없으면 URL에서 추출
          const path = extractStoragePath(attachment.url, 'chat_attachments');
          if (path) chatAttachments.push(path);
        }
      }
    }

    // 2. tool_results에서 generated-images URL 수집 (재귀 검색)
    if (message.tool_results && typeof message.tool_results === 'object') {
      // tool_results는 복잡한 구조일 수 있으므로 재귀적으로 검색
      const searchForImageUrls = (obj: any): void => {
        if (typeof obj === 'string') {
          // Support both old and new bucket names
          if (obj.includes('generated-images') || obj.includes('gemini-images')) {
            const bucket = obj.includes('generated-images') ? 'generated-images' : 'gemini-images';
            const path = extractStoragePath(obj, bucket);
            if (path) generatedImages.push({ path, bucket });
          }
        } else if (typeof obj === 'object' && obj !== null) {
          Object.values(obj).forEach(value => searchForImageUrls(value));
        }
      };
      searchForImageUrls(message.tool_results);
    }
  }

  // 중복 제거
  return {
    chatAttachments: [...new Set(chatAttachments)],
    generatedImages: [...new Set(generatedImages.map(img => JSON.stringify(img)))].map(str => JSON.parse(str))
  };
}

export async function POST() {
  try {
    const cookieStore = await cookies()
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

      // Step 2.5: Delete all storage files before DB deletion
      try {
        console.log('Starting storage cleanup for user:', user.id);
        
        // 1. 모든 chat_sessions 조회
        const { data: sessions } = await serviceClient
          .from('chat_sessions')
          .select('id')
          .eq('user_id', user.id);

        if (sessions && sessions.length > 0) {
          // 2. 각 세션의 메시지에서 파일 경로 수집
          const chatAttachmentPaths: string[] = [];
          const generatedImages: Array<{ path: string, bucket: string }> = [];
          
          for (const session of sessions) {
            const { data: messages } = await serviceClient
              .from('messages')
              .select('experimental_attachments, tool_results')
              .eq('chat_session_id', session.id)
              .eq('user_id', user.id);
            
            if (messages) {
              // collectStorageFiles 로직 적용
              const { chatAttachments, generatedImages: sessionImages } = collectStorageFiles(messages);
              chatAttachmentPaths.push(...chatAttachments);
              generatedImages.push(...sessionImages);
            }
          }
          
          // 3. Storage 파일 삭제
          if (chatAttachmentPaths.length > 0) {
            const { error: chatAttachmentsError } = await serviceClient.storage
              .from('chat_attachments')
              .remove(chatAttachmentPaths);
            
            if (chatAttachmentsError) {
              console.warn('Failed to delete chat attachments:', chatAttachmentsError);
            } else {
              console.log(`Successfully deleted ${chatAttachmentPaths.length} chat attachments`);
            }
          }
          
          // Delete generated images from both buckets
          if (generatedImages.length > 0) {
            // Group by bucket
            const imagesByBucket = generatedImages.reduce((acc, { path, bucket }) => {
              if (!acc[bucket]) acc[bucket] = [];
              acc[bucket].push(path);
              return acc;
            }, {} as Record<string, string[]>);
            
            // Delete from each bucket
            for (const [bucket, paths] of Object.entries(imagesByBucket)) {
              const { error } = await serviceClient.storage
                .from(bucket)
                .remove(paths);
              
              if (error) {
                console.warn(`Failed to delete ${bucket} images:`, error);
              } else {
                console.log(`Successfully deleted ${paths.length} images from ${bucket}`);
              }
            }
          }
          
          console.log('Storage cleanup completed:', {
            chatAttachments: chatAttachmentPaths.length,
            generatedImages: generatedImages.length
          });
        } else {
          console.log('No chat sessions found for user, skipping storage cleanup');
        }
      } catch (storageError) {
        console.warn('Failed to delete storage files:', storageError);
        // Continue with account deletion even if storage deletion fails
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