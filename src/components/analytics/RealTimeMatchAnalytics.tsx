import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  Target,
  Zap,
  Clock,
  Activity,
  Award,
  Eye,
  Brain,
  Gauge,
  Timer
} from 'lucide-react';

interface MatchStats {
  duration: number;
  totalPoints: number;
  totalShots: number;
  rallies: number;
  averageRallyLength: number;
  longestRally: number;
  aces: { player1: number; player2: number };
  doubleFaults: { player1: number; player2: number };
  winners: { player1: number; player2: number };
  unforcedErrors: { player1: number; player2: number };
  netApproaches: { player1: number; player2: number };
  breakPoints: { player1: number; player2: number };
}

interface PlayerAnalytics {
  playerId: string;
  shotAccuracy: number;
  firstServePercentage: number;
  firstServeWinPercentage: number;
  secondServeWinPercentage: number;
  returnWinPercentage: number;
  netWinPercentage: number;
  breakPointConversion: number;
  courtCoverage: number;
  movementEfficiency: number;
  stamina: number;
  momentum: number;
  shotDistribution: {
    forehand: number;
    backhand: number;
    serve: number;
    volley: number;
    overhead: number;
  };
  courtPositions: {
    baseline: number;
    midCourt: number;
    net: number;
  };
  shotSpeed: {
    average: number;
    max: number;
    serve: number;
    groundstroke: number;
  };
}

interface RealTimeMatchAnalyticsProps {
  matchId: string;
  player1Id: string;
  player2Id: string;
  isActive: boolean;
  currentScore?: Record<string, unknown>;
  onAnalyticsUpdate?: (analytics: Record<string, unknown>) => void;
}

const RealTimeMatchAnalytics: React.FC<RealTimeMatchAnalyticsProps> = ({
  matchId,
  player1Id,
  player2Id,
  isActive,
  onAnalyticsUpdate
}) => {
  const [matchStats, setMatchStats] = useState<MatchStats>({
    duration: 0,
    totalPoints: 0,
    totalShots: 0,
    rallies: 0,
    averageRallyLength: 0,
    longestRally: 0,
    aces: { player1: 0, player2: 0 },
    doubleFaults: { player1: 0, player2: 0 },
    winners: { player1: 0, player2: 0 },
    unforcedErrors: { player1: 0, player2: 0 },
    netApproaches: { player1: 0, player2: 0 },
    breakPoints: { player1: 0, player2: 0 }
  });
  
  const [playerAnalytics, setPlayerAnalytics] = useState<{
    player1: PlayerAnalytics;
    player2: PlayerAnalytics;
  }>({
    player1: {
      playerId: player1Id,
      shotAccuracy: 0,
      firstServePercentage: 0,
      firstServeWinPercentage: 0,
      secondServeWinPercentage: 0,
      returnWinPercentage: 0,
      netWinPercentage: 0,
      breakPointConversion: 0,
      courtCoverage: 0,
      movementEfficiency: 0,
      stamina: 100,
      momentum: 50,
      shotDistribution: {
        forehand: 0,
        backhand: 0,
        serve: 0,
        volley: 0,
        overhead: 0
      },
      courtPositions: {
        baseline: 0,
        midCourt: 0,
        net: 0
      },
      shotSpeed: {
        average: 0,
        max: 0,
        serve: 0,
        groundstroke: 0
      }
    },
    player2: {
      playerId: player2Id,
      shotAccuracy: 0,
      firstServePercentage: 0,
      firstServeWinPercentage: 0,
      secondServeWinPercentage: 0,
      returnWinPercentage: 0,
      netWinPercentage: 0,
      breakPointConversion: 0,
      courtCoverage: 0,
      movementEfficiency: 0,
      stamina: 100,
      momentum: 50,
      shotDistribution: {
        forehand: 0,
        backhand: 0,
        serve: 0,
        volley: 0,
        overhead: 0
      },
      courtPositions: {
        baseline: 0,
        midCourt: 0,
        net: 0
      },
      shotSpeed: {
        average: 0,
        max: 0,
        serve: 0,
        groundstroke: 0
      }
    }
  });
  
  const [selectedView, setSelectedView] = useState<'overview' | 'player1' | 'player2' | 'comparison'>('overview');
  const [keyMoments, setKeyMoments] = useState<Array<{
    id: string;
    timestamp: number;
    type: 'ace' | 'winner' | 'break_point' | 'momentum_shift';
    description: string;
    player: 'player1' | 'player2';
  }>>([]);
  
  const startTimeRef = useRef<number>(Date.now());
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update match duration
  const updateMatchDuration = useCallback(() => {
    if (!isActive) return;
    
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setMatchStats(prev => ({ ...prev, duration }));
  }, [isActive]);

  // Update duration every second
  useEffect(() => {
    if (!isActive) return;
    
    const durationInterval = setInterval(updateMatchDuration, 1000);
    return () => clearInterval(durationInterval);
  }, [isActive, updateMatchDuration]);

  // Start/stop analytics updates
  useEffect(() => {
    if (!isActive) return;

    const fetchAnalyticsData = async () => {
      try {
        // Fetch real-time match analytics from API
        const response = await fetch(`/api/match-analytics/${matchId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Update match statistics
            if (data.matchStats) {
              setMatchStats(data.matchStats);
            }
            
            // Update player statistics
            if (data.playerAnalytics) {
              setPlayerAnalytics(data.playerAnalytics);
            }
            
            // Update key moments
            if (data.keyMoments) {
              setKeyMoments(data.keyMoments.slice(0, 10));
            }
          }
        }
      } catch (error) {
        console.error('Error fetching match analytics:', error);
      }
    };

    fetchAnalyticsData();
    const interval = setInterval(fetchAnalyticsData, 3000);

    return () => clearInterval(interval);
  }, [isActive, matchId]);

  // Notify parent of analytics updates
  useEffect(() => {
    if (onAnalyticsUpdate) {
      onAnalyticsUpdate({ matchStats, playerAnalytics, keyMoments });
    }
  }, [matchStats, playerAnalytics, keyMoments, onAnalyticsUpdate]);

  // Format time duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get momentum color
  const getMomentumColor = (momentum: number) => {
    if (momentum > 70) return 'text-green-600';
    if (momentum > 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get stamina color
  const getStaminaColor = (stamina: number) => {
    if (stamina > 70) return 'text-green-600';
    if (stamina > 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="real-time-analytics bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-quantum-cyan" />
          <h3 className="font-semibold text-text-standard">Live Match Analytics</h3>
          <div className={`w-2 h-2 rounded-full ${
            isActive ? 'bg-green-500' : 'bg-red-500'
          }`} />
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-text-subtle" />
          <span className="text-sm font-mono">{formatDuration(matchStats.duration)}</span>
        </div>
      </div>

      {/* View Selector */}
      <div className="flex gap-1 mb-4 bg-bg-elevated rounded-lg p-1">
        {[
          { key: 'overview', label: 'Overview', icon: Activity },
          { key: 'player1', label: 'Player 1', icon: Target },
          { key: 'player2', label: 'Player 2', icon: Target },
          { key: 'comparison', label: 'Compare', icon: BarChart3 }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSelectedView(key as 'player1' | 'player2' | 'comparison')}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
              selectedView === key
                ? 'bg-quantum-cyan text-white'
                : 'text-text-subtle hover:text-text-standard hover:bg-hover-bg'
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Overview View */}
      {selectedView === 'overview' && (
        <div className="space-y-4">
          {/* Match Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-quantum-cyan" />
                <span className="text-xs text-text-subtle">Total Points</span>
              </div>
              <span className="text-lg font-bold">{matchStats.totalPoints}</span>
            </div>
            
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-xs text-text-subtle">Total Shots</span>
              </div>
              <span className="text-lg font-bold">{matchStats.totalShots}</span>
            </div>
            
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Timer className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-text-subtle">Avg Rally</span>
              </div>
              <span className="text-lg font-bold">{matchStats.averageRallyLength.toFixed(1)}</span>
            </div>
            
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-4 w-4 text-green-500" />
                <span className="text-xs text-text-subtle">Longest Rally</span>
              </div>
              <span className="text-lg font-bold">{matchStats.longestRally}</span>
            </div>
          </div>

          {/* Key Moments */}
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Key Moments
            </h4>
            
            {keyMoments.length === 0 ? (
              <p className="text-sm text-text-subtle text-center py-4">
                No key moments yet
              </p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {keyMoments.map((moment) => (
                  <div
                    key={moment.id}
                    className="flex items-center justify-between p-2 bg-bg-elevated rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {moment.type === 'ace' && <Zap className="h-3 w-3 text-yellow-500" />}
                      {moment.type === 'winner' && <Target className="h-3 w-3 text-green-500" />}
                      <span>{moment.description}</span>
                    </div>
                    <span className="text-xs text-text-subtle">
                      {new Date(moment.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Player Views */}
      {(selectedView === 'player1' || selectedView === 'player2') && (
        <div className="space-y-4">
          {(() => {
            const player = playerAnalytics[selectedView as keyof typeof playerAnalytics];
            return (
              <>
                {/* Performance Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bg-elevated rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Gauge className="h-4 w-4 text-quantum-cyan" />
                      <span className="text-sm font-medium">Shot Accuracy</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-bg-surface rounded-full h-2">
                        <div 
                          className="bg-quantum-cyan h-2 rounded-full transition-all duration-300"
                          style={{ width: `${player.shotAccuracy}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold">{player.shotAccuracy.toFixed(1)}%</span>
                    </div>
                  </div>
                  
                  <div className="bg-bg-elevated rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Stamina</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-bg-surface rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            player.stamina > 70 ? 'bg-green-500' : 
                            player.stamina > 40 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${player.stamina}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold ${getStaminaColor(player.stamina)}`}>
                        {player.stamina.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Serve Statistics */}
                <div className="bg-bg-elevated rounded-lg p-3">
                  <h5 className="font-medium mb-3">Serve Statistics</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>First Serve %</span>
                        <span>{player.firstServePercentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>1st Serve Win %</span>
                        <span>{player.firstServeWinPercentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>2nd Serve Win %</span>
                        <span>{player.secondServeWinPercentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Serve Speed</span>
                        <span>{player.shotSpeed.serve.toFixed(0)} km/h</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Court Coverage */}
                <div className="bg-bg-elevated rounded-lg p-3">
                  <h5 className="font-medium mb-3">Court Coverage</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Movement Efficiency</span>
                      <span>{player.movementEfficiency.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Court Coverage</span>
                      <span>{player.courtCoverage.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={getMomentumColor(player.momentum)}>Momentum</span>
                      <span className={getMomentumColor(player.momentum)}>
                        {player.momentum.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Comparison View */}
      {selectedView === 'comparison' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Player 1 */}
            <div className="bg-bg-elevated rounded-lg p-3">
              <h5 className="font-medium mb-3 text-center">Player 1</h5>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Shot Accuracy</span>
                  <span>{playerAnalytics.player1.shotAccuracy.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>First Serve %</span>
                  <span>{playerAnalytics.player1.firstServePercentage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Court Coverage</span>
                  <span>{playerAnalytics.player1.courtCoverage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={getStaminaColor(playerAnalytics.player1.stamina)}>Stamina</span>
                  <span className={getStaminaColor(playerAnalytics.player1.stamina)}>
                    {playerAnalytics.player1.stamina.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={getMomentumColor(playerAnalytics.player1.momentum)}>Momentum</span>
                  <span className={getMomentumColor(playerAnalytics.player1.momentum)}>
                    {playerAnalytics.player1.momentum.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Player 2 */}
            <div className="bg-bg-elevated rounded-lg p-3">
              <h5 className="font-medium mb-3 text-center">Player 2</h5>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Shot Accuracy</span>
                  <span>{playerAnalytics.player2.shotAccuracy.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>First Serve %</span>
                  <span>{playerAnalytics.player2.firstServePercentage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Court Coverage</span>
                  <span>{playerAnalytics.player2.courtCoverage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={getStaminaColor(playerAnalytics.player2.stamina)}>Stamina</span>
                  <span className={getStaminaColor(playerAnalytics.player2.stamina)}>
                    {playerAnalytics.player2.stamina.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={getMomentumColor(playerAnalytics.player2.momentum)}>Momentum</span>
                  <span className={getMomentumColor(playerAnalytics.player2.momentum)}>
                    {playerAnalytics.player2.momentum.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Head-to-Head Stats */}
          <div className="bg-bg-elevated rounded-lg p-3">
            <h5 className="font-medium mb-3">Head-to-Head</h5>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold">{matchStats.aces.player1}</div>
                <div className="text-xs text-text-subtle">Aces</div>
              </div>
              <div>
                <div className="text-xs text-text-subtle mb-1">VS</div>
                <div className="text-xs text-text-subtle">Comparison</div>
              </div>
              <div>
                <div className="text-lg font-bold">{matchStats.aces.player2}</div>
                <div className="text-xs text-text-subtle">Aces</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Footer */}
      <div className="mt-4 pt-3 border-t border-border-subtle">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-subtle">
            Status: {isActive ? 'Live Analysis' : 'Paused'}
          </span>
          <span className="text-text-subtle">
            Last Update: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default RealTimeMatchAnalytics;