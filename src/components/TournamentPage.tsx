import React, { useState, useEffect } from 'react';
import { Plus, Search, Trophy, Calendar, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TournamentService } from '../services/TournamentService';
import { Tournament } from '../types';
import TournamentCard from './TournamentCard';
import TournamentCreateForm from './TournamentCreateForm';
import TournamentDetailsPage from './TournamentDetailsPage';

const TournamentPage: React.FC = () => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Tournament['status']>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = () => {
    let allTournaments = TournamentService.getAllTournaments();
    
    // Apply search filter
    if (searchQuery.trim()) {
      allTournaments = allTournaments.filter(tournament =>
        tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tournament.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tournament.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      allTournaments = allTournaments.filter(tournament => tournament.status === statusFilter);
    }

    // Sort by start date (upcoming first)
    allTournaments.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    setTournaments(allTournaments);
  };

  useEffect(() => {
    loadTournaments();
  }, [searchQuery, statusFilter]);

  const handleRegister = (tournamentId: string) => {
    if (user) {
      const success = TournamentService.registerPlayer(tournamentId, user.id);
      if (success) {
        loadTournaments();
        // If we're viewing details of this tournament, refresh the view
        if (selectedTournament && selectedTournament.id === tournamentId) {
          const updatedTournament = TournamentService.getTournamentById(tournamentId);
          if (updatedTournament) {
            setSelectedTournament(updatedTournament);
          }
        }
      }
    }
  };

  const handleTournamentCreated = (tournament: Tournament) => {
    loadTournaments();
  };

  const handleViewDetails = (tournament: Tournament) => {
    setSelectedTournament(tournament);
  };

  const handleBackFromDetails = () => {
    setSelectedTournament(null);
    // Refresh tournaments list in case anything changed
    loadTournaments();
  };

  const getFilterCount = (status: Tournament['status']) => {
    const allTournaments = TournamentService.getAllTournaments();
    return allTournaments.filter(t => t.status === status).length;
  };

  // Show tournament details if one is selected
  if (selectedTournament) {
    return (
      <TournamentDetailsPage
        tournament={selectedTournament}
        onBack={handleBackFromDetails}
        onRegister={() => handleRegister(selectedTournament.id)}
      />
    );
  }

  return (
    <div className="tournaments-page">
      <div className="tournaments-container">
        {/* Welcome Section */}
        <div className="tournaments-welcome">
          <h1 className="tournaments-welcome-title">
            <span className="tournaments-welcome-name">Tournaments</span>
          </h1>
          <p className="tournaments-welcome-subtitle">
            Compete in organized tournaments and prove your skills against the best players.
          </p>
        </div>

        {/* Create Tournament Button */}
        <div className="tournaments-create-section">
          <button
            onClick={() => setShowCreateForm(true)}
            className="tournaments-create-btn"
          >
            <Plus size={16} />
            Create Tournament
          </button>
        </div>

        {/* Filters and Search */}
        <div className="tournaments-filters">
          <div className="tournaments-filters-content">
            {/* Search Bar */}
            <div className="tournaments-search">
              <div className="tournaments-search-container">
                <Search size={20} className="tournaments-search-icon" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="tournaments-search-input"
                  placeholder="Search tournaments by name, location, or description..."
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="tournaments-filter-controls">
              <div className="relative">
                <Filter size={20} className="tournaments-filter-icon" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="form-select tournaments-filter-select"
                >
                  <option value="all">All Tournaments</option>
                  <option value="registration_open">Registration Open ({getFilterCount('registration_open')})</option>
                  <option value="registration_closed">Registration Closed ({getFilterCount('registration_closed')})</option>
                  <option value="in_progress">In Progress ({getFilterCount('in_progress')})</option>
                  <option value="completed">Completed ({getFilterCount('completed')})</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Tournaments Grid */}
        <div className="tournaments-grid">
          {tournaments.length > 0 ? (
            tournaments.map((tournament, index) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                currentUserId={user?.id || ''}
                onRegister={() => handleRegister(tournament.id)}
                onViewDetails={() => handleViewDetails(tournament)}
              />
            ))
          ) : (
            <div className="tournaments-empty">
              <Trophy size={48} className="tournaments-empty-icon" />
              <h3 className="tournaments-empty-title">
                {searchQuery || statusFilter !== 'all' ? 'No tournaments found' : 'No tournaments available'}
              </h3>
              <p className="tournaments-empty-description">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Be the first to create a tournament and bring players together!'
                }
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="tournaments-empty-btn"
                >
                  <Plus size={16} />
                  Create First Tournament
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Tournament Modal */}
      {showCreateForm && (
        <TournamentCreateForm
          onClose={() => setShowCreateForm(false)}
          onTournamentCreated={handleTournamentCreated}
        />
      )}
    </div>
  );
};

export default TournamentPage;