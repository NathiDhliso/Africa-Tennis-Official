import React, { useState, useMemo } from 'react';
import { Target, Zap, Trophy } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useMatches } from '../../hooks/useMatches';
import { useTournaments } from '../../hooks/useTournaments';
import CreateMatchModal from '../matches/CreateMatchModal';
import LoadingSpinner from '../LoadingSpinner';
import { Match, Tournament } from '../../types';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuthStore();
  const { data: rawMatches, isLoading: isLoadingMatches } = useMatches(user?.id);
  const { tournaments: rawTournaments, isLoading: isLoadingTournaments } = useTournaments();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const matches: Match[] = useMemo(() => {
    if (!rawMatches) return [];
    return rawMatches.map((m: any) => ({
      id: m.id,
      date: m.date,
      location: m.location,
      status: m.status,
      score: m.score,
      player1: m.player1,
      player2: m.player2,
      winnerProfile: m.winnerProfile,
      challengerId: m.player1_id,
      challengedId: m.player2_id,
      createdAt: m.created_at,
      challengerScore: m.challenger_score,
      challengedScore: m.challenged_score,
      winner: m.winner_id,
      detailedStatsId: m.detailed_stats_id,
      scoreDisplay: m.score_display,
    }));
  }, [rawMatches]);

  const tournaments: Tournament[] = useMemo(() => {
    if (!rawTournaments) return [];
    return rawTournaments.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      location: t.location,
      format: t.format,
      status: t.status,
      createdAt: t.created_at,
      startDate: t.start_date,
      endDate: t.end_date,
      organizerId: t.organizer_id,
      registrationDeadline: t.registration_deadline,
      maxParticipants: t.max_participants,
      participantCount: t.participant_count,
      isRegistered: t.is_registered,
      umpireId: t.umpire_id,
      winnerId: t.winner_id,
    }));
  }, [rawTournaments]);

  const handleCreateMatch = () => {
    setShowCreateForm(true);
  };

  const winRate = profile ? 
    (profile.matches_played > 0 ? 
      (profile.matches_won / profile.matches_played * 100).toFixed(1) : 
      '0.0') : 
    '0.0';

  const isLoading = isLoadingMatches || isLoadingTournaments;

  if (isLoading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-container">
          <LoadingSpinner 
            size="large" 
            text="Loading dashboard..." 
            subtext="Retrieving your tennis data"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        {/* Welcome Message */}
        <div className="dashboard-welcome">
          <div className="dashboard-welcome-content">
            <h1 className="dashboard-welcome-title">
              Welcome back, <span className="dashboard-welcome-name">{profile?.username || 'Player'}</span>
            </h1>
            <p className="dashboard-welcome-subtitle">
              Ready to dominate the court? Create matches with new opponents and climb the rankings.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="dashboard-stats">
          <div className="dashboard-stat-card stagger-1">
            <div className="dashboard-stat-value">{profile?.elo_rating || 1200}</div>
            <div className="dashboard-stat-label">Rating</div>
          </div>
          <div className="dashboard-stat-card stagger-2">
            <div className="dashboard-stat-value">{profile?.matches_played || 0}</div>
            <div className="dashboard-stat-label">Matches Played</div>
          </div>
          <div className="dashboard-stat-card stagger-3">
            <div className="dashboard-stat-value">{profile?.matches_won || 0}</div>
            <div className="dashboard-stat-label">Matches Won</div>
          </div>
          <div className="dashboard-stat-card stagger-4">
            <div className="dashboard-stat-value">{winRate}%</div>
            <div className="dashboard-stat-label">Win Rate</div>
          </div>
        </div>

        {/* Main Action Section */}
        <div className="dashboard-section stagger-2">
          <div className="dashboard-getting-started">
            <div className="dashboard-getting-started-content">
              <Zap size={64} className="dashboard-getting-started-icon" />
              <h3 className="dashboard-getting-started-title">
                Ready to Start Your Tennis Journey?
              </h3>
              <p className="dashboard-getting-started-description">
                Create matches with other players to build your match history, improve your ranking, and become part of the competitive tennis community!
              </p>
              <div className="dashboard-getting-started-actions">
                <button
                  onClick={handleCreateMatch}
                  className="btn btn-primary btn-glare"
                >
                  <Target size={16} />
                  Create a Match
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Match Creation Form */}
      {showCreateForm && (
        <CreateMatchModal
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onMatchCreated={() => setShowCreateForm(false)}
          mode="create"
        />
      )}
    </div>
  );
};