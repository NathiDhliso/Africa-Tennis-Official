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
      
      // Always use AWS Lambda for rankings. If it fails, surface the error instead of
      // performing an expensive client-side calculation that hits Supabase and
      // loops across large result sets.
      const awsResponse = await apiClient.getRankings();

      if (awsResponse && awsResponse.success) {
        console.log('✅ Using AWS Lambda rankings');
        return awsResponse.data;
      }

      throw new Error(awsResponse?.error || 'Failed to fetch rankings from backend');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Save rankings to localStorage when data changes
  useEffect(() => {
    if (result.data) {
      localStorage.setItem(RANKINGS_STORAGE_KEY, JSON.stringify(result.data));
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