import React, { useState, useEffect } from 'react';
import { Search, User, Sparkles, Loader2, Trophy, BarChart3, AlertTriangle, Info, CheckCircle, Brain, Target, TrendingUp, Award, Zap } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/aws';
import type { Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

const AICoachPage: React.FC = () => {
  const { profile } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [playerMatches, setPlayerMatches] = useState<any[]>([]);

  // Use the current user's profile as the default selected player
  useEffect(() => {
    if (profile && !selectedPlayer) {
      setSelectedPlayer(profile);
      fetchPlayerMatches(profile.user_id);
    }
  }, [profile]);

  // Search for players
  useEffect(() => {
    const searchPlayers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', `%${searchQuery}%`)
          .order('elo_rating', { ascending: false })
          .limit(10);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error('Error searching players:', err);
        setError('Failed to search players');
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(() => {
      searchPlayers();
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const fetchPlayerMatches = async (playerId: string) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          player1:profiles!matches_player1_id_fkey(username, elo_rating),
          player2:profiles!matches_player2_id_fkey(username, elo_rating),
          winner:profiles!matches_winner_id_fkey(username)
        `)
        .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
        .eq('status', 'completed')
        .order('date', { ascending: false })
        .limit(5);

      if (error) throw error;
      setPlayerMatches(data || []);
    } catch (err) {
      console.error('Error fetching player matches:', err);
    }
  };

  const handleSelectPlayer = (player: Profile) => {
    setSelectedPlayer(player);
    setSearchQuery('');
    setSearchResults([]);
    fetchPlayerMatches(player.user_id);
  };

  const handleGenerateAnalysis = async () => {
    if (!selectedPlayer) return;

    setIsGeneratingAnalysis(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiClient.generatePlayerStyle(selectedPlayer.user_id);

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate player style analysis');
      }

      // Update the selected player with the new analysis
      setSelectedPlayer({
        ...selectedPlayer,
        player_style_analysis: (response.data as { playerStyleAnalysis: string }).playerStyleAnalysis
      });

      setSuccess('Player style analysis generated successfully!');
    } catch (err) {
      console.error('Error generating player style analysis:', err);
      setError(`Failed to generate analysis: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };



  const calculateWinRate = (matchesPlayed: number, matchesWon: number) => {
    if (matchesPlayed === 0) return '0.0';
    return ((matchesWon / matchesPlayed) * 100).toFixed(1);
  };

  return (
    <div className="ai-coach-page">
      {/* Hero Header */}
      <div className="ai-coach-hero">
        <div className="ai-coach-hero-content">
          <div className="ai-coach-hero-icon">
            <Brain size={48} />
          </div>
          <h1 className="ai-coach-hero-title">AI Tennis Coach</h1>
          <p className="ai-coach-hero-subtitle">
            Advanced AI-powered analysis for professional tennis insights
          </p>
          <div className="ai-coach-hero-features">
            <div className="ai-coach-feature">
              <Target size={20} />
              <span>Playing Style Analysis</span>
            </div>
            <div className="ai-coach-feature">
              <TrendingUp size={20} />
              <span>Performance Insights</span>
            </div>
            <div className="ai-coach-feature">
              <Award size={20} />
              <span>Improvement Recommendations</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ai-coach-container">
        <div className="ai-coach-layout">
          {/* Left Sidebar - Player Selection */}
          <div className="ai-coach-sidebar">
            <div className="ai-coach-card">
              <div className="ai-coach-card-header">
                <h2 className="ai-coach-card-title">
                  <User size={20} />
                  Player Selection
                </h2>
                <p className="ai-coach-card-subtitle">
                  Search for any player or analyze your own performance
                </p>
              </div>

              {/* Enhanced Search */}
              <div className="ai-coach-search-section">
                <div className="ai-coach-search-container">
                  <Search className="ai-coach-search-icon" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search players by username..."
                    className="ai-coach-search-input"
                  />
                  {isSearching && (
                    <Loader2 className="ai-coach-search-loading" size={18} />
                  )}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="ai-coach-search-results">
                    {searchResults.map((player) => (
                      <div
                        key={player.user_id}
                        className="ai-coach-search-item"
                        onClick={() => handleSelectPlayer(player)}
                      >
                        <div className="ai-coach-player-avatar">
                          {player.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="ai-coach-search-details">
                          <div className="ai-coach-search-name">{player.username}</div>
                          <div className="ai-coach-search-meta">
                            <span className={`ai-coach-skill-badge skill-${player.skill_level}`}>
                              {player.skill_level}
                            </span>
                            <span className="ai-coach-rating">
                              {player.elo_rating} ELO
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                  <div className="ai-coach-no-results">
                    <User className="ai-coach-no-results-icon" size={32} />
                    <p>No players found matching "{searchQuery}"</p>
                  </div>
                )}
              </div>

              {/* Selected Player Profile */}
              {selectedPlayer && (
                <div className="ai-coach-player-profile">
                  <div className="ai-coach-player-header">
                    <div className="ai-coach-player-avatar large">
                      {selectedPlayer.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="ai-coach-player-info">
                      <h3 className="ai-coach-player-name">{selectedPlayer.username}</h3>
                      <div className="ai-coach-player-badges">
                        <span
                          className={`ai-coach-skill-badge skill-${selectedPlayer.skill_level}`}
                        >
                          {selectedPlayer.skill_level}
                        </span>
                        <span className="ai-coach-rating-badge">
                          {selectedPlayer.elo_rating} ELO
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ai-coach-player-stats">
                    <div className="ai-coach-stat-card">
                      <div className="ai-coach-stat-icon">
                        <Trophy size={16} />
                      </div>
                      <div className="ai-coach-stat-value">{selectedPlayer.matches_played}</div>
                      <div className="ai-coach-stat-label">Matches</div>
                    </div>
                    <div className="ai-coach-stat-card">
                      <div className="ai-coach-stat-icon">
                        <Award size={16} />
                      </div>
                      <div className="ai-coach-stat-value">{selectedPlayer.matches_won}</div>
                      <div className="ai-coach-stat-label">Wins</div>
                    </div>
                    <div className="ai-coach-stat-card">
                      <div className="ai-coach-stat-icon">
                        <TrendingUp size={16} />
                      </div>
                      <div className="ai-coach-stat-value">
                        {calculateWinRate(selectedPlayer.matches_played, selectedPlayer.matches_won)}%
                      </div>
                      <div className="ai-coach-stat-label">Win Rate</div>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateAnalysis}
                    disabled={isGeneratingAnalysis}
                    className="ai-coach-analyze-btn"
                  >
                    {isGeneratingAnalysis ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        {selectedPlayer.player_style_analysis ? 'Regenerate Analysis' : 'Generate AI Analysis'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Recent Matches */}
            {selectedPlayer && playerMatches.length > 0 && (
              <div className="ai-coach-card">
                <div className="ai-coach-card-header">
                  <h3 className="ai-coach-card-title">
                    <Trophy size={18} />
                    Recent Performance
                  </h3>
                </div>
                <div className="ai-coach-matches-list">
                  {playerMatches.map((match) => {
                    const isPlayer1 = match.player1_id === selectedPlayer.user_id;
                    const opponent = isPlayer1 ? match.player2 : match.player1;
                    const isWinner = match.winner_id === selectedPlayer.user_id;
                    
                    return (
                      <div key={match.id} className="ai-coach-match-item">
                        <div className="ai-coach-match-info">
                          <div className="ai-coach-match-opponent">
                            vs {opponent?.username || 'Unknown'}
                          </div>
                          <div className="ai-coach-match-date">
                            {new Date(match.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className={`ai-coach-match-result ${isWinner ? 'win' : 'loss'}`}>
                          {isWinner ? 'W' : 'L'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Main Content - Analysis Display */}
          <div className="ai-coach-main">
            <div className="ai-coach-card">
              <div className="ai-coach-card-header">
                <h2 className="ai-coach-card-title">
                  <BarChart3 size={20} />
                  Player Style Analysis
                </h2>
                <p className="ai-coach-card-subtitle">
                  AI-powered insights into playing style, strengths, and improvement areas
                </p>
              </div>

              {/* Status Messages */}
              {error && (
                <div className="ai-coach-alert ai-coach-alert-error">
                  <AlertTriangle size={20} />
                  <div>
                    <h4>Analysis Failed</h4>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="ai-coach-alert ai-coach-alert-success">
                  <CheckCircle size={20} />
                  <div>
                    <h4>Analysis Complete</h4>
                    <p>{success}</p>
                  </div>
                </div>
              )}

              {/* Analysis Content */}
              <div className="ai-coach-analysis-section">
                {isGeneratingAnalysis ? (
                  <div className="ai-coach-loading-state">
                    <div className="ai-coach-loading-animation">
                      <Brain size={48} className="ai-coach-loading-icon" />
                      <div className="ai-coach-loading-pulse"></div>
                    </div>
                    <h3>Generating Analysis</h3>
                    <p>Our AI coach is analyzing playing patterns, strengths, and areas for improvement...</p>
                    <div className="ai-coach-loading-steps">
                      <div className="ai-coach-loading-step active">
                        <Zap size={16} />
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
                ) : selectedPlayer?.player_style_analysis ? (
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
                ) : selectedPlayer ? (
                  <div className="ai-coach-empty-state">
                    <div className="ai-coach-empty-icon">
                      <Sparkles size={64} />
                    </div>
                    <h3>Ready to Analyze</h3>
                    <p>
                      Generate an AI-powered analysis of {selectedPlayer.username}'s playing style, 
                      strengths, and areas for improvement based on match history and performance data.
                    </p>
                    <button
                      onClick={handleGenerateAnalysis}
                      className="ai-coach-cta-btn"
                    >
                      <Brain size={18} />
                      Start AI Analysis
                    </button>
                  </div>
                ) : (
                  <div className="ai-coach-empty-state">
                    <div className="ai-coach-empty-icon">
                      <User size={64} />
                    </div>
                    <h3>Select a Player</h3>
                    <p>
                      Choose a player from the search results or use your own profile to begin 
                      generating professional AI-powered tennis insights.
                    </p>
                  </div>
                )}
              </div>

              {/* AI Coach Information */}
              <div className="ai-coach-info-panel">
                <div className="ai-coach-info-header">
                  <Info size={20} />
                  <h4>About AI Tennis Coach</h4>
                </div>
                <p>
                  Our advanced AI system analyzes comprehensive player data including match history, 
                  performance patterns, and statistical trends to provide personalized coaching insights. 
                  The analysis identifies unique playing styles, tactical strengths, technical weaknesses, 
                  and strategic improvement opportunities.
                </p>
                <div className="ai-coach-capabilities">
                  <div className="ai-coach-capability">
                    <Target size={16} />
                    <span>Playing Style Identification</span>
                  </div>
                  <div className="ai-coach-capability">
                    <TrendingUp size={16} />
                    <span>Performance Pattern Analysis</span>
                  </div>
                  <div className="ai-coach-capability">
                    <Award size={16} />
                    <span>Personalized Recommendations</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICoachPage;