/*
  # Fix Tournament Bracket Generation

  1. Changes
    - Add function to manually close registration and generate bracket
    - Update tournament status to registration_closed before generating bracket
    - Fix the check in the generate_tournament_bracket function

  2. Security
    - Maintain existing RLS policies
*/

-- Update the generate_tournament_bracket function to work with registration_open status
CREATE OR REPLACE FUNCTION public.generate_tournament_bracket(tournament_id UUID)
RETURNS VOID AS $$
DECLARE
  tournament_record RECORD;
  participants RECORD;
  seeded_participants RECORD;
  match_count INTEGER := 0;
  match_date TIMESTAMP WITH TIME ZONE;
  tournament_format TEXT;
  match_data JSONB;
  participant_array JSONB;
  seeded_positions INTEGER[];
BEGIN
  -- Get tournament details
  SELECT * INTO tournament_record 
  FROM tournaments 
  WHERE id = tournament_id;
  
  -- Exit if tournament doesn't exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found';
    RETURN;
  END IF;
  
  -- First update the tournament status to registration_closed if it's still open
  IF tournament_record.status = 'registration_open' THEN
    UPDATE tournaments
    SET status = 'registration_closed'
    WHERE id = tournament_id;
    
    -- Refresh tournament record
    SELECT * INTO tournament_record 
    FROM tournaments 
    WHERE id = tournament_id;
  END IF;
  
  -- Exit if tournament is already in progress or completed
  IF tournament_record.status = 'in_progress' OR tournament_record.status = 'completed' THEN
    RAISE EXCEPTION 'Tournament is already in progress or completed';
    RETURN;
  END IF;
  
  tournament_format := tournament_record.format;
  match_date := tournament_record.start_date;
  
  -- Get participants and seed them by ELO rating
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', tp.id,
        'player_id', tp.player_id,
        'seed', ROW_NUMBER() OVER (ORDER BY p.elo_rating DESC)
      )
    ) INTO participant_array
  FROM 
    tournament_participants tp
  JOIN 
    profiles p ON tp.player_id = p.user_id
  WHERE 
    tp.tournament_id = tournament_id;
  
  -- Check if we have enough participants
  IF jsonb_array_length(participant_array) < 2 THEN
    RAISE EXCEPTION 'Tournament needs at least 2 participants';
    RETURN;
  END IF;
  
  -- Update seed numbers in tournament_participants table
  FOR seeded_participants IN 
    SELECT * FROM jsonb_array_elements(participant_array) AS p
  LOOP
    UPDATE tournament_participants
    SET seed = (seeded_participants->>'seed')::INTEGER
    WHERE id = (seeded_participants->>'id')::UUID;
  END LOOP;
  
  -- Generate matches based on tournament format
  CASE tournament_format
    WHEN 'single_elimination' THEN
      -- Calculate the number of participants and rounds
      DECLARE
        num_participants INTEGER := jsonb_array_length(participant_array);
        num_rounds INTEGER := CEILING(LOG(2, num_participants));
        num_first_round_matches INTEGER := 2 ^ (num_rounds - 1);
        num_byes INTEGER := num_first_round_matches * 2 - num_participants;
        seeded_positions INTEGER[];
        match_number INTEGER := 1;
      BEGIN
        -- Generate seeded positions
        seeded_positions := generate_seeded_positions(num_first_round_matches * 2);
        
        -- Create first round matches with seeded participants
        FOR i IN 0..(num_first_round_matches-1) LOOP
          DECLARE
            position1 INTEGER := seeded_positions[i*2+1];
            position2 INTEGER := seeded_positions[i*2+2];
            player1_id UUID := NULL;
            player2_id UUID := NULL;
            player1_record JSONB := NULL;
            player2_record JSONB := NULL;
            match_status TEXT := 'pending';
          BEGIN
            -- Find the players for these positions
            IF position1 <= num_participants THEN
              SELECT jsonb_array_elements(participant_array) INTO player1_record
              FROM jsonb_array_elements(participant_array) p
              WHERE (p->>'seed')::INTEGER = position1
              LIMIT 1;
              
              player1_id := (player1_record->>'player_id')::UUID;
            END IF;
            
            IF position2 <= num_participants THEN
              SELECT jsonb_array_elements(participant_array) INTO player2_record
              FROM jsonb_array_elements(participant_array) p
              WHERE (p->>'seed')::INTEGER = position2
              LIMIT 1;
              
              player2_id := (player2_record->>'player_id')::UUID;
            END IF;
            
            -- If one player is NULL, the other gets a bye (handled in later rounds)
            IF player1_id IS NULL OR player2_id IS NULL THEN
              CONTINUE;
            END IF;
            
            -- Calculate match date (staggered throughout the tournament)
            match_date := tournament_record.start_date + ((i % 4) * INTERVAL '2 hours');
            
            -- Insert the match
            INSERT INTO matches (
              tournament_id,
              player1_id,
              player2_id,
              status,
              date,
              location,
              round,
              match_number
            ) VALUES (
              tournament_id,
              player1_id,
              player2_id,
              match_status,
              match_date,
              tournament_record.location,
              1,
              match_number
            );
            
            match_number := match_number + 1;
            match_count := match_count + 1;
          END;
        END LOOP;
      END;
      
    WHEN 'double_elimination' THEN
      -- For now, just create the winners bracket like single elimination
      -- In a real implementation, you'd also set up the losers bracket structure
      DECLARE
        num_participants INTEGER := jsonb_array_length(participant_array);
        num_rounds INTEGER := CEILING(LOG(2, num_participants));
        num_first_round_matches INTEGER := 2 ^ (num_rounds - 1);
        num_byes INTEGER := num_first_round_matches * 2 - num_participants;
        seeded_positions INTEGER[];
        match_number INTEGER := 1;
      BEGIN
        -- Generate seeded positions
        seeded_positions := generate_seeded_positions(num_first_round_matches * 2);
        
        -- Create first round matches with seeded participants
        FOR i IN 0..(num_first_round_matches-1) LOOP
          DECLARE
            position1 INTEGER := seeded_positions[i*2+1];
            position2 INTEGER := seeded_positions[i*2+2];
            player1_id UUID := NULL;
            player2_id UUID := NULL;
            player1_record JSONB := NULL;
            player2_record JSONB := NULL;
            match_status TEXT := 'pending';
          BEGIN
            -- Find the players for these positions
            IF position1 <= num_participants THEN
              SELECT jsonb_array_elements(participant_array) INTO player1_record
              FROM jsonb_array_elements(participant_array) p
              WHERE (p->>'seed')::INTEGER = position1
              LIMIT 1;
              
              player1_id := (player1_record->>'player_id')::UUID;
            END IF;
            
            IF position2 <= num_participants THEN
              SELECT jsonb_array_elements(participant_array) INTO player2_record
              FROM jsonb_array_elements(participant_array) p
              WHERE (p->>'seed')::INTEGER = position2
              LIMIT 1;
              
              player2_id := (player2_record->>'player_id')::UUID;
            END IF;
            
            -- If one player is NULL, the other gets a bye (handled in later rounds)
            IF player1_id IS NULL OR player2_id IS NULL THEN
              CONTINUE;
            END IF;
            
            -- Calculate match date (staggered throughout the tournament)
            match_date := tournament_record.start_date + ((i % 4) * INTERVAL '2 hours');
            
            -- Insert the match
            INSERT INTO matches (
              tournament_id,
              player1_id,
              player2_id,
              status,
              date,
              location,
              round,
              match_number
            ) VALUES (
              tournament_id,
              player1_id,
              player2_id,
              match_status,
              match_date,
              tournament_record.location,
              1,
              match_number
            );
            
            match_number := match_number + 1;
            match_count := match_count + 1;
          END;
        END LOOP;
      END;
      
    WHEN 'round_robin' THEN
      DECLARE
        num_participants INTEGER := jsonb_array_length(participant_array);
        match_number INTEGER := 1;
      BEGIN
        -- Generate a match for each pair of participants
        FOR i IN 0..(num_participants-2) LOOP
          FOR j IN (i+1)..(num_participants-1) LOOP
            DECLARE
              player1_record JSONB;
              player2_record JSONB;
              player1_id UUID;
              player2_id UUID;
            BEGIN
              -- Get player records
              SELECT jsonb_array_elements(participant_array) INTO player1_record
              FROM jsonb_array_elements(participant_array) p
              WHERE (p->>'seed')::INTEGER = i+1
              LIMIT 1;
              
              SELECT jsonb_array_elements(participant_array) INTO player2_record
              FROM jsonb_array_elements(participant_array) p
              WHERE (p->>'seed')::INTEGER = j+1
              LIMIT 1;
              
              player1_id := (player1_record->>'player_id')::UUID;
              player2_id := (player2_record->>'player_id')::UUID;
              
              -- Calculate match date (staggered throughout the tournament)
              match_date := tournament_record.start_date + 
                            (FLOOR(match_number / 4) * INTERVAL '2 hours') + 
                            (FLOOR(match_number / 8) * INTERVAL '1 day');
              
              -- Insert the match
              INSERT INTO matches (
                tournament_id,
                player1_id,
                player2_id,
                status,
                date,
                location,
                round,
                match_number
              ) VALUES (
                tournament_id,
                player1_id,
                player2_id,
                'pending',
                match_date,
                tournament_record.location || ' - Court ' || ((match_number % 3) + 1),
                1, -- All matches are considered round 1 in round robin
                match_number
              );
              
              match_number := match_number + 1;
              match_count := match_count + 1;
            END;
          END LOOP;
        END LOOP;
      END;
      
    ELSE
      RAISE EXCEPTION 'Unsupported tournament format: %', tournament_format;
  END CASE;
  
  -- If matches were created, update tournament status to in_progress
  IF match_count > 0 THEN
    UPDATE tournaments
    SET 
      status = 'in_progress',
      brackets_generated = TRUE
    WHERE id = tournament_id;
    
    RAISE NOTICE 'Generated % matches for tournament %', match_count, tournament_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

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