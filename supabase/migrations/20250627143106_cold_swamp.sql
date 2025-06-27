/*
  # Fix matches table INSERT policy

  1. Security Policy Update
    - Drop the existing INSERT policy that uses incorrect `uid()` function
    - Create new INSERT policy using correct `auth.uid()` function
    - Ensure authenticated users can create matches where they are player1

  This fixes the RLS violation error when creating new matches.
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create matches as player1" ON matches;

-- Create the corrected INSERT policy using auth.uid()
CREATE POLICY "Users can create matches as player1"
  ON matches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player1_id);