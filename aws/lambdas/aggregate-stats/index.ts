import { createClient } from '@supabase/supabase-js';

interface PlayerStats {
  user_id: string;
  username: string;
  elo_rating: number;
  matches_played: number;
  matches_won: number;
  win_rate: number;
  recent_form: number;
  avg_opponent_elo: number;
  win_rate_vs_higher_elo: number;
  win_rate_vs_lower_elo: number;
  longest_win_streak: number;
  current_win_streak: number;
  tournaments_played: number;
  tournaments_won: number;
  last_match_date: string | null;
}

interface ProfileData {
  user_id: string;
  username: string;
  elo_rating: number;
  matches_played: number;
  matches_won: number;
}

interface MatchData {
  id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string;
  created_at: string;
  status: string;
}

export const handler = async (event: { 
  httpMethod?: string; 
  queryStringParameters?: Record<string, string>;
  source?: string; // For scheduled events
}): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
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

    // Determine if this is a scheduled event or API call
    const isScheduledEvent = event.source === 'aws.events' || !event.httpMethod;
    const playerId = event.queryStringParameters?.player_id;

    if (isScheduledEvent) {
      // Process all players for scheduled aggregation
      console.log('Running scheduled stats aggregation for all players...');
      const result = await aggregateAllPlayersStats(supabase);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: result,
          processed: 'all_players',
          timestamp: new Date().toISOString()
        })
      };
    } else if (playerId) {
      // Process specific player for API call
      console.log(`Running stats aggregation for player: ${playerId}`);
      const result = await aggregatePlayerStats(supabase, playerId);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: result,
          processed: 'single_player',
          timestamp: new Date().toISOString()
        })
      };
    } else {
      // Manual trigger for all players via API
      console.log('Running manual stats aggregation for all players...');
      const result = await aggregateAllPlayersStats(supabase);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: result,
          processed: 'all_players_manual',
          timestamp: new Date().toISOString()
        })
      };
    }

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

async function aggregateAllPlayersStats(supabase: any): Promise<{
  playersProcessed: number;
  rankingsUpdated: boolean;
  processingTime: number;
}> {
  const startTime = Date.now();
  
  // Get all active players
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, username, elo_rating')
    .not('elo_rating', 'is', null)
    .order('elo_rating', { ascending: false });

  if (profilesError) {
    throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
  }

  if (!profiles || profiles.length === 0) {
    return {
      playersProcessed: 0,
      rankingsUpdated: false,
      processingTime: Date.now() - startTime
    };
  }

  console.log(`Processing stats for ${profiles.length} players...`);

  // Process players in batches to avoid timeouts
  const batchSize = 10;
  const playerStats: PlayerStats[] = [];

  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map((profile: ProfileData) => calculatePlayerStats(supabase, profile.user_id, profile.username, profile.elo_rating))
    );
    
    playerStats.push(...batchResults.filter(Boolean));
    console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(profiles.length / batchSize)}`);
  }

  // Update player_rankings table
  if (playerStats.length > 0) {
    // Clear old rankings
    await supabase.from('player_rankings').delete().neq('user_id', '');
    
    // Insert new rankings with ranks
    const rankedStats = playerStats.map((stats, index) => ({
      ...stats,
      rank: index + 1,
      updated_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('player_rankings')
      .insert(rankedStats);

    if (insertError) {
      console.error('Failed to update rankings:', insertError);
      throw new Error(`Failed to update rankings: ${insertError.message}`);
    }
  }

  return {
    playersProcessed: playerStats.length,
    rankingsUpdated: true,
    processingTime: Date.now() - startTime
  };
}

async function aggregatePlayerStats(supabase: any, playerId: string): Promise<PlayerStats> {
  // Get player profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, username, elo_rating, matches_played, matches_won')
    .eq('user_id', playerId)
    .single();

  if (profileError) {
    throw new Error(`Failed to fetch player profile: ${profileError.message}`);
  }

  return await calculatePlayerStats(supabase, profile.user_id, profile.username, profile.elo_rating);
}

async function calculatePlayerStats(supabase: any, userId: string, username: string, eloRating: number): Promise<PlayerStats> {
  // Fetch all matches for the player
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('*')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (matchesError) {
    console.warn(`Failed to fetch matches for ${userId}:`, matchesError);
    return createDefaultStats(userId, username, eloRating);
  }

  const totalMatches = matches?.length || 0;
  const wins = matches?.filter((match: any) => match.winner_id === userId).length || 0;
  const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

  // Calculate recent form (last 10 matches)
  const recentMatches = matches?.slice(0, 10) || [];
  const recentWins = recentMatches.filter((match: any) => match.winner_id === userId).length;
  const recentForm = recentMatches.length > 0 ? (recentWins / recentMatches.length) * 100 : 0;

  // Calculate win streaks
  let currentWinStreak = 0;
  let longestWinStreak = 0;
  let tempStreak = 0;

  for (const match of matches || []) {
    if (match.winner_id === userId) {
      tempStreak++;
      if (currentWinStreak === 0) currentWinStreak = tempStreak;
    } else {
      longestWinStreak = Math.max(longestWinStreak, tempStreak);
      tempStreak = 0;
      currentWinStreak = 0;
    }
  }
  longestWinStreak = Math.max(longestWinStreak, tempStreak);

  // Calculate opponent stats (simplified for performance)
  const opponentElos: number[] = [];
  for (const match of (matches || []).slice(0, 50)) { // Limit for performance
    const opponentId = match.player1_id === userId ? match.player2_id : match.player1_id;
    
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
      // Continue if opponent profile not found
    }
  }

  const avgOpponentElo = opponentElos.length > 0 
    ? opponentElos.reduce((sum, elo) => sum + elo, 0) / opponentElos.length 
    : eloRating;

  // Calculate performance vs higher/lower ELO
  let winsVsHigher = 0, matchesVsHigher = 0;
  let winsVsLower = 0, matchesVsLower = 0;

  (matches || []).slice(0, 50).forEach((match: MatchData, index: number) => {
    const opponentElo = opponentElos[index];
    if (!opponentElo) return;
    
    if (opponentElo > eloRating) {
      matchesVsHigher++;
      if (match.winner_id === userId) winsVsHigher++;
    } else if (opponentElo < eloRating) {
      matchesVsLower++;
      if (match.winner_id === userId) winsVsLower++;
    }
  });

  const winRateVsHigherElo = matchesVsHigher > 0 ? (winsVsHigher / matchesVsHigher) * 100 : 0;
  const winRateVsLowerElo = matchesVsLower > 0 ? (winsVsLower / matchesVsLower) * 100 : 0;

  // Tournament stats (placeholder - would need tournament_participants table)
  const tournamentsPlayed = 0;
  const tournamentsWon = 0;

  const lastMatchDate = matches && matches.length > 0 ? matches[0].created_at : null;

  return {
    user_id: userId,
    username,
    elo_rating: eloRating,
    matches_played: totalMatches,
    matches_won: wins,
    win_rate: Math.round(winRate * 100) / 100,
    recent_form: Math.round(recentForm * 100) / 100,
    avg_opponent_elo: Math.round(avgOpponentElo),
    win_rate_vs_higher_elo: Math.round(winRateVsHigherElo * 100) / 100,
    win_rate_vs_lower_elo: Math.round(winRateVsLowerElo * 100) / 100,
    longest_win_streak: longestWinStreak,
    current_win_streak: currentWinStreak,
    tournaments_played: tournamentsPlayed,
    tournaments_won: tournamentsWon,
    last_match_date: lastMatchDate
  };
}

function createDefaultStats(userId: string, username: string, eloRating: number): PlayerStats {
  return {
    user_id: userId,
    username,
    elo_rating: eloRating,
    matches_played: 0,
    matches_won: 0,
    win_rate: 0,
    recent_form: 0,
    avg_opponent_elo: eloRating,
    win_rate_vs_higher_elo: 0,
    win_rate_vs_lower_elo: 0,
    longest_win_streak: 0,
    current_win_streak: 0,
    tournaments_played: 0,
    tournaments_won: 0,
    last_match_date: null
  };
}