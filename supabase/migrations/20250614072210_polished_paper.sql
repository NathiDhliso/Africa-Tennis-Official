/*
  # Fix Tennis Scoring System

  1. Changes
    - Update calculate_tennis_score function to properly handle tennis scoring (0, 15, 30, 40, AD)
    - Fix server tracking and display
    - Add proper tiebreak handling
    - Ensure proper score progression

  2. Security
    - Maintain existing RLS policies
*/

-- Update the calculate_tennis_score function to fix scoring issues
CREATE OR REPLACE FUNCTION calculate_tennis_score(
  match_id UUID,
  winning_player_id UUID,
  point_type TEXT
) RETURNS JSONB AS $$
DECLARE
  match_record RECORD;
  current_score JSONB;
  player1_id UUID;
  player2_id UUID;
  player1_is_winner BOOLEAN;
  player2_is_winner BOOLEAN;
  player1_points TEXT;
  player2_points TEXT;
  player1_games INTEGER;
  player2_games INTEGER;
  current_set INTEGER;
  is_tiebreak BOOLEAN;
  server_id UUID;
  new_server_id UUID;
  sets_array JSONB;
  current_set_obj JSONB;
  game_won BOOLEAN := FALSE;
  set_won BOOLEAN := FALSE;
  match_ended BOOLEAN := FALSE;
  event_description TEXT;
  point_value TEXT;
BEGIN
  -- Get the current match data
  SELECT * INTO match_record FROM matches WHERE id = match_id;
  
  -- Set variables from match data
  player1_id := match_record.player1_id;
  player2_id := match_record.player2_id;
  current_score := match_record.score;
  
  -- Determine if player1 or player2 won the point
  player1_is_winner := (winning_player_id = player1_id);
  player2_is_winner := (winning_player_id = player2_id);
  
  -- Extract current score components
  player1_points := current_score->'current_game'->>'player1';
  player2_points := current_score->'current_game'->>'player2';
  sets_array := current_score->'sets';
  is_tiebreak := (current_score->>'is_tiebreak')::BOOLEAN;
  server_id := (current_score->>'server_id')::UUID;
  
  -- If server_id is null, set it to player1_id by default
  IF server_id IS NULL THEN
    server_id := player1_id;
    current_score := jsonb_set(current_score, '{server_id}', to_jsonb(player1_id));
  END IF;
  
  -- Calculate current set number (0-based index)
  current_set := jsonb_array_length(sets_array);
  
  -- Initialize current set object if it doesn't exist
  IF current_set = 0 OR NOT sets_array->0 ? 'player1_games' THEN
    current_set_obj := jsonb_build_object(
      'player1_games', 0,
      'player2_games', 0,
      'games', jsonb_build_array()
    );
    sets_array := jsonb_set(sets_array, '{0}', current_set_obj);
    current_score := jsonb_set(current_score, '{sets}', sets_array);
  END IF;
  
  -- Get current games in the set
  player1_games := (sets_array->0->>'player1_games')::INTEGER;
  player2_games := (sets_array->0->>'player2_games')::INTEGER;
  
  -- Handle scoring based on whether we're in a tiebreak or regular game
  IF is_tiebreak THEN
    -- Tiebreak scoring (1, 2, 3, etc.)
    IF player1_is_winner THEN
      player1_points := (player1_points::INTEGER + 1)::TEXT;
      event_description := 'Point won by player 1 in tiebreak';
    ELSE
      player2_points := (player2_points::INTEGER + 1)::TEXT;
      event_description := 'Point won by player 2 in tiebreak';
    END IF;
    
    -- Check if tiebreak is won (first to 7 with 2 point lead)
    IF (player1_points::INTEGER >= 7 AND player1_points::INTEGER - player2_points::INTEGER >= 2) THEN
      -- Player 1 wins the tiebreak and the set
      player1_games := player1_games + 1;
      game_won := TRUE;
      set_won := TRUE;
      event_description := 'Player 1 won the tiebreak and the set';
      
      -- Reset for next set
      player1_points := '0';
      player2_points := '0';
      is_tiebreak := FALSE;
      
      -- Switch server for the next set
      new_server_id := CASE WHEN server_id = player1_id THEN player2_id ELSE player1_id END;
      
    ELSIF (player2_points::INTEGER >= 7 AND player2_points::INTEGER - player1_points::INTEGER >= 2) THEN
      -- Player 2 wins the tiebreak and the set
      player2_games := player2_games + 1;
      game_won := TRUE;
      set_won := TRUE;
      event_description := 'Player 2 won the tiebreak and the set';
      
      -- Reset for next set
      player1_points := '0';
      player2_points := '0';
      is_tiebreak := FALSE;
      
      -- Switch server for the next set
      new_server_id := CASE WHEN server_id = player1_id THEN player2_id ELSE player1_id END;
    ELSE
      -- Tiebreak continues, switch server every 2 points (after first point)
      IF (player1_points::INTEGER + player2_points::INTEGER) % 2 = 1 THEN
        new_server_id := CASE WHEN server_id = player1_id THEN player2_id ELSE player1_id END;
      ELSE
        new_server_id := server_id;
      END IF;
    END IF;
    
  ELSE
    -- Regular game scoring (0, 15, 30, 40, AD)
    IF player1_is_winner THEN
      -- Player 1 won the point
      CASE player1_points
        WHEN '0' THEN player1_points := '15';
        WHEN '15' THEN player1_points := '30';
        WHEN '30' THEN player1_points := '40';
        WHEN '40' THEN
          IF player2_points = '40' THEN
            -- Deuce to Advantage
            player1_points := 'AD';
          ELSE
            -- Player 1 wins the game
            player1_games := player1_games + 1;
            player1_points := '0';
            player2_points := '0';
            game_won := TRUE;
            event_description := 'Player 1 won the game';
            
            -- Switch server for next game
            new_server_id := CASE WHEN server_id = player1_id THEN player2_id ELSE player1_id END;
          END IF;
        WHEN 'AD' THEN
          -- Player 1 wins the game after having advantage
          player1_games := player1_games + 1;
          player1_points := '0';
          player2_points := '0';
          game_won := TRUE;
          event_description := 'Player 1 won the game from advantage';
          
          -- Switch server for next game
          new_server_id := CASE WHEN server_id = player1_id THEN player2_id ELSE player1_id END;
      END CASE;
      
      -- If player2 had advantage and player1 won the point, go back to deuce
      IF player2_points = 'AD' THEN
        player1_points := '40';
        player2_points := '40';
        event_description := 'Back to deuce';
      END IF;
      
    ELSE
      -- Player 2 won the point
      CASE player2_points
        WHEN '0' THEN player2_points := '15';
        WHEN '15' THEN player2_points := '30';
        WHEN '30' THEN player2_points := '40';
        WHEN '40' THEN
          IF player1_points = '40' THEN
            -- Deuce to Advantage
            player2_points := 'AD';
          ELSE
            -- Player 2 wins the game
            player2_games := player2_games + 1;
            player1_points := '0';
            player2_points := '0';
            game_won := TRUE;
            event_description := 'Player 2 won the game';
            
            -- Switch server for next game
            new_server_id := CASE WHEN server_id = player1_id THEN player2_id ELSE player1_id END;
          END IF;
        WHEN 'AD' THEN
          -- Player 2 wins the game after having advantage
          player2_games := player2_games + 1;
          player1_points := '0';
          player2_points := '0';
          game_won := TRUE;
          event_description := 'Player 2 won the game from advantage';
          
          -- Switch server for next game
          new_server_id := CASE WHEN server_id = player1_id THEN player2_id ELSE player1_id END;
      END CASE;
      
      -- If player1 had advantage and player2 won the point, go back to deuce
      IF player1_points = 'AD' THEN
        player1_points := '40';
        player2_points := '40';
        event_description := 'Back to deuce';
      END IF;
    END IF;
  END IF;
  
  -- If a game was won, check if a set was won or if we need to start a tiebreak
  IF game_won THEN
    -- Check if player1 won the set (6 games with 2 game lead, or 7-6 via tiebreak)
    IF player1_games >= 6 AND (player1_games - player2_games >= 2 OR (player1_games = 7 AND player2_games = 6)) THEN
      set_won := TRUE;
      event_description := 'Player 1 won the set';
      
      -- Check if match is won (best of 3 sets)
      IF jsonb_array_length(sets_array) >= 1 THEN
        -- Count sets won by player1
        DECLARE
          player1_sets_won INTEGER := 0;
          i INTEGER;
        BEGIN
          FOR i IN 0..jsonb_array_length(sets_array)-1 LOOP
            IF (sets_array->i->>'player1_games')::INTEGER > (sets_array->i->>'player2_games')::INTEGER THEN
              player1_sets_won := player1_sets_won + 1;
            END IF;
          END LOOP;
          
          -- Add current set
          player1_sets_won := player1_sets_won + 1;
          
          -- Check if player1 has won 2 sets (best of 3)
          IF player1_sets_won >= 2 THEN
            match_ended := TRUE;
            event_description := 'Player 1 won the match';
          END IF;
        END;
      END IF;
      
    -- Check if player2 won the set (6 games with 2 game lead, or 7-6 via tiebreak)
    ELSIF player2_games >= 6 AND (player2_games - player1_games >= 2 OR (player2_games = 7 AND player1_games = 6)) THEN
      set_won := TRUE;
      event_description := 'Player 2 won the set';
      
      -- Check if match is won (best of 3 sets)
      IF jsonb_array_length(sets_array) >= 1 THEN
        -- Count sets won by player2
        DECLARE
          player2_sets_won INTEGER := 0;
          i INTEGER;
        BEGIN
          FOR i IN 0..jsonb_array_length(sets_array)-1 LOOP
            IF (sets_array->i->>'player2_games')::INTEGER > (sets_array->i->>'player1_games')::INTEGER THEN
              player2_sets_won := player2_sets_won + 1;
            END IF;
          END LOOP;
          
          -- Add current set
          player2_sets_won := player2_sets_won + 1;
          
          -- Check if player2 has won 2 sets (best of 3)
          IF player2_sets_won >= 2 THEN
            match_ended := TRUE;
            event_description := 'Player 2 won the match';
          END IF;
        END;
      END IF;
      
    -- Check if we need to start a tiebreak (6-6)
    ELSIF player1_games = 6 AND player2_games = 6 THEN
      is_tiebreak := TRUE;
      event_description := 'Tiebreak started at 6-6';
      
      -- Insert tiebreak_started event
      INSERT INTO match_events (
        match_id, 
        event_type, 
        player_id, 
        description, 
        score_snapshot
      ) VALUES (
        match_id,
        'tiebreak_started',
        server_id,
        'Tiebreak started at 6-6',
        current_score
      );
    END IF;
  END IF;
  
  -- Update the score object
  current_score := jsonb_set(current_score, '{current_game}', jsonb_build_object('player1', player1_points, 'player2', player2_points));
  current_score := jsonb_set(current_score, '{is_tiebreak}', to_jsonb(is_tiebreak));
  
  -- Update server_id if it changed
  IF new_server_id IS NOT NULL THEN
    current_score := jsonb_set(current_score, '{server_id}', to_jsonb(new_server_id));
  END IF;
  
  -- If a game was won, update the set information
  IF game_won THEN
    -- Update games in current set
    sets_array := jsonb_set(sets_array, '{0,player1_games}', to_jsonb(player1_games));
    sets_array := jsonb_set(sets_array, '{0,player2_games}', to_jsonb(player2_games));
    
    -- Add game to games array
    DECLARE
      games_array JSONB;
      new_game JSONB;
    BEGIN
      games_array := sets_array->0->'games';
      new_game := jsonb_build_object(
        'player1_points', player1_is_winner::INTEGER,
        'player2_points', player2_is_winner::INTEGER,
        'server_id', server_id
      );
      games_array := games_array || new_game;
      sets_array := jsonb_set(sets_array, '{0,games}', games_array);
    END;
    
    current_score := jsonb_set(current_score, '{sets}', sets_array);
    
    -- Insert game_won event
    INSERT INTO match_events (
      match_id, 
      event_type, 
      player_id, 
      description, 
      score_snapshot
    ) VALUES (
      match_id,
      'game_won',
      winning_player_id,
      event_description,
      current_score
    );
  END IF;
  
  -- If a set was won, start a new set
  IF set_won AND NOT match_ended THEN
    -- Create a new set object
    current_set_obj := jsonb_build_object(
      'player1_games', 0,
      'player2_games', 0,
      'games', jsonb_build_array()
    );
    
    -- Add the completed set to the sets array
    sets_array := sets_array || current_set_obj;
    current_score := jsonb_set(current_score, '{sets}', sets_array);
    
    -- Insert set_won event
    INSERT INTO match_events (
      match_id, 
      event_type, 
      player_id, 
      description, 
      score_snapshot
    ) VALUES (
      match_id,
      'set_won',
      winning_player_id,
      event_description,
      current_score
    );
  END IF;
  
  -- If match ended, update match status and winner
  IF match_ended THEN
    UPDATE matches 
    SET 
      status = 'completed',
      winner_id = winning_player_id
    WHERE id = match_id;
    
    -- Insert match_ended event
    INSERT INTO match_events (
      match_id, 
      event_type, 
      player_id, 
      description, 
      score_snapshot
    ) VALUES (
      match_id,
      'match_ended',
      winning_player_id,
      event_description,
      current_score
    );
  END IF;
  
  -- Determine point type description
  CASE point_type
    WHEN 'ace' THEN point_value := 'Ace';
    WHEN 'double_fault' THEN point_value := 'Double fault';
    WHEN 'winner' THEN point_value := 'Winner';
    WHEN 'forced_error' THEN point_value := 'Forced error';
    WHEN 'unforced_error' THEN point_value := 'Unforced error';
    ELSE point_value := 'Point';
  END CASE;
  
  -- Insert point_won event (if not a game/set/match event)
  IF NOT game_won THEN
    INSERT INTO match_events (
      match_id, 
      event_type, 
      player_id, 
      description, 
      score_snapshot,
      metadata
    ) VALUES (
      match_id,
      'point_won',
      winning_player_id,
      point_value || ' by ' || 
        CASE 
          WHEN winning_player_id = player1_id THEN 'Player 1' 
          ELSE 'Player 2' 
        END,
      current_score,
      jsonb_build_object('point_type', point_type)
    );
  END IF;
  
  -- Update the match score
  UPDATE matches SET score = current_score WHERE id = match_id;
  
  RETURN current_score;
END;
$$ LANGUAGE plpgsql;