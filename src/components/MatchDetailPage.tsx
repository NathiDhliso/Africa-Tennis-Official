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
  Star,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Match } from '../types';
import { useAuthStore } from '../stores/authStore';
import MatchRequestActions from './matches/MatchRequestActions';
import LoadingSpinner from './LoadingSpinner';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/aws';
import type { Database } from '../types/database';

type Match = Database['public']['Tables']['matches']['Row'];

interface MatchDetailsPageProps {
  match: Match;
  onBack: () => void;
  onActionComplete?: () => void;
  onStartScoring?: () => void;
}

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
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // Determine which player is the current user and which is the opponent
  const isUserChallenger = match.player1_id === user?.id;
  const opponent = isUserChallenger ? match.player2_id : match.player1_id;
  const currentUser = isUserChallenger ? match.player1_id : match.player2_id;

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
      setSummary(matchData.summary);

      // Generate mock statistics as fallback
      const mockStats: MatchStatistics = {
        possession: { 
          user: Math.floor(Math.random() * 20) + 40, 
          opponent: 0 
        },
        shots: { 
          user: Math.floor(Math.random() * 50) + 80, 
          opponent: Math.floor(Math.random() * 50) + 80 
        },
        aces: { 
          user: Math.floor(Math.random() * 8) + 2, 
          opponent: Math.floor(Math.random() * 8) + 2 
        },
        doubleFaults: { 
          user: Math.floor(Math.random() * 4), 
          opponent: Math.floor(Math.random() * 4) 
        },
        breakPoints: {
          user: { won: Math.floor(Math.random() * 4) + 1, total: Math.floor(Math.random() * 3) + 3 },
          opponent: { won: Math.floor(Math.random() * 4) + 1, total: Math.floor(Math.random() * 3) + 3 }
        },
        winners: { 
          user: Math.floor(Math.random() * 20) + 15, 
          opponent: Math.floor(Math.random() * 20) + 15 
        },
        unforcedErrors: { 
          user: Math.floor(Math.random() * 15) + 10, 
          opponent: Math.floor(Math.random() * 15) + 10 
        }
      };
      
      // Calculate opponent possession
      mockStats.possession.opponent = 100 - mockStats.possession.user;
      
      // Generate mock timeline
      const mockTimeline: MatchTimeline[] = [
        { time: '0:05', event: 'Match Start', player: 'System', description: 'Match begins', type: 'game' },
        { time: '0:12', event: 'Ace', player: player1Profile?.username || 'You', description: 'Service ace down the T', type: 'ace' },
        { time: '0:28', event: 'Winner', player: player2Profile?.username || 'Opponent', description: 'Forehand winner cross-court', type: 'winner' },
        { time: '0:45', event: 'Break Point', player: player1Profile?.username || 'You', description: 'Break point converted', type: 'break' },
        { time: '1:15', event: 'Set Won', player: 'Unknown', description: 'First set completed', type: 'set' },
      ];
      
      // Generate mock highlights
      const mockHighlights: MatchHighlight[] = [
        {
          id: '1',
          title: 'Amazing Rally',
          description: '32-shot rally ending with a spectacular winner',
          timestamp: '1:23:45',
          type: 'rally'
        },
        {
          id: '2',
          title: 'Service Ace',
          description: 'Powerful ace at 125 mph to save break point',
          timestamp: '0:45:12',
          type: 'ace'
        },
        {
          id: '3',
          title: 'Break Point Conversion',
          description: 'Crucial break in the deciding set',
          timestamp: '2:15:30',
          type: 'break_point'
        },
        {
          id: '4',
          title: 'Comeback Victory',
          description: 'Won from 2 sets down in thrilling fashion',
          timestamp: '2:45:00',
          type: 'comeback'
        }
      ];
      
      setStatistics(mockStats);
      setTimeline(mockTimeline);
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
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Format score for display
  const getFormattedScore = () => {
    if (typeof match.score === 'string') {
      return match.score;
    } 
    
    if (match.score && typeof match.score === 'object') {
      try {
        const scoreObj = match.score as Record<string, unknown>;
        const sets = scoreObj.sets as Array<Record<string, number>> || [];
        if (sets.length === 0) return 'No sets played';
        
        return sets.map((set: Record<string, number>) => 
          `${set.player1_games}-${set.player2_games}`
        ).join(', ');
      } catch (err) {
        console.error('Error formatting score:', err);
        return 'Score unavailable';
      }
    }
    
    return 'Score unavailable';
  };

  const handleGenerateSummary = async () => {
    if (!match.id || !isCompleted) return;
    
    setIsGeneratingSummary(true);
    setError(null);
    
    try {
      const response = await apiClient.generateMatchSummary(match.id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate match summary');
      }
      
      const generatedSummary = response.data?.summary;
      if (generatedSummary) {
        setSummary(generatedSummary);
        
        // Also update the match in the database with the new summary
        await supabase
          .from('matches')
          .update({ summary: generatedSummary })
          .eq('id', match.id);
      }
    } catch (err: any) {
      console.error('Error generating match summary:', err);
      setError('Failed to generate match summary. Please try again later.');
    } finally {
      setIsGeneratingSummary(false);
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
          
          {match.winner_id && (
            <div className="match-winner-display">
              <Trophy size={20} />
              <span>Winner: {match.winner_id === user?.id ? 'You' : match.player1_id === match.winner_id ? player1Profile.username : player2Profile.username}</span>
            </div>
          )}
        </div>
      )}

      {/* Match Summary Section */}
      {isCompleted && (
        <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-standard)' }}>
              <Sparkles className="h-5 w-5 text-quantum-cyan" />
              AI Match Summary
            </h2>
            
            {!summary && !isGeneratingSummary && (
              <button 
                onClick={handleGenerateSummary}
                className="btn btn-primary btn-sm"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Generate Summary
              </button>
            )}
          </div>
          
          {isGeneratingSummary ? (
            <div className="bg-bg-elevated rounded-lg p-6 text-center">
              <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-quantum-cyan" />
              <p className="text-text-standard">Generating match summary with AI...</p>
              <p className="text-text-subtle text-sm mt-2">This may take a few moments</p>
            </div>
          ) : summary ? (
            <div className="bg-bg-elevated rounded-lg p-6">
              <div className="relative">
                <div className="absolute -left-2 top-0 bottom-0 w-1 bg-quantum-cyan rounded-full"></div>
                <div className="pl-4">
                  <p className="text-text-standard leading-relaxed">{summary}</p>
                  <div className="mt-4 text-right">
                    <span className="text-xs text-text-subtle italic">Generated by AI</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-bg-elevated rounded-lg p-6 text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-text-muted" />
              <h3 className="text-lg font-medium text-text-standard mb-2">No Summary Available</h3>
              <p className="text-text-subtle mb-4">Generate an AI-powered summary of this match to get insights and highlights.</p>
              <button 
                onClick={handleGenerateSummary}
                className="btn btn-primary"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Generate Match Summary
              </button>
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
                {match.winner_id === user?.id 
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
      {match.status === 'pending' && match.player2_id === user?.id && (
        <div className="match-request-actions-section">
          <h3 className="match-details-section-title">Match Request</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <p className="text-yellow-800 mb-4">
              {player1Profile?.username} has challenged you to a match. Please respond to this request.
            </p>
            <MatchRequestActions match={match as any} onActionComplete={onActionComplete} />
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
                  <div className="stat-bar-label">{opponent?.username}</div>
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
                    <span className="stat-label">{opponent?.username}</span>
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
                    <span className="stat-label">{opponent?.username}</span>
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
                    <span className="stat-label">{opponent?.username}</span>
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
                    <span className="stat-label">{opponent?.username}</span>
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
                    <span className="stat-label">{opponent?.username}</span>
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
              {currentUser?.username || 'You'} vs {opponent.username}
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