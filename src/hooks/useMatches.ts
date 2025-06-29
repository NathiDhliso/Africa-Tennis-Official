import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Match = Database['public']['Tables']['matches']['Row'];

// Optimized fetch function with caching
const fetchMatches = async (userId?: string): Promise<Match[]> => {
  if (!userId) {
    return [];
  }
  
  try {
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
  const queryKey = useMemo(() => ['matches', userId], [userId]);

  // Prefetch function for optimistic updates
  const prefetchMatches = useCallback(async () => {
    if (!userId) return;
    await queryClient.prefetchQuery({
      queryKey,
      queryFn: () => fetchMatches(userId),
    });
  }, [queryClient, queryKey, userId]);

  const queryResult = useQuery({
    queryKey,
    queryFn: () => fetchMatches(userId),
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Set up real-time subscription for matches
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
          // Invalidate query to trigger refetch
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, queryKey]);

  return {
    ...queryResult,
    prefetchMatches,
  };
};