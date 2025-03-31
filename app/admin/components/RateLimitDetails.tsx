'use client';

import { RATE_LIMITS } from '@/lib/models/config';

interface RateLimitDetailsProps {
  level?: string;
}

export default function RateLimitDetails({ level = 'level3' }: RateLimitDetailsProps) {
  // Handle invalid level
  if (!['level1', 'level2', 'level3', 'level4', 'level5'].includes(level)) {
    return <div className="text-red-500">Invalid rate limit level: {level}</div>;
  }

  const limits = RATE_LIMITS[level as keyof typeof RATE_LIMITS];
  
  if (!limits) {
    return <div className="text-red-500">Rate limit details not found for level: {level}</div>;
  }

  const cardStyle = {
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
    borderBottom: '1px solid var(--subtle-divider)',
    boxShadow: '0 1px 3px var(--overlay)'
  };

  const hourlyBgStyle = {
    backgroundColor: 'color-mix(in srgb, var(--foreground) 5%, transparent)',
    border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)'
  };

  const dailyBgStyle = {
    backgroundColor: 'color-mix(in srgb, var(--foreground) 7%, transparent)',
    border: '1px solid color-mix(in srgb, var(--foreground) 10%, transparent)'
  };

  return (
    <div className="rounded-lg p-4 mb-4" style={cardStyle}>
      <h3 className="text-lg font-medium mb-3" style={{ color: 'var(--foreground)' }}>
        Rate Limit Details - {level.toUpperCase()}
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 rounded-md" style={hourlyBgStyle}>
          <div className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Hourly Limit</div>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-2xl font-bold">{limits.hourly.requests}</span>
              <span className="ml-2">requests</span>
            </div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              per {limits.hourly.window}
            </div>
          </div>
        </div>
        
        <div className="p-3 rounded-md" style={dailyBgStyle}>
          <div className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Daily Limit</div>
          <div className="flex justify-between items-center">
            <div>
              <span className="text-2xl font-bold">{limits.daily.requests}</span>
              <span className="ml-2">requests</span>
            </div>
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              per {limits.daily.window}
            </div>
          </div>
        </div>
      </div>
      
      {/*
      // Uncomment when subscriber limits are enabled
      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--subtle-divider)' }}>
        <h4 className="text-md font-medium mb-3" style={{ color: 'var(--foreground)' }}>Subscriber Limits</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 rounded-md" style={{
            backgroundColor: 'color-mix(in srgb, rgb(139, 92, 246) 5%, transparent)',
            border: '1px solid color-mix(in srgb, rgb(139, 92, 246) 10%, transparent)'
          }}>
            <div className="text-sm font-medium mb-2" style={{ color: 'rgb(139, 92, 246)' }}>Hourly Limit</div>
            <div className="flex justify-between items-center">
              <div>
                <span className="text-2xl font-bold">{subscriberLimits?.hourly.requests || 'N/A'}</span>
                <span className="ml-2">requests</span>
              </div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                per {subscriberLimits?.hourly.window || 'N/A'}
              </div>
            </div>
          </div>
          
          <div className="p-3 rounded-md" style={{
            backgroundColor: 'color-mix(in srgb, rgb(245, 158, 11) 5%, transparent)',
            border: '1px solid color-mix(in srgb, rgb(245, 158, 11) 10%, transparent)'
          }}>
            <div className="text-sm font-medium mb-2" style={{ color: 'rgb(245, 158, 11)' }}>Daily Limit</div>
            <div className="flex justify-between items-center">
              <div>
                <span className="text-2xl font-bold">{subscriberLimits?.daily.requests || 'N/A'}</span>
                <span className="ml-2">requests</span>
              </div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                per {subscriberLimits?.daily.window || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>
      */}
    </div>
  );
} 