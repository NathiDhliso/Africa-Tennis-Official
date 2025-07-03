import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

// Debounce utility to prevent excessive invalidations
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Optimized fetch function with caching
const fetchTournamentsWithDetails = async (userId: string | undefined) => {
  const { data: tournamentsData, error } = await supabase
    .from('tournaments')
    .select('*, organizer:profiles!tournaments_organizer_id_fkey(username)')
    .order('start_date', { ascending: true });

  if (error) throw new Error(error.message);

  if (!tournamentsData) return [];

  // Process tournaments in batches for better performance
  const batchSize = 10;
  const tournamentsWithDetails = [];
  
  for (let i = 0; i < tournamentsData.length; i += batchSize) {
    const batch = tournamentsData.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (tournament) => {
        const { count, error: countError } = await supabase
          .from('tournament_participants')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', tournament.id);

        if (countError) console.error('Error fetching participant count:', countError);

        let isRegistered = false;
        if (userId) {
          const { data: registration, error: regError } = await supabase
            .from('tournament_participants')
            .select('id')
            .eq('tournament_id', tournament.id)
            .eq('player_id', userId)
            .maybeSingle();
          
          if (regError) console.error('Error checking registration:', regError);
          isRegistered = !!registration;
        }

        // Check if tournament is full
        const isFull = count !== null && count >= tournament.max_participants;

        return {
          ...tournament,
          participantCount: count || 0,
          isRegistered,
          isFull
        };
      })
    );
    
    tournamentsWithDetails.push(...batchResults);
  }

  return tournamentsWithDetails;
};

const fetchTournamentParticipants = async (tournamentId: string) => {
  const { data, error } = await supabase
    .from('tournament_participants')
    .select('*, player:profiles!tournament_participants_player_id_fkey(username, elo_rating)')
    .eq('tournament_id', tournamentId)
    .order('seed', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
};

export const useTournaments = (tournamentId?: string) => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  
  // Memoize query keys to prevent unnecessary re-renders
  const tournamentsQueryKey = useMemo(() => ['tournaments', user?.id], [user?.id]);
  const participantsQueryKey = useMemo(() => 
    tournamentId ? ['tournamentParticipants', tournamentId] : null, 
    [tournamentId]
  );

  // Prefetch function for optimistic updates
  const prefetchTournaments = useCallback(async () => {
    if (!user?.id) return;
    await queryClient.prefetchQuery({
      queryKey: tournamentsQueryKey,
      queryFn: () => fetchTournamentsWithDetails(user.id),
    });
  }, [queryClient, tournamentsQueryKey, user?.id]);

  const { data: tournaments, isLoading: isLoadingTournaments, error: tournamentsError } = useQuery({
    queryKey: tournamentsQueryKey,
    queryFn: () => fetchTournamentsWithDetails(user?.id),
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  });

  const { data: participants, isLoading: isLoadingParticipants, error: participantsError } = useQuery({
    queryKey: participantsQueryKey,
    queryFn: () => fetchTournamentParticipants(tournamentId!),
    enabled: !!tournamentId && !!participantsQueryKey,
    staleTime: 60 * 1000, // 1 minute
  });

  // Set up real-time subscription for tournaments and participants
  useEffect(() => {
    // Debounced invalidation functions to prevent excessive refetches
    const debouncedInvalidateTournaments = debounce(
      () => queryClient.invalidateQueries({ queryKey: tournamentsQueryKey }),
      300 // 300ms delay
    );
    
    const debouncedInvalidateParticipants = debounce(
      () => {
        if (tournamentId && participantsQueryKey) {
          queryClient.invalidateQueries({ queryKey: participantsQueryKey });
        }
      },
      300 // 300ms delay
    );

    const channel = supabase
      .channel('tournaments-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tournaments' },
        debouncedInvalidateTournaments
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tournament_participants' },
        () => {
          debouncedInvalidateTournaments();
          debouncedInvalidateParticipants();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tournament_participants' },
        () => {
          debouncedInvalidateTournaments();
          debouncedInvalidateParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tournamentId, tournamentsQueryKey, participantsQueryKey]);

  return {
    tournaments: tournaments || [],
    participants,
    isLoading: isLoadingTournaments || (!!tournamentId && isLoadingParticipants),
    error: tournamentsError || participantsError,
    prefetchTournaments,
  };
};