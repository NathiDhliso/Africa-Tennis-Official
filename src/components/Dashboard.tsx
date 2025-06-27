import React, { useState } from 'react';
import { Target, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import MatchModal from './MatchModal';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateMatch = () => {
    setShowCreateForm(true);
  };

  const handleMatchCreated = () => {
    // Refresh can be handled by parent components if needed
  };

  const winRate = user ? (user.matchesPlayed > 0 ? (user.matchesWon / user.matchesPlayed * 100).toFixed(1) : '0.0') : '0.0';

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        {/* Welcome Message */}
        <div className="dashboard-welcome">
          <div className="dashboard-welcome-content">
            <h1 className="dashboard-welcome-title">
              Welcome back, <span className="dashboard-welcome-name">{user?.name || 'Player'}</span>
            </h1>
            <p className="dashboard-welcome-subtitle">
              Ready to dominate the court? Create matches with new opponents and climb the rankings.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="dashboard-stats">
          <div className="dashboard-stat-card stagger-1">
            <div className="dashboard-stat-value">{user?.rating || 1200}</div>
            <div className="dashboard-stat-label">Rating</div>
          </div>
          <div className="dashboard-stat-card stagger-2">
            <div className="dashboard-stat-value">{user?.matchesPlayed || 0}</div>
            <div className="dashboard-stat-label">Matches Played</div>
          </div>
          <div className="dashboard-stat-card stagger-3">
            <div className="dashboard-stat-value">{user?.matchesWon || 0}</div>
            <div className="dashboard-stat-label">Matches Won</div>
          </div>
          <div className="dashboard-stat-card stagger-4">
            <div className="dashboard-stat-value">{winRate}%</div>
            <div className="dashboard-stat-label">Win Rate</div>
          </div>
        </div>

        {/* Main Action Section */}
        <div className="dashboard-section stagger-1">
          <div className="dashboard-getting-started">
            <div className="dashboard-getting-started-content">
              <Zap size={64} className="dashboard-getting-started-icon" />
              <h3 className="dashboard-getting-started-title">
                Ready to Start Your Tennis Journey?
              </h3>
              <p className="dashboard-getting-started-description">
                Create matches with other players to build your match history, improve your ranking, and become part of the competitive tennis community!
              </p>
              <div className="dashboard-getting-started-actions">
                <button
                  onClick={handleCreateMatch}
                  className="btn btn-primary btn-glare"
                >
                  <Target size={16} />
                  Create a Match
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Match Creation Form */}
      {showCreateForm && (
        <MatchModal
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onMatchCreated={handleMatchCreated}
          mode="create"
        />
      )}
    </div>
  );
};

export default Dashboard;