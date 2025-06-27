import { createClient } from '@supabase/supabase-js';

export const handler = async (): Promise<any> => {
  try {
    // Initialize Supabase client with service role key to bypass RLS
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error: Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, username, elo_rating');

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    console.log(`Processing statistics for ${profiles.length} players`);

    // 2. Process each profile
    const results = await Promise.all(profiles.map(async (profile) => {
      try {
        // Fetch all completed matches for this player
        const { data: matches, error: matchesError } = await supabase
          .from('matches')
          .select(`
            *,
            player1:profiles!matches_player1_id_fkey(user_id, elo_rating),
            player2:profiles!matches_player2_id_fkey(user_id, elo_rating)
          `)
          .or(`player1_id.eq.${profile.user_id},player2_id.eq.${profile.user_id}`)
          .eq('status', 'completed');

        if (matchesError) {
          throw new Error(`Failed to fetch matches for ${profile.username}: ${matchesError.message}`);
        }

        // Skip if no matches
        if (!matches || matches.length === 0) {
          return {
            user_id: profile.user_id,
            username: profile.username,
            matches_processed: 0,
            status: 'skipped',
            message: 'No completed matches found'
          };
        }

        // Calculate statistics
        const stats = calculateAdvancedStats(profile.user_id, matches, profile.elo_rating);

        // Update player_stats table
        const { error: upsertError } = await supabase
          .from('player_stats')
          .upsert({
            user_id: profile.user_id,
            win_rate_vs_higher_elo: stats.winRateVsHigherElo,
            win_rate_vs_lower_elo: stats.winRateVsLowerElo,
            avg_tournament_placement: stats.avgTournamentPlacement,
            last_calculated_at: new Date().toISOString()
          });

        if (upsertError) {
          throw new Error(`Failed to update stats for ${profile.username}: ${upsertError.message}`);
        }

        return {
          user_id: profile.user_id,
          username: profile.username,
          matches_processed: matches.length,
          status: 'success'
        };
      } catch (error: any) {
        console.error(`Error processing player ${profile.username}:`, error);
        return {
          user_id: profile.user_id,
          username: profile.username,
          status: 'error',
          error: error.message
        };
      }
    }));

    // Count successes and failures
    const successes = results.filter(r => r.status === 'success').length;
    const errors = results.filter(r => r.status === 'error').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Player statistics aggregation completed',
        summary: {
          total: profiles.length,
          processed: successes,
          errors,
          skipped
        },
        timestamp: new Date().toISOString()
      })
    };
  } catch (error: any) {
    console.error('Unexpected error during stats aggregation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'An unexpected error occurred during stats aggregation',
        message: error.message
      })
    };
  }
};

// Helper function to calculate advanced statistics
function calculateAdvancedStats(
  playerId: string, 
  matches: any[], 
  playerElo: number
): { 
  winRateVsHigherElo: number, 
  winRateVsLowerElo: number, 
  avgTournamentPlacement: number 
} {
  // Initialize counters
  let matchesVsHigherElo = 0;
  let winsVsHigherElo = 0;
  let matchesVsLowerElo = 0;
  let winsVsLowerElo = 0;
  
  // Process each match
  matches.forEach(match => {
    const isPlayer1 = match.player1_id === playerId;
    const opponent = isPlayer1 ? match.player2 : match.player1;
    const opponentElo = opponent?.elo_rating || 1200;
    const isWinner = match.winner_id === playerId;
    
    if (opponentElo > playerElo) {
      // Match against higher-rated opponent
      matchesVsHigherElo++;
      if (isWinner) winsVsHigherElo++;
    } else {
      // Match against lower-rated or equal opponent
      matchesVsLowerElo++;
      if (isWinner) winsVsLowerElo++;
    }
  });
  
  // Calculate win rates
  const winRateVsHigherElo = matchesVsHigherElo > 0 
    ? (winsVsHigherElo / matchesVsHigherElo) * 100 
    : 0;
    
  const winRateVsLowerElo = matchesVsLowerElo > 0 
    ? (winsVsLowerElo / matchesVsLowerElo) * 100 
    : 0;
  
  // For tournament placement, we would need to fetch tournament data
  // This is a placeholder - in a real implementation, you would calculate this
  // based on actual tournament results
  const avgTournamentPlacement = 0;
  
  return {
    winRateVsHigherElo,
    winRateVsLowerElo,
    avgTournamentPlacement
  };
}