// Import database types from supabase
import type { Json, Database } from './supabase';

// Direct database table types
export type DbMatch = Database['public']['Tables']['matches']['Row'];
export type DbMatchInsert = Database['public']['Tables']['matches']['Insert'];
export type DbMatchUpdate = Database['public']['Tables']['matches']['Update'];

export type DbProfile = Database['public']['Tables']['profiles']['Row'];
export type DbProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type DbProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type DbTournament = Database['public']['Tables']['tournaments']['Row'];
export type DbTournamentInsert = Database['public']['Tables']['tournaments']['Insert'];
export type DbTournamentUpdate = Database['public']['Tables']['tournaments']['Update'];

export type DbTournamentParticipant = Database['public']['Tables']['tournament_participants']['Row'];
export type DbTournamentParticipantInsert = Database['public']['Tables']['tournament_participants']['Insert'];

export type DbMatchEvent = Database['public']['Tables']['match_events']['Row'];
export type DbMatchEventInsert = Database['public']['Tables']['match_events']['Insert'];

export type DbMatchHighlight = Database['public']['Tables']['match_highlights']['Row'];
export type DbMatchHighlightInsert = Database['public']['Tables']['match_highlights']['Insert'];

// Score types for tennis matches
export interface MatchScore {
  sets: Array<{ player1_games: number; player2_games: number }>;
  current_game: { player1_points: number; player2_points: number };
  server_id: string;
  is_tiebreak: boolean;
}

// Type guards for safe type conversion
export function isMatchScore(score: Json | null): score is MatchScore & Json {
  if (!score || typeof score !== 'object' || Array.isArray(score)) return false;
  const s = score as Record<string, unknown>;
  return Array.isArray(s.sets) && 
         typeof s.current_game === 'object' && 
         typeof s.server_id === 'string' &&
         typeof s.is_tiebreak === 'boolean';
}

export function scoreToString(score: Json | null): string {
  if (!score) return 'No score';
  if (typeof score === 'string') return score;
  if (isMatchScore(score)) {
    return score.sets.map(set => `${set.player1_games}-${set.player2_games}`).join(', ');
  }
  return 'Invalid score';
}

// Extended types with joined data (for queries with relationships)
export interface MatchWithPlayers extends DbMatch {
  player1?: { username: string; elo_rating: number | null; user_id: string } | null;
  player2?: { username: string; elo_rating: number | null; user_id: string } | null;
  tournament?: { id: string; name: string } | null;
  winner?: { username: string; user_id: string } | null;
}

export interface TournamentWithOrganizer extends DbTournament {
  organizer?: { username: string; user_id: string } | null;
}

export interface TournamentParticipantWithPlayer extends DbTournamentParticipant {
  player: { username: string; elo_rating: number | null; user_id: string };
}

// Application-level types (for components)
export interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  phone?: string;
  location?: string;
  bio?: string;
  profilePicture?: string | null;
  skillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  rating?: number;
  matchesPlayed?: number;
  matchesWon?: number;
  isOnboarded?: boolean;
}

// Application interface that aligns with database
export interface Profile {
  user_id: string;
  username: string;
  elo_rating: number;
  matches_played: number;
  matches_won: number;
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  bio: string | null;
  profile_picture_url: string | null;
  created_at: string;
  updated_at: string;
  player_style_analysis: string | null;
}

// Extended match status to cover additional workflow states
export type MatchStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'cancelled';

// Match interface for application use
export interface Match {
  id: string;
  tournament_id: string | null;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  /**
   * Score can be either a formatted string (e.g. "6-4, 7-5") or a JSON object
   * containing set-by-set details. Components check for both shapes.
   */
  score: string | MatchScore | null;
  status: MatchStatus;
  date: string;
  location: string;
  match_number: number | null;
  round: number | null;
  summary: string | null;
  created_at: string | null;
  updated_at: string | null;

  /* ------------------------------------
   *  Additional, non-DB fields used in UI
   * ---------------------------------- */
  challengerId?: string; // alias for player1_id in UI components
  challengedId?: string; // alias for player2_id in UI components
  challengerScore?: number | null;
  challengedScore?: number | null;
  detailedStatsId?: string | null;
  scoreDisplay?: string | null;
  tournamentId?: string | null; // camel-case alias

  // Extended relational data
  player1?: { username: string; elo_rating: number | null; user_id: string; profile_picture_url?: string | null };
  player2?: { username: string; elo_rating: number | null; user_id: string; profile_picture_url?: string | null };
  winnerProfile?: { username: string; user_id: string };
  tournament?: { id: string; name: string };
  winner?: { username: string; user_id: string } | string | null;
}

// Tournament status type
export type TournamentStatus = 'registration_open' | 'registration_closed' | 'in_progress' | 'completed';

// Tournament format type
export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss';

// Tournament interface for application use
export interface Tournament {
  id: string;
  name: string;
  description: string;
  organizer_id: string;
  start_date: string;
  end_date: string;
  // Camel-case aliases used in some components
  startDate?: string;
  endDate?: string;
  format: TournamentFormat;
  location: string;
  max_participants: number;
  // Camel-case alias
  maxParticipants?: number;
  status: TournamentStatus | 'registration_closed';
  brackets_generated: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  entry_fee: number | null;
  prize_pool: number | null;
  // Extended fields
  organizer?: { username: string; user_id: string };
  participantCount?: number;
  isRegistered?: boolean;
}

// Tournament participant interface
export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  player_id: string;
  seed: number | null;
  registered_at: string;
  // Extended fields
  player: { username: string; elo_rating: number | null; user_id: string };
}

// Conversion functions from database types to application types
export function dbMatchToMatch(dbMatch: MatchWithPlayers): Match {
  return {
    id: dbMatch.id,
    tournament_id: dbMatch.tournament_id,
    player1_id: dbMatch.player1_id,
    player2_id: dbMatch.player2_id,
    winner_id: dbMatch.winner_id,
    score: scoreToString(dbMatch.score),
    status: (dbMatch.status as MatchStatus) || 'pending',
    date: dbMatch.date,
    location: dbMatch.location,
    match_number: dbMatch.match_number,
    round: dbMatch.round,
    summary: dbMatch.summary,
    created_at: dbMatch.created_at,
    updated_at: dbMatch.updated_at,
    player1: dbMatch.player1 || undefined,
    player2: dbMatch.player2 || undefined,
    tournament: dbMatch.tournament || undefined,
    winner: dbMatch.winner || undefined,
  };
}

export function dbTournamentToTournament(dbTournament: TournamentWithOrganizer): Tournament {
  return {
    id: dbTournament.id,
    name: dbTournament.name,
    description: dbTournament.description,
    organizer_id: dbTournament.organizer_id,
    start_date: dbTournament.start_date,
    end_date: dbTournament.end_date,
    format: (dbTournament.format as TournamentFormat) || 'single_elimination',
    location: dbTournament.location,
    max_participants: dbTournament.max_participants,
    status: (dbTournament.status as TournamentStatus) || 'registration_open',
    brackets_generated: dbTournament.brackets_generated,
    created_at: dbTournament.created_at,
    updated_at: dbTournament.updated_at,
    entry_fee: dbTournament.entry_fee,
    prize_pool: dbTournament.prize_pool,
    organizer: dbTournament.organizer || undefined,
  };
}

export function dbProfileToProfile(dbProfile: DbProfile): Profile {
  return {
    user_id: dbProfile.user_id,
    username: dbProfile.username,
    elo_rating: dbProfile.elo_rating || 1200,
    matches_played: dbProfile.matches_played || 0,
    matches_won: dbProfile.matches_won || 0,
    skill_level: (dbProfile.skill_level as Profile['skill_level']) || 'beginner',
    bio: dbProfile.bio,
    profile_picture_url: dbProfile.profile_picture_url,
    created_at: dbProfile.created_at || new Date().toISOString(),
    updated_at: dbProfile.updated_at || new Date().toISOString(),
    player_style_analysis: dbProfile.player_style_analysis,
  };
}

export function dbTournamentParticipantToTournamentParticipant(
  dbParticipant: TournamentParticipantWithPlayer
): TournamentParticipant {
  return {
    id: dbParticipant.id,
    tournament_id: dbParticipant.tournament_id,
    player_id: dbParticipant.player_id,
    seed: dbParticipant.seed,
    registered_at: dbParticipant.registered_at || new Date().toISOString(),
    player: dbParticipant.player,
  };
}

// Legacy types for backward compatibility (will be gradually phased out)
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
    video_url?: string;
  };
}

export interface MatchStatistics {
  possession: { user: number; opponent: number };
  shots: { user: number; opponent: number };
  aces: { user: number; opponent: number };
  doubleFaults: { user: number; opponent: number };
  breakPoints: {
    user: { won: number; total: number };
    opponent: { won: number; total: number };
  };
  winners: { user: number; opponent: number };
  unforcedErrors: { user: number; opponent: number };
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

export interface PlayerProfile {
  user_id: string;
  username: string;
  elo_rating: number | null;
  profile_picture_url?: string | null;
}

// Video processing types
export interface VideoProcessingOptions {
  enableAI: boolean;
  analysisFps: number;
  maxFrames: number;
  duration: number;
}

export interface VideoAnalysisResult {
  success: boolean;
  data?: {
    videoUrl: string;
    analysisData: unknown;
    insights: string[];
  };
  error?: string;
}