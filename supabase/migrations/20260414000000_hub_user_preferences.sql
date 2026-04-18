-- Migration: Create hub_user_preferences table
-- Date: 2026-04-14
-- Purpose: Store user preferences for Muuney.hub (onboarding status, tier info, etc.)

-- Create the table
CREATE TABLE IF NOT EXISTS hub_user_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  tier VARCHAR(50) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'admin')),
  theme VARCHAR(50) DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  notifications_enabled BOOLEAN DEFAULT TRUE,
  feedback_analytics_enabled BOOLEAN DEFAULT TRUE,
  sidebar_collapsed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_hub_user_preferences_user_id 
ON hub_user_preferences(user_id);

-- Create index for onboarding filter
CREATE INDEX IF NOT EXISTS idx_hub_user_preferences_onboarding 
ON hub_user_preferences(onboarding_completed);

-- Create index for tier filter
CREATE INDEX IF NOT EXISTS idx_hub_user_preferences_tier 
ON hub_user_preferences(tier);

-- Enable RLS (Row Level Security)
ALTER TABLE hub_user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own preferences
CREATE POLICY hub_user_preferences_read
  ON hub_user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only update their own preferences
CREATE POLICY hub_user_preferences_update
  ON hub_user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only insert their own preferences
CREATE POLICY hub_user_preferences_insert
  ON hub_user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hub_user_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hub_user_preferences_timestamp
  BEFORE UPDATE ON hub_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_hub_user_preferences_timestamp();

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE ON hub_user_preferences TO anon;
GRANT SELECT, INSERT, UPDATE ON hub_user_preferences TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE hub_user_preferences_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE hub_user_preferences_id_seq TO authenticated;

-- Add comment to table
COMMENT ON TABLE hub_user_preferences IS 'User preferences and settings for Muuney.hub platform';
COMMENT ON COLUMN hub_user_preferences.user_id IS 'Foreign key to auth.users';
COMMENT ON COLUMN hub_user_preferences.onboarding_completed IS 'Whether user has completed the onboarding tour';
COMMENT ON COLUMN hub_user_preferences.tier IS 'User subscription tier: free, pro, or admin';
COMMENT ON COLUMN hub_user_preferences.theme IS 'UI theme preference';
COMMENT ON COLUMN hub_user_preferences.notifications_enabled IS 'Global notifications toggle';
COMMENT ON COLUMN hub_user_preferences.feedback_analytics_enabled IS 'Permission to collect feedback analytics';
COMMENT ON COLUMN hub_user_preferences.sidebar_collapsed IS 'Sidebar collapse state';
