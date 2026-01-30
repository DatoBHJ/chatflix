import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { OnboardingLocation } from '@/app/types/OnboardingFeature';
import { getActiveFeaturesByLocation } from '@/app/lib/onboardingRegistry';

/**
 * Hook for managing onboarding features
 * Hook that manages onboarding features the user has seen
 */
export const useOnboardingFeatures = () => {
  const [seenFeatureKeys, setSeenFeatureKeys] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  // Fetch user data
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
        setUser(null);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Load seen features from Supabase or localStorage
  useEffect(() => {
    const fetchSeenFeatures = async () => {
      if (!user?.id) {
        // Use localStorage as fallback for non-authenticated users
        try {
          const stored = localStorage.getItem('onboardingSeenFeatures');
          if (stored) {
            const keys = JSON.parse(stored) as string[];
            setSeenFeatureKeys(new Set(keys));
          }
        } catch (error) {
          console.error('Error reading from localStorage:', error);
        }
        setIsLoaded(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_onboarding_features')
          .select('feature_key')
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Error fetching seen features:', error);
          setIsLoaded(true);
          return;
        }
        
        if (data) {
          const keys = data.map(row => row.feature_key);
          setSeenFeatureKeys(new Set(keys));
        }
      } catch (error) {
        console.error('Error fetching from Supabase:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    fetchSeenFeatures();
  }, [user, supabase]);

  /**
   * Mark a feature as seen
   */
  const markFeatureAsSeen = useCallback(async (featureKey: string) => {
    // Update local state immediately
    setSeenFeatureKeys(prev => {
      const newSet = new Set(prev);
      newSet.add(featureKey);
      return newSet;
    });

    if (!user?.id) {
      // Use localStorage as fallback for non-authenticated users
      try {
        const stored = localStorage.getItem('onboardingSeenFeatures');
        const keys = stored ? JSON.parse(stored) as string[] : [];
        keys.push(featureKey);
        localStorage.setItem('onboardingSeenFeatures', JSON.stringify([...new Set(keys)]));
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('user_onboarding_features')
        .upsert({
          user_id: user.id,
          feature_key: featureKey,
        }, { onConflict: 'user_id,feature_key' });
      
      if (error) {
        console.error('Error marking feature as seen:', error);
        // Rollback on error
        setSeenFeatureKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(featureKey);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error updating Supabase:', error);
      // Rollback on error
      setSeenFeatureKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(featureKey);
        return newSet;
      });
    }
  }, [user, supabase]);

  /**
   * Check if a feature has been seen
   */
  const hasSeenFeature = useCallback((featureKey: string): boolean => {
    return seenFeatureKeys.has(featureKey);
  }, [seenFeatureKeys]);

  /**
   * Get unseen features for a specific location
   */
  const getUnseenFeatures = useCallback((location: OnboardingLocation, context?: any) => {
    const activeFeatures = getActiveFeaturesByLocation(location, context);
    return activeFeatures.filter(feature => !seenFeatureKeys.has(feature.key));
  }, [seenFeatureKeys]);

  return {
    seenFeatureKeys,
    isLoaded,
    markFeatureAsSeen,
    hasSeenFeature,
    getUnseenFeatures,
  };
};

