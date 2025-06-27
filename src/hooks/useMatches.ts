import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/aws';
import type { Database } from '../types/database';

type Match = Database['public']['Tables']['matches']['Row'];

const fetchMatches = async (userId?: string): Promise<Match[]> => {
  if (!userId) {
    return [];
  }
  
  try {
    // First try to use the API Gateway endpoint
    const response = await apiClient.getMatches(userId);
    if (response.success && Array.isArray(response.data)) {
      return response.data;
    }
    
    // Fallback to direct Supabase query if API fails
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        player1:profiles!matches_player1_id_fkey(username, elo_rating),
        player2:profiles!matches_player2_id_fkey(username, elo_rating),
        winner:profiles!matches_winner_id_fkey(username)
      `)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .order('date', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching matches:', error);
    throw error;
  }
};

export const useMatches = (userId?: string) => {
  const queryClient = useQueryClient();

  const queryResult = useQuery({
    queryKey: ['matches', userId],
    queryFn: () => fetchMatches(userId),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`matches-for-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `or(player1_id.eq.${userId},player2_id.eq.${userId})`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['matches', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return queryResult;
};