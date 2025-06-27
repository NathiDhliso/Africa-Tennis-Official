import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

const fetchTournamentsWithDetails = async (userId: string | undefined) => {
  const { data: tournamentsData, error } = await supabase
    .from('tournaments')
    .select('*, organizer:profiles!tournaments_organizer_id_fkey(username)')
    .order('start_date', { ascending: true });

  if (error) throw new Error(error.message);

  if (!tournamentsData) return [];

  const tournamentsWithDetails = await Promise.all(
    tournamentsData.map(async (tournament) => {
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

  const { data: tournaments, isLoading: isLoadingTournaments, error: tournamentsError } = useQuery({
    queryKey: ['tournaments', user?.id],
    queryFn: () => fetchTournamentsWithDetails(user?.id),
  });

  const { data: participants, isLoading: isLoadingParticipants, error: participantsError } = useQuery({
    queryKey: ['tournamentParticipants', tournamentId],
    queryFn: () => fetchTournamentParticipants(tournamentId!),
    enabled: !!tournamentId,
  });

  useEffect(() => {
    const channel = supabase
      .channel('tournaments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tournaments'] });
          if (tournamentId) {
            queryClient.invalidateQueries({ queryKey: ['tournamentParticipants', tournamentId] });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_participants' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tournaments'] });
          if (tournamentId) {
            queryClient.invalidateQueries({ queryKey: ['tournamentParticipants', tournamentId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tournamentId]);

  return {
    tournaments: tournaments || [],
    participants,
    isLoading: isLoadingTournaments || (!!tournamentId && isLoadingParticipants),
    error: tournamentsError || participantsError,
  };
};