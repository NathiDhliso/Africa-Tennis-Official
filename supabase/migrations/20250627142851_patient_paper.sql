/*
  # Fix Match Creation RLS Policy

  1. Security Changes
    - Update INSERT policy for matches table to properly allow match creation
    - Ensure authenticated users can create matches where they are player1_id
    - Maintain security by preventing users from creating matches as other players

  2. Policy Updates
    - Drop existing INSERT policy
    - Create new simplified INSERT policy for match creation
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create matches" ON matches;

-- Create a new INSERT policy that allows users to create matches where they are player1_id
CREATE POLICY "Users can create matches as player1"
  ON matches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player1_id);