/*
  # Fix matches table INSERT policy

  1. Policy Changes
    - Update the INSERT policy for matches table to allow authenticated users to create matches where they are player1
    - This allows users to create matches and invite other players as player2
  
  2. Security
    - Maintains security by ensuring users can only create matches where they are the first player
    - Other existing policies for SELECT and UPDATE remain unchanged
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create matches they participate in" ON matches;

-- Create a new INSERT policy that allows users to create matches where they are player1
CREATE POLICY "Authenticated users can create matches as player1"
  ON matches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player1_id);