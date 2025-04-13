'use client'

import { useState, useEffect } from 'react'
import { createCheckoutSession, getCustomerPortalUrl, checkSubscription } from '@/lib/polar'

interface SubscriptionButtonProps {
  user: any;
}

export function SubscriptionButton({ user }: SubscriptionButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (user) {
      checkUserSubscription();
    }
  }, [user]);

  const checkUserSubscription = async () => {
    if (!user) return;
    
    try {
      const hasSubscription = await checkSubscription(user.id);
      setIsSubscribed(hasSubscription);
    } catch (error) {
      // console.error('Error checking subscription:', error);
      setIsSubscribed(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const checkout = await createCheckoutSession(
        user.id,
        user.email,
        user.user_metadata?.full_name
      );
      
      // Redirect to checkout URL
      window.location.href = checkout.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to create checkout session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isSubscribed === null) {
    return (
      <button
        className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1"
        disabled
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </button>
    );
  }

  if (isSubscribed) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs bg-gradient-to-r from-purple-500 to-blue-500 text-white px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
          </svg>
          <span>Unlimited</span>
        </span>
      </div>
    );
  }
  
  // Not subscribed state - Modern Minimal Golden Ticket
  return (
    <div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <button
        onClick={handleSubscribe}
        disabled={isLoading}
        className="premium-ticket flex items-center gap-2 px-3 py-1.5 border border-amber-400/30 bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 rounded-sm hover:shadow-md transition-all"
        aria-label="Get Premium Access"
      >
        <span className="text-sm font-bold tracking-wide relative z-10">
          <span className="opacity-70 text-xs ">UPGRADE</span>
        </span>
          {/* <span className="opacity-70 text-xs line-through mr-1">$4</span>
          $0.8
        </span> */}
      </button>
      
      {/* {showTooltip && (
        <div className="absolute right-0 mt-2 w-48 bg-white/90 backdrop-blur-sm text-amber-900 p-2.5 rounded shadow-lg z-10 border border-amber-100 animate-fade-in">
          <div className="font-medium text-xs mb-1 text-amber-800">Golden Ticket Access</div>
          <p className="text-xs text-amber-700 opacity-80">Get your 50% off before the official launch.</p>
          <p className="text-xs text-amber-700 opacity-80">Unlock unlimited conversations and premium features.</p>
        </div>
      )} */}
    </div>
  );
}