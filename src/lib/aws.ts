// Use a relative path for the proxy during development.
// The VITE_API_BASE_URL from .env will be used for production builds.
const API_BASE_URL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL || '');

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
      const response = await fetch(url, {
        ...options,
        headers
      })

      // Handle rate limiting (429 status)
      if (response.status === 429 && retries > 0) {
        console.warn(`Rate limited, retrying in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.request(endpoint, options, retries - 1);
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      return data
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Network error'
      
      // Retry on network errors
      if (error instanceof TypeError && retries > 0) {
        console.warn(`Network error, retrying in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.request(endpoint, options, retries - 1);
      }

      console.error(`API request failed: ${endpoint}`, error)
      return {
        success: false,
        error: errorMessage
      }
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
    return this.request(`/matches?userId=${userId}`);
  }
  
  // Match summary generation
  async generateMatchSummary(matchId: string) {
    return this.request(`/matches/${matchId}/generate-summary`, {
      method: 'POST'
    })
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
    return this.request(`/matches/${matchId}/score`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // Tournament operations
  async generateTournamentBracket(tournamentId: string) {
    return this.request(`/tournaments/${tournamentId}/generate-bracket`, {
      method: 'POST'
    })
  }
  
  // AI Coach operations
  async generatePlayerStyle(playerId: string) {
    return this.request(`/players/${playerId}/generate-style`, {
      method: 'POST'
    })
  }
  
  // AI Umpire Insight operations
  async getUmpireInsight(matchId: string, scoreSnapshot?: Record<string, unknown>) {
    const body = scoreSnapshot ? JSON.stringify({ scoreSnapshot }) : undefined;
    return this.request(`/matches/${matchId}/umpire-insight`, {
      method: 'POST',
      body
    })
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
  
  // Aggregate stats
  async aggregatePlayerStats(playerId: string) {
    return this.request(`/aggregate-stats?player_id=${playerId}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL)

// Helper to set auth token from Supabase session
export const setApiAuthToken = (token: string) => {
  apiClient.setAuthToken(token)
}