export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      match_events: {
        Row: {
          created_at: string | null
          description: string
          event_type: string
          id: string
          match_id: string
          metadata: Json | null
          player_id: string
          score_snapshot: Json | null
          timestamp: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          event_type: string
          id?: string
          match_id: string
          metadata?: Json | null
          player_id: string
          score_snapshot?: Json | null
          timestamp?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          event_type?: string
          id?: string
          match_id?: string
          metadata?: Json | null
          player_id?: string
          score_snapshot?: Json | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      match_highlights: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          match_id: string | null
          timestamp: string
          type: string
          video_url: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          match_id?: string | null
          timestamp?: string
          type: string
          video_url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          match_id?: string | null
          timestamp?: string
          type?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_highlights_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "match_highlights_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string | null
          date: string
          id: string
          location: string
          match_number: number | null
          player1_id: string
          player2_id: string
          round: number | null
          score: Json | null
          status: string | null
          summary: string | null
          tournament_id: string | null
          updated_at: string | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          location: string
          match_number?: number | null
          player1_id: string
          player2_id: string
          round?: number | null
          score?: Json | null
          status?: string | null
          summary?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          location?: string
          match_number?: number | null
          player1_id?: string
          player2_id?: string
          round?: number | null
          score?: Json | null
          status?: string | null
          summary?: string | null
          tournament_id?: string | null
          updated_at?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tournament"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      player_stats: {
        Row: {
          avg_tournament_placement: number | null
          last_calculated_at: string | null
          user_id: string
          win_rate_vs_higher_elo: number | null
          win_rate_vs_lower_elo: number | null
        }
        Insert: {
          avg_tournament_placement?: number | null
          last_calculated_at?: string | null
          user_id: string
          win_rate_vs_higher_elo?: number | null
          win_rate_vs_lower_elo?: number | null
        }
        Update: {
          avg_tournament_placement?: number | null
          last_calculated_at?: string | null
          user_id?: string
          win_rate_vs_higher_elo?: number | null
          win_rate_vs_lower_elo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          elo_rating: number | null
          matches_played: number | null
          matches_won: number | null
          player_style_analysis: string | null
          profile_picture_url: string | null
          skill_level: string | null
          updated_at: string | null
          user_id: string
          username: string
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          elo_rating?: number | null
          matches_played?: number | null
          matches_won?: number | null
          player_style_analysis?: string | null
          profile_picture_url?: string | null
          skill_level?: string | null
          updated_at?: string | null
          user_id: string
          username: string
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          elo_rating?: number | null
          matches_played?: number | null
          matches_won?: number | null
          player_style_analysis?: string | null
          profile_picture_url?: string | null
          skill_level?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      tournament_participants: {
        Row: {
          id: string
          player_id: string
          registered_at: string | null
          seed: number | null
          tournament_id: string
        }
        Insert: {
          id?: string
          player_id: string
          registered_at?: string | null
          seed?: number | null
          tournament_id: string
        }
        Update: {
          id?: string
          player_id?: string
          registered_at?: string | null
          seed?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          brackets_generated: boolean | null
          created_at: string | null
          description: string
          end_date: string
          entry_fee: number | null
          format: string | null
          id: string
          location: string
          max_participants: number
          name: string
          organizer_id: string
          prize_pool: number | null
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          brackets_generated?: boolean | null
          created_at?: string | null
          description: string
          end_date: string
          entry_fee?: number | null
          format?: string | null
          id?: string
          location: string
          max_participants: number
          name: string
          organizer_id: string
          prize_pool?: number | null
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          brackets_generated?: boolean | null
          created_at?: string | null
          description?: string
          end_date?: string
          entry_fee?: number | null
          format?: string | null
          id?: string
          location?: string
          max_participants?: number
          name?: string
          organizer_id?: string
          prize_pool?: number | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_elo_rating: {
        Args: { player1_id: string; player2_id: string; winner_id: string }
        Returns: undefined
      }
      calculate_tennis_score: {
        Args: {
          match_id: string
          winning_player_id: string
          point_type?: string
        }
        Returns: Json
      }
      generate_seeded_positions: {
        Args: { num_positions: number }
        Returns: number[]
      }
      generate_tournament_bracket: {
        Args: { tournament_id: string }
        Returns: undefined
      }
      get_tournament_standings: {
        Args: { tournament_id_param: string }
        Returns: {
          player_id: string
          username: string
          elo_rating: number
          matches_played: number
          matches_won: number
          points: number
        }[]
      }
      manually_start_tournament: {
        Args: { tournament_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
