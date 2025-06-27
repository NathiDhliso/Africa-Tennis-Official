import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface RankingPlayer {
  user_id: string;
  username: string;
  elo_rating: number;
  matches_played: number;
  matches_won: number;
  skill_level: string;
  rank?: number;
  rankChange?: 'up' | 'down' | 'same' | 'new';
  rankChangeValue?: number;
  profile_picture_url?: string | null;
}

const RANKINGS_STORAGE_KEY = 'africa-tennis-previous-rankings';

const fetchRankings = async (): Promise<RankingPlayer[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, elo_rating, matches_played, matches_won, skill_level, profile_picture_url')
    .order('elo_rating', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  // Add rank to each player
  return data.map((player, index) => ({
    ...player,
    rank: index + 1
  }));
};

// Pure function to calculate rank changes
const calculateRankChanges = (
  newRankings: RankingPlayer[],
  previousRankings: RankingPlayer[]
): RankingPlayer[] => {
  // Create a Map for O(1) lookups of previous rankings
  const prevRankingsMap = new Map<string, RankingPlayer>();
  previousRankings.forEach(player => {
    prevRankingsMap.set(player.user_id, player);
  });
  
  return newRankings.map(player => {
    const prevPlayer = prevRankingsMap.get(player.user_id);
    
    let rankChange: 'up' | 'down' | 'same' | 'new' = 'new';
    let rankChangeValue = 0;
    
    if (prevPlayer && player.rank && prevPlayer.rank) {
      if (player.rank < prevPlayer.rank) {
        rankChange = 'up';
        rankChangeValue = prevPlayer.rank - player.rank;
      } else if (player.rank > prevPlayer.rank) {
        rankChange = 'down';
        rankChangeValue = player.rank - prevPlayer.rank;
      } else {
        rankChange = 'same';
      }
    }
    
    return {
      ...player,
      rankChange,
      rankChangeValue
    };
  });
};

export const useRankings = () => {
  const queryClient = useQueryClient();

  const result = useQuery({
    queryKey: ['rankings'],
    queryFn: fetchRankings,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    select: (newRankings) => {
      // Load previous rankings from localStorage
      let previousRankings: RankingPlayer[] = [];
      try {
        const stored = localStorage.getItem(RANKINGS_STORAGE_KEY);
        if (stored) {
          previousRankings = JSON.parse(stored);
        }
      } catch (error) {
        console.error('Error loading previous rankings:', error);
        localStorage.removeItem(RANKINGS_STORAGE_KEY);
      }
      
      // Calculate and return rankings with changes
      return calculateRankChanges(newRankings, previousRankings);
    },
    onSuccess: (data) => {
      // Save the original rankings (without change indicators) to localStorage
      // This ensures we're always comparing against the most recent successful fetch
      const originalRankings = data.map(({ rankChange, rankChangeValue, ...player }) => player);
      localStorage.setItem(RANKINGS_STORAGE_KEY, JSON.stringify(originalRankings));
    }
  });

  // Set up real-time subscription to rankings changes
  useEffect(() => {
    const channel = supabase
      .channel('rankings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          columns: ['elo_rating', 'matches_played', 'matches_won']
        },
        () => {
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
    rankings: result.data || []
  };
};