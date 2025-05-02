import { Polar } from "@polar-sh/sdk";
import { clearRateLimitInfo } from "./utils";

// Environment configuration
interface PolarConfig {
  accessToken: string;
  productId: string;
  productPriceId: string;
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
      productPriceId: process.env.POLAR_DEV_PRODUCT_PRICE_ID || '',
      // discountId: process.env.POLAR_DEV_DISCOUNT_ID || '',
      // discountCode: process.env.POLAR_DEV_DISCOUNT_CODE || '',
      baseUrl: process.env.POLAR_DEV_BASE_URL || 'https://sandbox-api.polar.sh',
      isSandbox: true,
    };
    
    // Validate required configuration
    if (!config.accessToken) {
      throw new Error('Missing POLAR_DEV_ACCESS_TOKEN environment variable');
    }
    
    return config;
  } else {
    const config = {
      accessToken: process.env.POLAR_PROD_ACCESS_TOKEN || '',
      productId: process.env.POLAR_PROD_PRODUCT_ID || '',
      productPriceId: process.env.POLAR_PROD_PRODUCT_PRICE_ID || '',
      // discountId: process.env.POLAR_PROD_DISCOUNT_ID || '',
      // discountCode: process.env.POLAR_PROD_DISCOUNT_CODE || '',
      baseUrl: process.env.POLAR_PROD_BASE_URL || 'https://api.polar.sh',
      isSandbox: false,
    };
    
    // Validate required configuration
    if (!config.accessToken) {
      throw new Error('Missing POLAR_PROD_ACCESS_TOKEN environment variable');
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
export async function checkSubscription(externalId: string, email?: string): Promise<boolean> {
  try {
    const polar = createPolarClient();
    const config = getPolarConfig();
    
    try {
      // Add timeout to prevent long-running requests
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Polar API request timed out')), 5000);
      });
      
      // Try to get subscription status using external ID first
      let result: any;
      let isSubscribed = false;
      let subscriptionCheckMethod = '';
      
      try {
        const resultPromise = polar.customers.getStateExternal({
          externalId,
        });
        
        // Race between the API call and timeout
        result = await Promise.race([resultPromise, timeoutPromise]) as any;
        
        // Check if user has any active subscriptions
        isSubscribed = result.activeSubscriptions && result.activeSubscriptions.length > 0;
        subscriptionCheckMethod = 'externalId';
        
        console.log(`[polar.ts]: Subscription check via externalId successful for ${externalId}`);
      } catch (externalIdError: any) {
        console.log(`[polar.ts]: Could not check subscription via externalId: ${externalIdError.message}`);
        
        // If external ID check fails and email is provided, try to find customer by email
        if (email) {
          console.log(`[polar.ts]: Attempting to check subscription via email for ${email}`);
          
          try {
            // Try to list customers with the provided email
            const customersPromise = polar.customers.list({
              email: email
            });
            
            const customers = await Promise.race([customersPromise, timeoutPromise]) as any;
            
            // If any customers found with this email
            if (customers.items && customers.items.length > 0) {
              const customer = customers.items[0];
              console.log(`[polar.ts]: Found customer via email: ${customer.id}`);
              
              // Get customer state to check subscriptions
              const customerStatePromise = polar.customers.getState({
                id: customer.id
              });
              
              const customerState = await Promise.race([customerStatePromise, timeoutPromise]) as any;
              
              // Check if user has any active subscriptions
              isSubscribed = customerState.activeSubscriptions && customerState.activeSubscriptions.length > 0;
              subscriptionCheckMethod = 'email';
              
              // Update result for further processing
              result = customerState;
              console.log(`[polar.ts]: Subscription check via email successful. Active subscriptions: ${isSubscribed ? 'Yes' : 'No'}`);
            } else {
              console.log(`[polar.ts]: No customers found with email: ${email}`);
            }
          } catch (emailError: any) {
            console.error(`[polar.ts]: Failed to check subscription via email: ${emailError.message}`);
          }
        }
      }
      
      // Get previously cached subscription status if available
      let previousStatus = false;
      const cacheKey = subscriptionCheckMethod === 'email' ? `subscription_status_email_${email}` : `subscription_status_${externalId}`;
      
      if (typeof window !== 'undefined') {
        try {
          const cachedStatus = localStorage.getItem(cacheKey);
          previousStatus = cachedStatus === 'true';
        } catch (e) {
          // Ignore errors when accessing localStorage
        }
      }

      // If subscription status changed from not subscribed to subscribed,
      // clear rate limit information from localStorage
      if (isSubscribed && !previousStatus) {
        clearRateLimitInfo();
      }
      
      // Cache the current status
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, String(isSubscribed));
        } catch (e) {
          // Ignore errors when accessing localStorage
        }
      }
      
      return isSubscribed;
    } catch (error: any) {
      // If the error is 404 Not Found, it means the customer doesn't exist yet
      // This is normal for new users who haven't subscribed yet
      if (error.message && (error.message.includes('Not found') || error.message.includes('ResourceNotFound'))) {
        return false;
      }
      
      // For timeout errors, log and return false
      if (error.message && error.message.includes('timed out')) {
        return false;
      }
      
      // For network or server errors (including 403 Forbidden), log and return false
      if (error.message && (error.message.includes('403') || error.message.includes('network') || error.message.includes('server'))) {
        return false;
      }
      
      // For other errors, rethrow
      throw error;
    }
  } catch (error) {
    console.error('[polar.ts]: Error checking subscription:', error);
    return false;
  }
}

// Create a checkout session for a user
export async function createCheckoutSession(externalId: string, email: string, name?: string) {
  try {
    const polar = createPolarClient();
    const config = getPolarConfig();
    
    // Create checkout session
    const result = await polar.checkouts.create({
      productId: config.productId,
      productPriceId: config.productPriceId,
      // discountId: config.discountId,
      // discountCode: config.discountCode,
      successUrl: `${window.location.origin}/subscription/success`,
      customerExternalId: externalId,
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
      customerExternalId: externalId,
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