import { createClient } from '@supabase/supabase-js';

export const handler = async (event: { httpMethod?: string; queryStringParameters?: Record<string, string> }): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: ''
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract player_id from query parameters
    const playerId = event.queryStringParameters?.player_id;
    
    if (!playerId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'player_id is required'
        })
      };
    }

    // Fetch player profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', playerId)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch player profile: ${profileError.message}`);
    }

    // Fetch all matches for the player
        const { data: matches, error: matchesError } = await supabase
          .from('matches')
      .select('*')
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
          .eq('status', 'completed');

        if (matchesError) {
      throw new Error(`Failed to fetch matches: ${matchesError.message}`);
        }

    // Calculate win rate statistics
    const totalMatches = matches?.length || 0;
    const wins = matches?.filter((match: { winner_id: string | null }) => match.winner_id === playerId).length || 0;
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

    // Calculate recent form (last 10 matches)
    const recentMatches = matches?.slice(-10) || [];
    const recentWins = recentMatches.filter((match: { winner_id: string | null }) => match.winner_id === playerId).length;
    const recentForm = recentMatches.length > 0 ? (recentWins / recentMatches.length) * 100 : 0;

    // Calculate opponent ELO statistics
    const opponentElos: number[] = [];
    
    for (const match of matches || []) {
      const opponentId = match.player1_id === playerId ? match.player2_id : match.player1_id;
      
      try {
        const { data: opponentProfile } = await supabase
          .from('profiles')
          .select('elo_rating')
          .eq('user_id', opponentId)
          .single();
        
        if (opponentProfile?.elo_rating) {
          opponentElos.push(opponentProfile.elo_rating);
        }
      } catch (error) {
        console.warn(`Failed to fetch opponent ELO for ${opponentId}:`, error);
        }
    }

    const avgOpponentElo = opponentElos.length > 0 
      ? opponentElos.reduce((sum, elo) => sum + elo, 0) / opponentElos.length 
      : profile.elo_rating;

    // Separate wins against higher and lower ELO opponents
    const playerElo = profile.elo_rating;
    let winsVsHigher = 0;
    let matchesVsHigher = 0;
    let winsVsLower = 0;
    let matchesVsLower = 0;

    for (let i = 0; i < (matches?.length || 0); i++) {
      const match = matches![i];
      const opponentElo = opponentElos[i];
      
      if (!opponentElo) continue;
      
      if (opponentElo > playerElo) {
        matchesVsHigher++;
        if (match.winner_id === playerId) winsVsHigher++;
      } else if (opponentElo < playerElo) {
        matchesVsLower++;
        if (match.winner_id === playerId) winsVsLower++;
      }
    }

    const winRateVsHigherElo = matchesVsHigher > 0 ? (winsVsHigher / matchesVsHigher) * 100 : 0;
    const winRateVsLowerElo = matchesVsLower > 0 ? (winsVsLower / matchesVsLower) * 100 : 0;

    // Update or insert player stats
    const statsData = {
      user_id: playerId,
      win_rate_vs_higher_elo: winRateVsHigherElo,
      win_rate_vs_lower_elo: winRateVsLowerElo,
      avg_tournament_placement: 0, // Placeholder - would need tournament data
      last_calculated_at: new Date().toISOString()
    };

        const { error: upsertError } = await supabase
          .from('player_stats')
      .upsert(statsData);

        if (upsertError) {
      throw new Error(`Failed to update player stats: ${upsertError.message}`);
      }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          playerId,
          totalMatches,
          wins,
          winRate: Math.round(winRate * 100) / 100,
          recentForm: Math.round(recentForm * 100) / 100,
          avgOpponentElo: Math.round(avgOpponentElo),
          winRateVsHigherElo: Math.round(winRateVsHigherElo * 100) / 100,
          winRateVsLowerElo: Math.round(winRateVsLowerElo * 100) / 100,
          lastCalculated: statsData.last_calculated_at
        }
      })
    };

  } catch (error: unknown) {
    console.error('Error in aggregate-stats:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: errorMessage
      })
    };
  }
};