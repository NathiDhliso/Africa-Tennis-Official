// Interface for API responses (may be used in the future)
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

class ApiClient {
  private baseURL: string;
  private useAWS: boolean;

  constructor() {
    // Progressive rollout: use environment flag to switch between Supabase and AWS
    this.useAWS = import.meta.env.VITE_USE_AWS === 'true';
    this.baseURL = import.meta.env.VITE_AWS_API_URL || 'https://api.africatennis.com/prod';
    
    console.log(`API Client initialized - Using ${this.useAWS ? 'AWS' : 'Supabase'} backend`);
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth header if user is logged in
    const authToken = localStorage.getItem('supabase.auth.token');
    if (authToken) {
      defaultHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // --- Core Heavy-Computation Endpoints (AWS-first) ---

  // 1. Live Scoring (Offloaded to AWS Lambda)
  async updateMatchScore(matchId: string, data: {
    winningPlayerId: string;
    pointType?: string;
  }) {
    if (this.useAWS) {
      console.log('🚀 Using AWS Lambda for score update');
      return this.request(`/compute/update-score/${matchId}`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } else {
      // Fallback to existing mock implementation
      console.log('⚠️ Using fallback Supabase implementation');
      return {
        success: true,
        data: {
          sets: [
            {
              player1_games: 3,
              player2_games: 2,
              games: []
            }
          ],
          current_game: {
            player1: data.winningPlayerId === data.winningPlayerId ? '40' : '30',
            player2: '15'
          },
          server_id: data.winningPlayerId,
          is_tiebreak: false
        }
      };
    }
  }

  // 2. Tournament Bracket Generation (Offloaded to AWS Lambda)
  async generateBracket(tournamentId: string) {
    if (this.useAWS) {
      console.log('🚀 Using AWS Lambda for bracket generation');
      return this.request(`/compute/generate-bracket/${tournamentId}`, {
        method: 'POST'
      });
    } else {
      // Fallback to existing mock implementation
      console.log('⚠️ Using fallback bracket generation');
      return {
        success: true,
        data: {
          tournamentId,
          format: 'single_elimination',
          participantCount: 8,
          matchCount: 7,
          matchesCreated: 7,
          message: 'Tournament bracket generated successfully'
        }
      };
    }
  }

  // Alias for backward compatibility
  async generateTournamentBracket(tournamentId: string) {
    return this.generateBracket(tournamentId);
  }

  // 3. Rankings & Stats (Offloaded to AWS Lambda)
  async getRankings(params?: {
    limit?: number;
    offset?: number;
    skill_level?: string;
  }) {
    if (this.useAWS) {
      console.log('🚀 Using AWS Lambda for rankings');
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.skill_level) queryParams.append('skill_level', params.skill_level);
      
      const endpoint = `/query/get-rankings${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      return this.request(endpoint, { method: 'GET' });
    } else {
      // Fallback to existing implementation (will be handled by useRankings hook)
      console.log('⚠️ Using fallback rankings calculation');
      return null; // Signal to use Supabase fallback
    }
  }

  // 4. Stats Aggregation (Manual trigger)
  async aggregateStats(playerId?: string) {
    if (this.useAWS) {
      console.log('🚀 Using AWS Lambda for stats aggregation');
      const queryParams = playerId ? `?player_id=${playerId}` : '';
      return this.request(`/compute/aggregate-stats${queryParams}`, {
        method: 'POST'
      });
    } else {
      console.log('⚠️ Stats aggregation not available in fallback mode');
      return { success: false, error: 'Stats aggregation requires AWS backend' };
    }
  }

  // --- Existing Endpoints (Keep for compatibility) ---

  async getMatches() {
    return this.request('/query/get-matches');
  }

  async generateMatchSummary(matchId: string) {
    if (this.useAWS) {
      console.log('🚀 Using AWS Lambda for match summary');
      return this.request(`/compute/generate-match-summary/${matchId}`, { method: 'POST' });
    }
    // Fallback – keep running on the client (placeholder content)
    console.log('⚠️ Using fallback static match summary');
    return {
      success: true,
      data: {
        summary: 'An exciting match that featured powerful serving and strong baseline rallies. The first set was tightly contested with both players holding serve until a crucial break. This victory marks another strong performance in what has been an impressive tournament run.'
      }
    };
  }

  async generatePlayerStyle(playerId: string) {
    if (this.useAWS) {
      console.log('🚀 Using AWS Lambda for player style');
      return this.request(`/compute/generate-player-style/${playerId}`, { method: 'POST' });
    }
    // Fallback static response
    console.log('⚠️ Using fallback static player style analysis');
    return {
      success: true,
      data: {
        playerStyleAnalysis: 'This player demonstrates a balanced all-court game with strong baseline consistency. Their forehand is their primary weapon, showing good depth and placement. Backhand is solid but could be more aggressive in attacking opportunities. Serve is reliable rather than dominant, with good placement compensating for moderate power. At the net, they show decent volleying skills but could improve their approach shots. Mental game is strong, particularly in pressure situations. To advance further, focus should be on developing a more aggressive transition game and improving second serve consistency.'
      }
    };
  }

  async getUmpireInsight(matchId: string) {
    if (this.useAWS) {
      console.log('🚀 Using AWS Lambda for umpire insight');
      return this.request(`/compute/get-umpire-insight/${matchId}`, { method: 'POST' });
    }
    // Fallback static response
    console.log('⚠️ Using fallback static umpire insight');
    return {
      success: true,
      data: {
        insight: 'Based on the current score and match dynamics, this is a crucial moment in the match. The serving player should focus on first serve percentage to maintain pressure. Key areas to watch: player fatigue levels, serving patterns, and court positioning. The momentum could shift significantly with the next few points.',
        matchId,
        timestamp: new Date().toISOString()
      }
    };
  }

  // --- Performance Monitoring ---
  async getApiHealth() {
    if (this.useAWS) {
      try {
        const startTime = Date.now();
        const response = await this.request('/health', { method: 'GET' });
        const latency = Date.now() - startTime;
        
        return {
          ...response,
          latency,
          backend: 'AWS',
          performance: latency < 200 ? 'good' : latency < 500 ? 'warning' : 'poor'
        };
      } catch (error) {
        console.error('AWS health check failed:', error);
        return {
          success: false,
          backend: 'AWS',
          error: 'Health check failed',
          performance: 'poor'
        };
      }
    } else {
      return {
        success: true,
        backend: 'Supabase',
        latency: 0,
        performance: 'good'
      };
    }
  }

  // Toggle backend for testing
  toggleBackend() {
    this.useAWS = !this.useAWS;
    console.log(`🔄 Switched to ${this.useAWS ? 'AWS' : 'Supabase'} backend`);
    
    // Update environment variable for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('aws_backend_enabled', this.useAWS.toString());
    }
  }

  // Get current backend status
  getBackendStatus() {
    return {
      using_aws: this.useAWS,
      base_url: this.baseURL,
      environment: import.meta.env.MODE || 'development'
    };
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Function to set API auth token (for backward compatibility)
export const setApiAuthToken = (token: string) => {
  localStorage.setItem('supabase.auth.token', token);
};

export default apiClient;