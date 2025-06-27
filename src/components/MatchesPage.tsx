import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Calendar, MapPin, Clock, Target, Swords, ChevronDown, ChevronUp, ArrowLeft, Users, Timer, Award, TrendingUp, Eye, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Match } from '../types';
import MatchCard from './MatchCard';
import ScoreModal from './ScoreModal';
import MatchModal from './MatchModal';
import MatchDetailsPage from './MatchDetailsPage';
import { useNavigate } from 'react-router-dom';

interface ExpandedMatchData {
  venue: {
    name: string;
    location: string;
    capacity: number;
    facilities: string[];
  };
  headToHead: {
    totalMatches: number;
    userWins: number;
    opponentWins: number;
    lastMatch?: {
      date: string;
      score: string;
      winner: string;
    };
  };
  ticketInfo?: {
    available: boolean;
    price: string;
    purchaseLink: string;
  };
}

const MatchesPage: React.FC = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Match['status']>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'recent'>('all');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [selectedMatchForDetails, setSelectedMatchForDetails] = useState<Match | null>(null);
  
  // Accordion state
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());
  const [loadingMatchData, setLoadingMatchData] = useState<Set<string>>(new Set());
  const [matchData, setMatchData] = useState<Map<string, ExpandedMatchData>>(new Map());

  const navigate = useNavigate();

  const loadMatches = useCallback(async () => {
    if (user) {
      // Mock data for now - replace with actual service call
      const userMatches: Match[] = [];
      const now = new Date();
      
      // Separate upcoming and recent matches
      const upcoming = userMatches
        .filter(match => {
          const matchDate = new Date(match.date);
          return matchDate > now && (match.status === 'pending' || match.status === 'confirmed');
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const recent = userMatches
        .filter(match => {
          const matchDate = new Date(match.date);
          return matchDate <= now || match.status === 'completed';
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setUpcomingMatches(upcoming);
      setRecentMatches(recent);
      
      // Sort all matches by date (newest first)
      const sortedMatches = userMatches.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
      setMatches(sortedMatches);
    }
  }, [user]);

  const filterMatches = useCallback(() => {
    let filtered = matches;
    const now = new Date();

    // Apply time filter
    if (timeFilter === 'upcoming') {
      filtered = filtered.filter(match => {
        const matchDate = new Date(match.date);
        return matchDate > now && (match.status === 'pending' || match.status === 'confirmed');
      });
    } else if (timeFilter === 'recent') {
      filtered = filtered.filter(match => {
        const matchDate = new Date(match.date);
        return matchDate <= now || match.status === 'completed';
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(match => match.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(match => {
        // Mock opponent search - replace with actual service call
        return match.location.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    setFilteredMatches(filtered);
  }, [matches, searchQuery, statusFilter, timeFilter, user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadMatches();
    }
  }, [user?.id, loadMatches]);

  useEffect(() => {
    filterMatches();
  }, [filterMatches]);

  const generateMockMatchData = (): ExpandedMatchData => {
    // Generate mock venue data
    const venues = [
      { name: 'Elite Tennis Academy', location: 'Sandton, Johannesburg', capacity: 500, facilities: ['Pro Shop', 'Locker Rooms', 'Parking', 'Café'] },
      { name: 'Midrand Tennis Club', location: 'Midrand, Gauteng', capacity: 300, facilities: ['Coaching', 'Equipment Rental', 'Parking'] },
      { name: 'Central Sports Complex', location: 'Pretoria Central', capacity: 800, facilities: ['Multiple Courts', 'Spectator Seating', 'Restaurant', 'Parking'] },
      { name: 'Community Tennis Courts', location: 'Roodepoort', capacity: 150, facilities: ['Basic Facilities', 'Parking'] },
    ];
    
    const venue = venues[Math.floor(Math.random() * venues.length)];
    
    // Generate mock head-to-head data
    const totalMatches = Math.floor(Math.random() * 8) + 1;
    const userWins = Math.floor(Math.random() * totalMatches);
    const opponentWins = totalMatches - userWins;
    
    const lastMatchDate = new Date();
    lastMatchDate.setDate(lastMatchDate.getDate() - Math.floor(Math.random() * 90));
    
    return {
      venue,
      headToHead: {
        totalMatches,
        userWins,
        opponentWins,
        lastMatch: totalMatches > 0 ? {
          date: lastMatchDate.toLocaleDateString(),
          score: `${Math.floor(Math.random() * 7)}-${Math.floor(Math.random() * 7)}`,
          winner: Math.random() > 0.5 ? 'You' : 'Opponent'
        } : undefined
      },
      ticketInfo: Math.random() > 0.7 ? {
        available: true,
        price: `R${Math.floor(Math.random() * 100) + 50}`,
        purchaseLink: '#'
      } : undefined
    };
  };

  const toggleMatchExpansion = async (matchId: string) => {
    const newExpanded = new Set(expandedMatches);
    
    if (expandedMatches.has(matchId)) {
      newExpanded.delete(matchId);
    } else {
      newExpanded.add(matchId);
      
      // Load match data if not already loaded
      if (!matchData.has(matchId)) {
        setLoadingMatchData(prev => new Set(prev).add(matchId));
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const data = generateMockMatchData();
        setMatchData(prev => new Map(prev).set(matchId, data));

        setLoadingMatchData(prev => {
          const newSet = new Set(prev);
          newSet.delete(matchId);
          return newSet;
        });
      }
    }
    
    setExpandedMatches(newExpanded);
  };

  const handleReportScore = (match: Match) => {
    setSelectedMatch(match);
    setShowScoreModal(true);
  };

  const handleScoreSubmit = (challengerScore: number, challengedScore: number) => {
    if (selectedMatch) {
      // Mock score submission - replace with actual service call
      console.log(`Score submitted: Challenger ${challengerScore}, Challenged ${challengedScore}`);
      setShowScoreModal(false);
      setSelectedMatch(null);
      loadMatches();
    }
  };

  const handleCreateNewMatch = () => {
    setShowCreateForm(true);
  };

  const handleMatchCreated = () => {
    loadMatches();
  };

  const handleViewMatchDetails = (match: Match) => {
    setSelectedMatchForDetails(match);
    setShowMatchDetails(true);
  };

  const handleBackFromDetails = () => {
    setShowMatchDetails(false);
    setSelectedMatchForDetails(null);
  };

  const getFilterCount = (status: Match['status']) => {
    return matches.filter(m => m.status === status).length;
  };

  const getTimeFilterCount = (timeType: 'upcoming' | 'recent') => {
    const now = new Date();
    if (timeType === 'upcoming') {
      return matches.filter(match => {
        const matchDate = new Date(match.date);
        return matchDate > now && (match.status === 'pending' || match.status === 'confirmed');
      }).length;
    } else {
      return matches.filter(match => {
        const matchDate = new Date(match.date);
        return matchDate <= now || match.status === 'completed';
      }).length;
    }
  };

  // Show match details page if selected
  if (showMatchDetails && selectedMatchForDetails) {
    return (
      <MatchDetailsPage
        match={selectedMatchForDetails}
        onBack={handleBackFromDetails}
      />
    );
  }

  return (
    <div className="matches-page">
      <div className="matches-container">
        {/* Header */}
        <div className="matches-header">
          <div className="matches-title-section">
            <h1 className="matches-title">
              <Swords size={32} />
              My Matches
            </h1>
            <p className="matches-subtitle">
              Manage your scheduled matches, view results, and track your tennis journey
            </p>
          </div>
          
          <div className="matches-header-actions">
            <button
              onClick={handleCreateNewMatch}
              className="matches-new-btn"
            >
              <Plus size={16} />
              Create New Match
            </button>
          </div>
        </div>

        {/* Upcoming Matches Section with Accordion */}
        {upcomingMatches.length > 0 && (
          <div className="matches-section">
            <h2 className="matches-section-title">
              <Clock size={24} />
              Upcoming Matches ({upcomingMatches.length})
            </h2>
            <div className="matches-accordion-grid">
              {upcomingMatches.map((match) => {
                        // Mock opponent - replace with actual service call
        const opponent = { name: 'Unknown Player' };
                const isExpanded = expandedMatches.has(match.id);
                const isLoading = loadingMatchData.has(match.id);
                const data = matchData.get(match.id);
                const matchDate = new Date(match.date);

                return (
                  <div key={match.id} className="match-accordion-card">
                    {/* Main Match Card */}
                    <div className="match-accordion-header">
                      <MatchCard
                        match={match}
                        currentUserId={user?.id || ''}
                        onReportScore={() => handleReportScore(match)}
                      />
                      
                      <button
                        onClick={() => toggleMatchExpansion(match.id)}
                        className="match-expand-btn"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader size={20} className="animate-spin" />
                        ) : isExpanded ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </button>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && data && (
                      <div className="match-accordion-content">
                        {/* Venue Details */}
                        <div className="match-detail-section">
                          <h4 className="match-detail-title">
                            <MapPin size={16} />
                            Venue Details
                          </h4>
                          <div className="match-detail-content">
                            <div className="venue-info">
                              <div className="venue-main">
                                <h5 className="venue-name">{data.venue.name}</h5>
                                <p className="venue-location">{data.venue.location}</p>
                                <p className="venue-capacity">Capacity: {data.venue.capacity} spectators</p>
                              </div>
                              <div className="venue-facilities">
                                <span className="facilities-label">Facilities:</span>
                                <div className="facilities-list">
                                  {data.venue.facilities.map((facility, index) => (
                                    <span key={index} className="facility-tag">{facility}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Head-to-Head Statistics */}
                        <div className="match-detail-section">
                          <h4 className="match-detail-title">
                            <TrendingUp size={16} />
                            Head-to-Head Record
                          </h4>
                          <div className="match-detail-content">
                            <div className="h2h-stats">
                              <div className="h2h-summary">
                                <div className="h2h-record">
                                  <span className="h2h-total">Total Matches: {data.headToHead.totalMatches}</span>
                                </div>
                                <div className="h2h-breakdown">
                                  <div className="h2h-stat user-wins">
                                    <span className="h2h-label">Your Wins</span>
                                    <span className="h2h-value">{data.headToHead.userWins}</span>
                                  </div>
                                  <div className="h2h-stat opponent-wins">
                                    <span className="h2h-label">{opponent?.name} Wins</span>
                                    <span className="h2h-value">{data.headToHead.opponentWins}</span>
                                  </div>
                                </div>
                              </div>
                              
                              {data.headToHead.lastMatch && (
                                <div className="h2h-last-match">
                                  <h6 className="last-match-title">Last Match</h6>
                                  <div className="last-match-details">
                                    <span className="last-match-date">{data.headToHead.lastMatch.date}</span>
                                    <span className="last-match-score">Score: {data.headToHead.lastMatch.score}</span>
                                    <span className="last-match-winner">Winner: {data.headToHead.lastMatch.winner}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Ticket Information */}
                        {data.ticketInfo && (
                          <div className="match-detail-section">
                            <h4 className="match-detail-title">
                              <Award size={16} />
                              Spectator Information
                            </h4>
                            <div className="match-detail-content">
                              <div className="ticket-info">
                                <div className="ticket-availability">
                                  <span className="ticket-status available">Tickets Available</span>
                                  <span className="ticket-price">{data.ticketInfo.price}</span>
                                </div>
                                <button className="ticket-purchase-btn">
                                  Purchase Tickets
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Matches Section with View Details */}
        {recentMatches.length > 0 && (
          <div className="matches-section">
            <h2 className="matches-section-title">
              <Calendar size={24} />
              Recent Matches ({recentMatches.length})
            </h2>
            <div className="matches-grid">
              {recentMatches.map((match) => (
                <div key={match.id} className="match-card-with-details">
                  <MatchCard
                    match={match}
                    currentUserId={user?.id || ''}
                    onReportScore={() => handleReportScore(match)}
                  />
                  
                  <button
                    onClick={() => handleViewMatchDetails(match)}
                    className="match-details-btn"
                  >
                    <Eye size={16} />
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters and Search - Only show if there are matches */}
        {matches.length > 0 && (
          <div className="matches-filters">
            <div className="matches-filters-header">
              <h2 className="matches-section-title">
                <Filter size={24} />
                All Matches ({matches.length})
              </h2>
            </div>
            
            <div className="matches-filters-content">
              {/* Search Bar */}
              <div className="matches-search">
                <div className="matches-search-container">
                  <Search size={20} className="matches-search-icon" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="matches-search-input"
                    placeholder="Search by opponent or location..."
                  />
                </div>
              </div>

              {/* Filter Controls */}
              <div className="matches-filter-controls">
                <div className="matches-filter-group">
                  <label className="matches-filter-label">Time Period</label>
                  <select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value as typeof timeFilter)}
                    className="form-select matches-filter-select"
                  >
                    <option value="all">All Matches ({matches.length})</option>
                    <option value="upcoming">Upcoming ({getTimeFilterCount('upcoming')})</option>
                    <option value="recent">Recent ({getTimeFilterCount('recent')})</option>
                  </select>
                </div>

                <div className="matches-filter-group">
                  <label className="matches-filter-label">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="form-select matches-filter-select"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending ({getFilterCount('pending')})</option>
                    <option value="confirmed">Confirmed ({getFilterCount('confirmed')})</option>
                    <option value="completed">Completed ({getFilterCount('completed')})</option>
                    <option value="declined">Declined ({getFilterCount('declined')})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Filtered Results */}
            <div className="matches-grid">
              {filteredMatches.length > 0 ? (
                filteredMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    currentUserId={user?.id || ''}
                    onReportScore={() => handleReportScore(match)}
                    onViewDetails={() => navigate(`/matches/${match.id}`)}
                    onActionComplete={loadMatches}
                  />
                ))
              ) : (
                <div className="matches-empty">
                  <Search size={48} className="matches-empty-icon" />
                  <h3 className="matches-empty-title">No matches found</h3>
                  <p className="matches-empty-description">
                    Try adjusting your search or filter criteria.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Matches State */}
        {matches.length === 0 && (
          <div className="matches-empty-state">
            <div className="matches-empty-content">
              <Swords size={64} className="matches-empty-icon" />
              <h3 className="matches-empty-title">
                No Matches Scheduled
              </h3>
              <p className="matches-empty-description">
                Create matches with other players to start building your match history and climb the rankings!
              </p>
              <div className="matches-empty-actions">
                <button
                  onClick={handleCreateNewMatch}
                  className="matches-empty-btn"
                >
                  <Target size={16} />
                  Create a Match
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Score Modal */}
      {showScoreModal && selectedMatch && (
        <ScoreModal
          match={selectedMatch}
          onSubmit={handleScoreSubmit}
          onClose={() => {
            setShowScoreModal(false);
            setSelectedMatch(null);
          }}
        />
      )}

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

export default MatchesPage;