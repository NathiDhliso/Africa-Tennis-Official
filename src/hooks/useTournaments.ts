import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { 
  TournamentWithOrganizer, 
  Tournament, 
  dbTournamentToTournament,
  TournamentParticipantWithPlayer,
  TournamentParticipant,
  dbTournamentParticipantToTournamentParticipant
} from '../types';

// Debounce utility to prevent excessive invalidations
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  }) as T;
}

const fetchTournaments = async (): Promise<Tournament[]> => {
  const { data, error } = await supabase
    .from('tournaments')
    .select(`
      *,
      organizer:profiles!tournaments_organizer_id_fkey(user_id, username)
    `)
    .order('start_date', { ascending: false });

  if (error) throw error;

  const dbTournaments = data as TournamentWithOrganizer[];
  return dbTournaments.map(dbTournamentToTournament);
};

const fetchTournamentParticipants = async (tournamentId: string): Promise<TournamentParticipant[]> => {
  const { data, error } = await supabase
    .from('tournament_participants')
    .select(`
      *,
      player:profiles!tournament_participants_player_id_fkey(user_id, username, elo_rating)
    `)
    .eq('tournament_id', tournamentId);

  if (error) throw error;

  const dbParticipants = data as TournamentParticipantWithPlayer[];
  return dbParticipants.map(dbTournamentParticipantToTournamentParticipant);
};

export const useTournaments = (tournamentId?: string) => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const tournamentsQueryKey = useMemo(() => ['tournaments', user?.id], [user?.id]);
  const participantsQueryKey = useMemo(() => 
    tournamentId ? ['tournamentParticipants', tournamentId] as const : null, 
    [tournamentId]
  );

  const { data: tournaments, isLoading: isLoadingTournaments, error: tournamentsError } = useQuery({
    queryKey: tournamentsQueryKey,
    queryFn: fetchTournaments,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: participants, isLoading: isLoadingParticipants, error: participantsError } = useQuery({
    queryKey: participantsQueryKey || ['tournaments', 'participants', 'disabled'],
    queryFn: () => fetchTournamentParticipants(tournamentId!),
    enabled: !!tournamentId && !!participantsQueryKey,
    staleTime: 60 * 1000, // 1 minute
  });

  const prefetchTournaments = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: tournamentsQueryKey,
      queryFn: fetchTournaments,
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient, tournamentsQueryKey]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('tournaments_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => {
        const debouncedInvalidateTournaments = debounce(
          () => queryClient.invalidateQueries({ queryKey: tournamentsQueryKey }),
          1000
        );
        debouncedInvalidateTournaments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_participants' }, () => {
        const debouncedInvalidateParticipants = debounce(
          () => {
            if (tournamentId && participantsQueryKey) {
              queryClient.invalidateQueries({ queryKey: participantsQueryKey });
            }
          },
          1000
        );
        debouncedInvalidateParticipants();
      })
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