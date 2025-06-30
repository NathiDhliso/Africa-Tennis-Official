// Import Json type from supabase
import type { Json } from './supabase';

// Database-aligned types
export type DatabaseProfile = {
  user_id: string;
  username: string;
  bio: string | null;
  created_at: string | null;
  elo_rating: number | null;
  matches_played: number | null;
  matches_won: number | null;
  player_style_analysis: string | null;
  profile_picture_url: string | null;
  skill_level: string | null;
  updated_at: string | null;
};

export interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  phone?: string;
  location?: string;
  bio?: string;
  profilePicture?: string | null;
  skillLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
  rating?: number;
  matchesPlayed?: number;
  matchesWon?: number;
  isOnboarded?: boolean;
}

export interface TennisScore {
  player1_sets: number;
  player2_sets: number;
  player1_games: number;
  player2_games: number;
  player1_points: number;
  player2_points: number;
  current_set: number;
  current_game: number;
  serving_player?: 'player1' | 'player2';
}

// Database-aligned Match type
export type DatabaseMatch = {
  id: string;
  tournament_id: string | null;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  score: Json | null; // Json type from database
  status: string | null;
  date: string;
  location: string;
  match_number: number | null;
  round: number | null;
  summary: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export interface Match {
  id: string;
  challengerId?: string;
  challengedId?: string;
  tournament_id?: string | null;
  player1_id?: string;
  player2_id?: string;
  player1?: { username: string; elo_rating: number | null };
  player2?: { username: string; elo_rating: number | null };
  date: string;
  location: string;
  status?: 'pending' | 'confirmed' | 'completed' | 'declined' | 'in_progress' | 'cancelled' | null;
  challengerScore?: number;
  challengedScore?: number;
  winner?: string | null; // winnerId
  winner_id?: string | null;
  winnerProfile?: { username: string } | null;
  createdAt?: string | null;
  created_at?: string | null;
  detailedStatsId?: string; // Link to detailed statistics
  score?: TennisScore | Json | null; // Can be either TennisScore interface or Json from database
  scoreDisplay?: string | null; // Formatted score string for display
  tournamentId?: string | null; // ID of the tournament this match belongs to
  match_number?: number | null;
  round?: number | null;
  summary?: string | null;
  updated_at?: string | null;
}

// Database-aligned Tournament type
export type DatabaseTournament = {
  id: string;
  name: string;
  description: string;
  organizer_id: string;
  start_date: string;
  end_date: string;
  format: string | null;
  location: string;
  max_participants: number;
  status: string | null;
  brackets_generated: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  entry_fee: number | null;
  prize_pool: number | null;
};

export interface Tournament {
  id: string;
  name: string;
  description: string;
  organizerId?: string;
  organizer_id?: string;
  registrationDeadline?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  format?: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss' | string | null;
  location: string;
  maxParticipants?: number;
  max_participants?: number;
  umpireId?: string;
  status?: 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | string | null;
  winnerId?: string;
  createdAt?: string;
  created_at?: string | null;
  updated_at?: string | null;
  participantCount?: number;
  isRegistered?: boolean;
  brackets_generated?: boolean | null;
  entry_fee?: number | null;
  prize_pool?: number | null;
  organizer?: { username: string };
}

// Database-aligned TournamentParticipant type
export type DatabaseTournamentParticipant = {
  id: string;
  tournament_id: string;
  player_id: string;
  seed: number | null;
  registered_at: string | null;
};

export interface TournamentParticipant {
  id: string;
  tournamentId?: string;
  tournament_id?: string;
  playerId?: string;
  player_id?: string;
  seed?: number | null;
  registeredAt?: string | null;
  registered_at?: string | null;
  player?: { username: string; elo_rating: number | null };
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  player1Id?: string;
  player2Id?: string;
  winnerId?: string;
  score?: string;
  status: 'pending' | 'in_progress' | 'completed';
  scheduledDate?: string;
  location: string;
  umpireId: string;
  detailedStatsId?: string; // Link to detailed statistics
}

// Database-aligned VideoHighlight type
export type DatabaseVideoHighlight = {
  id: string;
  match_id: string | null;
  created_by: string;
  video_url: string;
  type: string;
  timestamp: string;
  description: string | null;
  created_at: string | null;
};

export interface VideoHighlight {
  id: string;
  match_id: string;
  matchId?: string;
  created_by: string;
  video_url: string;
  type: string;
  timestamp: string;
  description: string | null;
  created_at: string | null;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ThemeContextType {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

// New interfaces for detailed match statistics
export interface MatchEvent {
  id: string;
  matchId: string;
  timestamp: number;
  type: 'point_won' | 'ace' | 'double_fault' | 'winner' | 'unforced_error' | 'break_point' | 'game_won' | 'set_won' | 'match_start' | 'match_end';
  playerId: string;
  description: string;
  scoreSnapshot: {
    player1Sets: number[];
    player2Sets: number[];
    player1Games: number;
    player2Games: number;
    player1Points: number;
    player2Points: number;
    currentSet: number;
    servingPlayer: 'player1' | 'player2';
  };
  metadata?: {
    isBreakPoint?: boolean;
    isSetPoint?: boolean;
    isMatchPoint?: boolean;
    shotType?: string;
    courtPosition?: string;
  };
}

export interface DetailedMatchStatistics {
  id: string;
  matchId: string;
  player1Id: string;
  player2Id: string;
  startTime: number;
  endTime?: number;
  duration?: number; // in minutes
  
  // Court coverage and possession
  possession: {
    player1: number; // percentage
    player2: number; // percentage
  };
  
  // Shot statistics
  shots: {
    player1: number;
    player2: number;
  };
  
  // Serving statistics
  aces: {
    player1: number;
    player2: number;
  };
  
  doubleFaults: {
    player1: number;
    player2: number;
  };
  
  // Break point statistics
  breakPoints: {
    player1: { won: number; total: number };
    player2: { won: number; total: number };
  };
  
  // Shot quality
  winners: {
    player1: number;
    player2: number;
  };
  
  unforcedErrors: {
    player1: number;
    player2: number;
  };
  
  // Game flow
  gamesWon: {
    player1: number;
    player2: number;
  };
  
  setsWon: {
    player1: number;
    player2: number;
  };
  
  // Additional metrics
  longestRally?: number;
  totalRallies?: number;
  averageRallyLength?: number;
  
  // Time-based statistics
  timeInPoints?: number; // total time spent in actual point play
  timeInBreaks?: number; // time between points/games
  
  // Momentum tracking
  momentumShifts?: Array<{
    timestamp: number;
    playerId: string;
    reason: string;
  }>;
}

export interface MatchTimeline {
  time: string;
  event: string;
  player: string;
  description: string;
  type: 'point' | 'game' | 'set' | 'break' | 'ace' | 'winner' | 'error';
}

export interface MatchHighlight {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'ace' | 'winner' | 'break_point' | 'rally' | 'comeback';
  videoUrl?: string;
}