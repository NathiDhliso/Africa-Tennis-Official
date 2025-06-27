/*
  # Add Player Style Analysis Column

  1. New Features
    - Add player_style_analysis column to profiles table to store AI-generated playing style descriptions
    - Create index for faster lookups

  2. Security
    - Maintain existing RLS policies
*/

-- Add player_style_analysis column to profiles table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'player_style_analysis'
  ) THEN
    ALTER TABLE profiles ADD COLUMN player_style_analysis TEXT;
  END IF;
END $$;

-- Create index for faster lookups (will be skipped if it already exists)
DROP INDEX IF EXISTS idx_profiles_player_style_analysis;
CREATE INDEX idx_profiles_player_style_analysis ON profiles(player_style_analysis) WHERE player_style_analysis IS NOT NULL;