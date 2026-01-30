import { Polar } from "@polar-sh/sdk";
import { clearRateLimitInfo } from "./utils";
import { SubscriptionCache } from "./subscription-cache";

// In-memory ongoing requests tracking (Redis는 Promise를 저장할 수 없으므로 메모리에 유지)
const ongoingRequests = new Map<string, Promise<boolean>>();

// Environment configuration
interface PolarConfig {
  accessToken: string;
  productId: string;
  // discountId: string;
  // discountCode: string;
  baseUrl: string;
  isSandbox: boolean;
}

// Get configuration based on environment
export function getPolarConfig(): PolarConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // // // Log environment variables for debugging
  // console.log('Environment:', process.env.NODE_ENV);
  // console.log('Access Token:', isDevelopment ? process.env.POLAR_DEV_ACCESS_TOKEN : process.env.POLAR_PROD_ACCESS_TOKEN);
  
  if (isDevelopment) {
    const config = {
      accessToken: process.env.POLAR_DEV_ACCESS_TOKEN || '',
      productId: process.env.POLAR_DEV_PRODUCT_ID || '',
      // discountId: process.env.POLAR_DEV_DISCOUNT_ID || '',
      // discountCode: process.env.POLAR_DEV_DISCOUNT_CODE || '',
      baseUrl: process.env.POLAR_DEV_BASE_URL || 'https://sandbox-api.polar.sh',
      isSandbox: true,
    };
    
    // Validate required configuration
    if (!config.accessToken) {
      throw new Error('Missing POLAR_DEV_ACCESS_TOKEN environment variable');
    }
    if (!config.productId) {
      throw new Error('Missing POLAR_DEV_PRODUCT_ID environment variable');
    }
    
    return config;
  } else {
    const config = {
      accessToken: process.env.POLAR_PROD_ACCESS_TOKEN || '',
      productId: process.env.POLAR_PROD_PRODUCT_ID || '',
      // discountId: process.env.POLAR_PROD_DISCOUNT_ID || '',
      // discountCode: process.env.POLAR_PROD_DISCOUNT_CODE || '',
      baseUrl: process.env.POLAR_PROD_BASE_URL || 'https://api.polar.sh',
      isSandbox: false,
    };
    
    // Validate required configuration
    if (!config.accessToken) {
      throw new Error('Missing POLAR_PROD_ACCESS_TOKEN environment variable');
    }
    if (!config.productId) {
      throw new Error('Missing POLAR_PROD_PRODUCT_ID environment variable');
    }
    
    return config;
  }
}

// Create Polar client
export function createPolarClient() {
  const config = getPolarConfig();
  
  return new Polar({
    accessToken: config.accessToken,
    server: config.isSandbox ? 'sandbox' : undefined,
  });
}

// Check if a user has an active subscription
export async function checkSubscription(externalId: string): Promise<boolean> {
  try {
    // Check if there's an ongoing request for this user (메모리에서 확인)
    if (ongoingRequests.has(externalId)) {
      return await ongoingRequests.get(externalId)!;
    }

    // Check if there's an ongoing request in Redis
    const hasOngoingRequest = await SubscriptionCache.hasOngoingRequest(externalId);
    if (hasOngoingRequest) {
      // Wait a bit and try again
      await new Promise(resolve => setTimeout(resolve, 100));
      const cachedResult = await SubscriptionCache.getStatus(externalId);
      if (cachedResult !== null) {
        return cachedResult;
      }
    }

    // Check Redis cache first
      const cached = await SubscriptionCache.getStatus(externalId);
      if (cached !== null) {
        return cached;
      }

    // Set ongoing request lock in Redis
    await SubscriptionCache.setOngoingRequest(externalId);

    // Create promise for this request to prevent duplicate calls
    const requestPromise = performSubscriptionCheck(externalId);
    ongoingRequests.set(externalId, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache the result in Redis
      await SubscriptionCache.setStatus(externalId, result);
      
      console.log('[polar.ts]: Cached subscription status in Redis for user:', externalId, 'status:', result);

      return result;
    } finally {
      // Clean up ongoing request (both memory and Redis)
      ongoingRequests.delete(externalId);
      await SubscriptionCache.deleteOngoingRequest(externalId);
    }
  } catch (error) {
    console.error('[polar.ts]: Error checking subscription:', error);
    // Clean up ongoing request on error
    await SubscriptionCache.deleteOngoingRequest(externalId);
    return false;
  }
}

// Actual API call function
async function performSubscriptionCheck(externalId: string): Promise<boolean> {
  const polar = createPolarClient();
  
  try {
    // Add timeout to prevent long-running requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Polar API request timed out')), 5000);
    });
    
    const resultPromise = polar.customers.getStateExternal({
      externalId,
    });
    
    // Race between the API call and timeout
    const result = await Promise.race([resultPromise, timeoutPromise]) as any;
    
    // Check if user has any active subscriptions
    const isSubscribed = result.activeSubscriptions && result.activeSubscriptions.length > 0;
    
    // Get previously cached subscription status from Redis
    let previousStatus = false;
    try {
      const cachedStatus = await SubscriptionCache.getStatus(externalId);
      previousStatus = cachedStatus === true;
    } catch (e) {
      // Ignore cache errors
    }

    // If subscription status changed from not subscribed to subscribed,
    // clear rate limit information from localStorage
    if (isSubscribed && !previousStatus) {
      clearRateLimitInfo();
    }
    
    return isSubscribed;
  } catch (error: any) {
    // If the error is 404 Not Found, it means the customer doesn't exist yet
    // This is normal for new users who haven't subscribed yet
    if (error.status === 404 || 
        error.statusCode === 404 || 
        (error.message && (
          error.message.includes('Not found') || 
          error.message.includes('ResourceNotFound') ||
          error.message.includes('404')
        ))) {
      return false;
    }
    
    // For timeout errors, log and return false
    if (error.message && error.message.includes('timed out')) {
      return false;
    }
    
    // For network or server errors (including 403 Forbidden), log and return false
    if (error.status === 403 ||
        error.statusCode === 403 ||
        (error.message && (
          error.message.includes('403') || 
          error.message.includes('Forbidden') ||
          error.message.includes('network') || 
          error.message.includes('server')
        ))) {
      return false;
    }
    
    // For other errors, rethrow
    throw error;
  }
}

// Create a checkout session for a user
export async function createCheckoutSession(externalId: string, email: string, name?: string, successUrl?: string) {
  try {
    const polar = createPolarClient();
    const config = getPolarConfig();
    
    // Use provided successUrl or construct default from environment
    const finalSuccessUrl = successUrl || `${process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'}/subscription/success`;
    
    // Create checkout session
    const result = await polar.checkouts.create({
      products: [config.productId], // Use product ID instead of deprecated productPriceId
      successUrl: finalSuccessUrl,
      externalCustomerId: externalId,
      customerEmail: email,
      customerName: name || email.split('@')[0],
      // allowDiscountCodes: true,
    });
    
    return result;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

// Create a customer portal session for managing subscription
export async function getCustomerPortalUrl(externalId: string) {
  try {
    const polar = createPolarClient();
    
    // Get customer by external ID
    const customer = await polar.customerSessions.create({
      externalCustomerId: externalId,
    });
    
    return customer.customerPortalUrl;
  } catch (error) {
    console.error('Error getting customer portal URL:', error);
    throw error;
  }
}

// Delete a customer when account is deleted
export async function deleteCustomer(externalId: string) {
  try {
    const polar = createPolarClient();
    
    await polar.customers.deleteExternal({
      externalId,
    });
    
    return true;
  } catch (error) {
    console.error('Error deleting customer:', error);
    return false;
  }
}

// Clear cache when user logs out or subscription changes
export async function clearSubscriptionCache() {
  // Clear Redis cache
  await SubscriptionCache.clearAllCache();
  
  // Clear memory cache
  ongoingRequests.clear();
  
  console.log('🗑️ Cleared all subscription cache (Redis + Memory)');
}

// Clear cache for specific user (used by webhooks)
export async function clearSubscriptionCacheForUser(externalId: string) {
  // Clear Redis cache
  await SubscriptionCache.clearUserCache(externalId);
  
  // Clear memory cache
  ongoingRequests.delete(externalId);
  
  console.log('🗑️ Cleared subscription cache (Redis + Memory) for user:', externalId);
} 