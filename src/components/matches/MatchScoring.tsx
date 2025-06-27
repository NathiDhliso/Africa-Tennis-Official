import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, 
  Plus, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  X
} from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';
import { useMatchMutations } from '../../hooks/useMatchMutations';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/aws';
import type { Database } from '../../types/database';

type Match = Database['public']['Tables']['matches']['Row'] & {
  player1?: { username: string; elo_rating: number };
  player2?: { username: string; elo_rating: number };
};

type PointType = 'point_won' | 'ace' | 'winner' | 'double_fault' | 'forced_error' | 'unforced_error';

interface MatchScoringProps {
  match: Match;
  onBack: () => void;
}

interface TennisScore {
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
  score: TennisScore;
  timestamp: number;
  action: string;
}

interface UmpireInsight {
  insight: string;
  timestamp: string;
}

const MatchScoring: React.FC<MatchScoringProps> = ({ 
  match, 
  onBack
}) => {
  const { user } = useAuthStore();
  const [score, setScore] = useState<TennisScore | null>(null);
  const [pointType, setPointType] = useState<PointType>('point_won');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmEndMatch, setConfirmEndMatch] = useState(false);
  const [lastPointPlayerId, setLastPointPlayerId] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<MatchScoreHistory[]>([]);
  const [player1Profile, setPlayer1Profile] = useState<any>(null);
  const [player2Profile, setPlayer2Profile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const scoreRef = useRef<TennisScore | null>(null);
  const [umpireInsight, setUmpireInsight] = useState<UmpireInsight | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [showInsight, setShowInsight] = useState(false);

  const { awardPoint, updateMatch } = useMatchMutations(user?.id ?? '');

  useEffect(() => {
    const initializeScore = () => {
      if (match && match.score) {
        try {
          const parsedScore = typeof match.score === 'string' ? JSON.parse(match.score) : match.score;
          setScore(parsedScore);
          scoreRef.current = parsedScore;
          
          // Initialize score history with current score
          setScoreHistory([{
            score: parsedScore,
            timestamp: Date.now(),
            action: 'initial'
          }]);
        } catch (err) {
          console.error('Error parsing score:', err);
          setError('Error loading match score');
        }
      } else {
        const defaultScore = {
          sets: [{
            player1_games: 0,
            player2_games: 0,
            games: []
          }],
          current_game: { player1: '0', player2: '0' },
          server_id: match.player1_id,
          is_tiebreak: false,
        };
        setScore(defaultScore);
        scoreRef.current = defaultScore;
        setScoreHistory([{
          score: defaultScore,
          timestamp: Date.now(),
          action: 'initial'
        }]);
      }
    };

    initializeScore();

    const subscription = supabase
      .channel(`match-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${match.id}`,
        },
        (payload) => {
          if (payload.new && payload.new.score) {
            const newScore = payload.new.score as TennisScore;
            setScore(newScore);
            scoreRef.current = newScore;
            
            // Add to score history
            setScoreHistory(prev => [...prev, {
              score: newScore,
              timestamp: Date.now(),
              action: 'update'
            }]);

            if (payload.new.status === 'completed') {
              setSuccessMessage('Match completed!');
              setTimeout(() => onBack(), 3000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [match.id, match.player1_id, onBack]);

  useEffect(() => {
    if (score) {
      setPointType('point_won');
      scoreRef.current = score;
    }
  }, [score]);

  const handleAwardPoint = async (playerId: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await awardPoint.mutateAsync({
        matchId: match.id,
        winningPlayerId: playerId,
        pointType: pointType,
      });
      setLastPointPlayerId(playerId);
      setTimeout(() => setLastPointPlayerId(null), 2000);
    } catch (err: any) {
      console.error('Error awarding point:', err);
      setError(err.message || 'Failed to award point');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndo = () => {
    if (scoreHistory.length > 1 && !isSubmitting) {
      setIsSubmitting(true);
      setError(null);
      
      try {
        // Remove the current score and go back to the previous one
        const newHistory = [...scoreHistory];
        newHistory.pop(); // Remove current score
        const previousScore = newHistory[newHistory.length - 1].score;
        
        // Update the match with the previous score
        updateMatch.mutate({
          id: match.id,
          updates: {
            score: previousScore
          }
        }, {
          onSuccess: () => {
            setScoreHistory(newHistory);
          },
          onError: (err: any) => {
            setError(err.message || 'Failed to undo last point');
          }
        });
      } catch (err: any) {
        console.error('Error undoing point:', err);
        setError(err.message || 'Failed to undo last point');
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
      await updateMatch.mutateAsync({
        id: match.id,
        updates: {
          status: 'completed',
          winner_id: getMatchWinner(),
        },
      });

      setSuccessMessage('Match completed successfully!');
      setTimeout(() => {
        onBack();
      }, 3000);
    } catch (err: any) {
      console.error('Error ending match:', err);
      setError(err.message || 'Failed to end match');
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

    return ''; // No winner yet
  };

  const getPointTypeLabel = (type: PointType): string => {
    switch (type) {
      case 'ace': return 'Ace';
      case 'winner': return 'Winner';
      case 'double_fault': return 'Double Fault';
      case 'forced_error': return 'Forced Error';
      case 'unforced_error': return 'Unforced Error';
      default: return 'Point';
    }
  };

  const getPointTypeColor = (type: PointType): string => {
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
    setError(null);
    
    try {
      const response = await apiClient.getUmpireInsight(match.id, score);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to get umpire insight');
      }
      
      setUmpireInsight(response.data);
      setShowInsight(true);
      
      // Auto-hide insight after 10 seconds
      setTimeout(() => {
        setShowInsight(false);
      }, 10000);
    } catch (err: any) {
      console.error('Error getting umpire insight:', err);
      setError('Oops! We couldn\'t fetch the AI umpire insight right now. This may be due to a temporary server issue or network problem. Please try again shortly. If this keeps happening, let us know through support.');
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  if (!score) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="large" text="Loading match data..." />
      </div>
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
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <span>{error}</span>
            </div>
          </div>
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
            {(['point_won', 'ace', 'winner', 'double_fault', 'forced_error', 'unforced_error'] as PointType[]).map((type) => (
              <button
                key={type}
                onClick={() => setPointType(type)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  pointType === type 
                    ? 'bg-opacity-20 border-2' 
                    : 'bg-bg-elevated border border-border-subtle hover:bg-hover-bg'
                }`}
                style={{
                  backgroundColor: pointType === type ? `${getPointTypeColor(type)}20` : undefined,
                  borderColor: pointType === type ? getPointTypeColor(type) : undefined,
                  color: pointType === type ? getPointTypeColor(type) : 'var(--text-standard)'
                }}
              >
                {getPointTypeLabel(type)}
              </button>
            ))}
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