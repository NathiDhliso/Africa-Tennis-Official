import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import MatchDetailsPage from '../components/MatchDetailsPage';
import LoadingSpinner from '../components/LoadingSpinner';
import { Match, scoreToString } from '../types';

const MatchDetailPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatchDetails = useCallback(async () => {
      if (!matchId) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('matches')
          .select(`
            *,
            player1:profiles!matches_player1_id_fkey(username, elo_rating),
            player2:profiles!matches_player2_id_fkey(username, elo_rating),
            winner:profiles!matches_winner_id_fkey(username)
          `)
          .eq('id', matchId)
          .single();
          
        if (error) throw error;
        
        if (data) {
          // Convert Supabase match to our app format
          let challengerScore, challengedScore;

          // Safely check if score is a string (for old data) before splitting
          if (typeof data.score === 'string' && data.score.includes('-')) {
            const parts = data.score.split('-');
            challengerScore = parseInt(parts[0], 10);
            challengedScore = parseInt(parts[1], 10);
          }

          // For new JSONB scores, these will be undefined.
          // The MatchDetailsPage component will handle rendering the live score object.

          const convertedMatch: Match = {
            id: data.id,
            tournament_id: data.tournament_id,
            player1_id: data.player1_id,
            player2_id: data.player2_id,
            winner_id: data.winner_id,
            score: scoreToString(data.score),
            status: (data.status as Match['status']) || 'pending',
            date: data.date,
            location: data.location,
            match_number: data.match_number,
            round: data.round,
            summary: data.summary,
            created_at: data.created_at,
            updated_at: data.updated_at,
            challengerId: data.player1_id,
            challengedId: data.player2_id,
            challengerScore, // Use the safely parsed score
            challengedScore, // Use the safely parsed score
            winner: data.winner_id,
            winnerProfile: data.winner ? {
               username: data.winner.username,
               user_id: data.winner_id || ''
             } : undefined,
            player1: data.player1 ? {
               username: data.player1.username,
               elo_rating: data.player1.elo_rating,
               user_id: data.player1_id,
               profile_picture_url: null
             } : undefined,
             player2: data.player2 ? {
               username: data.player2.username,
               elo_rating: data.player2.elo_rating,
               user_id: data.player2_id,
               profile_picture_url: null
             } : undefined
          };
          
          setMatch(convertedMatch);
        }
      } catch (err: unknown) {
        console.error('Error fetching match details:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }, [matchId]);

  useEffect(() => {
    fetchMatchDetails();
  }, [fetchMatchDetails]);

  const handleBack = () => {
    navigate('/matches');
  };

  // Subscribe to real-time updates for this match
  useEffect(() => {
    if (!matchId) return;
    
    const subscription = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`
        },
        (payload) => {
          if (payload.new) {
            fetchMatchDetails();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [matchId, fetchMatchDetails]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <LoadingSpinner 
          size="large" 
          text="Loading match details..." 
          subtext="Retrieving match information"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-standard)' }}>Error Loading Match</h2>
          <p style={{ color: 'var(--text-subtle)' }}>{error}</p>
          <button 
            onClick={handleBack}
            className="mt-4 btn btn-primary"
          >
            Back to Matches
          </button>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-standard)' }}>Match Not Found</h2>
          <p style={{ color: 'var(--text-subtle)' }}>The match you're looking for doesn't exist or you don't have permission to view it.</p>
          <button 
            onClick={handleBack}
            className="mt-4 btn btn-primary"
          >
            Back to Matches
          </button>
        </div>
      </div>
    );
  }

  return (
    <MatchDetailsPage 
      match={match} 
      onBack={handleBack} 
      onActionComplete={() => {
        // Refresh match data after action
        fetchMatchDetails();
      }} 
    />
  );
};

export default MatchDetailPage;