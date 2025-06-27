/*
  # Fix Match Creation RLS Policy

  1. Security Changes
    - Update the INSERT policy for matches table to be more permissive for authenticated users
    - Allow authenticated users to create matches where they are involved as either player
    - Ensure the policy works correctly with the current application logic

  2. Policy Updates
    - Drop the existing restrictive INSERT policy
    - Create a new policy that allows authenticated users to create matches
    - Maintain security by ensuring users can only create matches they participate in
*/

-- Drop the existing INSERT policy that's causing issues
DROP POLICY IF EXISTS "Authenticated users can create matches they participate in" ON matches;

-- Create a new, more robust INSERT policy for matches
CREATE POLICY "Authenticated users can create matches they participate in"
  ON matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if the authenticated user is either player1 or player2
    (auth.uid() = player1_id OR auth.uid() = player2_id)
  );

-- Also ensure the SELECT policy allows users to see matches they're involved in
DROP POLICY IF EXISTS "Users can view matches they participate in" ON matches;

CREATE POLICY "Users can view matches they participate in"
  ON matches
  FOR SELECT
  TO public
  USING (
    -- Allow if user is a participant or tournament organizer
    auth.uid() = player1_id 
    OR auth.uid() = player2_id 
    OR EXISTS (
      SELECT 1 FROM tournaments t 
      WHERE t.id = matches.tournament_id 
      AND t.organizer_id = auth.uid()
    )
  );