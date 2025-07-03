import React from 'react';
import { Trophy, Medal, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useRankings } from '../hooks/useRankings';

interface RankingPlayer {
  user_id: string;
  username: string;
  elo_rating: number;
  matches_played: number;
  matches_won: number;
  skill_level: string;
  profile_picture_url: string | null;
  rank: number;
  win_rate: number;
  rank_change?: number;
}

const RankingsPage: React.FC = () => {
  const { data: rankings, isLoading, error, refetch } = useRankings();

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="text-yellow-500" size={24} />;
    if (rank === 2) return <Medal className="text-gray-400" size={24} />;
    if (rank === 3) return <Medal className="text-amber-600" size={24} />;
    return <span className="text-lg font-bold text-gray-600">#{rank}</span>;
  };

  const getRankChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="text-green-500" size={16} />;
    if (change < 0) return <TrendingDown className="text-red-500" size={16} />;
    return <Minus className="text-gray-400" size={16} />;
  };



  if (isLoading) {
    return (
      <div className="rankings-page">
        <div className="rankings-empty">
          <div className="loading-spinner"></div>
          <p>Loading rankings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rankings-page">
        <div className="rankings-empty">
          <h2>Failed to load rankings</h2>
          <p>There was an error loading the player rankings.</p>
          <button
            onClick={() => refetch()}
            className="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rankings-page">
      <div className="rankings-header">
        <div className="rankings-title-section">
          <h1 className="rankings-title">
            <Trophy className="text-quantum-cyan" />
            Player Rankings
          </h1>
          <p className="rankings-subtitle">
            Top players ranked by ELO rating and tournament performance
          </p>
        </div>
        
        <div className="rankings-controls">
          <button
            onClick={() => refetch()}
            className="btn btn-primary"
          >
            Refresh Rankings
          </button>
        </div>
      </div>

      {rankings && rankings.length > 0 ? (
        <div className="rankings-table-container">
          <div className="rankings-table-header">
            <div>Rank</div>
            <div>Player</div>
            <div>ELO Rating</div>
            <div>Matches</div>
            <div>Win Rate</div>
            <div>Change</div>
          </div>
          
          <div className="rankings-table-body">
            {rankings.map((player: RankingPlayer) => (
              <div key={player.user_id} className="rankings-table-row">
                <div className="rank-col">
                  <div className="rank-display">
                    {getRankIcon(player.rank)}
                  </div>
                </div>
                <div className="player-col">
                  <div className="player-info">
                    {player.profile_picture_url ? (
                      <img
                        className="player-avatar"
                        src={player.profile_picture_url}
                        alt=""
                      />
                    ) : (
                      <div className="player-avatar player-avatar-fallback">
                        <span className="player-avatar-initial">
                          {player.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="player-details">
                      <div className="player-name">
                        {player.username}
                      </div>
                      <div className={`player-skill skill-${player.skill_level?.toLowerCase() || 'beginner'}`}>
                        {player.skill_level}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rating-col">
                  <div className="rating-display">
                    <div className="rating-value">{player.elo_rating}</div>
                    <div className="rating-label">ELO</div>
                  </div>
                </div>
                <div className="matches-col">
                  <div className="matches-display">
                    <div className="matches-played">{player.matches_played}</div>
                    <div className="matches-won">{player.matches_won} wins</div>
                  </div>
                </div>
                <div className="winrate-col">
                  <div className="winrate-display">
                    <div className="winrate-value">{player.win_rate.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="change-col">
                  <div className="rank-change">
                    {getRankChangeIcon(player.rank_change || 0)}
                    <span className="rank-change-number">
                      {Math.abs(player.rank_change || 0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rankings-empty">
          <Trophy className="rankings-empty-icon" size={48} />
          <h3>No rankings available</h3>
          <p>
            Rankings will appear here once players start competing in matches.
          </p>
        </div>
      )}
    </div>
  );
};

export default RankingsPage;