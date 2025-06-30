import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trophy, Users, Search, Filter } from 'lucide-react';
import TournamentCard from './TournamentCard';
import TournamentCreateForm from './TournamentCreateForm';
import TournamentDetailsPage from './TournamentDetailsPage';
import { Tournament } from '../types';
import { useAuthStore } from '../stores/authStore';
import { useTournaments } from '../hooks/useTournaments';

const TournamentPage: React.FC = () => {
  const { user } = useAuthStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { tournaments = [], isLoading, prefetchTournaments } = useTournaments();

  useEffect(() => {
    prefetchTournaments();
  }, [prefetchTournaments]);

  useEffect(() => {
    if (user) {
      prefetchTournaments();
    }
  }, [user, prefetchTournaments]);

  // Filter tournaments based on search term and status
  const filteredTournaments = tournaments.filter((tournament: Tournament) => {
    const matchesSearch = !searchTerm || 
      tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tournament.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tournament.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || tournament.status === statusFilter;

    return matchesSearch && matchesStatus;
  }).sort((a: Tournament, b: Tournament) => {
    const dateA = new Date(a.start_date || a.startDate || '').getTime();
    const dateB = new Date(b.start_date || b.startDate || '').getTime();
    return dateA - dateB;
  });

  const handleTournamentCreated = () => {
    setShowCreateForm(false);
    prefetchTournaments();
  };

  const handleRegister = (tournamentId: string) => {
    if (!user) return;
    
    // TODO: Implement registration logic
    console.log('Registering for tournament:', tournamentId);
    prefetchTournaments();
  };

  const handleViewTournament = (tournament: Tournament) => {
    setSelectedTournament(tournament);
  };

  const handleBackFromDetails = () => {
    setSelectedTournament(null);
    prefetchTournaments();
  };

  const getStatusCount = (status: string) => {
    if (status === 'all') return tournaments.length;
    return tournaments.filter((t: Tournament) => t.status === status).length;
  };

  if (selectedTournament) {
    return (
      <TournamentDetailsPage
        tournament={selectedTournament}
        participants={[]}
        matches={[]}
        onBack={handleBackFromDetails}
        onRegister={handleBackFromDetails}
      />
    );
  }

  if (showCreateForm) {
    return (
      <TournamentCreateForm 
        onClose={() => setShowCreateForm(false)}
        onTournamentCreated={handleTournamentCreated}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="text-yellow-500" />
            Tournaments
          </h1>
          <p className="text-gray-600 mt-2">
            Join competitive tournaments and showcase your skills
          </p>
        </div>
        
        {user && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Create Tournament
          </button>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search tournaments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status ({getStatusCount('all')})</option>
            <option value="registration_open">Open ({getStatusCount('registration_open')})</option>
            <option value="registration_closed">Closed ({getStatusCount('registration_closed')})</option>
            <option value="in_progress">In Progress ({getStatusCount('in_progress')})</option>
            <option value="completed">Completed ({getStatusCount('completed')})</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Open for Registration</p>
              <p className="text-2xl font-bold text-green-800">{getStatusCount('registration_open')}</p>
            </div>
            <Users className="text-green-600" size={24} />
          </div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">In Progress</p>
              <p className="text-2xl font-bold text-blue-800">{getStatusCount('in_progress')}</p>
            </div>
            <Trophy className="text-blue-600" size={24} />
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600">Completed</p>
              <p className="text-2xl font-bold text-purple-800">{getStatusCount('completed')}</p>
            </div>
            <Calendar className="text-purple-600" size={24} />
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Tournaments</p>
              <p className="text-2xl font-bold text-gray-800">{tournaments.length}</p>
            </div>
            <Filter className="text-gray-600" size={24} />
          </div>
        </div>
      </div>

      {/* Tournament Grid */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading tournaments...</p>
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="text-center py-8">
          <Trophy className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tournaments found</h3>
          <p className="text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? "Try adjusting your search or filter criteria" 
              : "Be the first to create a tournament!"
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament: Tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              onRegister={handleRegister}
              onView={handleViewTournament}
              currentUserId={user?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentPage;