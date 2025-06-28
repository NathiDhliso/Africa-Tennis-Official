/*
  # Add Match Summary Column

  1. New Features
    - Add a summary column to the matches table to store AI-generated match summaries
    - This column will hold text summaries created by Amazon Bedrock

  2. Security
    - Maintain existing RLS policies
*/

-- Add summary column to matches table
ALTER TABLE matches ADD COLUMN summary TEXT;

-- Create index for faster lookups
CREATE INDEX idx_matches_summary ON matches(summary) WHERE summary IS NOT NULL;