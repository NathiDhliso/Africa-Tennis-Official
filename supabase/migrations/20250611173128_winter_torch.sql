-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE profiles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  elo_rating INTEGER DEFAULT 1200,
  matches_played INTEGER DEFAULT 0,
  matches_won INTEGER DEFAULT 0,
  skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')) DEFAULT 'beginner',
  bio TEXT,
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create matches table
CREATE TABLE matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID,
  player1_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  player2_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  winner_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  score TEXT,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  date TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_players CHECK (player1_id != player2_id)
);

-- Create tournaments table
CREATE TABLE tournaments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  organizer_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  format TEXT CHECK (format IN ('single_elimination', 'double_elimination', 'round_robin', 'swiss')) DEFAULT 'single_elimination',
  max_participants INTEGER NOT NULL CHECK (max_participants > 0),
  status TEXT CHECK (status IN ('registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled')) DEFAULT 'registration_open',
  location TEXT NOT NULL,
  entry_fee DECIMAL(10,2),
  prize_pool DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date > start_date)
);

-- Create tournament_participants table
CREATE TABLE tournament_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  seed INTEGER,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, player_id)
);

-- Create match_events table for detailed match tracking
CREATE TABLE match_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT CHECK (event_type IN ('move', 'capture', 'check', 'checkmate', 'draw', 'resignation', 'timeout')) NOT NULL,
  player_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  score_snapshot JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create clubs table
CREATE TABLE clubs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  location TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create club_members table
CREATE TABLE club_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('member', 'admin', 'moderator')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

-- Create followers table for social features
CREATE TABLE followers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  followed_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, followed_id),
  CONSTRAINT no_self_follow CHECK (follower_id != followed_id)
);

-- Add foreign key constraint for tournament matches
ALTER TABLE matches ADD CONSTRAINT fk_tournament 
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_elo_rating ON profiles(elo_rating DESC);
CREATE INDEX idx_matches_player1 ON matches(player1_id);
CREATE INDEX idx_matches_player2 ON matches(player2_id);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_date ON matches(date);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_tournaments_organizer ON tournaments(organizer_id);
CREATE INDEX idx_tournaments_start_date ON tournaments(start_date);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX idx_tournament_participants_player ON tournament_participants(player_id);
CREATE INDEX idx_match_events_match ON match_events(match_id);
CREATE INDEX idx_match_events_timestamp ON match_events(timestamp);
CREATE INDEX idx_club_members_club ON club_members(club_id);
CREATE INDEX idx_club_members_user ON club_members(user_id);
CREATE INDEX idx_followers_follower ON followers(follower_id);
CREATE INDEX idx_followers_followed ON followers(followed_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();