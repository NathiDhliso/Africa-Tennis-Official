import React, { useState } from 'react';
import { Brain, Sparkles, Loader2, TrendingUp, Target, Award } from 'lucide-react';
import { apiClient } from '../../lib/aws';
import { useAuthStore } from '../../stores/authStore';
import type { Profile } from '../../types/database';

interface PlayerAnalysisSectionProps {
  selectedPlayer: Profile | null;
  onAnalysisGenerated?: (analysis: string) => void;
}

const PlayerAnalysisSection: React.FC<PlayerAnalysisSectionProps> = ({ 
  selectedPlayer,
  onAnalysisGenerated
}) => {
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user } = useAuthStore();

  const handleGenerateAnalysis = async () => {
    if (!selectedPlayer) return;

    setIsGeneratingAnalysis(true);
    setError(null);
    setSuccess(null);

    try {
      console.log(`Generating player style analysis for ${selectedPlayer.username} (${selectedPlayer.user_id})`);
      const response = await apiClient.generatePlayerStyle(selectedPlayer.user_id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate player style analysis');
      }
      
      const analysis = (response.data as { playerStyleAnalysis: string }).playerStyleAnalysis;
      
      if (onAnalysisGenerated) {
        onAnalysisGenerated(analysis);
      }

      setSuccess('Player style analysis generated successfully!');
    } catch (err) {
      console.error('Error generating player style analysis:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  if (isGeneratingAnalysis) {
    return (
      <div className="ai-coach-loading-state">
        <div className="ai-coach-loading-animation">
          <Brain size={48} className="ai-coach-loading-icon" />
          <div className="ai-coach-loading-pulse"></div>
        </div>
        <h3>Generating Analysis</h3>
        <p>Our AI coach is analyzing playing patterns, strengths, and areas for improvement...</p>
        <div className="ai-coach-loading-steps">
          <div className="ai-coach-loading-step active">
            <Sparkles size={16} />
            <span>Processing match data</span>
          </div>
          <div className="ai-coach-loading-step active">
            <Target size={16} />
            <span>Analyzing playing style</span>
          </div>
          <div className="ai-coach-loading-step">
            <TrendingUp size={16} />
            <span>Generating insights</span>
          </div>
        </div>
      </div>
    );
  }

  if (selectedPlayer?.player_style_analysis) {
    return (
      <div className="ai-coach-analysis-content">
        <div className="ai-coach-analysis-header">
          <div className="ai-coach-analysis-badge">
            <Sparkles size={16} />
            AI Generated Analysis
          </div>
        </div>
        <div className="ai-coach-analysis-text">
          {selectedPlayer.player_style_analysis}
        </div>
        <div className="ai-coach-analysis-footer">
          <div className="ai-coach-analysis-meta">
            <Brain size={14} />
            <span>Powered by AI Tennis Coach</span>
          </div>
        </div>
      </div>
    );
  }

  if (selectedPlayer) {
    return (
      <div className="ai-coach-empty-state">
        <div className="ai-coach-empty-icon">
          <Sparkles size={64} />
        </div>
        <h3>Ready to Analyze</h3>
        <p>
          Generate an AI-powered analysis of {selectedPlayer.username}'s playing style, 
          strengths, and areas for improvement based on match history and performance data.
        </p>
        
        {error && (
          <div className="ai-coach-alert ai-coach-alert-error mb-4">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <p>{error}</p>
            </div>
          </div>
        )}
        
        <button
          onClick={handleGenerateAnalysis}
          className="ai-coach-cta-btn relative"
          disabled={isGeneratingAnalysis}
        >
          {isGeneratingAnalysis ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain size={18} />
              Start AI Analysis
            </>
          )}
          <span className="absolute -top-1 -right-1 text-xs px-1.5 py-0.5 bg-warning-orange text-white rounded-full">BETA</span>
        </button>
      </div>
    );
  }

  return (
    <div className="ai-coach-empty-state">
      <div className="ai-coach-empty-icon">
        <Award size={64} />
      </div>
      <h3>Select a Player</h3>
      <p>
        Choose a player from the search results or use your own profile to begin 
        generating professional AI-powered tennis insights.
      </p>
    </div>
  );
};

export default PlayerAnalysisSection;