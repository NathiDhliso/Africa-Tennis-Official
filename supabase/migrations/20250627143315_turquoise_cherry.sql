/*
  # Fix match creation RLS policy

  1. Security Changes
    - Update INSERT policy for matches table to allow authenticated users to create matches
    - Allow users to create matches where they are either player1 or player2
    - Ensure proper authorization for match creation

  2. Policy Updates
    - Drop existing restrictive INSERT policy
    - Create new policy that allows match creation for authenticated users
    - Maintain security by ensuring users can only create matches they participate in
*/

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create matches as player1" ON matches;

-- Create a new INSERT policy that allows authenticated users to create matches
-- where they are either player1 or player2
CREATE POLICY "Authenticated users can create matches they participate in"
  ON matches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = player1_id OR auth.uid() = player2_id
  );