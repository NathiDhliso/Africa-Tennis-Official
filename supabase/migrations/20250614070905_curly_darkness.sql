/*
  # Add Manually Start Tournament Function

  1. New Features
    - Add function to manually start a tournament
    - Update tournament status to registration_closed
    - Generate tournament bracket

  2. Security
    - Maintain existing RLS policies
*/

-- Create a function to manually start a tournament
CREATE OR REPLACE FUNCTION public.manually_start_tournament(tournament_id UUID)
RETURNS JSONB AS $$
DECLARE
  tournament_record RECORD;
  result JSONB;
BEGIN
  -- Get tournament details
  SELECT * INTO tournament_record 
  FROM tournaments 
  WHERE id = tournament_id;
  
  -- Exit if tournament doesn't exist
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tournament not found'
    );
  END IF;
  
  -- Check if tournament is already in progress or completed
  IF tournament_record.status = 'in_progress' OR tournament_record.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tournament is already in progress or completed'
    );
  END IF;
  
  -- Update tournament status to registration_closed
  UPDATE tournaments
  SET status = 'registration_closed'
  WHERE id = tournament_id;
  
  -- Generate the tournament bracket
  BEGIN
    PERFORM generate_tournament_bracket(tournament_id);
    result := jsonb_build_object(
      'success', true,
      'message', 'Tournament started successfully'
    );
  EXCEPTION
    WHEN OTHERS THEN
      result := jsonb_build_object(
        'success', false,
        'error', SQLERRM
      );
  END;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;