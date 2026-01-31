import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { 
  DEFAULT_QUICK_ACCESS_APPS_DESKTOP,
  DEFAULT_QUICK_ACCESS_APPS_MOBILE,
  DEFAULT_QUICK_ACCESS_APPS_TABLET,
  VALID_APP_IDS,
  StoredApp 
} from '@/lib/quick-access-apps';

// IDs are centralized in lib/quick-access-apps.ts

type DeviceType = 'mobile' | 'tablet' | 'desktop';

const DEVICE_PARAM_KEY = 'deviceType';
const DEVICE_COLUMN_MAP: Record<DeviceType, 'quick_access_apps_mobile' | 'quick_access_apps_tablet' | 'quick_access_apps_desktop'> = {
  mobile: 'quick_access_apps_mobile',
  tablet: 'quick_access_apps_tablet',
  desktop: 'quick_access_apps_desktop',
};

const extractDeviceType = (req: NextRequest): DeviceType => {
  const url = new URL(req.url);
  const param = url.searchParams.get(DEVICE_PARAM_KEY);
  if (param === 'mobile') return 'mobile';
  if (param === 'tablet') return 'tablet';
  return 'desktop';
};

const getDefaultApps = (deviceType: DeviceType): StoredApp[] => {
  if (deviceType === 'mobile') return DEFAULT_QUICK_ACCESS_APPS_MOBILE;
  if (deviceType === 'tablet') return DEFAULT_QUICK_ACCESS_APPS_TABLET;
  return DEFAULT_QUICK_ACCESS_APPS_DESKTOP;
};

const sanitizeApps = (apps: StoredApp[] | null | undefined, deviceType: DeviceType): StoredApp[] => {
  if (!Array.isArray(apps)) {
    return getDefaultApps(deviceType);
  }

  const filtered = apps.filter((item: StoredApp) => {
    const id = typeof item === 'string' ? item : item.id;
    return VALID_APP_IDS.includes(id);
  });

  return filtered.length > 0 ? filtered : getDefaultApps(deviceType);
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const deviceType = extractDeviceType(req);
    const deviceColumn = DEVICE_COLUMN_MAP[deviceType];

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      // Anonymous user - return default apps
      return NextResponse.json({ 
        apps: getDefaultApps(deviceType),
        source: 'default'
      });
    }

    // Fetch user preferences
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('quick_access_apps_mobile, quick_access_apps_tablet, quick_access_apps_desktop')
      .eq('user_id', user.id)
      .single();

    if (prefError && prefError.code !== 'PGRST116') {
      console.error('Error fetching user preferences:', prefError);
      return NextResponse.json({ 
        apps: getDefaultApps(deviceType),
        source: 'default'
      });
    }

    const appsByDevice = preferences?.[deviceColumn] as StoredApp[] | undefined;
    
    // Migration: If tablet is requested but empty, try to fallback to mobile settings
    let apps: StoredApp[];
    let source: 'database' | 'default' = 'default';

    if (Array.isArray(appsByDevice)) {
      apps = sanitizeApps(appsByDevice, deviceType);
      source = 'database';
    } else if (deviceType === 'tablet' && Array.isArray(preferences?.quick_access_apps_mobile)) {
      // Fallback tablet to existing mobile settings if tablet settings don't exist yet
      apps = sanitizeApps(preferences!.quick_access_apps_mobile as StoredApp[], 'tablet');
      source = 'database'; // Consider it database source as it's migrated from mobile
    } else {
      apps = getDefaultApps(deviceType);
      source = 'default';
    }

    return NextResponse.json({ 
      apps,
      source
    });

  } catch (error) {
    console.error('Error in GET /api/quick-access-apps:', error);
    const deviceType = extractDeviceType(req);
    return NextResponse.json({ 
      apps: getDefaultApps(deviceType),
      source: 'default'
    });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const deviceType = extractDeviceType(req);
    const deviceColumn = DEVICE_COLUMN_MAP[deviceType];
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { apps } = body;

    if (!Array.isArray(apps)) {
      return NextResponse.json(
        { error: 'Apps must be an array' },
        { status: 400 }
      );
    }

    // Validate app IDs (문자열 또는 { id, slotIndex } 객체)
    const invalidApps = apps.filter((item: string | { id: string }) => {
      const appId = typeof item === 'string' ? item : item.id;
      return !VALID_APP_IDS.includes(appId);
    });
    if (invalidApps.length > 0) {
      const invalidIds = invalidApps.map((item: string | { id: string }) => 
        typeof item === 'string' ? item : item.id
      );
      return NextResponse.json(
        { error: `Invalid app IDs: ${invalidIds.join(', ')}` },
        { status: 400 }
      );
    }

    // Get existing user preferences to preserve other device columns and background settings.
    // If this fetch fails (e.g. network), we must not upsert—we could overwrite other device columns.
    const { data: existingPrefs, error: prefError } = await supabase
      .from('user_preferences')
      .select('selected_background_type, selected_background_id, quick_access_apps_mobile, quick_access_apps_tablet, quick_access_apps_desktop')
      .eq('user_id', user.id)
      .single();

    if (prefError && prefError.code !== 'PGRST116') {
      console.error('Error fetching user preferences for quick-access-apps PUT:', prefError);
      return NextResponse.json(
        { error: 'Failed to load existing preferences' },
        { status: 500 }
      );
    }
    // PGRST116 = no row; existingPrefs is null, which is fine for first-time save.

    // Preserve existing background settings or use defaults
    const backgroundType = existingPrefs?.selected_background_type || 'default';
    const backgroundId = existingPrefs?.selected_background_id || 'default-1';

    const upsertPayload: Record<string, unknown> = {
      user_id: user.id,
      selected_background_type: backgroundType,
      selected_background_id: backgroundId,
    };

    // Set the current device column to the new apps
    upsertPayload[deviceColumn] = apps;
    
    // Preserve other device columns
    if (deviceColumn !== 'quick_access_apps_mobile' && existingPrefs?.quick_access_apps_mobile !== undefined) {
      upsertPayload.quick_access_apps_mobile = existingPrefs.quick_access_apps_mobile;
    }
    if (deviceColumn !== 'quick_access_apps_tablet' && existingPrefs?.quick_access_apps_tablet !== undefined) {
      upsertPayload.quick_access_apps_tablet = existingPrefs.quick_access_apps_tablet;
    }
    if (deviceColumn !== 'quick_access_apps_desktop' && existingPrefs?.quick_access_apps_desktop !== undefined) {
      upsertPayload.quick_access_apps_desktop = existingPrefs.quick_access_apps_desktop;
    }

    // Upsert user preferences with preserved background settings
    const { error: upsertError } = await supabase
      .from('user_preferences')
      .upsert(upsertPayload, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error upserting user preferences:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      apps 
    });

  } catch (error) {
    console.error('Error in PUT /api/quick-access-apps:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
