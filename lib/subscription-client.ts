// Client-side subscription checking utility
// This uses the database-based subscription check for faster responses

export async function checkSubscriptionClient(forceRefresh = false): Promise<boolean> {
  try {
    // Use the database-based subscription check API
    const response = await fetch('/api/subscription/check', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add cache busting parameter if force refresh is requested
      ...(forceRefresh && {
        cache: 'no-cache'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.isSubscribed || false;
  } catch (error) {
    console.error('Error in checkSubscriptionClient:', error);
    return false;
  }
}

// Clear client-side cache (useful for logout or manual refresh)
export function clearClientSubscriptionCache() {
  // Clear subscription-related localStorage cache
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('subscription_status_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    // localStorage access failed, ignore
  }
  
  console.log('🗑️ Cleared client subscription cache');
}

// Get subscription details from client
export async function getSubscriptionDetailsClient() {
  try {
    const response = await fetch('/api/subscription/details', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting subscription details on client:', error);
    return null;
  }
} 

