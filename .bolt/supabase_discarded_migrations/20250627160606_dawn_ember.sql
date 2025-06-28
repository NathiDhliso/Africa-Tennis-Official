/*
  # Fix Tournament Bracket Generation

  1. Changes
    - Update generate_tournament_bracket function to work with any number of participants (minimum 2)
    - Improve error handling and validation
    - Return detailed JSON responses with success/error information
    - Fix issues with tournament registration closing

  2. Security
    - Maintain existing RLS policies
*/

-- Update the generate_tournament_bracket function to return JSON with detailed status
CREATE OR REPLACE FUNCTION public.generate_tournament_bracket(tournament_id UUID)
RETURNS JSONB AS $$
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
  participant_count INTEGER;
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
      'error', 'Tournament not found',
      'code', 'NOT_FOUND'
    );
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
  IF tournament_record.status = 'in_progress' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tournament is already in progress',
      'code', 'ALREADY_IN_PROGRESS'
    );
  END IF;
  
  IF tournament_record.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tournament is already completed',
      'code', 'ALREADY_COMPLETED'
    );
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
  
  -- Get participant count
  SELECT COUNT(*) INTO participant_count
  FROM tournament_participants
  WHERE tournament_id = tournament_id;
  
  -- Check if we have enough participants
  IF participant_count < 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tournament needs at least 2 participants',
      'code', 'INSUFFICIENT_PARTICIPANTS',
      'participant_count', participant_count
    );
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
        num_first_round_matches INTEGER := GREATEST(1, FLOOR(num_participants / 2));
        seeded_positions INTEGER[];
        match_number INTEGER := 1;
      BEGIN
        -- Generate seeded positions
        seeded_positions := generate_seeded_positions(num_participants * 2);
        
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
        num_first_round_matches INTEGER := GREATEST(1, FLOOR(num_participants / 2));
        seeded_positions INTEGER[];
        match_number INTEGER := 1;
      BEGIN
        -- Generate seeded positions
        seeded_positions := generate_seeded_positions(num_participants * 2);
        
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
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unsupported tournament format: ' || tournament_format,
        'code', 'UNSUPPORTED_FORMAT'
      );
  END CASE;
  
  -- If matches were created, update tournament status to in_progress
  IF match_count > 0 THEN
    UPDATE tournaments
    SET 
      status = 'in_progress',
      brackets_generated = TRUE
    WHERE id = tournament_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Tournament bracket generated successfully',
      'matches_created', match_count,
      'participant_count', participant_count
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to create any matches',
      'code', 'NO_MATCHES_CREATED',
      'participant_count', participant_count
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update the manually_start_tournament function to handle tournaments with fewer than max participants
CREATE OR REPLACE FUNCTION public.manually_start_tournament(tournament_id UUID)
RETURNS JSONB AS $$
DECLARE
  tournament_record RECORD;
  participant_count INTEGER;
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
      'error', 'Tournament not found',
      'code', 'NOT_FOUND'
    );
  END IF;
  
  -- Check if tournament is already in progress or completed
  IF tournament_record.status = 'in_progress' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tournament is already in progress',
      'code', 'ALREADY_IN_PROGRESS'
    );
  END IF;
  
  IF tournament_record.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tournament is already completed',
      'code', 'ALREADY_COMPLETED'
    );
  END IF;
  
  -- Check if there are enough participants
  SELECT COUNT(*) INTO participant_count
  FROM tournament_participants
  WHERE tournament_id = tournament_id;
  
  IF participant_count < 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tournament needs at least 2 participants',
      'code', 'INSUFFICIENT_PARTICIPANTS',
      'participant_count', participant_count
    );
  END IF;
  
  -- Update tournament status to registration_closed
  UPDATE tournaments
  SET status = 'registration_closed'
  WHERE id = tournament_id;
  
  -- Generate the tournament bracket
  result := generate_tournament_bracket(tournament_id);
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update the check_tournament_full_and_generate_bracket function to handle edge cases
CREATE OR REPLACE FUNCTION public.check_tournament_full_and_generate_bracket()
RETURNS TRIGGER AS $$
DECLARE
  participant_count INTEGER;
  max_participants INTEGER;
  tournament_status TEXT;
  bracket_result JSONB;
BEGIN
  -- Get the tournament details
  SELECT 
    t.max_participants, 
    t.status,
    COUNT(tp.id) AS participant_count
  INTO 
    max_participants, 
    tournament_status,
    participant_count
  FROM 
    tournaments t
  LEFT JOIN 
    tournament_participants tp ON t.id = tp.tournament_id
  WHERE 
    t.id = NEW.tournament_id
  GROUP BY 
    t.id;

  -- Check if the tournament is now full and still in registration_open status
  IF participant_count >= max_participants AND tournament_status = 'registration_open' THEN
    -- Update tournament status to registration_closed
    UPDATE tournaments
    SET status = 'registration_closed'
    WHERE id = NEW.tournament_id;
    
    -- Generate the tournament bracket based on format
    bracket_result := generate_tournament_bracket(NEW.tournament_id);
    
    -- Log the result
    IF (bracket_result->>'success')::BOOLEAN THEN
      RAISE NOTICE 'Tournament bracket generated successfully: %', bracket_result->>'message';
    ELSE
      RAISE NOTICE 'Failed to generate tournament bracket: %', bracket_result->>'error';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;