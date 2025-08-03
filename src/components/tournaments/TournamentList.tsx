import React, { useState } from 'react';
import { Trophy, Calendar, MapPin, Users, Plus, Search, Filter, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTournaments } from '../../hooks/useTournaments';
import { useTournamentMutations } from '../../hooks/useTournamentMutations';
import LoadingSpinner from '../LoadingSpinner';
import TournamentCreateForm from '../TournamentCreateForm';
import { useNavigate } from 'react-router-dom';

export const TournamentList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const user = useAuthStore((state) => state.user);
  const { tournaments, isLoading, error } = useTournaments();
  const { registerForTournament } = useTournamentMutations();
  const navigate = useNavigate();

  const handleRegister = (tournamentId: string) => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }
    
    console.log('Attempting to register for tournament:', tournamentId);
    registerForTournament.mutate(
      { tournamentId, playerId: user.id },
      {
        onSuccess: () => {
          console.log('Registration successful!');
        },
        onError: (error) => {
          console.error('Registration failed:', error);
        }
      }
    );
  };

  const handleCreateTournament = () => {
    setShowCreateForm(true);
  };

  const handleViewDetails = (tournamentId: string) => {
    console.log('Navigating to tournament details:', tournamentId);
    navigate(`/tournaments/${tournamentId}`);
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const filteredTournaments = (tournaments || []).filter((tournament) => {
    const matchesSearch =
      tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tournament.description && tournament.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      tournament.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || tournament.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="tournaments-container">
        <LoadingSpinner size="large" text="Loading tournaments..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="tournaments-container">
        <div className="text-center py-12">
          <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: 'var(--error-pink)' }} />
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-standard)' }}>
            Error Loading Tournaments
          </h3>
          <p className="mb-4" style={{ color: 'var(--text-subtle)' }}>
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tournaments-container">
      {/* Header */}
      <div className="tournaments-header">
        <h1 className="tournaments-title">Tournaments</h1>
        <button onClick={handleCreateTournament} className="tournaments-create-btn">
          <Plus size={16} />
          Create Tournament
        </button>
      </div>

      {/* Filters */}
      <div className="tournaments-filters">
        <div className="tournaments-filters-content">
          <div className="tournaments-search">
            <div className="tournaments-search-container">
              <Search size={18} className="tournaments-search-icon" />
              <input
                type="text"
                placeholder="Search tournaments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="tournaments-search-input"
              />
            </div>
          </div>
          <div className="tournaments-filter-controls">
            <div className="relative">
              <Filter size={16} className="tournaments-filter-icon" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-select tournaments-filter-select"
              >
                <option value="all">All Statuses</option>
                <option value="registration_open">Registration Open</option>
                <option value="registration_closed">Registration Closed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tournament Grid */}
      {filteredTournaments.length === 0 ? (
        <div className="tournaments-empty">
          <Trophy size={48} className="tournaments-empty-icon" />
          <h3 className="tournaments-empty-title">No Tournaments Found</h3>
          <p className="tournaments-empty-description">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Be the first to create a tournament and bring players together!'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button onClick={handleCreateTournament} className="tournaments-empty-btn">
              <Plus size={16} />
              Create First Tournament
            </button>
          )}
        </div>
      ) : (
        <div className="tournaments-grid">
          {filteredTournaments.map((tournament) => (
            <div key={tournament.id} className="tournament-card-minimal">
              {/* Header with Title and Status */}
              <div className="tournament-card-header">
                <div className="tournament-card-title-section">
                  <h3 className="tournament-card-title">{tournament.name}</h3>
                  <div
                    className="tournament-card-status"
                    style={{
                      backgroundColor: `${
                        tournament.status === 'registration_open'
                          ? 'rgba(0, 255, 170, 0.2)'
                          : tournament.status === 'in_progress'
                          ? 'rgba(0, 212, 255, 0.2)'
                          : tournament.status === 'registration_closed'
                          ? 'rgba(255, 149, 0, 0.2)'
                          : 'rgba(100, 116, 139, 0.2)'
                      }`,
                      color:
                        tournament.status === 'registration_open'
                          ? 'var(--success-green)'
                          : tournament.status === 'in_progress'
                          ? 'var(--quantum-cyan)'
                          : tournament.status === 'registration_closed'
                          ? 'var(--warning-orange)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {formatStatus(tournament.status)}
                    {tournament.participantCount && tournament.max_participants && tournament.participantCount >= tournament.max_participants && tournament.status === 'registration_open' && ' (Full)'}
                  </div>
                </div>
              </div>

              {/* Essential Info */}
              <div className="tournament-card-info">
                <div className="tournament-card-info-item">
                  <Calendar size={14} />
                  <span>{new Date(tournament.start_date).toLocaleDateString()}</span>
                </div>
                <div className="tournament-card-info-item">
                  <MapPin size={14} />
                  <span>{tournament.location.split(',')[0]}</span>
                </div>
                <div className="tournament-card-info-item">
                  <Users size={14} />
                  <span>{tournament.participantCount}/{tournament.max_participants}</span>
                </div>
              </div>

              {/* Registration Status Indicator */}
              {tournament.isRegistered && (
                <div className="tournament-card-registered">
                  <Trophy size={14} />
                  <span>Registered</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="tournament-card-actions">
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewDetails(tournament.id);
                  }}
                  className="tournament-card-btn tournament-card-btn-secondary"
                  type="button"
                >
                  Details
                </button>

                {tournament.status === 'registration_open' &&
                  !tournament.isRegistered &&
                  !(tournament.participantCount && tournament.max_participants && tournament.participantCount >= tournament.max_participants) && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRegister(tournament.id);
                      }}
                      className="tournament-card-btn tournament-card-btn-primary"
                      disabled={registerForTournament.isPending}
                      type="button"
                    >
                      {registerForTournament.isPending ? 'Registering...' : 'Register'}
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tournament Creation Form */}
      {showCreateForm && (
        <TournamentCreateForm
          onClose={() => setShowCreateForm(false)}
          onTournamentCreated={() => {
            setShowCreateForm(false);
            // No need to manually refetch, React Query handles it
          }}
        />
      )}
    </div>
  );
};