import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import apiClient from '../lib/aws';

const RANKINGS_STORAGE_KEY = 'tennis_rankings_cache';

// Helper function to calculate rankings from Supabase data
const calculateRankingsFromSupabase = async () => {
  console.log('📊 Calculating rankings from Supabase...');
  
  try {
    // Get all active players with their stats
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, username, elo_rating, matches_played, matches_won, skill_level, profile_picture_url')
      .not('elo_rating', 'is', null)
      .gt('matches_played', 0)
      .order('elo_rating', { ascending: false })
      .limit(100); // Limit for performance

    if (error) {
      throw new Error(`Failed to fetch profiles: ${error.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return [];
    }

    // Calculate additional metrics for rankings
    const rankings = await Promise.all(
      profiles.map(async (profile, index) => {
        const win_rate = (profile.matches_played && profile.matches_played > 0 && profile.matches_won) 
          ? (profile.matches_won / profile.matches_played) * 100 
          : 0;

        // Get recent form (last 5 matches for performance)
        const { data: recentMatches } = await supabase
          .from('matches')
          .select('winner_id')
          .or(`player1_id.eq.${profile.user_id},player2_id.eq.${profile.user_id}`)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5);

        const recentWins = recentMatches?.filter(m => m.winner_id === profile.user_id).length || 0;
        const recent_form = (recentMatches && recentMatches.length > 0) 
          ? (recentWins / recentMatches.length) * 100 
          : 0;

        return {
          user_id: profile.user_id,
          username: profile.username,
          elo_rating: profile.elo_rating,
          matches_played: profile.matches_played || 0,
          matches_won: profile.matches_won || 0,
          skill_level: profile.skill_level,
          win_rate: Math.round(win_rate * 100) / 100,
          rank: index + 1,
          rank_change: 0, // Would need historical data
          rank_change_value: 0,
          recent_form: Math.round(recent_form * 100) / 100,
          profile_picture_url: profile.profile_picture_url
        };
      })
    );

    return rankings;
  } catch (error) {
    console.error('Failed to calculate rankings from Supabase:', error);
    throw error;
  }
};

export const useRankings = () => {
  const queryClient = useQueryClient();
  
  const result = useQuery({
    queryKey: ['rankings'],
    queryFn: async () => {
      console.log('🏆 Fetching rankings...');
      
      try {
        // Try AWS Lambda first
        const awsResponse = await apiClient.getRankings();

        // If AWS returns valid data, use it
        if (awsResponse && awsResponse.success && awsResponse.data) {
          console.log('✅ Using AWS Lambda rankings');
          return awsResponse.data;
        }

        // If AWS returns null (intentional fallback) or fails, use Supabase
        console.log('⚠️ AWS Lambda not available, using Supabase fallback');
        return await calculateRankingsFromSupabase();
        
      } catch (error) {
        console.error('Error fetching rankings from AWS:', error);
        console.log('⚠️ Falling back to Supabase rankings calculation');
        
        try {
          return await calculateRankingsFromSupabase();
        } catch (fallbackError) {
          console.error('Supabase fallback also failed:', fallbackError);
          throw new Error('Failed to load rankings from both AWS and Supabase');
        }
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
         retry: (failureCount) => {
       // Don't retry if it's a network issue or server error
       if (failureCount >= 2) return false;
       console.log(`Retrying rankings fetch (attempt ${failureCount + 1})`);
       return true;
     },
  });

  // Save rankings to localStorage when data changes
  useEffect(() => {
    if (result.data) {
      try {
        localStorage.setItem(RANKINGS_STORAGE_KEY, JSON.stringify(result.data));
      } catch (error) {
        console.warn('Failed to cache rankings to localStorage:', error);
      }
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
          // Add a small delay to avoid too frequent updates
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['rankings'] });
          }, 1000);
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