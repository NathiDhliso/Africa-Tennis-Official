/*
  # Add Match Summary Column (If Not Exists)

  1. Changes
    - Add summary column to matches table if it doesn't already exist
    - Create index for faster lookups on the summary column

  2. Security
    - Maintain existing RLS policies
*/

-- Add summary column to matches table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'matches' 
    AND column_name = 'summary'
  ) THEN
    ALTER TABLE matches ADD COLUMN summary TEXT;
  END IF;
END $$;

-- Create index for faster lookups (will be skipped if it already exists)
DROP INDEX IF EXISTS idx_matches_summary;
CREATE INDEX idx_matches_summary ON matches(summary) WHERE summary IS NOT NULL;