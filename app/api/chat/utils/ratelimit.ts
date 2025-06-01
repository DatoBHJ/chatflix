import { getRateLimiter, createRateLimitKey } from '@/lib/ratelimit';
import { getModelById, RATE_LIMITS } from '@/lib/models/config';

export const handleRateLimiting = async (userId: string, model: string) => {
    if (!userId) {
      throw new Error('User ID is required for rate limiting');
    }
    
    const modelConfig = getModelById(model);
    if (!modelConfig) {
      throw new Error(`Model ${model} not found in configuration`);
    }
    
    const now = new Date();
    // console.log(`[DEBUG-RATELIMIT][${now.toISOString()}] Checking rate limit for user ${userId}, model ${model}, level ${modelConfig.rateLimit.level}`);
    
    const rateLimiters = await getRateLimiter(model, userId);
    const level = modelConfig.rateLimit.level;
    
    // 시간당 제한 체크
    const hourlyKey = createRateLimitKey(userId, level, 'hourly');
    const hourlyResult = await rateLimiters.hourly.limit(hourlyKey);
    
    const hourlyReset = new Date(hourlyResult.reset);
    const hourlyTimeToReset = Math.floor((hourlyResult.reset - Date.now()) / 1000);
    // console.log(`[DEBUG-RATELIMIT][${now.toISOString()}] Hourly rate limit result: success=${hourlyResult.success}, remaining=${hourlyResult.remaining}/${hourlyResult.limit}, reset=${hourlyReset.toISOString()}, seconds_to_reset=${hourlyTimeToReset}`);
    
    // 시간당 제한 초과시
    if (!hourlyResult.success) {
      const retryAfter = Math.floor((hourlyResult.reset - Date.now()) / 1000);
      // Get the actual window from config
      const configLevel = RATE_LIMITS[level as keyof typeof RATE_LIMITS];
      const windowText = configLevel ? configLevel.hourly.window : '1 h';
      
      return {
        success: false,
        error: {
          type: 'rate_limit',
          message: `Hourly rate limit exceeded for ${level} models. You've used all ${hourlyResult.limit} requests in the sliding ${windowText} window. Next request allowed in ${retryAfter} seconds.`,
          retryAfter,
          level,
          reset: hourlyResult.reset,
          limit: hourlyResult.limit
        }
      };
    }
    
    // 일일 제한 체크
    const dailyKey = createRateLimitKey(userId, level, 'daily');
    const dailyResult = await rateLimiters.daily.limit(dailyKey);
    
    const dailyReset = new Date(dailyResult.reset);
    const dailyTimeToReset = Math.floor((dailyResult.reset - Date.now()) / 1000);
    // console.log(`[DEBUG-RATELIMIT][${now.toISOString()}] Daily rate limit result: success=${dailyResult.success}, remaining=${dailyResult.remaining}/${dailyResult.limit}, reset=${dailyReset.toISOString()}, seconds_to_reset=${dailyTimeToReset}`);
    
    // 일일 제한 초과시
    if (!dailyResult.success) {
      const retryAfter = Math.floor((dailyResult.reset - Date.now()) / 1000);
      
      return {
        success: false,
        error: {
          type: 'rate_limit',
          message: `Daily rate limit exceeded for ${level} models. You've used all ${dailyResult.limit} requests for today. Limit resets in ${Math.floor(retryAfter / 3600)} hours and ${Math.floor((retryAfter % 3600) / 60)} minutes.`,
          retryAfter,
          level,
          reset: dailyResult.reset,
          limit: dailyResult.limit
        }
      };
    }
    
    return { success: true };
  };