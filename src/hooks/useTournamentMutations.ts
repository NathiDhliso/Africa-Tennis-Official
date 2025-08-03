import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase-generated';

type TournamentInsert = Database['public']['Tables']['tournaments']['Insert'];
type TournamentUpdate = Database['public']['Tables']['tournaments']['Update'];

const createTournamentFn = async (tournament: TournamentInsert) => {
  const { data, error } = await supabase.from('tournaments').insert(tournament).select().single();
  if (error) throw error;
  return data;
};

const updateTournamentFn = async ({ id, updates }: { id: string; updates: TournamentUpdate }) => {
  const { error } = await supabase.from('tournaments').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
};

const registerForTournamentFn = async ({ tournamentId, playerId }: { tournamentId: string; playerId: string }) => {
  // Check if the player is already registered
  const { data: existingRegistration, error: checkError } = await supabase
    .from('tournament_participants')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
    .maybeSingle();
    
  if (checkError) throw checkError;
  
  // If already registered, don't try to register again
  if (existingRegistration) return existingRegistration;
  
  // Register the player
  const { error } = await supabase.from('tournament_participants').insert({ tournament_id: tournamentId, player_id: playerId });
  if (error) throw error;
};

const unregisterFromTournamentFn = async ({ tournamentId, playerId }: { tournamentId: string; playerId: string }) => {
  const { error } = await supabase.from('tournament_participants').delete().eq('tournament_id', tournamentId).eq('player_id', playerId);
  if (error) throw error;
};

export const useTournamentMutations = () => {
  const queryClient = useQueryClient();

  const createTournament = useMutation({
    mutationFn: createTournamentFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });

  const updateTournament = useMutation({
    mutationFn: updateTournamentFn,
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      // Also invalidate the specific tournament details if you have a query for that
    },
  });

  const registerForTournament = useMutation({
    mutationFn: registerForTournamentFn,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournamentParticipants', variables.tournamentId] });
      // Show success notification
      console.log('Successfully registered for tournament');
    },
    onError: (error) => {
      console.error('Failed to register for tournament:', error);
      // You can add toast notification here
    },
  });

  const unregisterFromTournament = useMutation({
    mutationFn: unregisterFromTournamentFn,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['tournamentParticipants', variables.tournamentId] });
      console.log('Successfully unregistered from tournament');
    },
    onError: (error) => {
      console.error('Failed to unregister from tournament:', error);
    },
  });

  return {
    createTournament,
    updateTournament,
    registerForTournament,
    unregisterFromTournament,
  };
};