/**
 * User locale information utilities
 * Handles reading and updating user locale data in all_user table
 */
import type { GeoOption } from '@/lib/trends/options';

export interface UserLocaleInfo {
  country?: string       // "KR"
  region?: string        // "Seoul"
  geo?: string           // "KR-11"
  timezone?: string      // "Asia/Seoul"
  language?: string      // "ko"
  updatedAt?: string
}

/**
 * Get user locale information from all_user table
 */
export async function getUserLocaleInfo(
  userId: string,
  supabase: any
): Promise<UserLocaleInfo | null> {
  try {
    const { data, error } = await supabase
      .from('all_user')
      .select('locale_country, locale_region, locale_geo, locale_timezone, locale_language, locale_updated_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    // Return null if no locale data exists
    if (!data.locale_country && !data.locale_geo) {
      return null;
    }

    return {
      country: data.locale_country || undefined,
      region: data.locale_region || undefined,
      geo: data.locale_geo || undefined,
      timezone: data.locale_timezone || undefined,
      language: data.locale_language || undefined,
      updatedAt: data.locale_updated_at || undefined
    };
  } catch (error) {
    console.error('[user-locale] Error fetching user locale info:', error);
    return null;
  }
}

/**
 * Update user locale information in all_user table
 */
export async function updateUserLocale(
  supabase: any,
  userId: string,
  locale: Partial<UserLocaleInfo>
): Promise<void> {
  try {
    const updateData: any = {
      locale_updated_at: new Date().toISOString()
    };

    if (locale.country !== undefined) {
      updateData.locale_country = locale.country;
    }
    if (locale.region !== undefined) {
      updateData.locale_region = locale.region;
    }
    if (locale.geo !== undefined) {
      updateData.locale_geo = locale.geo;
    }
    if (locale.timezone !== undefined) {
      updateData.locale_timezone = locale.timezone;
    }
    if (locale.language !== undefined) {
      // Extract base language code (e.g., "ko" from "ko-KR")
      const baseLang = locale.language.split('-')[0].toLowerCase();
      updateData.locale_language = baseLang;
    }

    const { error } = await supabase
      .from('all_user')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error('[user-locale] Error updating user locale:', error);
      throw error;
    }
  } catch (error) {
    console.error('[user-locale] Error in updateUserLocale:', error);
    // Don't throw - allow the calling code to continue
  }
}

export interface UserTrendsPreferences {
  country?: string
  region?: string
}

export interface FormattedTrendsPreferences {
  countryCode?: string
  countryName?: string
  regionCode?: string
  regionName?: string
}

export async function getUserTrendsPreferences(
  userId: string,
  supabase: any,
): Promise<UserTrendsPreferences | null> {
  try {
    const { data, error } = await supabase
      .from('user_trends_preferences')
      .select('selected_country, selected_region, is_custom')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[user-locale] Error fetching user trends preferences:', error.message);
      }
      return null;
    }

    if (!data || !data.is_custom) {
      return null;
    }

    const country = data.selected_country || undefined;
    const region = data.selected_region || undefined;

    if (!country && !region) {
      return null;
    }

    return { country, region };
  } catch (error) {
    console.error('[user-locale] getUserTrendsPreferences failed:', error);
    return null;
  }
}

export function formatTrendsPreferencesForPrompt(
  preferences: UserTrendsPreferences | null,
  geoOptions: GeoOption[] = [],
): FormattedTrendsPreferences | null {
  if (!preferences) {
    return null;
  }

  const { country, region } = preferences;
  if (!country && !region) {
    return null;
  }

  const geoMap = geoOptions.length
    ? new Map(geoOptions.map((option) => [option.geo_id, option]))
    : null;

  const formatted: FormattedTrendsPreferences = {
    countryCode: country,
    regionCode: region,
  };

  if (geoMap && country) {
    formatted.countryName = geoMap.get(country)?.geo_description;
  }

  if (geoMap && region) {
    const regionOption = geoMap.get(region);
    if (regionOption) {
      formatted.regionName = regionOption.geo_description;
      if (!formatted.countryName) {
        const parentId = regionOption.parent_geo_id || region.split('-')[0];
        formatted.countryName = parentId ? geoMap.get(parentId)?.geo_description : undefined;
      }
      if (!formatted.countryCode && regionOption.parent_geo_id) {
        formatted.countryCode = regionOption.parent_geo_id;
      }
    }
  }

  return formatted;
}

