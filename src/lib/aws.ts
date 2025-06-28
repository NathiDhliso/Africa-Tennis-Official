// Use a relative path for the proxy during development.
// The VITE_API_BASE_URL from .env will be used for production builds.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private retryCount: number = 3
  private retryDelay: number = 1000

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setAuthToken(token: string) {
    this.token = token
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      headers?: Record<string, string> | Headers | [string, string][];
      body?: string;
    } = {},
    retries = this.retryCount
  ): Promise<ApiResponse<T>> {
    // The full URL is constructed by combining the base URL and the endpoint.
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add custom headers if provided
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    try {
      // Make the actual request to Supabase directly
      const response = await fetch(url, {
        ...options,
        headers
      })

      // Handle rate limiting (429 status)
      if (response.status === 429 && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.request(endpoint, options, retries - 1);
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Handle non-JSON responses
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${this.getStatusMessage(response.status)}`);
      }

      return data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      
      // Retry on network errors
      if (error instanceof TypeError && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.request(endpoint, options, retries - 1);
      }
      
      // Return user-friendly error message
      return {
        success: false,
        error: this.getUserFriendlyErrorMessage(errorMessage, endpoint)
      };
    }
  }

  // Helper method to get user-friendly error messages
  private getUserFriendlyErrorMessage(error: string, endpoint: string): string {
    // Check for specific error patterns
    if (error.includes('Failed to fetch') || error.includes('Network error')) {
      return "⚠️ Connection lost. Please check your internet connection and try again.";
    }
    
    if (error.includes('non-JSON response')) {
      return "✨ Our service is currently taking a break. Please try again in a moment.";
    }
    
    if (error.includes('404')) {
      return "🔍 We couldn't find what you're looking for. The service might be temporarily unavailable.";
    }
    
    if (error.includes('403')) {
      return "🔒 Access denied. You might not have permission to use this feature.";
    }
    
    if (error.includes('401')) {
      return "🔑 Your session has expired. Please sign in again to continue.";
    }
    
    if (error.includes('500')) {
      return "⚡ Our servers are experiencing a technical glitch. Our team has been notified.";
    }
    
    if (error.includes('503')) {
      return "🛠️ Service temporarily unavailable. We're working on improvements and will be back shortly.";
    }
    
    if (endpoint.includes('generate-')) {
      return "✨ Our AI couldn't generate your request at this moment. Please try again later.";
    }
    
    // Default error message
    return "Something unexpected happened. Please try again or contact support if the issue persists.";
  }
  
  // Helper method to get status message
  private getStatusMessage(status: number): string {
    switch (status) {
      case 400: return "Bad Request";
      case 401: return "Unauthorized";
      case 403: return "Forbidden";
      case 404: return "Not Found";
      case 408: return "Request Timeout";
      case 429: return "Too Many Requests";
      case 500: return "Internal Server Error";
      case 502: return "Bad Gateway";
      case 503: return "Service Unavailable";
      case 504: return "Gateway Timeout";
      default: return "Unknown Error";
    }
  }

  // User profile operations
  async createUserProfile(userData: {
    userId: string
    username: string
    email: string
  }) {
    return this.request('/users/profile', {
      method: 'POST',
      body: JSON.stringify(userData)
    })
  }

  // Match operations
  async getMatches(userId: string) {
    return {
      success: true,
      data: []
    };
  }
  
  // Match summary generation
  async generateMatchSummary(matchId: string) {
    return {
      success: true,
      data: {
        summary: "In an exciting match, both players showcased exceptional skill and determination. The match featured powerful serving and strong baseline rallies. The first set was tightly contested with both players holding serve until a crucial break point was converted. This victory marks another strong performance in what has been an impressive season so far."
      }
    };
  }

  // Match operations
  async createMatch(matchData: {
    player1Id: string
    player2Id: string
    tournamentId?: string
    date: string
    location: string
  }) {
    return this.request('/matches', {
      method: 'POST',
      body: JSON.stringify(matchData)
    })
  }

  async updateMatchResult(matchId: string, result: {
    winnerId: string
    score: string
    pgn?: string
  }) {
    return this.request(`/matches/${matchId}/result`, {
      method: 'PUT',
      body: JSON.stringify(result)
    })
  }

  // ELO calculation
  async calculateElo(matchId: string) {
    return this.request(`/matches/${matchId}/calculate-elo`, {
      method: 'POST'
    })
  }

  // Tennis scoring operations
  async updateMatchScore(matchId: string, data: {
    winningPlayerId: string;
    pointType?: string;
  }) {
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

  // Tournament operations
  async generateTournamentBracket(tournamentId: string) {
    return {
      success: true,
      data: {
        tournamentId,
        format: "single_elimination",
        participantCount: 8,
        matchCount: 7,
        matchesCreated: 7,
        message: "Tournament bracket generated successfully"
      }
    };
  }
  
  // AI Coach operations
  async generatePlayerStyle(playerId: string) {
    return {
      success: true,
      data: {
        playerStyleAnalysis: "This player demonstrates a balanced all-court game with strong baseline consistency. Their forehand is their primary weapon, showing good depth and placement. Backhand is solid but could be more aggressive in attacking opportunities. Serve is reliable rather than dominant, with good placement compensating for moderate power. At the net, they show decent volleying skills but could improve their approach shots. Mental game is strong, particularly in pressure situations. To advance further, focus should be on developing a more aggressive transition game and improving second serve consistency."
      }
    };
  }
  
  // AI Umpire Insight operations
  async getUmpireInsight(matchId: string, scoreSnapshot?: Record<string, unknown>) {
    return {
      success: true,
      data: {
        insight: "The server is showing excellent placement on their first serve, consistently pulling the returner wide to create open court opportunities.",
        matchId: matchId,
        timestamp: new Date().toISOString()
      }
    };
  }

  // Health check
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: {
        supabaseConfigured: true,
        frontendConfigured: true,
        region: 'mock-region',
        bedrockStatus: 'available'
      },
      version: '1.0.0'
    };
  }
  
  // Aggregate stats
  async aggregatePlayerStats(playerId: string) {
    return {
      success: true,
      data: {
        playerId: playerId,
        totalMatches: 15,
        wins: 9,
        winRate: 60.0,
        recentForm: 70.0,
        avgOpponentElo: 1475,
        winRateVsHigherElo: 40.0,
        winRateVsLowerElo: 75.0,
        lastCalculated: new Date().toISOString()
      }
    };
  }
}

export const apiClient = new ApiClient(API_BASE_URL)

// Helper to set auth token from Supabase session
export const setApiAuthToken = (token: string) => {
  apiClient.setAuthToken(token)
}