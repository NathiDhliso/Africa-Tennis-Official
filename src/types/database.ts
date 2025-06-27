export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          username: string
          elo_rating: number
          matches_played: number
          matches_won: number
          skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
          bio: string | null
          profile_picture_url: string | null
          created_at: string
          updated_at: string
          player_style_analysis: string | null
        }
        Insert: {
          user_id: string
          username: string
          elo_rating?: number
          matches_played?: number
          matches_won?: number
          skill_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
          bio?: string | null
          profile_picture_url?: string | null
          created_at?: string
          updated_at?: string
          player_style_analysis?: string | null
        }
        Update: {
          user_id?: string
          username?: string
          elo_rating?: number
          matches_played?: number
          matches_won?: number
          skill_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
          bio?: string | null
          profile_picture_url?: string | null
          updated_at?: string
          player_style_analysis?: string | null
        }
      }
      matches: {
        Row: {
          id: string
          tournament_id: string | null
          player1_id: string
          player2_id: string
          winner_id: string | null
          score: string | null
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          date: string
          location: string
          created_at: string
          updated_at: string
          summary: string | null
        }
        Insert: {
          id?: string
          tournament_id?: string | null
          player1_id: string
          player2_id: string
          winner_id?: string | null
          score?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          date: string
          location: string
          created_at?: string
          updated_at?: string
          summary?: string | null
        }
        Update: {
          tournament_id?: string | null
          player1_id?: string
          player2_id?: string
          winner_id?: string | null
          score?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          date?: string
          location?: string
          updated_at?: string
          summary?: string | null
        }
      }
      tournaments: {
        Row: {
          id: string
          name: string
          description: string
          organizer_id: string
          start_date: string
          end_date: string
          format: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss'
          max_participants: number
          status: 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled'
          location: string
          entry_fee: number | null
          prize_pool: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          organizer_id: string
          start_date: string
          end_date: string
          format?: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss'
          max_participants: number
          status?: 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled'
          location: string
          entry_fee?: number | null
          prize_pool?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string
          organizer_id?: string
          start_date?: string
          end_date?: string
          format?: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss'
          max_participants?: number
          status?: 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled'
          location?: string
          entry_fee?: number | null
          prize_pool?: number | null
          updated_at?: string
        }
      }
      tournament_participants: {
        Row: {
          id: string
          tournament_id: string
          player_id: string
          seed: number | null
          registered_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          player_id: string
          seed?: number | null
          registered_at?: string
        }
        Update: {
          tournament_id?: string
          player_id?: string
          seed?: number | null
        }
      }
      match_events: {
        Row: {
          id: string
          match_id: string
          timestamp: string
          event_type: 'move' | 'capture' | 'check' | 'checkmate' | 'draw' | 'resignation' | 'timeout'
          player_id: string
          description: string
          score_snapshot: any
          metadata: any | null
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          timestamp?: string
          event_type: 'move' | 'capture' | 'check' | 'checkmate' | 'draw' | 'resignation' | 'timeout'
          player_id: string
          description: string
          score_snapshot: any
          metadata?: any | null
          created_at?: string
        }
        Update: {
          match_id?: string
          timestamp?: string
          event_type?: 'move' | 'capture' | 'check' | 'checkmate' | 'draw' | 'resignation' | 'timeout'
          player_id?: string
          description?: string
          score_snapshot?: any
          metadata?: any | null
        }
      }
      player_stats: {
        Row: {
          user_id: string
          win_rate_vs_higher_elo: number
          win_rate_vs_lower_elo: number
          avg_tournament_placement: number
          last_calculated_at: string
        }
        Insert: {
          user_id: string
          win_rate_vs_higher_elo?: number
          win_rate_vs_lower_elo?: number
          avg_tournament_placement?: number
          last_calculated_at?: string
        }
        Update: {
          win_rate_vs_higher_elo?: number
          win_rate_vs_lower_elo?: number
          avg_tournament_placement?: number
          last_calculated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}