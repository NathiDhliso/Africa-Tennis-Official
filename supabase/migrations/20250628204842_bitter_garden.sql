-- Create match_highlights table for storing video highlights
CREATE TABLE IF NOT EXISTS match_highlights (
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
CREATE INDEX IF NOT EXISTS idx_match_highlights_match_id ON match_highlights(match_id);
CREATE INDEX IF NOT EXISTS idx_match_highlights_created_by ON match_highlights(created_by);
CREATE INDEX IF NOT EXISTS idx_match_highlights_type ON match_highlights(type);

-- Enable Row Level Security
ALTER TABLE match_highlights ENABLE ROW LEVEL SECURITY;

-- Create policies with IF NOT EXISTS checks
DO $$ 
BEGIN
  -- Check if the policy exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'match_highlights' AND policyname = 'Anyone can view match highlights'
  ) THEN
    CREATE POLICY "Anyone can view match highlights" 
      ON match_highlights
      FOR SELECT
      USING (true);
  END IF;

  -- Check if the policy exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'match_highlights' AND policyname = 'Authenticated users can create highlights'
  ) THEN
    CREATE POLICY "Authenticated users can create highlights" 
      ON match_highlights
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = created_by);
  END IF;

  -- Check if the policy exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'match_highlights' AND policyname = 'Users can delete their own highlights'
  ) THEN
    CREATE POLICY "Users can delete their own highlights" 
      ON match_highlights
      FOR DELETE
      USING (auth.uid() = created_by);
  END IF;

  -- Check if the policy exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'match_highlights' AND policyname = 'Users can update their own highlights'
  ) THEN
    CREATE POLICY "Users can update their own highlights" 
      ON match_highlights
      FOR UPDATE
      USING (auth.uid() = created_by);
  END IF;
END $$;

-- Add video_recorded event type to match_events
DO $$ 
BEGIN
  -- Check if the constraint exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_events_event_type_check') THEN
    -- Drop the existing constraint
    ALTER TABLE match_events DROP CONSTRAINT match_events_event_type_check;
    
    -- Add the new constraint with video_recorded
    ALTER TABLE match_events ADD CONSTRAINT match_events_event_type_check 
      CHECK (event_type IN (
        'point_won', 
        'ace', 
        'double_fault', 
        'game_won', 
        'set_won', 
        'match_ended',
        'service_break',
        'tiebreak_started',
        'tiebreak_ended',
        'video_recorded'
      ));
  END IF;
END $$;