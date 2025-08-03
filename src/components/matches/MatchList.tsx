import React, { useState, useMemo } from 'react';
import { Search, Filter, Trophy, Clock, Plus, Swords, Gavel } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useMatches } from '../../hooks/useMatches';
import { useMatchMutations } from '../../hooks/useMatchMutations';
import MatchCard from '../MatchCard';
import CreateMatchModal from './CreateMatchModal';
import ScoreModal from '../ScoreModal';
import { useNavigate } from 'react-router-dom';
import { Match } from '../../types';
import LoadingSpinner from '../LoadingSpinner';

export const MatchList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Match['status']>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'recent'>('all');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { user } = useAuthStore();
  const { data: rawMatches = [], isLoading, error, refetch } = useMatches(user?.id);
  const navigate = useNavigate();

  const matches: Match[] = useMemo(() => {
    if (!rawMatches) return [];
    // Use the raw matches directly since they already conform to the Match interface
    return rawMatches;
  }, [rawMatches]);

  const { updateMatch } = useMatchMutations();

  const filteredMatches = useMemo(() => {
    let filtered = matches;
    const now = new Date();

    if (timeFilter === 'upcoming') {
      filtered = filtered.filter((match) => new Date(match.date) > now && (match.status === 'pending' || match.status === 'in_progress'));
    } else if (timeFilter === 'recent') {
      filtered = filtered.filter((match) => new Date(match.date) <= now || match.status === 'completed');
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((match) => match.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const lowercasedQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((match) => 
        match.player1?.username.toLowerCase().includes(lowercasedQuery) ||
        match.player2?.username.toLowerCase().includes(lowercasedQuery) ||
        (match.location && match.location.toLowerCase().includes(lowercasedQuery))
      );
    }

    // Filter out in-progress matches that are part of tournaments for the "All Matches" section
    filtered = filtered.filter(match => 
      !(match.status === 'in_progress' && match.tournamentId)
    );

    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, searchQuery, statusFilter, timeFilter]);

  const upcomingMatches = useMemo(() => {
    const now = new Date();
    return matches
      .filter((match) => new Date(match.date) > now && (match.status === 'pending' || match.status === 'in_progress'))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matches]);

  const pendingMatches = useMemo(() => {
    if (!user) return [];
    return matches.filter(match => match.status === 'pending' && match.challengedId === user.id);
  }, [matches, user]);

  // Get tournament matches that are in progress
  const tournamentMatches = useMemo(() => {
    return matches.filter(match => match.tournamentId && match.status === 'in_progress');
  }, [matches]);

  const handleReportScore = (match: Match) => {
    setSelectedMatch(match);
    setShowScoreModal(true);
  };

  const handleScoreSubmit = async (player1_games: number, player2_games: number) => {
    if (!selectedMatch || !user) return;

    const winnerId = player1_games > player2_games 
      ? selectedMatch.challengerId 
      : selectedMatch.challengedId;

    const scoreObject = {
      sets: [{ player1_games, player2_games }],
      current_game: { player1_points: 0, player2_points: 0 },
      server_id: selectedMatch.challengerId,
      is_tiebreak: false
    };

    updateMatch.mutate(
      { 
        id: selectedMatch.id, 
        updates: { 
          score: scoreObject as any, // Supabase types are tricky for JSONB
          winner_id: winnerId, 
          status: 'completed' 
        }
      },
      {
        onSuccess: () => {
          setShowScoreModal(false);
          setSelectedMatch(null);
          refetch();
        }
      }
    );
  };

  const handleCreateMatch = () => setShowCreateForm(true);
  const handleViewMatch = (matchId: string) => navigate(`/matches/${matchId}`);
  const handleGoToLiveScoring = () => navigate('/umpire');

  if (isLoading) {
    return (
      <div className="match-list-page">
        <div className="match-list-container">
          <LoadingSpinner size="large" text="Loading matches..." subtext="Retrieving your match history" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="match-list-page">
        <div className="match-list-container">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium" style={{ color: 'var(--error-pink)' }}>
              Error loading matches: {error instanceof Error ? error.message : 'Unknown error'}
            </h3>
            <p className="mt-4" style={{ color: 'var(--text-subtle)' }}>
              Please try refreshing the page or contact support if the problem persists.
            </p>
            <button 
              onClick={() => refetch()} 
              className="mt-4 btn btn-primary"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="match-list-page">
      <div className="match-list-container">
        <header className="matches-header">
          <div>
            <h1 className="matches-title">Matches</h1>
            <p className="matches-subtitle">View your match history, challenge players, and report scores.</p>
          </div>
          <div className="matches-header-actions">
            <button className="btn btn-primary btn-icon" onClick={handleCreateMatch}>
              <Plus size={18} />
              Create Match
            </button>
          </div>
        </header>

        {/* Live Scoring Link */}
        <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4 mb-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium" style={{ color: 'var(--text-standard)' }}>
              <Gavel size={20} className="inline-block mr-2" />
              Live Scoring Dashboard
            </h3>
            <p style={{ color: 'var(--text-subtle)' }}>
              Access the live scoring interface for matches and tournaments
            </p>
          </div>
          <button 
            onClick={handleGoToLiveScoring}
            className="btn btn-primary"
          >
            <Gavel size={16} className="mr-2" />
            Go to Live Scoring
          </button>
        </div>

        <div className="match-list-controls">
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by opponent or location..." 
              className="search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <Filter size={18} className="filter-icon" />
            <select 
              className="filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as Match['status'] | 'all')}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select 
              className="filter-select"
              value={timeFilter}
              onChange={e => setTimeFilter(e.target.value as 'all' | 'upcoming' | 'recent')}
            >
              <option value="all">All Time</option>
              <option value="upcoming">Upcoming</option>
              <option value="recent">Recent</option>
            </select>
          </div>
        </div>

        {/* Tournament Matches Section */}
        {tournamentMatches.length > 0 && (
          <section className="match-section">
            <h2 className="section-title">
              <Trophy size={22} className="section-title-icon" />
              Tournament Matches ({tournamentMatches.length})
            </h2>
            <div className="match-grid">
              {tournamentMatches.map((match) => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  currentUserId={user?.id || ''} 
                  onReportScore={() => handleReportScore(match)}
                  onViewDetails={() => handleViewMatch(match.id)}
                  onActionComplete={() => refetch()}
                />
              ))}
            </div>
            <div className="mt-4 text-center">
              <button 
                onClick={handleGoToLiveScoring}
                className="btn btn-secondary"
              >
                <Gavel size={16} className="mr-2" />
                Go to Live Scoring Dashboard
              </button>
            </div>
          </section>
        )}

        {/* Pending Match Requests Section */}
        {pendingMatches.length > 0 && (
          <section className="match-section">
            <h2 className="section-title">
              <Trophy size={22} className="section-title-icon" />
              Pending Match Requests ({pendingMatches.length})
            </h2>
            <div className="match-grid">
              {pendingMatches.map((match) => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  currentUserId={user?.id || ''} 
                  onReportScore={() => handleReportScore(match)}
                  onViewDetails={() => handleViewMatch(match.id)}
                  onActionComplete={() => refetch()}
                />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Matches Section */}
        {upcomingMatches.length > 0 && (
          <section className="match-section">
            <h2 className="section-title">
              <Clock size={22} className="section-title-icon" />
              Upcoming Matches
            </h2>
            <div className="match-grid">
              {upcomingMatches.map((match) => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  currentUserId={user?.id || ''} 
                  onReportScore={() => handleReportScore(match)}
                  onViewDetails={() => handleViewMatch(match.id)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="match-section">
          <h2 className="section-title">
            <Swords size={22} className="section-title-icon" />
            {timeFilter === 'all' ? 'All Matches' : 'Filtered Matches'}
          </h2>
          {filteredMatches.length > 0 ? (
            <div className="match-grid">
              {filteredMatches.map((match) => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  currentUserId={user?.id || ''} 
                  onReportScore={() => handleReportScore(match)}
                  onViewDetails={() => handleViewMatch(match.id)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Trophy size={48} className="empty-state-icon" />
              <h3 className="empty-state-title">No Matches Found</h3>
              <p className="empty-state-text">Adjust your filters or create a new match to get started.</p>
            </div>
          )}
        </section>
      </div>

      {showScoreModal && selectedMatch && (
        <ScoreModal
          isOpen={showScoreModal}
          onClose={() => setShowScoreModal(false)}
          onSubmit={handleScoreSubmit}
          match={selectedMatch as Match}
        />
      )}

      {showCreateForm && (
        <CreateMatchModal
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onMatchCreated={() => {
            setShowCreateForm(false);
            refetch();
          }}
          mode="create"
        />
      )}
    </div>
  );
};

export default MatchList;