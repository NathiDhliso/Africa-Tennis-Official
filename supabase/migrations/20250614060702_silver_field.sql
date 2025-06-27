/*
  # Auto-Generate Tournament Bracket When Full

  1. New Features
    - Add trigger to automatically generate tournament bracket when max participants is reached
    - Add function to handle bracket generation logic
    - Update tournament status to registration_closed when full

  2. Security
    - Maintain existing RLS policies
*/

-- Create a function to check if a tournament is full and generate brackets if needed
CREATE OR REPLACE FUNCTION public.check_tournament_full_and_generate_bracket()
RETURNS TRIGGER AS $$
DECLARE
  participant_count INTEGER;
  max_participants INTEGER;
  tournament_status TEXT;
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
    PERFORM generate_tournament_bracket(NEW.tournament_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to check if a tournament is full after a new participant registers
CREATE TRIGGER tournament_full_check
AFTER INSERT ON tournament_participants
FOR EACH ROW
EXECUTE FUNCTION public.check_tournament_full_and_generate_bracket();

-- Create a function to generate tournament brackets
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
  
  -- Exit if tournament doesn't exist or isn't in registration_closed status
  IF NOT FOUND OR tournament_record.status != 'registration_closed' THEN
    RAISE NOTICE 'Tournament not found or not in registration_closed status';
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
    SET status = 'in_progress'
    WHERE id = tournament_id;
    
    RAISE NOTICE 'Generated % matches for tournament %', match_count, tournament_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Helper function to generate seeded positions for a bracket
CREATE OR REPLACE FUNCTION generate_seeded_positions(num_positions INTEGER)
RETURNS INTEGER[] AS $$
DECLARE
  positions INTEGER[];
BEGIN
  IF num_positions <= 1 THEN 
    RETURN ARRAY[1];
  END IF;
  
  positions := array_fill(0, ARRAY[num_positions]);
  positions[1] := 1; -- Top seed
  positions[num_positions] := 2; -- Second seed
  
  IF num_positions <= 2 THEN 
    RETURN positions;
  END IF;
  
  -- Place 3rd and 4th seeds
  positions[num_positions/2] := 3;
  positions[num_positions/2 + 1] := 4;
  
  -- Fill remaining positions
  DECLARE
    current_seed INTEGER := 5;
  BEGIN
    FOR i IN 1..num_positions LOOP
      IF positions[i] = 0 THEN
        positions[i] := current_seed;
        current_seed := current_seed + 1;
      END IF;
    END LOOP;
  END;
  
  RETURN positions;
END;
$$ LANGUAGE plpgsql;

-- Add a column to track if brackets have been generated
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS brackets_generated BOOLEAN DEFAULT FALSE;

-- Add a column to track round number in matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 1;

-- Add a column to track match number in matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_number INTEGER;