-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Matches policies
CREATE POLICY "Users can view matches they participate in" ON matches
  FOR SELECT USING (
    auth.uid() = player1_id OR 
    auth.uid() = player2_id OR
    EXISTS (
      SELECT 1 FROM tournaments t 
      WHERE t.id = matches.tournament_id 
      AND t.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Users can create matches" ON matches
  FOR INSERT WITH CHECK (
    auth.uid() = player1_id OR auth.uid() = player2_id
  );

CREATE POLICY "Players and organizers can update matches" ON matches
  FOR UPDATE USING (
    auth.uid() = player1_id OR 
    auth.uid() = player2_id OR
    EXISTS (
      SELECT 1 FROM tournaments t 
      WHERE t.id = matches.tournament_id 
      AND t.organizer_id = auth.uid()
    )
  );

-- Tournaments policies
CREATE POLICY "Anyone can view tournaments" ON tournaments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tournaments" ON tournaments
  FOR INSERT WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update their tournaments" ON tournaments
  FOR UPDATE USING (auth.uid() = organizer_id);

CREATE POLICY "Organizers can delete their tournaments" ON tournaments
  FOR DELETE USING (auth.uid() = organizer_id);

-- Tournament participants policies
CREATE POLICY "Anyone can view tournament participants" ON tournament_participants
  FOR SELECT USING (true);

CREATE POLICY "Users can register for tournaments" ON tournament_participants
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can unregister from tournaments" ON tournament_participants
  FOR DELETE USING (
    auth.uid() = player_id OR
    EXISTS (
      SELECT 1 FROM tournaments t 
      WHERE t.id = tournament_participants.tournament_id 
      AND t.organizer_id = auth.uid()
    )
  );

-- Match events policies
CREATE POLICY "Users can view match events for their matches" ON match_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches m 
      WHERE m.id = match_events.match_id 
      AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
  );

CREATE POLICY "Players can create match events" ON match_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m 
      WHERE m.id = match_events.match_id 
      AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
    )
  );

-- Clubs policies
CREATE POLICY "Anyone can view clubs" ON clubs
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create clubs" ON clubs
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Club owners can update their clubs" ON clubs
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Club owners can delete their clubs" ON clubs
  FOR DELETE USING (auth.uid() = owner_id);

-- Club members policies
CREATE POLICY "Anyone can view club members" ON club_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join clubs" ON club_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave clubs or owners can remove members" ON club_members
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM clubs c 
      WHERE c.id = club_members.club_id 
      AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Club owners and admins can update member roles" ON club_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM clubs c 
      WHERE c.id = club_members.club_id 
      AND c.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM club_members cm 
      WHERE cm.club_id = club_members.club_id 
      AND cm.user_id = auth.uid() 
      AND cm.role = 'admin'
    )
  );

-- Followers policies
CREATE POLICY "Users can view all followers" ON followers
  FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON followers
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others" ON followers
  FOR DELETE USING (auth.uid() = follower_id);