import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Clock, 
  Trophy, 
  Target,
  TrendingUp,
  BarChart3,
  Play,
  Award,
  Users,
  Activity,
  Zap,
  Star
} from 'lucide-react';
import type { Match } from '../types';
import { useAuthStore } from '../stores/authStore';
import MatchRequestActions from './matches/MatchRequestActions';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../lib/supabase';

interface PlayerProfile {
  username: string;
  elo_rating: number;
  [key: string]: unknown;
}

interface MatchStatistics {
  possession: { user: number; opponent: number };
  shots: { user: number; opponent: number };
  aces: { user: number; opponent: number };
  doubleFaults: { user: number; opponent: number };
  breakPoints: { user: { won: number; total: number }; opponent: { won: number; total: number } };
  winners: { user: number; opponent: number };
  unforcedErrors: { user: number; opponent: number };
}

interface MatchTimeline {
  time: string;
  event: string;
  player: string;
  description: string;
  type: 'point' | 'game' | 'set' | 'break' | 'ace' | 'winner' | 'error';
}

interface MatchHighlight {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'ace' | 'winner' | 'break_point' | 'rally' | 'comeback';
  videoUrl?: string;
}

interface MatchDetailsPageProps {
  match: Match;
  onBack: () => void;
  onActionComplete?: () => void;
  onStartScoring?: () => void;
}

const MatchDetailsPage: React.FC<MatchDetailsPageProps> = ({ 
  match, 
  onBack, 
  onActionComplete = () => {},
  onStartScoring
}) => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'statistics' | 'timeline' | 'highlights'>('overview');
  const [player1Profile, setPlayer1Profile] = useState<PlayerProfile | null>(null);
  const [player2Profile, setPlayer2Profile] = useState<PlayerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statistics, setStatistics] = useState<MatchStatistics | null>(null);
  const [timeline, setTimeline] = useState<MatchTimeline[]>([]);
  const [highlights, setHighlights] = useState<MatchHighlight[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Determine which player is the current user and which is the opponent
  const isUserChallenger = match.player1_id === user?.id;
  const opponent = isUserChallenger ? match.player2_id : match.player1_id;
  // Get opponent username from fetched profiles (fallback to 'Opponent')
  const opponentUsername = isUserChallenger ? player2Profile?.username : player1Profile?.username;

  const matchDate = new Date(match.date);
  const isCompleted = match.status === 'completed';

  const loadMatchData = useCallback(async () => {
    if (!match.id) return;
    
    setIsLoading(true);
    try {
      const { data: matchData, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!matches_player1_id_fkey(username, elo_rating),
          player2:profiles!matches_player2_id_fkey(username, elo_rating)
        `)
        .eq('id', match.id)
        .single();

      if (error) throw error;

      setPlayer1Profile(matchData.player1 as PlayerProfile);
      setPlayer2Profile(matchData.player2 as PlayerProfile);

      // Fetch match events for timeline
      const { data: matchEvents, error: eventsError } = await supabase
        .from('match_events')
        .select('*')
        .eq('match_id', match.id)
        .order('timestamp', { ascending: true });
      
      // Note: match_statistics and match_highlights tables don't exist in current schema
      // Using mock data for now until these tables are created
      
      // Process statistics - using mock data since match_statistics table doesn't exist
      // TODO: Create match_statistics table or calculate from match_events
      setStatistics({
        possession: {
          user: 52,
          opponent: 48
        },
        shots: {
          user: 45,
          opponent: 38
        },
        aces: {
          user: 3,
          opponent: 2
        },
        doubleFaults: {
          user: 1,
          opponent: 2
        },
        breakPoints: {
          user: { 
            won: 2, 
            total: 4 
          },
          opponent: { 
            won: 1, 
            total: 3 
          }
        },
        winners: {
          user: 12,
          opponent: 8
        },
        unforcedErrors: {
          user: 8,
          opponent: 12
        }
      });
      
      // Process timeline events if available
      if (matchEvents && !eventsError) {
 const timeline: MatchTimeline[] = matchEvents.map(event => ({
          id: event.id,
          time: event.timestamp ? new Date(event.timestamp).toLocaleTimeString('en-US', {
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : '',
          event: event.event_type,
          player: event.player_id === match.player1_id ? 
            (player1Profile?.username || 'Player 1') : 
            (player2Profile?.username || 'Player 2'),
          description: event.description || '',
          type: event.event_type as 'error' | 'ace' | 'winner' | 'point' | 'game' | 'set' | 'break'
        }));
        setTimeline(timeline);
      }
      
      // Process highlights - using mock data since match_highlights table doesn't exist
      // TODO: Create match_highlights table or generate from match_events
      const mockHighlights: MatchHighlight[] = [
        {
          id: '1',
          title: 'Ace on Match Point',
          description: 'Powerful serve down the T to close out the match',
          timestamp: '2024-01-15T14:45:30Z',
          type: 'ace'
        },
        {
          id: '2',
          title: 'Break Point Conversion',
          description: 'Crucial break in the second set with a forehand winner',
          timestamp: '2024-01-15T14:32:15Z',
          type: 'winner'
        }
      ];
      setHighlights(mockHighlights);
    } catch (error: unknown) {
      console.error('Error loading match:', error);
      setError('Failed to load match details');
    } finally {
      setIsLoading(false);
    }
  }, [match.id, isUserChallenger, match.player1_id, match.player2_id, player1Profile?.username, player2Profile?.username]);

  useEffect(() => {
    loadMatchData();
  }, [loadMatchData]);

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
        return String(status);
    }
  };



  const renderOverview = () => (
    <div className="tournament-details-overview">
      {/* Match Score */}
      {isCompleted && player1Profile && player2Profile && (
        <div className="match-score-section">
          <h3 className="match-details-section-title">Final Score</h3>
          <div className="match-score-display">
            <div className="match-score-player">
              <div className="match-score-name">{isUserChallenger ? player1Profile.username : player2Profile.username}</div>
              <div className="match-score-value">{isUserChallenger ? match.challengerScore : match.challengedScore}</div>
            </div>
            <div className="match-score-separator">-</div>
            <div className="match-score-player">
              <div className="match-score-name">{isUserChallenger ? player2Profile.username : player1Profile.username}</div>
              <div className="match-score-value">{isUserChallenger ? match.challengedScore : match.challengerScore}</div>
            </div>
          </div>
          
          {match.winner && (
            <div className="match-winner-display">
              <Trophy size={20} />
              <span>Winner: {match.winner === user?.id ? 'You' : match.winnerProfile?.username || opponentUsername || 'Opponent'}</span>
            </div>
          )}
        </div>
      )}

      {/* Match Information */}
      <div className="match-info-grid">
        <div className="match-info-card">
          <div className="match-info-header">
            <Calendar size={20} />
            <span>Match Details</span>
          </div>
          <div className="match-info-content">
            <div className="match-info-item">
              <span className="match-info-label">Date:</span>
              <span className="match-info-value">{matchDate.toLocaleDateString()}</span>
            </div>
            <div className="match-info-item">
              <span className="match-info-label">Time:</span>
              <span className="match-info-value">{matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="match-info-item">
              <span className="match-info-label">Status:</span>
              <span 
                className="match-info-status"
                style={{ color: getStatusColor(match.status) }}
              >
                {getStatusText(match.status)}
              </span>
            </div>
            <div className="match-info-item">
              <span className="match-info-label">Duration:</span>
              <span className="match-info-value">2h 15m</span>
            </div>
          </div>
        </div>

        <div className="match-info-card">
          <div className="match-info-header">
            <MapPin size={20} />
            <span>Venue</span>
          </div>
          <div className="match-info-content">
            <div className="match-info-item">
              <span className="match-info-label">Location:</span>
              <span className="match-info-value">{match.location}</span>
            </div>
            <div className="match-info-item">
              <span className="match-info-label">Court Type:</span>
              <span className="match-info-value">
                {match.location.includes('grass') ? 'Grass' : 
                 match.location.includes('clay') ? 'Clay' : 
                 match.location.includes('hard') ? 'Hard' : 'Standard'}
              </span>
            </div>
          </div>
        </div>

        <div className="match-info-card">
          <div className="match-info-header">
            <Users size={20} />
            <span>Players</span>
          </div>
          {player1Profile && player2Profile && (
            <div className="match-info-content">
              <div className="match-players-display">
                <div className="match-player-info">
                  <div className="player-avatar">
                    {player1Profile.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="match-player-details">
                    <div className="match-player-name">{player1Profile.username}</div>
                    <div className="match-player-rating">Rating: {player1Profile.elo_rating}</div>
                  </div>
                </div>
                
                <div className="match-vs">VS</div>
                
                <div className="match-player-info">
                  <div className="player-avatar">
                    {player2Profile.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="match-player-details">
                    <div className="match-player-name">{player2Profile.username}</div>
                    <div className="match-player-rating">Rating: {player2Profile.elo_rating}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Post-Match Analysis */}
      {isCompleted && (
        <div className="match-analysis-section">
          <h3 className="match-details-section-title">Post-Match Analysis</h3>
          <div className="match-analysis-content">
            <div className="analysis-summary">
              <p>
                {match.winner === user?.id 
                  ? "Congratulations on your victory! You showed great composure and executed your game plan effectively."
                  : "A hard-fought match with valuable learning opportunities. Focus on the positives and areas for improvement."
                }
              </p>
            </div>
            
            <div className="analysis-highlights">
              <h4>Key Takeaways:</h4>
              <ul>
                <li>Strong serving performance with {statistics?.aces.user || 0} aces</li>
                <li>Effective net play and court positioning</li>
                <li>Good mental resilience in pressure situations</li>
                <li>Areas to work on: consistency on second serve</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      
      {/* Match Request Actions - Show for pending matches where current user is challenged */}
      {match.status === 'pending' && match.challengedId === user?.id && (
        <div className="match-request-actions-section">
          <h3 className="match-details-section-title">Match Request</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <p className="text-yellow-800 mb-4">
              {match.player1?.username} has challenged you to a match. Please respond to this request.
            </p>
            <MatchRequestActions match={match} onActionComplete={onActionComplete} />
          </div>
        </div>
      )}
      
      {/* Live Scoring Button - Show for in_progress matches */}
      {match.status === 'in_progress' && onStartScoring && (
        <div className="mt-6">
          <button
            onClick={onStartScoring}
            className="btn btn-primary btn-glare w-full flex items-center justify-center gap-2"
          >
            <Play size={20} />
            Live Scoring Mode
          </button>
        </div>
      )}
    </div>
  );

  const renderStatistics = () => (
    <div className="match-statistics">
      {statistics && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <Activity size={20} />
                <span>Court Coverage</span>
              </div>
              <div className="stat-content">
                <div className="stat-bar">
                  <div className="stat-bar-label">You</div>
                  <div className="stat-bar-container">
                    <div 
                      className="stat-bar-fill user"
                      style={{ width: `${statistics.possession.user}%` }}
                    />
                    <span className="stat-bar-value">{statistics.possession.user}%</span>
                  </div>
                </div>
                <div className="stat-bar">
                  <div className="stat-bar-label">{opponentUsername}</div>
                  <div className="stat-bar-container">
                    <div 
                      className="stat-bar-fill opponent"
                      style={{ width: `${statistics.possession.opponent}%` }}
                    />
                    <span className="stat-bar-value">{statistics.possession.opponent}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <Target size={20} />
                <span>Total Shots</span>
              </div>
              <div className="stat-content">
                <div className="stat-comparison">
                  <div className="stat-player">
                    <span className="stat-value">{statistics.shots.user}</span>
                    <span className="stat-label">You</span>
                  </div>
                  <div className="stat-player">
                    <span className="stat-value">{statistics.shots.opponent}</span>
                    <span className="stat-label">{opponentUsername}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <Zap size={20} />
                <span>Aces</span>
              </div>
              <div className="stat-content">
                <div className="stat-comparison">
                  <div className="stat-player">
                    <span className="stat-value">{statistics.aces.user}</span>
                    <span className="stat-label">You</span>
                  </div>
                  <div className="stat-player">
                    <span className="stat-value">{statistics.aces.opponent}</span>
                    <span className="stat-label">{opponentUsername}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <Award size={20} />
                <span>Winners</span>
              </div>
              <div className="stat-content">
                <div className="stat-comparison">
                  <div className="stat-player">
                    <span className="stat-value">{statistics.winners.user}</span>
                    <span className="stat-label">You</span>
                  </div>
                  <div className="stat-player">
                    <span className="stat-value">{statistics.winners.opponent}</span>
                    <span className="stat-label">{opponentUsername}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <TrendingUp size={20} />
                <span>Break Points</span>
              </div>
              <div className="stat-content">
                <div className="stat-comparison">
                  <div className="stat-player">
                    <span className="stat-value">
                      {statistics.breakPoints.user.won}/{statistics.breakPoints.user.total}
                    </span>
                    <span className="stat-label">You</span>
                  </div>
                  <div className="stat-player">
                    <span className="stat-value">
                      {statistics.breakPoints.opponent.won}/{statistics.breakPoints.opponent.total}
                    </span>
                    <span className="stat-label">{opponentUsername}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <Activity size={20} />
                <span>Unforced Errors</span>
              </div>
              <div className="stat-content">
                <div className="stat-comparison">
                  <div className="stat-player">
                    <span className="stat-value">{statistics.unforcedErrors.user}</span>
                    <span className="stat-label">You</span>
                  </div>
                  <div className="stat-player">
                    <span className="stat-value">{statistics.unforcedErrors.opponent}</span>
                    <span className="stat-label">{opponentUsername}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderTimeline = () => (
    <div className="match-timeline">
      <div className="timeline-container">
        {timeline.map((event, index) => (
          <div key={index} className={`timeline-event ${event.type}`}>
            <div className="timeline-marker">
              {event.type === 'ace' && <Zap size={16} />}
              {event.type === 'winner' && <Star size={16} />}
              {event.type === 'break' && <Target size={16} />}
              {event.type === 'set' && <Trophy size={16} />}
              {event.type === 'game' && <Play size={16} />}
              {event.type === 'point' && <Activity size={16} />}
              {event.type === 'error' && <Activity size={16} />}
            </div>
            <div className="timeline-content">
              <div className="timeline-header">
                <span className="timeline-time">{event.time}</span>
                <span className="timeline-event-type">{event.event}</span>
              </div>
              <div className="timeline-details">
                <span className="timeline-player">{event.player}</span>
                <span className="timeline-description">{event.description}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderHighlights = () => (
    <div className="match-highlights">
      <div className="highlights-grid">
        {highlights.map((highlight) => (
          <div key={highlight.id} className="highlight-card">
            <div className="highlight-header">
              <div className="highlight-type">
                {highlight.type === 'ace' && <Zap size={20} />}
                {highlight.type === 'winner' && <Star size={20} />}
                {highlight.type === 'break_point' && <Target size={20} />}
                {highlight.type === 'rally' && <Activity size={20} />}
                {highlight.type === 'comeback' && <TrendingUp size={20} />}
              </div>
              <span className="highlight-timestamp">{highlight.timestamp}</span>
            </div>
            <div className="highlight-content">
              <h4 className="highlight-title">{highlight.title}</h4>
              <p className="highlight-description">{highlight.description}</p>
            </div>
            <div className="highlight-actions">
              <button className="highlight-play-btn">
                <Play size={16} />
                Watch Clip
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!opponent) return null;

  return (
    <div className="match-details-page">
      <div className="match-details-container">
        {/* Header */}
        <div className="match-details-header">
          <button onClick={onBack} className="match-details-back-btn">
            <ArrowLeft size={20} />
          </button>
          
          <div className="match-details-title-section">
            <h1 className="match-details-title">
              {isUserChallenger ? player1Profile?.username || 'You' : player2Profile?.username || 'You'} vs {opponentUsername || 'Opponent'}
            </h1>
            <div 
              className="match-details-status"
              style={{ 
                backgroundColor: `${getStatusColor(match.status)}20`,
                color: getStatusColor(match.status)
              }}
            >
              {getStatusText(match.status)}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="match-details-tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`match-details-tab ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <Trophy size={16} />
            Overview
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`match-details-tab ${activeTab === 'statistics' ? 'active' : ''}`}
          >
            <BarChart3 size={16} />
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`match-details-tab ${activeTab === 'timeline' ? 'active' : ''}`}
          >
            <Clock size={16} />
            Timeline
          </button>
          <button
            onClick={() => setActiveTab('highlights')}
            className={`match-details-tab ${activeTab === 'highlights' ? 'active' : ''}`}
          >
            <Star size={16} />
            Highlights
          </button>
        </div>

        {/* Tab Content */}
        <div className="match-details-content">
          {isLoading ? (
            <div className="match-details-loading">
              <LoadingSpinner size="large" text="Loading match data..." />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'statistics' && renderStatistics()}
              {activeTab === 'timeline' && renderTimeline()}
              {activeTab === 'highlights' && renderHighlights()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchDetailsPage;