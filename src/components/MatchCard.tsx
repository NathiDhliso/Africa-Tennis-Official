import React from 'react';
import { Calendar, MapPin, Trophy, Clock, Target } from 'lucide-react';
import { Match } from '../types';
import MatchRequestActions from './matches/MatchRequestActions';

interface MatchCardProps {
  match: Match;
  currentUserId: string;
  onReportScore: () => void;
  onViewDetails?: (() => void) | undefined;
  onActionComplete?: () => void;
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  currentUserId,
  onReportScore,
  onViewDetails,
  onActionComplete = () => {}
}) => {
  // Determine which player is the opponent based on the current user ID
  const isChallenger = match.challengerId === currentUserId;
  const opponentProfile = isChallenger ? match.player2 : match.player1;
  const currentUserProfile = isChallenger ? match.player1 : match.player2;
  
  const matchDate = new Date(match.date);
  const isCompleted = match.status === 'completed';
  const isPending = match.status === 'pending';
  const isConfirmed = match.status === 'confirmed';
  const isInProgress = match.status === 'in_progress';
  const isCancelled = match.status === 'cancelled' || match.status === 'declined';
  
  const getStatusColor = (status: Match['status']) => {
    switch (status) {
      case 'pending':
        return 'var(--warning-orange)';
      case 'confirmed':
      case 'in_progress':
        return 'var(--quantum-cyan)';
      case 'completed':
        return 'var(--success-green)';
      case 'declined':
      case 'cancelled':
        return 'var(--error-pink)';
      default:
        return 'var(--text-muted)';
    }
  };

  const getStatusText = (status: Match['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'declined':
        return 'Declined';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Format score for display
  const getFormattedScore = () => {
    if (typeof match.score === 'string') {
      return match.score;
    } else if (match.score && typeof match.score === 'object') {
      // For JSONB score objects, format sets
      try {
        const sets = match.score.sets || [];
        if (sets.length === 0) return 'No sets played';
        
        return sets.map((set: any) => 
          `${set.player1_games}-${set.player2_games}`
        ).join(', ');
      } catch (err) {
        console.error('Error formatting score:', err);
        return 'Score unavailable';
      }
    }
    return '';
  };

  if (!opponentProfile) {
    return null;
  }

  // Check if the match is in the past but not completed
  const isPastMatch = new Date(match.date) < new Date() && !isCompleted && !isInProgress;

  return (
    <div className="card" onClick={onViewDetails ? () => onViewDetails() : undefined} style={{ cursor: onViewDetails ? 'pointer' : 'default' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {opponentProfile.profile_picture_url ? (
            <img 
              src={opponentProfile.profile_picture_url} 
              alt={opponentProfile.username} 
              className="player-avatar text-sm"
            />
          ) : (
            <div className="player-avatar text-sm">
              {opponentProfile.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--text-standard)' }}>
              vs {opponentProfile.username}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              {isChallenger ? 'You challenged' : 'Challenged you'}
            </p>
          </div>
        </div>
        <div 
          className="px-3 py-1 rounded-full text-xs font-medium"
          style={{ 
            backgroundColor: `${getStatusColor(match.status)}20`,
            color: getStatusColor(match.status)
          }}
        >
          {getStatusText(match.status)}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
          <Calendar size={14} />
          <span>{matchDate.toLocaleDateString()} at {matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
          <MapPin size={14} />
          <span>{match.location}</span>
        </div>
      </div>

      {isCompleted && match.score && (
        <div className="border-t pt-4 mb-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Final Score:</div> 
            <div className="font-mono font-bold" style={{ color: 'var(--text-standard)' }}>
              {getFormattedScore()}
            </div>
          </div>
          {match.winner && (
            <div className="text-center mt-2">
              <span 
                className="inline-flex items-center gap-1 text-sm font-medium"
                style={{ color: match.winner === currentUserId ? 'var(--success-green)' : 'var(--error-pink)' }}
              >
                <Trophy size={14} />
                {match.winner === currentUserId ? 'You Won!' : 'You Lost'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Show report score button for confirmed or in_progress matches */}
      {(match.status === 'in_progress' || match.status === 'confirmed' || isPastMatch) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReportScore();
          }}
          className="btn btn-secondary btn-glare w-full"
        >
          <Target size={16} />
          Report Score
        </button>
      )}
      
      {/* Show accept/decline buttons for the challenged player if match is pending */}
      {isPending && !isChallenger && (
        <MatchRequestActions 
          match={match} 
          onActionComplete={onActionComplete} 
        />
      )}
      
      {!isCompleted && !isPending && !isCancelled && onViewDetails && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onViewDetails) onViewDetails();
          }}
          className="btn btn-secondary btn-glare w-full"
        >
          View Details
        </button>
      )}
    </div>
  );
};

export default MatchCard;