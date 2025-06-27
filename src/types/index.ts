export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  phone?: string;
  location?: string;
  bio?: string;
  profilePicture?: string | null;
  skillLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  rating: number;
  matchesPlayed: number;
  matchesWon: number;
  isOnboarded: boolean;
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

export interface Match {
  id: string;
  challengerId: string;
  challengedId: string;
  player1?: { username: string; elo_rating: number };
  player2?: { username: string; elo_rating: number };
  date: string;
  location: string;
  status: 'pending' | 'confirmed' | 'completed' | 'declined' | 'in_progress' | 'cancelled';
  challengerScore?: number;
  challengedScore?: number;
  winner?: string; // winnerId
  winnerProfile?: { username: string };
  createdAt: string;
  detailedStatsId?: string; // Link to detailed statistics
  score?: TennisScore; // Proper tennis score object
  scoreDisplay?: string | null; // Formatted score string for display
  tournamentId?: string; // ID of the tournament this match belongs to
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  organizerId: string;
  registrationDeadline: string;
  startDate: string;
  endDate: string;
  format: 'single_elimination' | 'double_elimination' | 'round_robin';
  location: string;
  maxParticipants: number;
  umpireId: string;
  status: 'registration_open' | 'registration_closed' | 'in_progress' | 'completed';
  winnerId?: string;
  createdAt: string;
  participantCount?: number;
  isRegistered?: boolean;
}

export interface TournamentParticipant {
  id: string;
  tournamentId: string;
  playerId: string;
  seed?: number;
  registeredAt: string;
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