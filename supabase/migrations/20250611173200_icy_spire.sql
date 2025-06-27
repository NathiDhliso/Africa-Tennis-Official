-- Function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, elo_rating, matches_played, matches_won, skill_level)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    1200,
    0,
    0,
    'beginner'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to calculate ELO rating
CREATE OR REPLACE FUNCTION public.calculate_elo_rating(
  player1_id UUID,
  player2_id UUID,
  winner_id UUID
)
RETURNS VOID AS $$
DECLARE
  player1_rating INTEGER;
  player2_rating INTEGER;
  player1_expected DECIMAL;
  player2_expected DECIMAL;
  player1_score DECIMAL;
  player2_score DECIMAL;
  player1_new_rating INTEGER;
  player2_new_rating INTEGER;
  k_factor INTEGER := 32;
BEGIN
  -- Get current ratings
  SELECT elo_rating INTO player1_rating FROM profiles WHERE user_id = player1_id;
  SELECT elo_rating INTO player2_rating FROM profiles WHERE user_id = player2_id;
  
  -- Calculate expected scores
  player1_expected := 1.0 / (1.0 + POWER(10, (player2_rating - player1_rating) / 400.0));
  player2_expected := 1.0 / (1.0 + POWER(10, (player1_rating - player2_rating) / 400.0));
  
  -- Determine actual scores
  IF winner_id = player1_id THEN
    player1_score := 1.0;
    player2_score := 0.0;
  ELSIF winner_id = player2_id THEN
    player1_score := 0.0;
    player2_score := 1.0;
  ELSE
    -- Draw
    player1_score := 0.5;
    player2_score := 0.5;
  END IF;
  
  -- Calculate new ratings
  player1_new_rating := player1_rating + ROUND(k_factor * (player1_score - player1_expected));
  player2_new_rating := player2_rating + ROUND(k_factor * (player2_score - player2_expected));
  
  -- Ensure ratings don't go below 100
  player1_new_rating := GREATEST(player1_new_rating, 100);
  player2_new_rating := GREATEST(player2_new_rating, 100);
  
  -- Update profiles
  UPDATE profiles 
  SET 
    elo_rating = player1_new_rating,
    matches_played = matches_played + 1,
    matches_won = matches_won + CASE WHEN winner_id = player1_id THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE user_id = player1_id;
  
  UPDATE profiles 
  SET 
    elo_rating = player2_new_rating,
    matches_played = matches_played + 1,
    matches_won = matches_won + CASE WHEN winner_id = player2_id THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE user_id = player2_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically update ELO when a match is completed
CREATE OR REPLACE FUNCTION public.handle_match_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate ELO if the match status changed to 'completed' and has a winner
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.winner_id IS NOT NULL THEN
    PERFORM public.calculate_elo_rating(NEW.player1_id, NEW.player2_id, NEW.winner_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update ELO ratings when a match is completed
CREATE TRIGGER on_match_completed
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION public.handle_match_completion();

-- Function to get tournament standings for round robin
CREATE OR REPLACE FUNCTION public.get_tournament_standings(tournament_id_param UUID)
RETURNS TABLE (
  player_id UUID,
  username TEXT,
  elo_rating INTEGER,
  matches_played BIGINT,
  matches_won BIGINT,
  points DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    p.elo_rating,
    COUNT(m.id) as matches_played,
    COUNT(CASE WHEN m.winner_id = p.user_id THEN 1 END) as matches_won,
    COUNT(CASE WHEN m.winner_id = p.user_id THEN 1 END) * 1.0 + 
    COUNT(CASE WHEN m.winner_id IS NULL AND m.status = 'completed' THEN 1 END) * 0.5 as points
  FROM tournament_participants tp
  JOIN profiles p ON tp.player_id = p.user_id
  LEFT JOIN matches m ON (m.player1_id = p.user_id OR m.player2_id = p.user_id) 
    AND m.tournament_id = tournament_id_param
  WHERE tp.tournament_id = tournament_id_param
  GROUP BY p.user_id, p.username, p.elo_rating
  ORDER BY points DESC, p.elo_rating DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;