/*
  # Add Match Highlights Table

  1. New Tables
    - `match_highlights` - Stores video highlights from matches with AI analysis

  2. Security
    - Enable RLS on the new table
    - Add policies for users to view and manage their highlights
*/

-- Create match_highlights table for storing video highlights
CREATE TABLE match_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('rally', 'ace', 'winner', 'break_point', 'comeback')),
  description TEXT,
  video_url TEXT NOT NULL,
  created_by UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_match_highlights_match_id ON match_highlights(match_id);
CREATE INDEX idx_match_highlights_created_by ON match_highlights(created_by);
CREATE INDEX idx_match_highlights_type ON match_highlights(type);

-- Enable Row Level Security
ALTER TABLE match_highlights ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing highlights (anyone can view)
CREATE POLICY "Anyone can view match highlights" 
  ON match_highlights
  FOR SELECT
  USING (true);

-- Create policy for inserting highlights (authenticated users only)
CREATE POLICY "Authenticated users can create highlights" 
  ON match_highlights
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Create policy for deleting highlights (only the creator can delete)
CREATE POLICY "Users can delete their own highlights" 
  ON match_highlights
  FOR DELETE
  USING (auth.uid() = created_by);

-- Create policy for updating highlights (only the creator can update)
CREATE POLICY "Users can update their own highlights" 
  ON match_highlights
  FOR UPDATE
  USING (auth.uid() = created_by);