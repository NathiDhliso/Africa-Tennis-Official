import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/aws';
import type { Database } from '../types/database';

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

const awardPointFn = async ({ matchId, winningPlayerId, pointType }: { matchId: string; winningPlayerId: string; pointType?: string }) => {
  try {
    // First try to use the API Gateway endpoint
    const response = await apiClient.updateMatchScore(matchId, {
      winningPlayerId,
      pointType: pointType || 'point_won',
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to update score');
    }
    
    return response.data;
  } catch (apiError) {
    console.error('API error, falling back to direct Supabase call:', apiError);
    
    // Fallback to direct Supabase RPC call
    const { data, error } = await supabase.rpc('calculate_tennis_score', {
      match_id: matchId,
      winning_player_id: winningPlayerId,
      point_type: pointType || 'point_won'
    });
    
    if (error) throw error;
    return data;
  }
};

export const useMatchMutations = (userId?: string) => {
  const queryClient = useQueryClient();

  const createMatch = useMutation({
    mutationFn: createMatchFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', userId] });
    },
  });

  const updateMatch = useMutation({
    mutationFn: updateMatchFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', userId] });
    },
  });

  const awardPoint = useMutation({
    mutationFn: awardPointFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', userId] });
    },
  });

  return { createMatch, updateMatch, awardPoint };
};