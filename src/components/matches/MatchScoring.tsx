import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  Clock, 
  Trophy, 
  Users,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Minus,
  Zap,
  Target,
  Award,
  Gavel,
  Info,
  Sparkles,
  Loader2,
  X,
  Video,
  Camera
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/aws';
import LoadingSpinner from '../LoadingSpinner';
import ErrorDisplay from '../ErrorDisplay';
import VideoTrackingPanel from '../video/VideoTrackingPanel';
import type { Database } from '../../types/database';

type Tournament = Database['public']['Tables']['tournaments']['Row'];
type Match = Database['public']['Tables']['matches']['Row'] & {
  player1?: { username: string; elo_rating: number }
  player2?: { username: string; elo_rating: number }
};

interface MatchScore {
  sets: Array<{
    player1_games: number;
    player2_games: number;
    games: Array<{
      player1_points: number;
      player2_points: number;
      server_id: string;
    }>;
  }>;
  current_game: {
    player1: string;
    player2: string;
  };
  server_id: string;
  is_tiebreak: boolean;
}

interface MatchScoreHistory {
  score: MatchScore;
  timestamp: number;
  action: string;
}

interface ErrorState {
  visible: boolean;
  title: string;
  message: string;
  details?: string;
  type: 'error' | 'warning' | 'info';
}

interface UmpireInsight {
  insight: string;
  timestamp: string;
}

const MatchScoring: React.FC<{
  match: Match;
  onBack: () => void;
}> = ({ match, onBack }) => {
  const { user } = useAuthStore();
  const [score, setScore] = useState<MatchScore | null>(null);
  const [pointType, setPointType] = useState<string>('point_won');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ErrorState>({
    visible: false,
    title: '',
    message: '',
    details: '',
    type: 'error'
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmEndMatch, setConfirmEndMatch] = useState(false);
  const [lastPointPlayerId, setLastPointPlayerId] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<MatchScoreHistory[]>([]);
  const [player1Profile, setPlayer1Profile] = useState<any>(null);
  const [player2Profile, setPlayer2Profile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const scoreRef = useRef<MatchScore | null>(null);
  const [umpireInsight, setUmpireInsight] = useState<UmpireInsight | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [showInsight, setShowInsight] = useState(false);
  const [showVideoTracking, setShowVideoTracking] = useState(false);
  const [savedVideos, setSavedVideos] = useState<string[]>([]);

  // Create a default score object
  const createDefaultScore = (serverId: string): MatchScore => {
    return {
      sets: [{
        player1_games: 0,
        player2_games: 0,
        games: []
      }],
      current_game: { player1: '0', player2: '0' },
      server_id: serverId,
      is_tiebreak: false,
    };
  };

  useEffect(() => {
    const initializeScore = async () => {
      setIsLoading(true);
      try {
        if (match && match.id) {
          // Fetch the latest match data to ensure we have the most up-to-date score
          const { data: matchData, error: matchError } = await supabase
            .from('matches')
            .select(`
              *,
              player1:profiles!matches_player1_id_fkey(username, elo_rating),
              player2:profiles!matches_player2_id_fkey(username, elo_rating)
            `)
            .eq('id', match.id)
            .single();
            
          if (matchError) throw matchError;
          
          if (matchData) {
            // Set player profiles
            setPlayer1Profile(matchData.player1);
            setPlayer2Profile(matchData.player2);
            
            // Initialize score
            let initialScore: MatchScore;
            
            if (matchData.score) {
              try {
                // Handle different score formats
                if (typeof matchData.score === 'string') {
                  initialScore = JSON.parse(matchData.score);
                } else {
                  initialScore = matchData.score as MatchScore;
                }
                
                // Validate the score structure
                if (!initialScore.current_game || !initialScore.sets) {
                  console.warn('Invalid score structure, creating default score');
                  initialScore = createDefaultScore(matchData.player1_id);
                }
              } catch (err) {
                console.error('Error parsing score:', err);
                initialScore = createDefaultScore(matchData.player1_id);
              }
            } else {
              initialScore = createDefaultScore(matchData.player1_id);
            }
            
            setScore(initialScore);
            scoreRef.current = initialScore;
            
            // Initialize score history
            setScoreHistory([{
              score: initialScore,
              timestamp: Date.now(),
              action: 'initial'
            }]);

            // Fetch saved videos for this match
            const { data: eventData } = await supabase
              .from('match_events')
              .select('metadata')
              .eq('match_id', match.id)
              .eq('event_type', 'video_recorded');

            if (eventData && eventData.length > 0) {
              const videos = eventData
                .filter(event => event.metadata && event.metadata.video_url)
                .map(event => event.metadata.video_url);
              setSavedVideos(videos);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing score:', err);
        setError({
          visible: true,
          title: 'Error Loading Match',
          message: 'We couldn\'t load the match data. Please try again.',
          details: err instanceof Error ? err.message : 'Unknown error',
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeScore();

    // Set up real-time subscription for match updates
    const subscription = supabase
      .channel(`match-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${match.id}`
        },
        (payload) => {
          if (payload.new) {
            const newMatch = payload.new as Match;
            if (newMatch.score) {
              try {
                const newScore = typeof newMatch.score === 'string' 
                  ? JSON.parse(newMatch.score) 
                  : newMatch.score as MatchScore;
                  
                setScore(newScore);
                scoreRef.current = newScore;
                
                // Add to score history
                setScoreHistory(prev => [...prev, {
                  score: newScore,
                  timestamp: Date.now(),
                  action: 'update'
                }]);

                if (newMatch.status === 'completed') {
                  setSuccessMessage('Match completed!');
                  setTimeout(() => onBack(), 3000);
                }
              } catch (err) {
                console.error('Error processing score update:', err);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [match.id, match.player1_id, onBack]);

  useEffect(() => {
    if (score) {
      scoreRef.current = score;
    }
  }, [score]);

  const handleAwardPoint = async (playerId: string) => {
    if (isSubmitting || !match.id || !score) return;

    setIsSubmitting(true);
    setError({...error, visible: false});

    try {
      console.log(`Awarding point to player ${playerId} with point type ${pointType}`);
      
      // First try the API Gateway endpoint
      const response = await apiClient.updateMatchScore(match.id, {
        winningPlayerId: playerId,
        pointType: pointType,
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to update score');
      }
      
      // Set the updated score
      if (response.data) {
        const updatedScore = typeof response.data === 'string'
          ? JSON.parse(response.data)
          : response.data as MatchScore;
          
        setScore(updatedScore);
        scoreRef.current = updatedScore;
        
        // Add to score history
        setScoreHistory(prev => [...prev, {
          score: updatedScore,
          timestamp: Date.now(),
          action: 'point'
        }]);
      }
      
      // Visual feedback for the user
      setLastPointPlayerId(playerId);
      setTimeout(() => setLastPointPlayerId(null), 2000);
      
    } catch (apiError) {
      console.error('API error, falling back to direct Supabase call:', apiError);
      
      try {
        // Fallback to direct Supabase RPC call
        const { data, error: supabaseError } = await supabase.rpc('calculate_tennis_score', {
          match_id: match.id,
          winning_player_id: playerId,
          point_type: pointType || 'point_won'
        });
        
        if (supabaseError) throw supabaseError;
        
        if (data) {
          const updatedScore = typeof data === 'string'
            ? JSON.parse(data)
            : data as MatchScore;
            
          setScore(updatedScore);
          scoreRef.current = updatedScore;
          
          // Add to score history
          setScoreHistory(prev => [...prev, {
            score: updatedScore,
            timestamp: Date.now(),
            action: 'point'
          }]);
          
          // Visual feedback for the user
          setLastPointPlayerId(playerId);
          setTimeout(() => setLastPointPlayerId(null), 2000);
        }
      } catch (supabaseError) {
        console.error('Supabase error:', supabaseError);
        setError({
          visible: true,
          title: 'Scoring System Error',
          message: 'We couldn\'t update the score. The scoring system is currently unavailable.',
          details: supabaseError instanceof Error ? supabaseError.message : 'Unknown error',
          type: 'error'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndo = async () => {
    if (scoreHistory.length > 1 && !isSubmitting) {
      setIsSubmitting(true);
      setError({...error, visible: false});
      
      try {
        // Remove the current score and go back to the previous one
        const newHistory = [...scoreHistory];
        newHistory.pop(); // Remove current score
        const previousScore = newHistory[newHistory.length - 1].score;
        
        // Update the match with the previous score
        const { error: updateError } = await supabase
          .from('matches')
          .update({ 
            score: previousScore,
            updated_at: new Date().toISOString()
          })
          .eq('id', match.id);
          
        if (updateError) throw updateError;
        
        setScoreHistory(newHistory);
        setScore(previousScore);
        scoreRef.current = previousScore;
      } catch (err: any) {
        console.error('Error undoing point:', err);
        setError({
          visible: true,
          title: 'Undo Failed',
          message: 'We couldn\'t undo your last action. Please try again.',
          details: err.message,
          type: 'error'
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleEndMatch = async () => {
    setConfirmEndMatch(true);
  };

  const confirmMatchEnd = async () => {
    setIsSubmitting(true);
    try {
      // Determine the winner based on sets won
      const winnerId = getMatchWinner();
      
      if (!winnerId) {
        throw new Error('Cannot determine match winner');
      }
      
      const { error } = await supabase
        .from('matches')
        .update({
          status: 'completed',
          winner_id: winnerId,
        })
        .eq('id', match.id);
        
      if (error) throw error;

      setSuccessMessage('Match completed successfully!');
      setTimeout(() => {
        onBack();
      }, 3000);
    } catch (err: any) {
      console.error('Error ending match:', err);
      setError({
        visible: true,
        title: 'Error Ending Match',
        message: 'We couldn\'t complete the match. Please try again.',
        details: err.message,
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
      setConfirmEndMatch(false);
    }
  };

  const getMatchWinner = (): string => {
    if (!score || !score.sets || score.sets.length === 0) {
      return match.player1_id; // Default to player1 if no score data
    }
    
    let player1SetsWon = 0;
    let player2SetsWon = 0;

    score.sets.forEach(set => {
      if (set.player1_games > set.player2_games) {
        player1SetsWon++;
      } else if (set.player2_games > set.player1_games) {
        player2SetsWon++;
      }
    });

    // Assuming a best-of-3 match for now
    if (player1SetsWon >= 2) return match.player1_id;
    if (player2SetsWon >= 2) return match.player2_id;

    // If no clear winner yet, return the player with more sets
    if (player1SetsWon > player2SetsWon) return match.player1_id;
    if (player2SetsWon > player1SetsWon) return match.player2_id;

    // If still tied, return the player with more games in the current set
    const currentSet = score.sets[score.sets.length - 1];
    if (currentSet.player1_games > currentSet.player2_games) return match.player1_id;
    if (currentSet.player2_games > currentSet.player1_games) return match.player2_id;

    // If everything is tied, default to player1
    return match.player1_id;
  };

  const getPointTypeLabel = (type: string): string => {
    switch (type) {
      case 'ace': return 'Ace';
      case 'winner': return 'Winner';
      case 'double_fault': return 'Double Fault';
      case 'forced_error': return 'Forced Error';
      case 'unforced_error': return 'Unforced Error';
      default: return 'Point';
    }
  };

  const getPointTypeColor = (type: string): string => {
    switch (type) {
      case 'ace': return 'var(--accent-yellow)';
      case 'winner': return 'var(--success-green)';
      case 'double_fault': return 'var(--error-pink)';
      case 'forced_error': return 'var(--warning-orange)';
      case 'unforced_error': return 'var(--nebula-purple)';
      default: return 'var(--quantum-cyan)';
    }
  };

  const handleGetUmpireInsight = async () => {
    if (!score) return;
    
    setIsGeneratingInsight(true);
    setError({...error, visible: false});
    
    try {
      console.log('Requesting umpire insight from API');
      const response = await apiClient.getUmpireInsight(match.id, score);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get umpire insight');
      }
      
      setUmpireInsight(response.data as UmpireInsight);
      setShowInsight(true);
      
      // Auto-hide insight after 10 seconds
      setTimeout(() => {
        setShowInsight(false);
      }, 10000);
    } catch (err: any) {
      console.error('Error getting umpire insight:', err);
      setError({
        visible: true,
        title: 'AI Insight Failed',
        message: 'We couldn\'t fetch the AI umpire insight right now. This may be due to a temporary server issue or network problem. Please try again shortly.',
        details: err.message,
        type: 'error'
      });
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const handleVideoSaved = (videoUrl: string) => {
    setSavedVideos(prev => [...prev, videoUrl]);
    setShowVideoTracking(false);
    setSuccessMessage('Video saved successfully!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const dismissError = () => {
    setError({...error, visible: false});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="large" text="Loading match data..." />
      </div>
    );
  }

  if (!score) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ErrorDisplay
          type="error"
          title="Match Data Error"
          message="We couldn't load the match scoring data. Please try going back and entering the match again."
          onDismiss={onBack}
        />
      </div>
    );
  }

  if (showVideoTracking) {
    return (
      <VideoTrackingPanel 
        matchId={match.id} 
        onVideoSaved={handleVideoSaved}
        onClose={() => setShowVideoTracking(false)}
      />
    );
  }

  return (
    <div className="umpire-scoring-page">
      <div className="umpire-scoring-container">
        {/* Header */}
        <div className="umpire-scoring-header">
          <button
            onClick={onBack}
            className="umpire-back-btn"
            disabled={isSubmitting}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="umpire-scoring-match-info">
            Live Scoring: {match.player1?.username} vs {match.player2?.username}
          </div>
          <div className="umpire-scoring-set">
            {score.is_tiebreak ? 'Tiebreak' : `Set ${score.sets.length}`}
          </div>
        </div>

        {/* Error/Success Messages */}
        {error.visible && (
          <ErrorDisplay
            type={error.type}
            title={error.title}
            message={error.message}
            details={error.details}
            onDismiss={dismissError}
          />
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 mb-4">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        {/* AI Umpire Insight */}
        {showInsight && umpireInsight && (
          <div className="bg-quantum-cyan bg-opacity-10 border border-quantum-cyan border-opacity-20 rounded-lg p-4 mb-4 relative">
            <button 
              onClick={() => setShowInsight(false)}
              className="absolute top-2 right-2 text-text-subtle hover:text-text-standard"
            >
              <X size={16} />
            </button>
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-quantum-cyan flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center">
                  <h3 className="text-sm font-medium text-quantum-cyan">AI Umpire Insight</h3>
                  <span className="ml-2 text-xs px-1.5 py-0.5 bg-warning-orange bg-opacity-20 text-warning-orange rounded-full">BETA</span>
                </div>
                <p className="text-text-standard mt-1">{umpireInsight.insight}</p>
              </div>
            </div>
          </div>
        )}

        {/* Saved Videos Section */}
        {savedVideos.length > 0 && (
          <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4 mb-4">
            <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
              <Video className="h-5 w-5 text-quantum-cyan" />
              Match Videos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedVideos.map((videoUrl, index) => (
                <div key={index} className="saved-video-item">
                  <video 
                    src={videoUrl} 
                    controls 
                    className="w-full h-auto rounded-md"
                    style={{ maxHeight: '150px' }}
                  />
                  <div className="text-xs text-text-subtle mt-1">
                    Video {index + 1} - {new Date().toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scoreboard */}
        <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-6 mb-6">
          <div className="grid grid-cols-3 gap-4">
            {/* Player 1 */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="player-avatar">
                  {match.player1?.username.charAt(0).toUpperCase() || 'P1'}
                </div>
                <div className="font-bold text-lg">{match.player1?.username || 'Player 1'}</div>
                {score.server_id === match.player1_id && (
                  <div className="w-3 h-3 bg-accent-yellow rounded-full animate-pulse" title="Serving"></div>
                )}
              </div>
              
              {/* Sets */}
              <div className="flex justify-center gap-2 mb-4">
                {score.sets.map((set, index) => (
                  <div 
                    key={index} 
                    className="w-8 h-8 flex items-center justify-center bg-bg-elevated border border-border-subtle rounded-md font-mono font-bold"
                  >
                    {set.player1_games}
                  </div>
                ))}
              </div>
              
              {/* Current Game */}
              <div className={`text-3xl font-bold font-mono transition-all duration-500 ease-in-out ${lastPointPlayerId === match.player1_id ? 'text-success-green scale-125' : ''}`}>
                {score.current_game.player1}
              </div>
            </div>
            
            {/* Center/Score Info */}
            <div className="text-center flex flex-col items-center justify-center">
              <div className="text-xl font-bold mb-2">VS</div>
              {score.is_tiebreak ? (
                <div className="text-sm bg-warning-orange bg-opacity-20 text-warning-orange px-3 py-1 rounded-full">
                  Tiebreak
                </div>
              ) : (
                score.current_game.player1 === '40' && score.current_game.player2 === '40' ? (
                  <div className="text-sm bg-accent-yellow bg-opacity-20 text-accent-yellow px-3 py-1 rounded-full">
                    Deuce
                  </div>
                ) : (
                  score.current_game.player1 === 'AD' ? (
                    <div className="text-sm bg-quantum-cyan bg-opacity-20 text-quantum-cyan px-3 py-1 rounded-full">
                      Advantage {match.player1?.username}
                    </div>
                  ) : (
                    score.current_game.player2 === 'AD' ? (
                      <div className="text-sm bg-quantum-cyan bg-opacity-20 text-quantum-cyan px-3 py-1 rounded-full">
                        Advantage {match.player2?.username}
                      </div>
                    ) : null
                  )
                )
              )}
            </div>
            
            {/* Player 2 */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="player-avatar">
                  {match.player2?.username.charAt(0).toUpperCase() || 'P2'}
                </div>
                <div className="font-bold text-lg">{match.player2?.username || 'Player 2'}</div>
                {score.server_id === match.player2_id && (
                  <div className="w-3 h-3 bg-accent-yellow rounded-full animate-pulse" title="Serving"></div>
                )}
              </div>
              
              {/* Sets */}
              <div className="flex justify-center gap-2 mb-4">
                {score.sets.map((set, index) => (
                  <div 
                    key={index} 
                    className="w-8 h-8 flex items-center justify-center bg-bg-elevated border border-border-subtle rounded-md font-mono font-bold"
                  >
                    {set.player2_games}
                  </div>
                ))}
              </div>
              
              {/* Current Game */}
              <div className={`text-3xl font-bold font-mono transition-all duration-500 ease-in-out ${lastPointPlayerId === match.player2_id ? 'text-success-green scale-125' : ''}`}>
                {score.current_game.player2}
              </div>
            </div>
          </div>
        </div>

        {/* Point Type Selection */}
        <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-bold mb-4">Point Type</h3>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            <button
              onClick={() => setPointType('point_won')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                pointType === 'point_won' 
                  ? 'bg-opacity-20 border-2' 
                  : 'bg-bg-elevated border border-border-subtle hover:bg-hover-bg'
              }`}
              style={{
                backgroundColor: pointType === 'point_won' ? `${getPointTypeColor('point_won')}20` : undefined,
                borderColor: pointType === 'point_won' ? getPointTypeColor('point_won') : undefined,
                color: pointType === 'point_won' ? getPointTypeColor('point_won') : 'var(--text-standard)'
              }}
            >
              Point
            </button>
            <button
              onClick={() => setPointType('ace')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                pointType === 'ace' 
                  ? 'bg-opacity-20 border-2' 
                  : 'bg-bg-elevated border border-border-subtle hover:bg-hover-bg'
              }`}
              style={{
                backgroundColor: pointType === 'ace' ? `${getPointTypeColor('ace')}20` : undefined,
                borderColor: pointType === 'ace' ? getPointTypeColor('ace') : undefined,
                color: pointType === 'ace' ? getPointTypeColor('ace') : 'var(--text-standard)'
              }}
            >
              Ace
            </button>
            <button
              onClick={() => setPointType('winner')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                pointType === 'winner' 
                  ? 'bg-opacity-20 border-2' 
                  : 'bg-bg-elevated border border-border-subtle hover:bg-hover-bg'
              }`}
              style={{
                backgroundColor: pointType === 'winner' ? `${getPointTypeColor('winner')}20` : undefined,
                borderColor: pointType === 'winner' ? getPointTypeColor('winner') : undefined,
                color: pointType === 'winner' ? getPointTypeColor('winner') : 'var(--text-standard)'
              }}
            >
              Winner
            </button>
            <button
              onClick={() => setPointType('double_fault')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                pointType === 'double_fault' 
                  ? 'bg-opacity-20 border-2' 
                  : 'bg-bg-elevated border border-border-subtle hover:bg-hover-bg'
              }`}
              style={{
                backgroundColor: pointType === 'double_fault' ? `${getPointTypeColor('double_fault')}20` : undefined,
                borderColor: pointType === 'double_fault' ? getPointTypeColor('double_fault') : undefined,
                color: pointType === 'double_fault' ? getPointTypeColor('double_fault') : 'var(--text-standard)'
              }}
            >
              Double Fault
            </button>
            <button
              onClick={() => setPointType('forced_error')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                pointType === 'forced_error' 
                  ? 'bg-opacity-20 border-2' 
                  : 'bg-bg-elevated border border-border-subtle hover:bg-hover-bg'
              }`}
              style={{
                backgroundColor: pointType === 'forced_error' ? `${getPointTypeColor('forced_error')}20` : undefined,
                borderColor: pointType === 'forced_error' ? getPointTypeColor('forced_error') : undefined,
                color: pointType === 'forced_error' ? getPointTypeColor('forced_error') : 'var(--text-standard)'
              }}
            >
              Forced Error
            </button>
            <button
              onClick={() => setPointType('unforced_error')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                pointType === 'unforced_error' 
                  ? 'bg-opacity-20 border-2' 
                  : 'bg-bg-elevated border border-border-subtle hover:bg-hover-bg'
              }`}
              style={{
                backgroundColor: pointType === 'unforced_error' ? `${getPointTypeColor('unforced_error')}20` : undefined,
                borderColor: pointType === 'unforced_error' ? getPointTypeColor('unforced_error') : undefined,
                color: pointType === 'unforced_error' ? getPointTypeColor('unforced_error') : 'var(--text-standard)'
              }}
            >
              Unforced Error
            </button>
          </div>
        </div>

        {/* Point Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => handleAwardPoint(match.player1_id)}
            disabled={isSubmitting}
            className="btn btn-primary btn-lg p-6 h-auto flex flex-col items-center"
          >
            {isSubmitting ? (
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
            ) : (
              <Plus className="h-8 w-8 mb-2" />
            )}
            <span className="text-lg font-bold">Point for {match.player1?.username}</span>
          </button>
          
          <button
            onClick={() => handleAwardPoint(match.player2_id)}
            disabled={isSubmitting}
            className="btn btn-primary btn-lg p-6 h-auto flex flex-col items-center"
          >
            {isSubmitting ? (
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
            ) : (
              <Plus className="h-8 w-8 mb-2" />
            )}
            <span className="text-lg font-bold">Point for {match.player2?.username}</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={onBack}
            className="btn btn-ghost flex-1"
            disabled={isSubmitting}
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </button>
          
          <button
            onClick={handleUndo}
            disabled={isSubmitting || scoreHistory.length <= 1}
            className="btn btn-secondary flex-1"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            Undo Last Point
          </button>
          
          <button
            onClick={() => setShowVideoTracking(true)}
            disabled={isSubmitting}
            className="btn btn-secondary flex-1 relative"
          >
            <Camera className="h-5 w-5 mr-2" />
            Video Tracking
            <span className="absolute -top-1 -right-1 text-xs px-1.5 py-0.5 bg-warning-orange text-white rounded-full">NEW</span>
          </button>
          
          <button
            onClick={handleGetUmpireInsight}
            disabled={isGeneratingInsight}
            className="btn btn-secondary flex-1 relative"
          >
            {isGeneratingInsight ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5 mr-2" />
            )}
            AI Insight
            <span className="absolute -top-1 -right-1 text-xs px-1.5 py-0.5 bg-warning-orange text-white rounded-full">BETA</span>
          </button>
          
          <button
            onClick={handleEndMatch}
            className="btn btn-secondary flex-1"
            disabled={isSubmitting}
          >
            <Trophy className="h-5 w-5 mr-2" />
            End Match
          </button>
        </div>

        {/* End Match Confirmation Modal */}
        {confirmEndMatch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <AlertTriangle className="h-6 w-6 text-warning-orange mr-2" />
                End Match Confirmation
              </h3>
              
              <p className="mb-6">
                Are you sure you want to end this match? This will mark the match as completed and calculate the final result.
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setConfirmEndMatch(false)}
                  className="btn btn-ghost flex-1"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                
                <button
                  onClick={confirmMatchEnd}
                  className="btn btn-primary flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-5 w-5 mr-2" />
                  )}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchScoring;