import React from 'react';
import { Calendar, MapPin, Users, Trophy } from 'lucide-react';
import { Tournament } from '../types';

interface TournamentCardProps {
  tournament: Tournament;
  onRegister: (tournamentId: string) => void;
  onView: (tournament: Tournament) => void;
  currentUserId?: string;
}

const TournamentCard: React.FC<TournamentCardProps> = ({ 
  tournament, 
  onRegister, 
  onView,
  currentUserId 
}) => {
  // Stub implementations (replace with actual data fetching)
  const participants = tournament.participantCount || 0;
  const isRegistered = tournament.isRegistered || false;
  
  const handleRegister = () => {
    onRegister(tournament.id);
  };

  const handleView = () => {
    onView(tournament);
  };

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'registration_open':
        return 'bg-green-100 text-green-800';
      case 'registration_closed':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold text-gray-900">{tournament.name}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tournament.status)}`}>
          {tournament.status?.replace('_', ' ').toUpperCase()}
        </span>
      </div>
      
      <p className="text-gray-600 mb-4 line-clamp-2">{tournament.description}</p>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-500">
          <Calendar className="w-4 h-4 mr-2" />
          <span>{formatDate(tournament.start_date || tournament.startDate || '')}</span>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <MapPin className="w-4 h-4 mr-2" />
          <span>{tournament.location}</span>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <Users className="w-4 h-4 mr-2" />
          <span>{participants}/{tournament.max_participants || tournament.maxParticipants} participants</span>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <Trophy className="w-4 h-4 mr-2" />
          <span>{tournament.format?.replace('_', ' ').toUpperCase()}</span>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleView}
          className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
        >
          View Details
        </button>
        {tournament.status === 'registration_open' && currentUserId && (
          <button
            onClick={handleRegister}
            disabled={isRegistered}
            className={`flex-1 px-4 py-2 rounded-md transition-colors ${
              isRegistered
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRegistered ? 'Registered' : 'Register'}
          </button>
        )}
      </div>
    </div>
  );
};

export default TournamentCard;