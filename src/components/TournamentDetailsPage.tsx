import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Users, 
  Trophy, 
  Clock, 
  Target,
  User,
  Award,
  CheckCircle,
  AlertTriangle,
  Play,
  BarChart3,
  RotateCcw
} from 'lucide-react';
import { Tournament } from '../types';
import { useAuthStore } from '../stores/authStore';

interface TournamentDetailsPageProps {
  tournament: Tournament;
  participants: any[];
  matches: any[];
  onBack: () => void;
  onRegister?: () => void;
}

const TournamentDetailsPage: React.FC<TournamentDetailsPageProps> = ({ 
  tournament, 
  participants,
  matches,
  onBack, 
  onRegister 
}) => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'bracket' | 'standings'>('overview');

  // Use tournament organizer data directly or fallback to placeholder
  const organizer = tournament.organizer || { username: 'Unknown Organizer' };
  const isRegistered = tournament.isRegistered || false;
  const isOrganizer = tournament.organizerId === user?.id;
  
  const registrationDeadline = new Date(tournament.startDate); // Using startDate as registration deadline
  const startDate = new Date(tournament.startDate);
  const endDate = new Date(tournament.endDate);
  
  const isRegistrationOpen = tournament.status === 'registration_open';
  const canRegister = isRegistrationOpen && !isRegistered && !isOrganizer && 
    (tournament.participantCount || 0) < tournament.maxParticipants;

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
        return 'Registration Open';
      case 'registration_closed':
        return 'Registration Closed';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      default:
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getFormatText = (format: Tournament['format']) => {
    switch (format) {
      case 'single_elimination':
        return 'Single Elimination';
      case 'double_elimination':
        return 'Double Elimination';
      case 'round_robin':
        return 'Round Robin';
      default:
        return format.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const renderOverview = () => (
    <div className="tournament-details-overview">
      {/* Tournament Info */}
      <div className="tournament-info-grid">
        <div className="tournament-info-card">
          <div className="tournament-info-header">
            <Calendar size={20} />
            <span>Schedule</span>
          </div>
          <div className="tournament-info-content">
            <div className="tournament-info-item">
              <span className="tournament-info-label">Registration Deadline:</span>
              <span className="tournament-info-value">
                {registrationDeadline.toLocaleDateString()} at {registrationDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="tournament-info-item">
              <span className="tournament-info-label">Tournament Start:</span>
              <span className="tournament-info-value">
                {startDate.toLocaleDateString()} at {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="tournament-info-item">
              <span className="tournament-info-label">Tournament End:</span>
              <span className="tournament-info-value">
                {endDate.toLocaleDateString()} at {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        <div className="tournament-info-card">
          <div className="tournament-info-header">
            <Trophy size={20} />
            <span>Format & Rules</span>
          </div>
          <div className="tournament-info-content">
            <div className="tournament-info-item">
              <span className="tournament-info-label">Format:</span>
              <span className="tournament-info-value">{getFormatText(tournament.format)}</span>
            </div>
            <div className="tournament-info-item">
              <span className="tournament-info-label">Max Participants:</span>
              <span className="tournament-info-value">{tournament.maxParticipants} players</span>
            </div>
            <div className="tournament-info-item">
              <span className="tournament-info-label">Current Registration:</span>
              <span className="tournament-info-value">
                {tournament.participantCount}/{tournament.maxParticipants} players
              </span>
            </div>
            {tournament.format === 'round_robin' && (
              <div className="tournament-info-item">
                <span className="tournament-info-label">Total Matches:</span>
                <span className="tournament-info-value">
                  {(tournament.participantCount && tournament.participantCount > 0) ? 
                    (tournament.participantCount * (tournament.participantCount - 1)) / 2 : 0}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="tournament-info-card">
          <div className="tournament-info-header">
            <MapPin size={20} />
            <span>Location & Officials</span>
          </div>
          <div className="tournament-info-content">
            <div className="tournament-info-item">
              <span className="tournament-info-label">Venue:</span>
              <span className="tournament-info-value">{tournament.location}</span>
            </div>
            <div className="tournament-info-item">
              <span className="tournament-info-label">Organizer:</span>
              <span className="tournament-info-value">{organizer.username || 'Unknown'}</span>
            </div>
            <div className="tournament-info-item">
              <span className="tournament-info-label">Umpire:</span>
              <span className="tournament-info-value">TBD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Progress */}
      <div className="tournament-registration-progress">
        <div className="tournament-progress-header">
          <h3>Registration Progress</h3>
          <span className="tournament-progress-count">
            {tournament.participantCount}/{tournament.maxParticipants} players
          </span>
        </div>
        <div className="tournament-progress-bar">
          <div 
            className="tournament-progress-fill"
            style={{ 
              width: `${((tournament.participantCount || 0) / tournament.maxParticipants) * 100}%`,
              backgroundColor: (tournament.participantCount || 0) === tournament.maxParticipants ? 'var(--success-green)' : 'var(--quantum-cyan)'
            }}
          />
        </div>
        <div className="tournament-progress-percentage">
          {Math.round(((tournament.participantCount || 0) / tournament.maxParticipants) * 100)}% Full
        </div>
      </div>

      {/* Description */}
      <div className="tournament-description-card">
        <h3>About This Tournament</h3>
        <p>{tournament.description}</p>
      </div>

      {/* Format Explanation */}
      <div className="tournament-format-card">
        <h3>
          {tournament.format === 'single_elimination' ? (
            <>
              <Trophy size={20} className="inline-icon" />
              Single Elimination Format
            </>
          ) : tournament.format === 'double_elimination' ? (
            <>
              <Award size={20} className="inline-icon" />
              Double Elimination Format
            </>
          ) : tournament.format === 'round_robin' ? (
            <>
              <RotateCcw size={20} className="inline-icon" />
              Round Robin Format
            </>
          ) : (
            <>
              <Award size={20} className="inline-icon" />
              Tournament Format
            </>
          )}
        </h3>
        
        {tournament.format === 'single_elimination' && (
          <div className="format-explanation">
            <p>
              In this single elimination tournament, players compete in a knockout format. Lose once and you're eliminated from the competition.
            </p>
            <ul className="format-features">
              <li>Players are seeded based on their ratings</li>
              <li>Each match has one winner who advances to the next round</li>
              <li>The tournament champion is the last player standing</li>
              <li>Fast-paced format with clear progression</li>
            </ul>
          </div>
        )}
        
        {tournament.format === 'double_elimination' && (
          <div className="format-explanation">
            <p>
              In this double elimination tournament, players must lose twice to be eliminated. This format provides second chances while maintaining competitive structure.
            </p>
            <ul className="format-features">
              <li>Players compete in both winners and losers brackets</li>
              <li>Must lose twice to be eliminated from the tournament</li>
              <li>Losers bracket provides comeback opportunities</li>
              <li>Grand final may require bracket reset if losers bracket winner wins</li>
              <li>More forgiving format ensuring the best player wins</li>
            </ul>
          </div>
        )}
        
        {tournament.format === 'round_robin' && (
          <div className="format-explanation">
            <p>
              In this round robin tournament, every player competes against every other player. This format ensures maximum playing time and fair competition.
            </p>
            <ul className="format-features">
              <li>Each player faces all other players exactly once</li>
              <li>Total of {(participants.length * (participants.length - 1)) / 2} matches</li>
              <li>Winner determined by most matches won</li>
              <li>Comprehensive format that tests consistency</li>
            </ul>
          </div>
        )}
      </div>

      {/* Registration Status */}
      {isRegistered && (
        <div className="tournament-registration-status registered">
          <div className="tournament-status-content">
            <CheckCircle size={20} />
            <div>
              <div className="tournament-status-title">You're Registered!</div>
              <div className="tournament-status-subtitle">
                You're all set for this tournament. Check back for bracket updates.
              </div>
            </div>
          </div>
        </div>
      )}

      {!isRegistered && !isOrganizer && (
        <div className={`tournament-registration-status ${canRegister ? 'can-register' : 'cannot-register'}`}>
          <div className="tournament-status-content">
            {canRegister ? <Target size={20} /> : <AlertTriangle size={20} />}
            <div>
              <div className="tournament-status-title">
                {canRegister ? 'Registration Open' : 'Registration Unavailable'}
              </div>
              <div className="tournament-status-subtitle">
                {canRegister 
                  ? 'Join this tournament and compete against other players!'
                  : (tournament.participantCount || 0) >= tournament.maxParticipants 
                    ? 'Tournament is full'
                    : 'Registration has closed'
                }
              </div>
            </div>
          </div>
          {canRegister && onRegister && (
            <button onClick={onRegister} className="btn btn-primary btn-glare">
              <Target size={16} />
              Register Now
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderParticipants = () => (
    <div className="tournament-participants">
      <div className="tournament-participants-header">
        <h3>Registered Players ({participants.length})</h3>
        {tournament.status !== 'registration_open' && (
          <div className="tournament-seeding-note">
            Players are seeded by rating
          </div>
        )}
      </div>
      
      <div className="tournament-participants-grid">
        {participants.map((participant, index) => {
          const player = participant.player;
          if (!player) return null;

          return (
            <div key={participant.id} className="tournament-participant-card">
              <div className="tournament-participant-info">
                <div className="tournament-participant-avatar">
                  {player.username.charAt(0).toUpperCase()}
                </div>
                <div className="tournament-participant-details">
                  <div className="tournament-participant-name">{player.username}</div>
                  <div className="tournament-participant-skill">Rating: {player.elo_rating}</div>
                </div>
              </div>
              
              <div className="tournament-participant-stats">
                <div className="tournament-participant-rating">
                  <span className="tournament-participant-rating-value">{player.elo_rating}</span>
                  <span className="tournament-participant-rating-label">Rating</span>
                </div>
                {participant.seed && (
                  <div className="tournament-participant-seed">
                    <span className="tournament-participant-seed-value">#{participant.seed}</span>
                    <span className="tournament-participant-seed-label">Seed</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {participants.length === 0 && (
        <div className="tournament-participants-empty">
          <Users size={48} />
          <h3>No Players Registered Yet</h3>
          <p>Be the first to register for this tournament!</p>
        </div>
      )}
    </div>
  );

  const renderBracket = () => {
    // For round robin tournaments, show a different message
    if (tournament.format === 'round_robin') {
      return (
        <div className="tournament-bracket-round-robin">
          <div className="round-robin-message">
            <RotateCcw size={48} />
            <h3>Round Robin Tournament</h3>
            <p>This tournament uses a round robin format where every player faces every other player.</p>
            <p>Please check the "Standings" tab to view the current tournament standings.</p>
          </div>
          
          <div className="round-robin-matches">
            <h3>All Matches</h3>
            <div className="round-robin-matches-grid">
              {matches.map(match => {
                const player1 = match.player1;
                const player2 = match.player2;
                
                return (
                  <div key={match.id} className={`round-robin-match ${match.status}`}>
                    <div className="round-robin-match-header">
                      <span className="round-robin-match-number">
                        Match {match.match_number || match.id.slice(-4)}
                      </span>
                      <div className={`round-robin-match-status ${match.status}`}>
                        {match.status === 'completed' && <CheckCircle size={14} />}
                        {match.status === 'in_progress' && <Play size={14} />}
                        {match.status === 'pending' && <Clock size={14} />}
                      </div>
                    </div>
                    
                    <div className="round-robin-match-players">
                      <div className={`round-robin-player ${match.winner_id === match.player1_id ? 'winner' : ''}`}>
                        <span className="round-robin-player-name">
                          {player1?.username || 'TBD'}
                        </span>
                        {match.score && match.winner_id === match.player1_id && (
                          <Award size={14} className="round-robin-winner-icon" />
                        )}
                      </div>
                      
                      <div className="round-robin-vs">vs</div>
                      
                      <div className={`round-robin-player ${match.winner_id === match.player2_id ? 'winner' : ''}`}>
                        <span className="round-robin-player-name">
                          {player2?.username || 'TBD'}
                        </span>
                        {match.score && match.winner_id === match.player2_id && (
                          <Award size={14} className="round-robin-winner-icon" />
                        )}
                      </div>
                    </div>
                    
                    {match.score && (
                      <div className="round-robin-match-score">
                        {typeof match.score === 'string' ? match.score : 'Score available'}
                      </div>
                    )}
                    
                    {match.date && (
                      <div className="round-robin-match-time">
                        {new Date(match.date).toLocaleString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // For single/double elimination tournaments
    return (
      <div className="tournament-bracket">
        {matches.length > 0 ? (
          <div className="tournament-bracket-content">
            <div className="tournament-bracket-header">
              <h3>Tournament Bracket</h3>
              <div className="tournament-bracket-legend">
                <div className="tournament-bracket-legend-item">
                  <div className="tournament-bracket-status completed"></div>
                  <span>Completed</span>
                </div>
                <div className="tournament-bracket-legend-item">
                  <div className="tournament-bracket-status in-progress"></div>
                  <span>In Progress</span>
                </div>
                <div className="tournament-bracket-legend-item">
                  <div className="tournament-bracket-status pending"></div>
                  <span>Pending</span>
                </div>
              </div>
            </div>

            {/* Group matches by round */}
            {Array.from(new Set(matches.map(m => m.round || 1))).sort().map(round => {
              const roundMatches = matches.filter(m => (m.round || 1) === round);
              const maxRound = Math.max(...matches.map(m => m.round || 1));
              
              // Determine round name based on format
              let roundName = `Round ${round}`;
              
              if (tournament.format === 'single_elimination') {
                if (round === maxRound) {
                  roundName = 'Final';
                } else if (round === maxRound - 1) {
                  roundName = 'Semi-Final';
                }
              } else if (tournament.format === 'double_elimination') {
                const winnersRounds = Math.ceil(Math.log2(tournament.maxParticipants));
                
                if (round <= winnersRounds) {
                  // Winners bracket
                  if (round === winnersRounds) {
                    roundName = 'Winners Final';
                  } else if (round === winnersRounds - 1) {
                    roundName = 'Winners Semi-Final';
                  } else {
                    roundName = `Winners Round ${round}`;
                  }
                } else if (round === maxRound) {
                  roundName = 'Grand Final';
                } else if (round === maxRound - 1) {
                  roundName = 'Grand Final Reset';
                } else {
                  const losersRound = round - winnersRounds;
                  roundName = `Losers Round ${losersRound}`;
                }
              }

              return (
                <div key={round} className="tournament-bracket-round">
                  <h4 className="tournament-bracket-round-title">{roundName}</h4>
                  
                  <div className="tournament-bracket-matches">
                    {roundMatches
                      .sort((a, b) => (a.match_number || 0) - (b.match_number || 0))
                      .map(match => {
                        const player1 = match.player1;
                        const player2 = match.player2;
                        
                        return (
                          <div key={match.id} className={`tournament-bracket-match ${match.status}`}>
                            <div className="tournament-bracket-match-header">
                              <span className="tournament-bracket-match-number">
                                Match {match.match_number || match.id.slice(-4)}
                              </span>
                              <div className={`tournament-bracket-match-status ${match.status}`}>
                                {match.status === 'completed' && <CheckCircle size={14} />}
                                {match.status === 'in_progress' && <Play size={14} />}
                                {match.status === 'pending' && <Clock size={14} />}
                              </div>
                            </div>
                            
                            <div className="tournament-bracket-match-players">
                              <div className={`tournament-bracket-player ${match.winner_id === match.player1_id ? 'winner' : ''}`}>
                                <span className="tournament-bracket-player-name">
                                  {player1?.username || 'TBD'}
                                </span>
                                {match.score && match.winner_id === match.player1_id && (
                                  <Award size={14} className="tournament-bracket-winner-icon" />
                                )}
                              </div>
                              
                              <div className="tournament-bracket-vs">vs</div>
                              
                              <div className={`tournament-bracket-player ${match.winner_id === match.player2_id ? 'winner' : ''}`}>
                                <span className="tournament-bracket-player-name">
                                  {player2?.username || 'TBD'}
                                </span>
                                {match.score && match.winner_id === match.player2_id && (
                                  <Award size={14} className="tournament-bracket-winner-icon" />
                                )}
                              </div>
                            </div>
                            
                            {match.score && (
                              <div className="tournament-bracket-match-score">
                                {typeof match.score === 'string' ? match.score : 'Score available'}
                              </div>
                            )}
                            
                            {match.date && (
                              <div className="tournament-bracket-match-time">
                                {new Date(match.date).toLocaleString()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="tournament-bracket-empty">
            <Trophy size={48} />
            <h3>Bracket Not Generated Yet</h3>
            <p>
              {tournament.status === 'registration_open' 
                ? 'The tournament bracket will be generated after registration closes.'
                : 'Bracket generation is in progress.'
              }
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderStandings = () => {
    if (tournament.format !== 'round_robin') {
      return (
        <div className="tournament-standings-not-available">
          <Trophy size={48} />
          <h3>Standings Not Available</h3>
          <p>Standings are only available for Round Robin tournaments.</p>
        </div>
      );
    }

    // Calculate standings from matches for round robin
    const standings = participants.map(participant => {
      const playerMatches = matches.filter(match => 
        match.player1_id === participant.player_id || match.player2_id === participant.player_id
      );
      
      const wins = playerMatches.filter(match => 
        match.status === 'completed' && match.winner_id === participant.player_id
      ).length;
      
      const losses = playerMatches.filter(match => 
        match.status === 'completed' && match.winner_id !== participant.player_id && match.winner_id !== null
      ).length;
      
      const matchesPlayed = wins + losses;
      const winPercentage = matchesPlayed > 0 ? (wins / matchesPlayed) * 100 : 0;
      
      return {
        playerId: participant.player_id,
        player: participant.player,
        wins,
        losses,
        matchesPlayed,
        winPercentage,
        position: 0 // Will be calculated after sorting
      };
    }).sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      return b.winPercentage - a.winPercentage;
    }).map((standing, index) => ({
      ...standing,
      position: index + 1
    }));

    return (
      <div className="tournament-standings">
        <div className="tournament-standings-header">
          <h3>Tournament Standings</h3>
          <div className="tournament-standings-note">
            Players ranked by wins, then win percentage
          </div>
        </div>
        
        {standings.length > 0 ? (
          <div className="tournament-standings-table">
            <div className="tournament-standings-table-header">
              <div className="standings-rank-col">Rank</div>
              <div className="standings-player-col">Player</div>
              <div className="standings-record-col">Record</div>
              <div className="standings-win-col">Win %</div>
            </div>
            
            <div className="tournament-standings-table-body">
              {standings.map((standing) => {
                return (
                  <div key={standing.playerId} className="tournament-standings-table-row">
                    <div className="standings-rank-col">
                      <div className="standings-rank">
                        {standing.position === 1 && <Trophy size={16} className="standings-trophy" />}
                        {standing.position}
                      </div>
                    </div>
                    
                    <div className="standings-player-col">
                      <div className="standings-player-info">
                        <div className="player-avatar">
                          {standing.player?.username.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="standings-player-details">
                          <div className="standings-player-name">{standing.player?.username || 'Unknown Player'}</div>
                          <div className="standings-player-rating">Rating: {standing.player?.elo_rating || '?'}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="standings-record-col">
                      <div className="standings-record">
                        <span className="standings-wins">{standing.wins}</span>
                        <span className="standings-separator">-</span>
                        <span className="standings-losses">{standing.losses}</span>
                      </div>
                    </div>
                    
                    <div className="standings-win-col">
                      <div className="standings-win-percentage">
                        {standing.winPercentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="tournament-standings-empty">
            <BarChart3 size={48} />
            <h3>No Matches Completed Yet</h3>
            <p>Standings will be available once matches begin.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tournament-details-page">
      <div className="tournament-details-container">
        {/* Header */}
        <div className="tournament-details-header">
          <button onClick={onBack} className="tournament-details-back-btn">
            <ArrowLeft size={20} />
          </button>
          
          <div className="tournament-details-title-section">
            <h1 className="tournament-details-title">{tournament.name}</h1>
            <div 
              className="tournament-details-status"
              style={{ 
                backgroundColor: `${getStatusColor(tournament.status)}20`,
                color: getStatusColor(tournament.status)
              }}
            >
              {getStatusText(tournament.status)}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="tournament-details-tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`tournament-details-tab ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <Trophy size={16} />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`tournament-details-tab ${activeTab === 'participants' ? 'active' : ''}`}
          >
            <Users size={16} />
            Players ({participants.length})
          </button>
          {tournament.format === 'round_robin' ? (
            <button
              onClick={() => setActiveTab('standings')}
              className={`tournament-details-tab ${activeTab === 'standings' ? 'active' : ''}`}
            >
              <BarChart3 size={16} />
              Standings
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('bracket')}
              className={`tournament-details-tab ${activeTab === 'bracket' ? 'active' : ''}`}
            >
              <Award size={16} />
              Bracket
            </button>
          )}
          {tournament.format === 'round_robin' && (
            <button
              onClick={() => setActiveTab('bracket')}
              className={`tournament-details-tab ${activeTab === 'bracket' ? 'active' : ''}`}
            >
              <Play size={16} />
              Matches
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="tournament-details-content">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'participants' && renderParticipants()}
          {activeTab === 'bracket' && renderBracket()}
          {activeTab === 'standings' && renderStandings()}
        </div>
      </div>
    </div>
  );
};

export default TournamentDetailsPage;