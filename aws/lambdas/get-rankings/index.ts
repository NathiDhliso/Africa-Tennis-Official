import { createClient } from '@supabase/supabase-js';

interface RankingData {
  user_id: string;
  username: string;
  elo_rating: number;
  matches_played: number;
  matches_won: number;
  skill_level: string;
  win_rate: number;
  rank: number;
  rank_change: number;
  rank_change_value: number;
  recent_form: number;
  profile_picture_url?: string;
}

export const handler = async (event: { 
  httpMethod?: string; 
  queryStringParameters?: Record<string, string> 
}): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    // Get query parameters
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');
    const skill_level = event.queryStringParameters?.skill_level;

    // Check if we have cached rankings (updated within last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    let { data: cachedRankings, error: cacheError } = await supabase
      .from('player_rankings')
      .select('*')
      .order('rank', { ascending: true })
      .gte('updated_at', oneHourAgo)
      .range(offset, offset + limit - 1);

    if (cacheError) {
      console.warn('Cache lookup failed:', cacheError);
    }

    // If we have fresh cached data, return it
    if (cachedRankings && cachedRankings.length > 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: cachedRankings,
          cached: true,
          timestamp: new Date().toISOString()
        })
      };
    }

    // Otherwise, calculate rankings in real-time
    console.log('Calculating fresh rankings...');

    // Get all active players with their stats
    let query = supabase
      .from('profiles')
      .select(`
        user_id,
        username,
        elo_rating,
        matches_played,
        matches_won,
        skill_level,
        profile_picture_url
      `)
      .not('elo_rating', 'is', null)
      .gt('matches_played', 0);

    if (skill_level) {
      query = query.eq('skill_level', skill_level);
    }

    const { data: profiles, error: profilesError } = await query
      .order('elo_rating', { ascending: false })
      .limit(200); // Limit initial fetch for performance

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: [],
          cached: false,
          timestamp: new Date().toISOString()
        })
      };
    }

    // Calculate rankings with additional metrics
    const rankings: RankingData[] = await Promise.all(
      profiles.map(async (profile, index) => {
        const win_rate = profile.matches_played > 0 
          ? (profile.matches_won / profile.matches_played) * 100 
          : 0;

        // Get recent form (last 10 matches)
        const { data: recentMatches } = await supabase
          .from('matches')
          .select('winner_id')
          .or(`player1_id.eq.${profile.user_id},player2_id.eq.${profile.user_id}`)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(10);

        const recentWins = recentMatches?.filter(m => m.winner_id === profile.user_id).length || 0;
        const recent_form = (recentMatches?.length && recentMatches.length > 0)
          ? (recentWins / recentMatches.length) * 100 
          : 0;

        // Get previous rank for rank change calculation
        const { data: prevRanking } = await supabase
          .from('player_rankings')
          .select('rank, elo_rating')
          .eq('user_id', profile.user_id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        const currentRank = index + 1;
        const rank_change = prevRanking ? prevRanking.rank - currentRank : 0;
        const rank_change_value = prevRanking ? profile.elo_rating - prevRanking.elo_rating : 0;

        return {
          user_id: profile.user_id,
          username: profile.username,
          elo_rating: profile.elo_rating,
          matches_played: profile.matches_played,
          matches_won: profile.matches_won,
          skill_level: profile.skill_level,
          win_rate: Math.round(win_rate * 100) / 100,
          rank: currentRank,
          rank_change,
          rank_change_value: Math.round(rank_change_value),
          recent_form: Math.round(recent_form * 100) / 100,
          profile_picture_url: profile.profile_picture_url
        };
      })
    );

    // Cache the results
    const cacheData = rankings.map(ranking => ({
      ...ranking,
      updated_at: new Date().toISOString()
    }));

    // Clear old cache and insert new rankings
    await supabase.from('player_rankings').delete().neq('user_id', '');
    const { error: cacheInsertError } = await supabase
      .from('player_rankings')
      .insert(cacheData);

    if (cacheInsertError) {
      console.warn('Failed to cache rankings:', cacheInsertError);
    }

    // Apply pagination to results
    const paginatedResults = rankings.slice(offset, offset + limit);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: paginatedResults,
        cached: false,
        total: rankings.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error: unknown) {
    console.error('Error in get-rankings:', error);
    
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