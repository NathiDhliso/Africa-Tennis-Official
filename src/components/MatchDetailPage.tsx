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
    } catch (error: unknown) {
      console.error('Error loading match:', error);
      setError('Failed to load match details');
    } finally {
      setIsLoading(false);
    }
  }, [match.id]);

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
              <div className="match-score-value">{isUserChallenger ? match.score?.sets?.[0]?.player1_games : match.score?.sets?.[0]?.player2_games}</div>
            </div>
            <div className="match-score-separator">-</div>
            <div className="match-score-player">
              <div className="match-score-name">{isUserChallenger ? player2Profile.username : player1Profile.username}</div>
              <div className="match-score-value">{isUserChallenger ? match.score?.sets?.[0]?.player2_games : match.score?.sets?.[0]?.player1_games}</div>
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
      <div className="text-center py-8">
        <Activity size={48} className="mx-auto mb-4 text-text-muted" />
        <h3 className="text-lg font-medium text-text-standard mb-2">Match Statistics</h3>
        <p className="text-text-subtle">
          Detailed match statistics will be available after the match is completed and processed.
        </p>
      </div>
    </div>
  );

  const renderTimeline = () => (
    <div className="match-timeline">
      <div className="text-center py-8">
        <Clock size={48} className="mx-auto mb-4 text-text-muted" />
        <h3 className="text-lg font-medium text-text-standard mb-2">Match Timeline</h3>
        <p className="text-text-subtle">
          The match timeline will show key events as they happen during the match.
        </p>
      </div>
    </div>
  );

  const renderHighlights = () => (
    <div className="match-highlights">
      <div className="text-center py-8">
        <Star size={48} className="mx-auto mb-4 text-text-muted" />
        <h3 className="text-lg font-medium text-text-standard mb-2">Match Highlights</h3>
        <p className="text-text-subtle">
          Match highlights will be available after the match is completed.
        </p>
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