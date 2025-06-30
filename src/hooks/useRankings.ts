import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import apiClient from '../lib/aws';

const RANKINGS_STORAGE_KEY = 'tennis_rankings_cache';

export const useRankings = () => {
  const queryClient = useQueryClient();
  
  const result = useQuery({
    queryKey: ['rankings'],
    queryFn: async () => {
      console.log('🏆 Fetching rankings...');
      
      // Try AWS Lambda first
      const awsResponse = await apiClient.getRankings();
      
      if (awsResponse && awsResponse.success) {
        console.log('✅ Using AWS Lambda rankings');
        return awsResponse.data;
      }
      
      // Fallback to Supabase calculation
      console.log('⚠️ Using Supabase fallback for rankings');
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          username,
          elo_rating,
          matches_played,
          matches_won,
          skill_level,
          profile_picture_url
        `)
        .not('elo_rating', 'is', null)
        .order('elo_rating', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Calculate rankings with change indicators (simplified)
      const rankings = data
        .filter(player => player.elo_rating !== null)
        .map((player, index) => {
          const winRate = player.matches_played && player.matches_played > 0 
            ? (player.matches_won || 0) / player.matches_played * 100 
            : 0;

          // Get previous rank from localStorage for change calculation
          const previousRankings = JSON.parse(localStorage.getItem(RANKINGS_STORAGE_KEY) || '[]');
          const previousRank = previousRankings.findIndex((p: any) => p.user_id === player.user_id) + 1;
          const currentRank = index + 1;
          
          return {
            ...player,
            elo_rating: player.elo_rating!,
            matches_played: player.matches_played || 0,
            matches_won: player.matches_won || 0,
            skill_level: player.skill_level || 'Beginner',
            rank: currentRank,
            win_rate: Math.round(winRate * 100) / 100,
            rank_change: previousRank > 0 ? previousRank - currentRank : 0,
            rank_change_value: 0, // Simplified for fallback
            recent_form: 0 // Simplified for fallback
          };
        });

      return rankings;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Save rankings to localStorage when data changes
  useEffect(() => {
    if (result.data) {
      const originalRankings = result.data.map(({ rank_change, rank_change_value, ...player }) => player);
      localStorage.setItem(RANKINGS_STORAGE_KEY, JSON.stringify(originalRankings));
    }
  }, [result.data]);

  // Set up real-time subscription for rankings changes
  useEffect(() => {
    const channel = supabase
      .channel('rankings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: 'elo_rating=not.is.null'
        },
        () => {
          console.log('📊 Rankings data changed, invalidating cache...');
          queryClient.invalidateQueries({ queryKey: ['rankings'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    ...result,
    // Additional helpers
    refreshRankings: () => {
      console.log('🔄 Manual rankings refresh...');
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
    },
    
    getBackendStatus: () => apiClient.getBackendStatus(),
    
    toggleBackend: () => {
      apiClient.toggleBackend();
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
    }
  };
};