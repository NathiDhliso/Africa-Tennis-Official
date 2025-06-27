
const API_BASE_URL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL || '');

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setAuthToken(token: string) {
    this.token = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // The full URL is constructed by combining the base URL and the endpoint.
    const url = `${this.baseUrl}${endpoint}`;

    // Create a new Headers object for type safety.
    // This allows for safely setting headers without TypeScript errors.
    const headers = new Headers({
      'Content-Type': 'application/json',
    });

    // If custom headers are passed in options, add them to our Headers object.
    if (options.headers) {
        // We can iterate over Headers, an array of string pairs, or an object.
        const customHeaders = new Headers(options.headers);
        customHeaders.forEach((value, key) => {
            headers.append(key, value);
        });
    }

    if (this.token) {
      // Use the .set() method to safely add the Authorization header.
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers // Pass the updated Headers object
      })

      const data = await response.json()

      if (!response.ok) {
        // Use the error message from the response body if available, otherwise use the status.
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
      }

      return data
    } catch (error: any) {
      console.error(`API request failed: ${endpoint}`, error)
      return {
        success: false,
        error: error.message || 'An unknown network error occurred'
      }
    }
  }

  // --- User profile operations ---
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

  // --- Match operations ---
  async getMatches(userId: string) {
    return this.request(`/matches?userId=${userId}`);
  }

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

  // --- ELO calculation ---
  async calculateElo(matchId: string) {
    return this.request(`/matches/${matchId}/calculate-elo`, {
      method: 'POST'
    })
  }

  // --- Tennis scoring operations ---
  async updateMatchScore(matchId: string, data: {
    winningPlayerId: string;
    pointType?: string;
  }) {
    return this.request(`/matches/${matchId}/score`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // --- Tournament operations ---
  async generateTournamentBracket(tournamentId: string) {
    return this.request(`/tournaments/${tournamentId}/generate-bracket`, {
      method: 'POST'
    })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)

// Helper to set auth token from an external source like Supabase
export const setApiAuthToken = (token: string) => {
  apiClient.setAuthToken(token)
}
