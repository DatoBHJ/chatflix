// Client-side subscription checking utility
// This replaces direct Polar API calls from the client

// In-memory cache for client-side subscription checks
const clientSubscriptionCache = new Map<string, { status: boolean; timestamp: number }>();
const ongoingClientRequests = new Map<string, Promise<boolean>>();
const CLIENT_CACHE_DURATION = 60000; // 1 minute cache

export async function checkSubscriptionClient(): Promise<boolean> {
  const cacheKey = 'current_user'; // We don't need user ID on client since API handles auth
  
  try {
    // Check if there's an ongoing request
    if (ongoingClientRequests.has(cacheKey)) {
      return await ongoingClientRequests.get(cacheKey)!;
    }

    // Check client-side cache first
    const cached = clientSubscriptionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_DURATION) {
      return cached.status;
    }

    // Create promise for this request to prevent duplicate calls
    const requestPromise = performClientSubscriptionCheck();
    ongoingClientRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache the result
      clientSubscriptionCache.set(cacheKey, {
        status: result,
        timestamp: Date.now()
      });

      return result;
    } finally {
      // Clean up ongoing request
      ongoingClientRequests.delete(cacheKey);
    }
  } catch (error) {
    console.error('Error checking subscription on client:', error);
    return false;
  }
}

async function performClientSubscriptionCheck(): Promise<boolean> {
  try {
    const response = await fetch('/api/subscription/check', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // User not authenticated
        return false;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.isSubscribed || false;
  } catch (error) {
    console.error('Error calling subscription check API:', error);
    return false;
  }
}

// Clear cache when user logs out or subscription changes
export function clearSubscriptionCache() {
  clientSubscriptionCache.clear();
  ongoingClientRequests.clear();
} 