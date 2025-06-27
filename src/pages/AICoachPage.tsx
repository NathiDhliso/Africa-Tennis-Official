import React, { useState, useEffect } from 'react';
import { Search, User, Sparkles, Loader2, Trophy, BarChart3, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/aws';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

const AICoachPage: React.FC = () => {
  const { user, profile } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [playerMatches, setPlayerMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
      } catch (err: any) {
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
    setIsLoading(true);
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
    } catch (err: any) {
      console.error('Error fetching player matches:', err);
    } finally {
      setIsLoading(false);
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
        player_style_analysis: response.data.playerStyleAnalysis
      });

      setSuccess('Player style analysis generated successfully!');
    } catch (err: any) {
      console.error('Error generating player style analysis:', err);
      setError(`Failed to generate analysis: ${err.message}`);
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  const getSkillLevelColor = (skillLevel: string) => {
    switch (skillLevel) {
      case 'beginner':
        return 'var(--rating-beginner)';
      case 'intermediate':
        return 'var(--rating-intermediate)';
      case 'advanced':
        return 'var(--rating-advanced)';
      case 'expert':
        return 'var(--rating-expert)';
      default:
        return 'var(--text-muted)';
    }
  };

  const calculateWinRate = (matchesPlayed: number, matchesWon: number) => {
    if (matchesPlayed === 0) return '0.0';
    return ((matchesWon / matchesPlayed) * 100).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-bg-deep-space">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-start gap-8">
          {/* Left Column - Player Selection */}
          <div className="w-full md:w-1/3 space-y-6">
            <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Sparkles className="text-quantum-cyan" />
                <span>AI Tennis Coach</span>
              </h2>
              <p className="text-text-subtle mb-6">
                Get AI-powered insights and analysis for any player. Search for a player or use your own profile.
              </p>

              {/* Player Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Search Players</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by username..."
                    className="w-full pl-10 pr-4 py-2 bg-bg-elevated border border-border-subtle rounded-md focus:border-quantum-cyan focus:ring-1 focus:ring-quantum-cyan"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin text-text-muted" size={18} />
                  )}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-2 player-search-results">
                    {searchResults.map((player) => (
                      <div
                        key={player.user_id}
                        className="player-search-item"
                        onClick={() => handleSelectPlayer(player)}
                      >
                        <div className="player-avatar">
                          {player.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="player-search-details">
                          <div className="player-search-name">{player.username}</div>
                          <div className="player-search-info">
                            <span className={`player-skill-badge ${player.skill_level}`}>
                              {player.skill_level}
                            </span>
                            <span className="player-rating">
                              Rating: {player.elo_rating}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                  <div className="mt-2 p-4 bg-bg-elevated rounded-md text-center">
                    <User className="mx-auto h-8 w-8 text-text-muted mb-2" />
                    <p className="text-text-subtle">No players found matching "{searchQuery}"</p>
                  </div>
                )}
              </div>

              {/* Selected Player Card */}
              {selectedPlayer && (
                <div className="bg-bg-elevated rounded-lg p-4 border border-border-subtle">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="player-avatar w-16 h-16 text-xl">
                      {selectedPlayer.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{selectedPlayer.username}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${getSkillLevelColor(selectedPlayer.skill_level)}20`,
                            color: getSkillLevelColor(selectedPlayer.skill_level)
                          }}
                        >
                          {selectedPlayer.skill_level}
                        </span>
                        <span className="text-sm text-text-subtle">
                          Rating: {selectedPlayer.elo_rating}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-bg-surface-gray rounded p-2 text-center">
                      <div className="text-lg font-bold text-quantum-cyan">{selectedPlayer.matches_played}</div>
                      <div className="text-xs text-text-subtle">Matches</div>
                    </div>
                    <div className="bg-bg-surface-gray rounded p-2 text-center">
                      <div className="text-lg font-bold text-quantum-cyan">{selectedPlayer.matches_won}</div>
                      <div className="text-xs text-text-subtle">Wins</div>
                    </div>
                    <div className="bg-bg-surface-gray rounded p-2 text-center">
                      <div className="text-lg font-bold text-quantum-cyan">
                        {calculateWinRate(selectedPlayer.matches_played, selectedPlayer.matches_won)}%
                      </div>
                      <div className="text-xs text-text-subtle">Win Rate</div>
                    </div>
                  </div>

                  {selectedPlayer.bio && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-1">Bio</h4>
                      <p className="text-sm text-text-subtle bg-bg-surface-gray p-2 rounded">
                        {selectedPlayer.bio}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleGenerateAnalysis}
                    disabled={isGeneratingAnalysis}
                    className="w-full btn btn-primary flex items-center justify-center gap-2"
                  >
                    {isGeneratingAnalysis ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Generating Analysis...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        {selectedPlayer.player_style_analysis ? 'Regenerate Analysis' : 'Generate AI Analysis'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Recent Matches */}
            {selectedPlayer && playerMatches.length > 0 && (
              <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Trophy className="text-quantum-cyan" size={18} />
                  Recent Matches
                </h3>
                <div className="space-y-3">
                  {playerMatches.map((match) => {
                    const isPlayer1 = match.player1_id === selectedPlayer.user_id;
                    const opponent = isPlayer1 ? match.player2 : match.player1;
                    const isWinner = match.winner_id === selectedPlayer.user_id;
                    
                    return (
                      <div key={match.id} className="bg-bg-elevated p-3 rounded border border-border-subtle">
                        <div className="flex justify-between items-center mb-1">
                          <div className="text-sm font-medium">
                            vs {opponent?.username || 'Unknown'}
                          </div>
                          <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            isWinner ? 'bg-success-green bg-opacity-20 text-success-green' : 'bg-error-pink bg-opacity-20 text-error-pink'
                          }`}>
                            {isWinner ? 'Win' : 'Loss'}
                          </div>
                        </div>
                        <div className="text-xs text-text-subtle">
                          {new Date(match.date).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Analysis Display */}
          <div className="w-full md:w-2/3">
            <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <BarChart3 className="text-quantum-cyan" />
                <span>Player Style Analysis</span>
              </h2>

              {/* Error/Success Messages */}
              {error && (
                <div className="mb-6 p-4 bg-error-pink bg-opacity-10 border border-error-pink border-opacity-20 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="text-error-pink flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-medium text-error-pink">Error</h3>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-success-green bg-opacity-10 border border-success-green border-opacity-20 rounded-lg flex items-start gap-3">
                  <CheckCircle className="text-success-green flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-medium text-success-green">Success</h3>
                    <p className="text-sm">{success}</p>
                  </div>
                </div>
              )}

              {/* Analysis Content */}
              {isGeneratingAnalysis ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <LoadingSpinner size="large" text="Generating Player Analysis" subtext="Our AI coach is analyzing playing style, strengths, and areas for improvement" />
                </div>
              ) : selectedPlayer?.player_style_analysis ? (
                <div className="bg-bg-elevated rounded-lg p-6 border border-border-subtle">
                  <div className="relative">
                    <div className="absolute -left-2 top-0 bottom-0 w-1 bg-quantum-cyan rounded-full"></div>
                    <div className="pl-4">
                      <p className="text-text-standard leading-relaxed">{selectedPlayer.player_style_analysis}</p>
                      <div className="mt-4 text-right">
                        <span className="text-xs text-text-subtle italic">Generated by AI Coach</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedPlayer ? (
                <div className="py-12 text-center">
                  <Sparkles className="mx-auto h-16 w-16 text-text-muted mb-4" />
                  <h3 className="text-xl font-medium mb-2">No Analysis Available</h3>
                  <p className="text-text-subtle mb-6 max-w-md mx-auto">
                    Generate an AI-powered analysis of {selectedPlayer.username}'s playing style, strengths, and areas for improvement.
                  </p>
                  <button
                    onClick={handleGenerateAnalysis}
                    disabled={isGeneratingAnalysis}
                    className="btn btn-primary"
                  >
                    <Sparkles size={16} className="mr-2" />
                    Generate Player Analysis
                  </button>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <User className="mx-auto h-16 w-16 text-text-muted mb-4" />
                  <h3 className="text-xl font-medium mb-2">Select a Player</h3>
                  <p className="text-text-subtle max-w-md mx-auto">
                    Search for a player or use your own profile to generate an AI analysis.
                  </p>
                </div>
              )}

              {/* AI Coach Information */}
              <div className="mt-8 p-4 bg-bg-elevated rounded-lg border border-border-subtle">
                <div className="flex items-start gap-3">
                  <Info className="text-quantum-cyan flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="font-medium text-text-standard mb-1">About AI Tennis Coach</h3>
                    <p className="text-sm text-text-subtle">
                      The AI Tennis Coach analyzes player statistics, match history, and performance patterns to provide personalized insights. 
                      It identifies playing style, strengths, weaknesses, and suggests areas for improvement based on comprehensive data analysis.
                    </p>
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