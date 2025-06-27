/*
  # Add Player Stats Table

  1. New Tables
    - `player_stats` - Stores aggregated player statistics for analytics

  2. Security
    - Enable RLS on the new table
    - Add policy for users to view all player stats
    - Add policy for the system to update player stats
*/

-- Create player_stats table for storing pre-calculated analytics
CREATE TABLE player_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  win_rate_vs_higher_elo FLOAT DEFAULT 0,
  win_rate_vs_lower_elo FLOAT DEFAULT 0,
  avg_tournament_placement INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_player_stats_user_id ON player_stats(user_id);

-- Enable Row Level Security
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing player stats (anyone can view)
CREATE POLICY "Anyone can view player stats" 
  ON player_stats
  FOR SELECT
  USING (true);

-- Create policy for updating player stats (service role only)
-- Note: This relies on the service role key being used for Lambda functions
CREATE POLICY "Service role can update player stats" 
  ON player_stats
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert player stats" 
  ON player_stats
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');