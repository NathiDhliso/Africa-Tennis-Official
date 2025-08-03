import React from 'react';
import { 
  Play, 
  Trophy, 
  AlertTriangle,
  Gavel,
  Info,
  Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import '../styles/pages/umpire.css';
import { useAuthStore } from '../stores/authStore';
import MatchScoring from '../components/matches/MatchScoring';
import LoadingSpinner from '../components/LoadingSpinner';
import { Link } from 'react-router-dom';
import type { Database } from '../types/supabase-generated';
import { scoreToString, Match } from '../types';

type Tournament = {
  id: string;
  name: string;
  status: string | null;
  organizer_id: string;
  start_date: string;
  end_date: string;
  location: string;
};
type DatabaseMatch = Database['public']['Tables']['matches']['Row'] & {
  player1?: { user_id: string; username: string; elo_rating: number | null } | null;
  player2?: { user_id: string; username: string; elo_rating: number | null } | null;
  tournament?: { id: string; name: string } | null;
};

type ErrorState = {
  visible: boolean;
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
};

const UmpirePage: React.FC = () => {
  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<ErrorState>({ visible: false, title: '', message: '', type: 'error' });
  const [selectedMatch, setSelectedMatch] = React.useState<Match | null>(null);
  const [isLoadingTournaments, setIsLoadingTournaments] = React.useState(false);
  const [isLoadingMatches, setIsLoadingMatches] = React.useState(false);
  const [hasInitialLoad, setHasInitialLoad] = React.useState(false);

  const { user } = useAuthStore();

  const loadTournaments = React.useCallback(async () => {
    if (!user || isLoadingTournaments) return;
    
    setIsLoadingTournaments(true);
    // Only set main loading on initial load
    if (!hasInitialLoad) {
      setIsLoading(true);
    }
    
    try {
      const userId = user.id;
      
      // Add timeout and abort controller
      const abortController = new window.AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10 second timeout
      
      // Fetch tournaments where user is organizer, umpire, or participant
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, status, organizer_id, start_date, end_date, location')
        .or(`organizer_id.eq.${userId},status.eq.registration_closed,status.eq.in_progress`)
        .abortSignal(abortController.signal);
        
      clearTimeout(timeoutId);
      
      if (error) throw error;
      
      setTournaments(data || []);
      setHasInitialLoad(true);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error loading tournaments:', error);
        setError({
          visible: true,
          title: 'Connection Error',
          message: 'Unable to load tournaments. Please check your internet connection and try again.',
          type: 'error'
        });
      }
    } finally {
      setIsLoadingTournaments(false);
      setIsLoading(false);
    }
  }, [user, isLoadingTournaments, hasInitialLoad]);

  const loadMatches = React.useCallback(async () => {
    if (isLoadingMatches || tournaments.length === 0) return;
    
    setIsLoadingMatches(true);
    
    try {
      const tournamentIds = tournaments.map(t => t.id);
      
             // Add timeout and abort controller
       const abortController = new window.AbortController();
       const timeoutId = setTimeout(() => abortController.abort(), 10000);
      
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!matches_player1_id_fkey(user_id, username, elo_rating),
          player2:profiles!matches_player2_id_fkey(user_id, username, elo_rating),
          tournament:tournaments!fk_tournament(id, name)
        `)
        .in('tournament_id', tournamentIds)
        .in('status', ['scheduled', 'in_progress'])
        .order('date', { ascending: true })
        .abortSignal(abortController.signal);
        
      clearTimeout(timeoutId);
      
      if (error) throw error;
      
      // Convert database matches to application matches
      const matches: Match[] = (data || []).map((dbMatch: DatabaseMatch) => ({
        id: dbMatch.id,
        tournament_id: dbMatch.tournament_id,
        player1_id: dbMatch.player1_id,
        player2_id: dbMatch.player2_id,
        winner_id: dbMatch.winner_id,
        score: scoreToString(dbMatch.score),
        status: (dbMatch.status as Match['status']) || 'pending',
        date: dbMatch.date,
        location: dbMatch.location,
        match_number: dbMatch.match_number,
        round: dbMatch.round,
        summary: dbMatch.summary,
        created_at: dbMatch.created_at,
        updated_at: dbMatch.updated_at,
        player1: dbMatch.player1 ? {
           username: dbMatch.player1.username,
           elo_rating: dbMatch.player1.elo_rating,
           user_id: dbMatch.player1.user_id,
           profile_picture_url: null
         } : undefined,
         player2: dbMatch.player2 ? {
           username: dbMatch.player2.username,
           elo_rating: dbMatch.player2.elo_rating,
           user_id: dbMatch.player2.user_id,
           profile_picture_url: null
         } : undefined,
        tournament: dbMatch.tournament ? {
          id: dbMatch.tournament.id,
          name: dbMatch.tournament.name
        } : undefined
      }));
      
      setMatches(matches);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error loading matches:', error);
        setError({
          visible: true,
          title: 'Connection Error',
          message: 'Unable to load matches. Please try refreshing the page.',
          type: 'error'
        });
      }
    } finally {
      setIsLoadingMatches(false);
    }
  }, [tournaments, isLoadingMatches]);

  React.useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  React.useEffect(() => {
    if (tournaments.length > 0) {
      loadMatches();
    }
  }, [tournaments.length, loadMatches]);



  const handleMatchSelect = (match: Match) => {
    setSelectedMatch(match);
  };

  const handleBackToList = React.useCallback(() => {
    setSelectedMatch(null);
    loadMatches(); // Refresh matches when returning from scoring
  }, [loadMatches]);

  const dismissError = React.useCallback(() => {
    setError(prev => ({ ...prev, visible: false }));
  }, []);

  if (selectedMatch) {
    return (
      <MatchScoring 
        match={selectedMatch} 
        onBack={handleBackToList}
      />
    );
  }

  return (
    <div className="umpire-page">
      <div className="umpire-header">
        <h1 className="umpire-title">
          <Gavel className="h-8 w-8 text-quantum-cyan" />
          Live Scoring & Officiating
        </h1>
        
        <div className="umpire-status-info">
          <div className="status-item">
            <Info className="h-5 w-5 text-blue-500" />
            <span>Official Umpire Mode</span>
          </div>
          <div className="status-item">
            <Users className="h-5 w-5 text-green-500" />
            <span>{tournaments.length} Active Tournaments</span>
          </div>
        </div>
      </div>

      {error.visible && (
        <div className={`umpire-error ${error.type}`}>
          <AlertTriangle className="h-5 w-5" />
          <div>
            <h3>{error.title}</h3>
            <p>{error.message}</p>
            <button onClick={dismissError} className="error-dismiss-btn">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="umpire-loading">
          <LoadingSpinner size="large" text="Loading tournaments and matches..." />
        </div>
      ) : (
        <>
          {tournaments.length === 0 ? (
            <div className="umpire-empty-state">
              <Trophy className="h-16 w-16 text-quantum-cyan opacity-50" />
              <h2>No Active Tournaments</h2>
              <p>You don't have any tournaments available for officiating at the moment.</p>
              <Link to="/tournaments" className="btn btn-primary">
                <Trophy className="h-5 w-5 mr-2" />
                Browse Tournaments
              </Link>
            </div>
          ) : (
            <>
              <div className="umpire-section">
                <h2 className="umpire-section-title">Active Tournaments</h2>
                <div className="umpire-tournament-grid">
                  {tournaments.map(tournament => (
                    <div key={tournament.id} className="umpire-tournament-card">
                      <div className="tournament-header">
                        <h3>{tournament.name}</h3>
                        <span className={`tournament-status ${tournament.status}`}>
                          {tournament.status?.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="tournament-details">
                        <p><strong>Location:</strong> {tournament.location}</p>
                        <p><strong>Start:</strong> {new Date(tournament.start_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="umpire-section">
                <h2 className="umpire-section-title">
                  Matches Available for Officiating
                  {isLoadingMatches && <LoadingSpinner size="small" />}
                </h2>
                
                {matches.length === 0 ? (
                  <div className="umpire-empty-list">
                    <Play className="h-12 w-12 text-quantum-cyan opacity-50" />
                    <h3>No Matches Available</h3>
                    <p>There are no matches currently scheduled or in progress that need officiating.</p>
                  </div>
                ) : (
                  <div className="umpire-matches-grid">
                    {matches.map(match => (
                      <div key={match.id} className="umpire-match-card">
                        <div className="match-players">
                          <div className="player">
                            <strong>{match.player1?.username || 'TBD'}</strong>
                            <span className="elo-rating">{match.player1?.elo_rating || 'Unrated'}</span>
                          </div>
                          <div className="vs-divider">VS</div>
                          <div className="player">
                            <strong>{match.player2?.username || 'TBD'}</strong>
                            <span className="elo-rating">{match.player2?.elo_rating || 'Unrated'}</span>
                          </div>
                        </div>
                        
                        <div className="match-details">
                          <div className="match-tournament">
                            <Trophy className="h-4 w-4" />
                            {match.tournament?.name}
                          </div>
                          <div className="match-time">
                            {new Date(match.date).toLocaleString()}
                          </div>
                          <div className={`match-status ${match.status}`}>
                            {match.status?.replace('_', ' ')}
                          </div>
                        </div>

                        <button
                          onClick={() => handleMatchSelect(match)}
                          className="umpire-match-btn"
                        >
                          <Play className="h-5 w-5" />
                          {match.status === 'in_progress' ? 'Continue Scoring' : 'Start Officiating'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default UmpirePage;