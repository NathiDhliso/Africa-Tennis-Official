import React from 'react';
import { Calendar, MapPin, Users, Trophy, Target, Eye } from 'lucide-react';
import { Tournament } from '../types';
import { TournamentService } from '../services/TournamentService';
import { UserService } from '../services/UserService';

interface TournamentCardProps {
  tournament: Tournament;
  currentUserId: string;
  onRegister?: () => void;
  onViewDetails?: () => void;
}

const TournamentCard: React.FC<TournamentCardProps> = ({ 
  tournament, 
  currentUserId, 
  onRegister, 
  onViewDetails 
}) => {
  const organizer = UserService.getPlayerById(tournament.organizerId);
  const participants = TournamentService.getTournamentParticipants(tournament.id);
  const isRegistered = TournamentService.isPlayerRegistered(tournament.id, currentUserId);
  const isOrganizer = tournament.organizerId === currentUserId;
  
  const startDate = new Date(tournament.startDate);
  const isRegistrationOpen = tournament.status === 'registration_open';
  const canRegister = isRegistrationOpen && !isRegistered && !isOrganizer && participants.length < tournament.maxParticipants;

  const getStatusColor = (status: Tournament['status']) => {
    switch (status) {
      case 'registration_open':
        return 'var(--success-green)';
      case 'registration_closed':
        return 'var(--warning-orange)';
      case 'in_progress':
        return 'var(--quantum-cyan)';
      case 'completed':
        return 'var(--text-muted)';
      default:
        return 'var(--text-muted)';
    }
  };

  const getStatusText = (status: Tournament['status']) => {
    switch (status) {
      case 'registration_open':
        return 'Open';
      case 'registration_closed':
        return 'Closed';
      case 'in_progress':
        return 'Live';
      case 'completed':
        return 'Finished';
      default:
        return status;
    }
  };

  return (
    <div className="tournament-card-minimal">
      {/* Header with Title and Status */}
      <div className="tournament-card-header">
        <div className="tournament-card-title-section">
          <h3 className="tournament-card-title">{tournament.name}</h3>
          <div 
            className="tournament-card-status"
            style={{ 
              backgroundColor: `${getStatusColor(tournament.status)}20`,
              color: getStatusColor(tournament.status)
            }}
          >
            {getStatusText(tournament.status)}
          </div>
        </div>
      </div>

      {/* Essential Info */}
      <div className="tournament-card-info">
        <div className="tournament-card-info-item">
          <Calendar size={14} />
          <span>{startDate.toLocaleDateString()}</span>
        </div>
        <div className="tournament-card-info-item">
          <MapPin size={14} />
          <span>{tournament.location.split(',')[0]}</span>
        </div>
        <div className="tournament-card-info-item">
          <Users size={14} />
          <span>{participants.length}/{tournament.maxParticipants}</span>
        </div>
      </div>

      {/* Registration Status Indicator */}
      {isRegistered && (
        <div className="tournament-card-registered">
          <Trophy size={14} />
          <span>Registered</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="tournament-card-actions">
        <button
          onClick={onViewDetails}
          className="tournament-card-btn tournament-card-btn-secondary"
        >
          <Eye size={14} />
          Details
        </button>

        {canRegister && onRegister && (
          <button
            onClick={onRegister}
            className="tournament-card-btn tournament-card-btn-primary"
          >
            <Target size={14} />
            Register
          </button>
        )}
      </div>
    </div>
  );
};

export default TournamentCard;