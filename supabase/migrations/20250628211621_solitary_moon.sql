/*
  # Add summary column to matches table

  1. Changes
    - Adds a summary column to the matches table if it doesn't already exist
    - Creates an index for faster lookups on the summary column
*/

-- Check if summary column exists before adding it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'summary'
  ) THEN
    ALTER TABLE matches ADD COLUMN summary TEXT;
  END IF;
END $$;

-- Create index for faster lookups if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_matches_summary ON matches(summary) WHERE summary IS NOT NULL;