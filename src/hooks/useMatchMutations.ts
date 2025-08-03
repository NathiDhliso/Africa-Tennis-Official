import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/aws';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase-generated';

type MatchInsert = Database['public']['Tables']['matches']['Insert'];
type MatchUpdate = Database['public']['Tables']['matches']['Update'];

const createMatchFn = async (match: MatchInsert) => {
  const { data, error } = await supabase.from('matches').insert(match).select().single();
  if (error) throw error;
  return data;
};

const updateMatchFn = async ({ id, updates }: { id: string; updates: MatchUpdate }) => {
  const { error } = await supabase.from('matches').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
};

export const useMatchMutations = () => {
  const queryClient = useQueryClient();

  // Live scoring mutation - now uses AWS Lambda
  const updateScoreMutation = useMutation({
    mutationFn: async (variables: {
      matchId: string;
      winningPlayerId: string;
      pointType?: string;
    }) => {
      console.log('🎾 Updating match score via AWS Lambda...');
      
      // Use AWS Lambda for heavy score calculation
      const response = await apiClient.updateMatchScore(variables.matchId, {
        winningPlayerId: variables.winningPlayerId,
        pointType: variables.pointType || 'point_won'
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to update score');
      }

      // Update the match in Supabase with the new score
      const { error: updateError } = await supabase
        .from('matches')
        .update({ 
          score: response.data,
          updated_at: new Date().toISOString()
        })
        .eq('id', variables.matchId);

      if (updateError) {
        throw new Error('Failed to save score to database');
      }

      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch match data
      queryClient.invalidateQueries({ queryKey: ['match', variables.matchId] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      
      console.log('✅ Score updated successfully via AWS');
    },
    onError: (error) => {
      console.error('❌ Score update failed:', error);
    }
  });

  // Generate bracket mutation - now uses AWS Lambda
  const generateBracketMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      console.log('🏆 Generating tournament bracket via AWS Lambda...');
      
      const response = await apiClient.generateBracket(tournamentId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate bracket');
      }

      return response.data;
    },
    onSuccess: (data, tournamentId) => {
      // Invalidate tournament and matches data
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      
      console.log('✅ Bracket generated successfully via AWS');
    },
    onError: (error) => {
      console.error('❌ Bracket generation failed:', error);
    }
  });

  // Stats aggregation mutation - AWS Lambda only
  const aggregateStatsMutation = useMutation({
    mutationFn: async (playerId?: string) => {
      console.log('📊 Aggregating stats via AWS Lambda...');
      
      const response = await apiClient.aggregateStats(playerId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to aggregate stats');
      }

      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate rankings and stats data
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      
      console.log('✅ Stats aggregated successfully via AWS');
    },
    onError: (error) => {
      console.error('❌ Stats aggregation failed:', error);
    }
  });

  // Update match mutation - for general match updates
  const updateMatchMutation = useMutation({
    mutationFn: updateMatchFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      console.log('✅ Match updated successfully');
    },
    onError: (error) => {
      console.error('❌ Match update failed:', error);
    }
  });

  return {
    updateScore: updateScoreMutation,
    updateMatch: updateMatchMutation,
    generateBracket: generateBracketMutation,
    aggregateStats: aggregateStatsMutation,
    
    // Helper to get backend status
    getBackendStatus: () => apiClient.getBackendStatus(),
    
    // Helper to toggle backend for testing
    toggleBackend: () => {
      apiClient.toggleBackend();
      // Invalidate all queries to force refetch with new backend
      queryClient.invalidateQueries();
    }
  };
};