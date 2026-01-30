-- Add locale tracking fields to all_user table
-- This allows tracking user's location, timezone, and language preferences
-- Updated automatically when Trending widget is activated

ALTER TABLE all_user
ADD COLUMN IF NOT EXISTS locale_country TEXT,           -- "KR", "US", "TW"
ADD COLUMN IF NOT EXISTS locale_region TEXT,            -- "Seoul", "California"
ADD COLUMN IF NOT EXISTS locale_geo TEXT,               -- "KR-11" (country-region code)
ADD COLUMN IF NOT EXISTS locale_timezone TEXT,          -- "Asia/Seoul"
ADD COLUMN IF NOT EXISTS locale_language TEXT,          -- "ko", "en", "zh"
ADD COLUMN IF NOT EXISTS locale_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_all_user_locale_geo ON all_user(locale_geo) WHERE locale_geo IS NOT NULL;

