import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Trophy, 
  AlertTriangle,
  Gavel,
  Info,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import apiClient from '../lib/aws';
import '../styles/pages/umpire.css';
import { useAuthStore } from '../stores/authStore';
import MatchScoring from './matches/MatchScoring';
import LoadingSpinner from './LoadingSpinner';
import { Link } from 'react-router-dom';
import type { Database } from '../types/database';

type Tournament = Database['public']['Tables']['tournaments']['Row'];
type Match = Database['public']['Tables']['matches']['Row'] & {
  player1?: { username: string; elo_rating: number }
  player2?: { username: string; elo_rating: number }
};

interface MatchScore {
  sets: Array<{
    player1_games: number;
    player2_games: number;
    games: Array<{
      player1_points: number;
      player2_points: number;
      server_id: string;
    }>;
  }>;
  current_game: {
    player1: string;
    player2: string;
  };
  server_id: string;
  is_tiebreak: boolean;
}

interface MatchScoreHistory {
  score: MatchScore;
  timestamp: number;
  action: string;
}

interface ErrorState {
  visible: boolean;
  title: string;
  message: string;
  details?: string;
  type: 'error' | 'warning' | 'info';
}

const UmpirePage: React.FC = () => {
  const { user } = useAuthStore();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [matchScore, setMatchScore] = useState<MatchScore | null>(null);
  const [scoreHistory, setScoreHistory] = useState<MatchScoreHistory[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [showStartConfirmation, setShowStartConfirmation] = useState(false);
  const [showEndMatchConfirmation, setShowEndMatchConfirmation] = useState(false);
  const [tournamentToStart, setTournamentToStart] = useState<Tournament | null>(null);
  const [detailedStatsId, setDetailedStatsId] = useState<string | null>(null);
  const [player1Profile, setPlayer1Profile] = useState<any>(null);
  const [player2Profile, setPlayer2Profile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pointType, setPointType] = useState<string>('normal');
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [error, setError] = useState<ErrorState>({
    visible: false,
    title: '',
    message: '',
    details: '',
    type: 'error'
  });

  useEffect(() => {
    loadTournaments();
    loadRecentMatches();
  }, [user]);

  useEffect(() => {
    if (selectedTournament) {
      loadMatches();
    }
  }, [selectedTournament]);

  const loadTournaments = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const userId = user.id;
      
      // Fetch tournaments where user is organizer, umpire, or participant
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .or(`organizer_id.eq.${userId},status.eq.registration_closed,status.eq.in_progress`)
        
      if (error) throw error;
      
      setTournaments(data || []);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentMatches = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!matches_player1_id_fkey(username, elo_rating),
          player2:profiles!matches_player2_id_fkey(username, elo_rating)
        `)
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .eq('status', 'in_progress')
        .order('date', { ascending: true })
        .limit(5);
        
      if (error) throw error;
      setRecentMatches(data || []);
    } catch (error) {
      console.error('Error loading recent matches:', error);
    }
  };

  const loadMatches = async () => {
    if (!selectedTournament) return;
    
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!matches_player1_id_fkey(username, elo_rating),
          player2:profiles!matches_player2_id_fkey(username, elo_rating)
        `)
        .eq('tournament_id', selectedTournament.id)
        .order('date', { ascending: true });
        
      if (error) throw error;
      setMatches(data || []);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  const handleStartTournamentClick = (tournament: Tournament) => {
    setTournamentToStart(tournament);
    setShowStartConfirmation(true);
  };

  const handleStartTournament = async () => {
    if (!tournamentToStart) return;
    
    try {
      // Call the AWS Lambda function to generate the tournament bracket
      const response = await apiClient.generateTournamentBracket(tournamentToStart.id);
      
      if (!response.success) {
        throw new Error(response.error || 'We encountered an issue starting the tournament. Please try again or contact support if the problem persists.');
      }
      
      // Refresh tournaments and matches
      await loadTournaments();
      if (selectedTournament?.id === tournamentToStart.id) {
        await loadMatches();
      }
      
      setShowStartConfirmation(false);
      setTournamentToStart(null);
    } catch (error: any) {
      console.error('Error starting tournament:', error);
      
      // Set user-friendly error message
      setError({
        visible: true,
        title: 'Tournament Start Failed',
        message: getTournamentErrorMessage(error.message),
        details: error.message,
        type: 'error'
      });
      
      setShowStartConfirmation(false);
    }
  };

  // Function to get user-friendly error messages
  const getTournamentErrorMessage = (errorMessage: string): string => {
    if (errorMessage.includes('Tournament needs at least 2 participants')) {
      return 'This tournament needs at least 2 registered participants before it can be started.';
    }
    
    if (errorMessage.includes('not in registration_closed status')) {
      return 'The tournament must be in "Registration Closed" status before generating the bracket.';
    }
    
    if (errorMessage.includes('already in progress')) {
      return 'This tournament is already in progress.';
    }
    
    if (errorMessage.includes('already completed')) {
      return 'This tournament has already been completed.';
    }
    
    // Default message
    return 'We encountered an issue starting the tournament. Please try again or contact support if the problem persists.';
  };

  const handleStartMatch = async (match: Match) => {
    if (!match.player1_id || !match.player2_id) return;
    
    try {
      // Update match status to in_progress
      const { error } = await supabase
        .from('matches')
        .update({ status: 'in_progress' })
        .eq('id', match.id);
        
      if (error) throw error;
      
      // Fetch player profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', [match.player1_id, match.player2_id]);
        
      if (profiles) {
        setPlayer1Profile(profiles.find(p => p.user_id === match.player1_id));
        setPlayer2Profile(profiles.find(p => p.user_id === match.player2_id));
      }
      
      setActiveMatch(match);
    } catch (error) {
      console.error('Error starting match:', error);
    }
  };

  const handleBackToMatches = () => {
    setActiveMatch(null);
    setMatchScore(null);
    setScoreHistory([]);
    setCanUndo(false);
    setDetailedStatsId(null);
    setPlayer1Profile(null);
    setPlayer2Profile(null);
    
    // Refresh data
    loadTournaments();
    loadRecentMatches();
    if (selectedTournament) {
      loadMatches();
    }
  };

  const dismissError = () => {
    setError({...error, visible: false});
  };

  const getMatchStatus = (match: Match) => {
    if (match.status === 'completed') return 'Completed';
    if (match.status === 'in_progress') return 'In Progress';
    if (!match.player1_id || !match.player2_id) return 'Waiting for Players';
    return 'Ready to Start';
  };

  const getStatusColor = (match: Match) => {
    if (match.status === 'completed') return 'var(--success-green)';
    if (match.status === 'in_progress') return 'var(--quantum-cyan)';
    if (!match.player1_id || !match.player2_id) return 'var(--warning-orange)';
    return 'var(--text-muted)';
  };

  const getUserRole = (tournament: Tournament) => {
    if (!user) return '';
    
    if (tournament.organizer_id === user.id) return 'Organizer';
    return '';
  };

  // Show match details if one is selected
  if (activeMatch) {
    return (
      <MatchScoring 
        match={activeMatch as any} 
        onBack={handleBackToMatches} 
      />
    );
  }

  // Main Dashboard View
  return (
    <div className="umpire-page">
      <div className="umpire-container">
        <div className="umpire-header">
          <h1 className="umpire-title">
            <Gavel size={32} />
            Live Scoring Dashboard
          </h1>
          <p className="umpire-subtitle">
            Manage live tournament matches and scoring for your tournaments
          </p>
        </div>

        {/* Error Message */}
        {error.visible && (
          <div className={`bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4 mb-6 ${
            error.type === 'error' ? 'border-error-pink' : 
            error.type === 'warning' ? 'border-warning-orange' : 'border-quantum-cyan'
          }`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {error.type === 'error' && <AlertTriangle className="h-5 w-5 text-error-pink" />}
                {error.type === 'warning' && <AlertTriangle className="h-5 w-5 text-warning-orange" />}
                {error.type === 'info' && <Info className="h-5 w-5 text-quantum-cyan" />}
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-medium mb-1 ${
                  error.type === 'error' ? 'text-error-pink' : 
                  error.type === 'warning' ? 'text-warning-orange' : 'text-quantum-cyan'
                }`}>
                  {error.title}
                </h3>
                <p className="text-text-standard mb-2">{error.message}</p>
                {error.details && (
                  <details className="mt-2">
                    <summary className="text-sm text-text-subtle cursor-pointer">Technical details</summary>
                    <p className="mt-1 text-sm text-text-subtle bg-bg-elevated p-2 rounded">{error.details}</p>
                  </details>
                )}
                <div className="mt-3">
                  <button 
                    onClick={dismissError}
                    className="text-sm font-medium px-3 py-1 rounded-md bg-bg-elevated hover:bg-hover-bg"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Access to Matches */}
        {recentMatches.length > 0 && (
          <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-standard)' }}>
              Your Active Matches
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentMatches.map(match => (
                <div 
                  key={match.id} 
                  className="bg-bg-elevated p-4 rounded-lg border border-glass-border hover:border-quantum-cyan transition-all cursor-pointer"
                  onClick={() => handleStartMatch(match)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium px-2 py-1 rounded-full" style={{ 
                      backgroundColor: 'rgba(0, 212, 255, 0.1)',
                      color: 'var(--quantum-cyan)'
                    }}>
                      In Progress
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {new Date(match.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-center mb-2 font-medium" style={{ color: 'var(--text-standard)' }}>
                    {match.player1?.username} vs {match.player2?.username}
                  </div>
                  <button 
                    className="w-full btn btn-primary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartMatch(match);
                    }}
                  >
                    <Gavel size={14} className="mr-1" />
                    Continue Scoring
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link to="/matches" className="text-quantum-cyan hover:underline text-sm">
                View all your matches
              </Link>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="large" text="Loading tournaments..." />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="umpire-empty-state">
            <div className="umpire-empty-content">
              <Trophy size={64} className="umpire-empty-icon" />
              <h3 className="umpire-empty-title">
                No Active Tournaments
              </h3>
              <p className="umpire-empty-description">
                You don't have any tournaments ready for live scoring. You can only see tournaments where you are:
              </p>
              <ul className="umpire-empty-list">
                <li>• The tournament organizer</li>
                <li>• The assigned umpire</li>
                <li>• A registered participant</li>
              </ul>
              <p className="umpire-empty-note">
                Tournaments must have closed registration to appear here.
              </p>
              <div className="mt-6">
                <Link to="/tournaments" className="btn btn-primary">
                  <Trophy size={16} className="mr-2" />
                  View All Tournaments
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Tournament Selection */}
            <div className="umpire-tournament-section">
              <h2 className="umpire-section-title">Your Tournaments</h2>
              <div className="umpire-tournament-grid">
                {tournaments.map(tournament => {
                  const userRole = getUserRole(tournament);
                  return (
                    <div
                      key={tournament.id}
                      className={`umpire-tournament-card ${selectedTournament?.id === tournament.id ? 'selected' : ''}`}
                      onClick={() => setSelectedTournament(tournament)}
                    >
                      <div className="umpire-tournament-header">
                        <h3 className="umpire-tournament-name">{tournament.name}</h3>
                        <div 
                          className="umpire-tournament-status"
                          style={{ 
                            backgroundColor: tournament.status === 'in_progress' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 149, 0, 0.2)',
                            color: tournament.status === 'in_progress' ? 'var(--quantum-cyan)' : 'var(--warning-orange)'
                          }}
                        >
                          {tournament.status === 'in_progress' ? 'Live' : 'Ready to Start'}
                        </div>
                      </div>
                      
                      <p className="umpire-tournament-location">{tournament.location}</p>
                      
                      {userRole && (
                        <div className="umpire-tournament-role">
                          <span className="role-badge" style={{
                            backgroundColor: userRole === 'Organizer' ? 'rgba(0, 255, 170, 0.2)' : 'rgba(0, 212, 255, 0.2)',
                            color: userRole === 'Organizer' ? 'var(--success-green)' : 'var(--quantum-cyan)'
                          }}>
                            Your Role: {userRole}
                          </span>
                        </div>
                      )}
                      
                      {tournament.status === 'registration_closed' && tournament.organizer_id === user?.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartTournamentClick(tournament);
                          }}
                          className="umpire-start-tournament-btn"
                        >
                          <Play size={16} />
                          Start Tournament
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Matches List */}
            {selectedTournament && (
              <div className="umpire-matches-section">
                <h2 className="umpire-section-title">
                  <Users size={24} />
                  Tournament Matches
                </h2>
                
                {matches.length === 0 ? (
                  <div className="umpire-empty-state">
                    <div className="umpire-empty-content">
                      <Users size={64} className="umpire-empty-icon" />
                      <h3 className="umpire-empty-title">
                        No Matches Available
                      </h3>
                      <p className="umpire-empty-description">
                        There are no matches available for this tournament yet.
                      </p>
                      <div className="mt-4">
                        <Link to={`/tournaments/${selectedTournament.id}`} className="btn btn-primary">
                          <Trophy size={16} className="mr-2" />
                          View Tournament Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="umpire-matches-grid">
                    {matches.map(match => (
                      <div key={match.id} className="umpire-match-card">
                        <div className="umpire-match-header">
                          <div className="umpire-match-round">
                            Match {match.id.slice(-4)}
                          </div>
                          <div 
                            className="umpire-match-status"
                            style={{ color: getStatusColor(match) }}
                          >
                            {getMatchStatus(match)}
                          </div>
                        </div>
                        
                        <div className="umpire-match-players">
                          <div className="umpire-match-player">
                            {match.player1?.username || 'TBD'}
                          </div>
                          <div className="umpire-match-vs">vs</div>
                          <div className="umpire-match-player">
                            {match.player2?.username || 'TBD'}
                          </div>
                        </div>

                        {match.score && (
                          <div className="umpire-match-score">
                            Final Score: {typeof match.score === 'string' ? match.score : 'Score available'}
                          </div>
                        )}

                        {match.status === 'pending' && match.player1_id && match.player2_id && (
                          <button
                            onClick={() => handleStartMatch(match)}
                            className="umpire-match-btn"
                          >
                            <Play size={16} />
                            Umpire Match
                          </button>
                        )}
                        
                        {match.status === 'in_progress' && (
                          <button
                            onClick={() => handleStartMatch(match)}
                            className="umpire-match-btn"
                          >
                            <Gavel size={16} />
                            Continue Scoring
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Start Tournament Confirmation Modal */}
        {showStartConfirmation && tournamentToStart && (
          <div className="modal-backdrop fade-in">
            <div className="modal scale-in">
              <div className="text-center mb-6">
                <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: 'var(--warning-orange)' }} />
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-standard)' }}>
                  Start Tournament
                </h2>
                <p style={{ color: 'var(--text-subtle)' }}>
                  This will lock the tournament schedule and begin live scoring. This action cannot be undone.
                </p>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium" style={{ color: 'var(--warning-orange)' }}>
                    Tournament: {tournamentToStart.name}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowStartConfirmation(false);
                    setTournamentToStart(null);
                  }}
                  className="btn btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartTournament}
                  className="btn btn-primary btn-glare flex-1"
                >
                  <Play size={16} />
                  Start Tournament
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UmpirePage;