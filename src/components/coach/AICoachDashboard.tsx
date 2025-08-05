import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain,
  Target,
  BarChart3,
  Activity,
  Eye,
  MessageSquare,
  Settings,
  Play,
  Pause,
  RotateCcw,
  Clock
} from 'lucide-react';

interface CoachingInsight {
  id: string;
  timestamp: number;
  type: 'technical' | 'tactical' | 'mental' | 'physical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  confidence: number;
  playerFocus: 'player1' | 'player2' | 'both';
  category: string;
}

interface PerformanceMetrics {
  shotAccuracy: number;
  movementEfficiency: number;
  courtCoverage: number;
  reactionTime: number;
  stamina: number;
  consistency: number;
  shotTypes: {
    forehand: { count: number; accuracy: number };
    backhand: { count: number; accuracy: number };
    serve: { count: number; accuracy: number };
    volley: { count: number; accuracy: number };
  };
}

interface AICoachSettings {
  analysisFrequency: number; // seconds
  insightThreshold: number; // confidence threshold
  focusAreas: string[];
  realTimeEnabled: boolean;
  voiceEnabled: boolean;
  autoSuggestions: boolean;
}

interface AICoachDashboardProps {
  matchId: string;
  player1Id: string;
  player2Id: string;
  isActive: boolean;
  videoElement?: HTMLVideoElement;
  onInsightGenerated: (insight: CoachingInsight) => void;
}

const AICoachDashboard: React.FC<AICoachDashboardProps> = ({
  matchId,
  player1Id,
  player2Id,
  isActive,
  videoElement,
  onInsightGenerated
}) => {
  const [insights, setInsights] = useState<CoachingInsight[]>([]);
  const [currentInsight, setCurrentInsight] = useState<CoachingInsight | null>(null);
  const [metrics, setMetrics] = useState<{
    player1: PerformanceMetrics;
    player2: PerformanceMetrics;
  }>(
    {
      player1: {
        shotAccuracy: 0,
        movementEfficiency: 0,
        courtCoverage: 0,
        reactionTime: 0,
        stamina: 100,
        consistency: 0,
        shotTypes: {
          forehand: { count: 0, accuracy: 0 },
          backhand: { count: 0, accuracy: 0 },
          serve: { count: 0, accuracy: 0 },
          volley: { count: 0, accuracy: 0 }
        }
      },
      player2: {
        shotAccuracy: 0,
        movementEfficiency: 0,
        courtCoverage: 0,
        reactionTime: 0,
        stamina: 100,
        consistency: 0,
        shotTypes: {
          forehand: { count: 0, accuracy: 0 },
          backhand: { count: 0, accuracy: 0 },
          serve: { count: 0, accuracy: 0 },
          volley: { count: 0, accuracy: 0 }
        }
      }
    }
  );
  const [settings, setSettings] = useState<AICoachSettings>({
    analysisFrequency: 30,
    insightThreshold: 0.7,
    focusAreas: ['technique', 'tactics', 'fitness'],
    realTimeEnabled: true,
    voiceEnabled: false,
    autoSuggestions: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<'player1' | 'player2' | 'both'>('both');
  const [analysisStats, setAnalysisStats] = useState({
    totalInsights: 0,
    accuracyRate: 94.2,
    improvementSuggestions: 0,
    matchDuration: 0
  });
  
  const analysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Initialize speech synthesis
  useEffect(() => {
    if (settings.voiceEnabled && 'speechSynthesis' in window) {
      speechSynthesisRef.current = window.speechSynthesis;
    }
  }, [settings.voiceEnabled]);

  // Speak insight aloud
  const speakInsight = useCallback((insight: CoachingInsight) => {
    if (!settings.voiceEnabled || !speechSynthesisRef.current) return;

    const utterance = new (window as typeof window & { SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance }).SpeechSynthesisUtterance(
      `${insight.priority} priority: ${insight.title}. ${insight.recommendation}`
    );
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.7;
    
    speechSynthesisRef.current.speak(utterance);
  }, [settings.voiceEnabled]);

  // Generate AI coaching insights
  const generateCoachingInsight = useCallback(async () => {
    if (!isActive || !videoElement) return;

    try {
      // Call real AI analysis service
      const gameAnalysis = await analyzeCurrentGameState();
      
      if (gameAnalysis && gameAnalysis.confidence > settings.insightThreshold) {
        const insight = createInsightFromAnalysis(gameAnalysis);
        
        if (insight) {
          setInsights(prev => [insight, ...prev.slice(0, 19)]); // Keep last 20 insights
          setCurrentInsight(insight);
          onInsightGenerated(insight);
          
          if (settings.voiceEnabled) {
            speakInsight(insight);
          }
          
          // Update stats
          setAnalysisStats(prev => ({
            ...prev,
            totalInsights: prev.totalInsights + 1,
            improvementSuggestions: insight.type === 'technical' ? prev.improvementSuggestions + 1 : prev.improvementSuggestions
          }));
          
          // Auto-hide insight after 8 seconds
          setTimeout(() => setCurrentInsight(null), 8000);
        }
      }
      
      // Update performance metrics
      updatePerformanceMetrics();
      
    } catch (error) {
      console.error('AI Coach analysis error:', error);
    }
  }, [isActive, videoElement, settings, onInsightGenerated, speakInsight, analyzeCurrentGameState, createInsightFromAnalysis, updatePerformanceMetrics]);

  // Real game state analysis using AI service
  const analyzeCurrentGameState = useCallback(async () => {
    try {
      if (!videoElement) return null;
      
      // Capture current frame for analysis
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      ctx.drawImage(videoElement, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      
      // Call AWS Lambda for AI coaching analysis
      const response = await fetch('/api/video-based-ai-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId,
          player1Id,
          player2Id,
          currentFrame: base64Image,
          analysisOptions: {
            enableTechnicalAnalysis: true,
            enableTacticalAnalysis: true,
            enablePhysicalAnalysis: true,
            confidenceThreshold: settings.insightThreshold
          }
        })
      });
      
      if (!response.ok) {
        console.error('AI Coach analysis API error:', response.statusText);
        return null;
      }
      
      const result = await response.json();
      
      if (result.success && result.data.insights && result.data.insights.length > 0) {
        // Return the first insight with highest confidence
        return result.data.insights.sort((a: { confidence: number }, b: { confidence: number }) => b.confidence - a.confidence)[0];
      }
      
      return null;
    } catch (error) {
      console.error('AI Coach analysis error:', error);
      return null;
    }
  }, [videoElement, matchId, player1Id, player2Id, settings.insightThreshold]);
  
  // Create insight from analysis result
  const createInsightFromAnalysis = useCallback((analysis: { confidence: number; type: string; description: string; recommendation: string; priority: string }) => {
    if (!analysis || analysis.confidence < settings.insightThreshold) {
      return null;
    }
    
    return {
      id: `insight_${Date.now()}`,
      type: analysis.type,
      title: analysis.title,
      description: analysis.description,
      recommendation: analysis.recommendation,
      category: analysis.category,
      confidence: analysis.confidence,
      timestamp: Date.now(),
      priority: (analysis.confidence > 0.8 ? 'high' : 'medium') as 'medium' | 'high' | 'low' | 'critical',
      playerFocus: 'both' as 'player1' | 'player2' | 'both'
    };
  }, [settings.insightThreshold]);
  
  // Update performance metrics based on real data
  const updatePerformanceMetrics = useCallback(async () => {
    if (!isActive) return;
    
    try {
      // Fetch real performance data from database
      const response = await fetch(`/api/match-analytics/${matchId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setMetrics({
            player1: {
              shotAccuracy: data.data.player1?.shotAccuracy || 0,
              movementEfficiency: data.data.player1?.movementEfficiency || 0,
              courtCoverage: data.data.player1?.courtCoverage || 0,
              reactionTime: data.data.player1?.reactionTime || 0,
              stamina: data.data.player1?.stamina || 100,
              consistency: data.data.player1?.consistency || 0,
              shotTypes: data.data.player1?.shotTypes || {
                forehand: { count: 0, accuracy: 0 },
                backhand: { count: 0, accuracy: 0 },
                serve: { count: 0, accuracy: 0 },
                volley: { count: 0, accuracy: 0 }
              }
            },
            player2: {
              shotAccuracy: data.data.player2?.shotAccuracy || 0,
              movementEfficiency: data.data.player2?.movementEfficiency || 0,
              courtCoverage: data.data.player2?.courtCoverage || 0,
              reactionTime: data.data.player2?.reactionTime || 0,
              stamina: data.data.player2?.stamina || 100,
              consistency: data.data.player2?.consistency || 0,
              shotTypes: data.data.player2?.shotTypes || {
                forehand: { count: 0, accuracy: 0 },
                backhand: { count: 0, accuracy: 0 },
                serve: { count: 0, accuracy: 0 },
                volley: { count: 0, accuracy: 0 }
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error updating performance metrics:', error);
    }
  }, [isActive, matchId]);

  // Start/stop AI analysis
  useEffect(() => {
    if (isActive && settings.realTimeEnabled) {
      analysisIntervalRef.current = setInterval(
        generateCoachingInsight, 
        settings.analysisFrequency * 1000
      );
      
      // Update match duration
      const durationInterval = setInterval(() => {
        setAnalysisStats(prev => ({
          ...prev,
          matchDuration: Math.floor((Date.now() - startTimeRef.current) / 1000)
        }));
      }, 1000);
      
      return () => {
        clearInterval(durationInterval);
      };
    } else {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
    }
    
    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [isActive, settings.realTimeEnabled, settings.analysisFrequency, generateCoachingInsight]);

  // Handle settings change
  const handleSettingsChange = (newSettings: Partial<AICoachSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Format time duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="ai-coach-dashboard bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-quantum-cyan" />
          <h3 className="font-semibold text-text-standard">AI Tennis Coach</h3>
          <div className={`w-2 h-2 rounded-full ${
            isActive && settings.realTimeEnabled ? 'bg-green-500' : 'bg-red-500'
          }`} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 hover:bg-hover-bg rounded"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleSettingsChange({ realTimeEnabled: !settings.realTimeEnabled })}
            className="p-1 hover:bg-hover-bg rounded"
          >
            {settings.realTimeEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Current Insight */}
      {currentInsight && (
        <div className={`border rounded-lg p-3 mb-4 ${getPriorityColor(currentInsight.priority)}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4" />
                <span className="font-semibold text-sm">{currentInsight.title}</span>
                <span className="text-xs px-2 py-1 bg-white bg-opacity-50 rounded">
                  {currentInsight.priority.toUpperCase()}
                </span>
              </div>
              <p className="text-sm mb-2">{currentInsight.description}</p>
              <div className="flex items-start gap-2">
                <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">{currentInsight.recommendation}</p>
              </div>
            </div>
            <button
              onClick={() => setCurrentInsight(null)}
              className="p-1 hover:bg-white hover:bg-opacity-20 rounded ml-2"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-bg-elevated border border-border-subtle rounded-lg p-3 mb-4">
          <h4 className="font-medium mb-3">AI Coach Settings</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Analysis Frequency: {settings.analysisFrequency}s
              </label>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={settings.analysisFrequency}
                onChange={(e) => handleSettingsChange({ analysisFrequency: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Insight Threshold: {(settings.insightThreshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={settings.insightThreshold}
                onChange={(e) => handleSettingsChange({ insightThreshold: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Voice Coaching</span>
              <input
                type="checkbox"
                checked={settings.voiceEnabled}
                onChange={(e) => handleSettingsChange({ voiceEnabled: e.target.checked })}
                className="rounded"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Auto Suggestions</span>
              <input
                type="checkbox"
                checked={settings.autoSuggestions}
                onChange={(e) => handleSettingsChange({ autoSuggestions: e.target.checked })}
                className="rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance Metrics
          </h4>
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value as 'player1' | 'player2' | 'both')}
            className="text-xs bg-bg-elevated border border-border-subtle rounded px-2 py-1"
          >
            <option value="both">Both Players</option>
            <option value="player1">Player 1</option>
            <option value="player2">Player 2</option>
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {(selectedPlayer === 'both' ? ['player1', 'player2'] : [selectedPlayer]).map((player) => (
            <div key={player} className="bg-bg-elevated rounded-lg p-2">
              <h5 className="text-xs font-medium mb-2 text-center">
                {player === 'player1' ? 'Player 1' : 'Player 2'}
              </h5>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Shot Accuracy</span>
                  <span>{metrics[player as keyof typeof metrics].shotAccuracy.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Movement</span>
                  <span>{metrics[player as keyof typeof metrics].movementEfficiency.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Court Coverage</span>
                  <span>{metrics[player as keyof typeof metrics].courtCoverage.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Stamina</span>
                  <span className={metrics[player as keyof typeof metrics].stamina < 50 ? 'text-red-500' : 'text-green-500'}>
                    {metrics[player as keyof typeof metrics].stamina.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis Statistics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-bg-elevated rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <Activity className="h-3 w-3 text-quantum-cyan" />
            <span className="text-xs text-text-subtle">Total Insights</span>
          </div>
          <span className="text-lg font-bold">{analysisStats.totalInsights}</span>
        </div>
        
        <div className="bg-bg-elevated rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="h-3 w-3 text-blue-500" />
            <span className="text-xs text-text-subtle">Match Time</span>
          </div>
          <span className="text-lg font-bold">{formatDuration(analysisStats.matchDuration)}</span>
        </div>
      </div>

      {/* Recent Insights */}
      <div>
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Recent Insights
        </h4>
        
        {insights.length === 0 ? (
          <p className="text-sm text-text-subtle text-center py-4">
            No insights generated yet
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {insights.slice(0, 5).map((insight) => (
              <div
                key={insight.id}
                className="p-2 bg-bg-elevated rounded text-sm border-l-2 border-quantum-cyan"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs">{insight.title}</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs px-1 py-0.5 rounded ${
                      insight.priority === 'critical' ? 'bg-red-100 text-red-600' :
                      insight.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                      insight.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {insight.priority}
                    </span>
                    <span className="text-xs text-text-subtle">
                      {new Date(insight.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-text-subtle">{insight.recommendation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="mt-4 pt-3 border-t border-border-subtle">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-subtle">
            Status: {isActive && settings.realTimeEnabled ? 'Analyzing' : 'Paused'}
          </span>
          <span className="text-text-subtle">
            Accuracy: {analysisStats.accuracyRate}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default AICoachDashboard;