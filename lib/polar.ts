import { Polar } from "@polar-sh/sdk";

// Environment configuration
interface PolarConfig {
  accessToken: string;
  productId: string;
  productPriceId: string;
  discountId: string;
  discountCode: string;
  baseUrl: string;
  isSandbox: boolean;
}

// Get configuration based on environment
export function getPolarConfig(): PolarConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Log environment variables for debugging
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Access Token:', isDevelopment ? process.env.POLAR_DEV_ACCESS_TOKEN : process.env.POLAR_PROD_ACCESS_TOKEN);
  
  if (isDevelopment) {
    const config = {
      accessToken: process.env.POLAR_DEV_ACCESS_TOKEN || '',
      productId: process.env.POLAR_DEV_PRODUCT_ID || '',
      productPriceId: process.env.POLAR_DEV_PRODUCT_PRICE_ID || '',
      discountId: process.env.POLAR_DEV_DISCOUNT_ID || '',
      discountCode: process.env.POLAR_DEV_DISCOUNT_CODE || '',
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
      discountId: process.env.POLAR_PROD_DISCOUNT_ID || '',
      discountCode: process.env.POLAR_PROD_DISCOUNT_CODE || '',
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
export async function checkSubscription(externalId: string): Promise<boolean> {
  try {
    const polar = createPolarClient();
    const config = getPolarConfig();
    
    console.log('Checking subscription with config:', {
      isSandbox: config.isSandbox,
      baseUrl: config.baseUrl,
      externalId
    });
    
    try {
      const result = await polar.customers.getStateExternal({
        externalId,
      });
      
      // Check if user has any active subscriptions
      return result.activeSubscriptions && result.activeSubscriptions.length > 0;
    } catch (error: any) {
      // If the error is 404 Not Found, it means the customer doesn't exist yet
      // This is normal for new users who haven't subscribed yet
      if (error.message && (error.message.includes('Not found') || error.message.includes('ResourceNotFound'))) {
        console.log('Customer not found in Polar system, likely not subscribed yet');
        return false;
      }
      
      // For other errors, rethrow
      throw error;
    }
  } catch (error) {
    console.error('Error checking subscription:', error);
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
      discountId: config.discountId,
      successUrl: `${window.location.origin}/subscription/success`,
      customerExternalId: externalId,
      customerEmail: email,
      customerName: name || email.split('@')[0],
      allowDiscountCodes: true,
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