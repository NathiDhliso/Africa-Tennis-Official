import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,GET'
};

interface MatchStats {
  duration: number;
  totalPoints: number;
  totalShots: number;
  rallies: number;
  averageRallyLength: number;
  aces: { player1: number; player2: number };
  winners: { player1: number; player2: number };
  doubleFaults: { player1: number; player2: number };
  unforcedErrors: { player1: number; player2: number };
}

interface PlayerAnalytics {
  shotAccuracy: number;
  firstServePercentage: number;
  firstServeWinPercentage: number;
  courtCoverage: number;
  movementEfficiency: number;
  stamina: number;
  momentum: number;
  shotSpeed: {
    average: number;
    serve: number;
  };
}

interface KeyMoment {
  id: string;
  timestamp: number;
  type: 'ace' | 'winner' | 'break_point' | 'double_fault' | 'unforced_error';
  description: string;
  player: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Get match ID from path parameters
    const matchId = event.pathParameters?.matchId;
    
    if (!matchId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Match ID is required' })
      };
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Server configuration error' })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch match details
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        player1:profiles!matches_player1_id_fkey(username),
        player2:profiles!matches_player2_id_fkey(username)
      `)
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Match not found' })
      };
    }

    // Fetch match events for analytics
    const { data: events } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    // Calculate match duration
    const startTime = new Date(match.created_at).getTime();
    const endTime = match.status === 'completed' && match.updated_at 
      ? new Date(match.updated_at).getTime() 
      : Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);

    // Process events to calculate analytics
    const eventsByType = (events || []).reduce((acc, event) => {
      if (!acc[event.event_type]) acc[event.event_type] = [];
      acc[event.event_type].push(event);
      return acc;
    }, {} as Record<string, unknown[]>);

    // Calculate match stats
    const matchStats: MatchStats = {
      duration,
      totalPoints: (eventsByType.point_won || []).length,
      totalShots: (eventsByType.shot || []).length,
      rallies: (eventsByType.rally_end || []).length,
      averageRallyLength: (eventsByType.rally_end || []).length > 0 
        ? (eventsByType.shot || []).length / (eventsByType.rally_end || []).length 
        : 0,
      aces: {
        player1: (eventsByType.ace || []).filter(e => e.player_id === match.player1_id).length,
        player2: (eventsByType.ace || []).filter(e => e.player_id === match.player2_id).length
      },
      winners: {
        player1: (eventsByType.winner || []).filter(e => e.player_id === match.player1_id).length,
        player2: (eventsByType.winner || []).filter(e => e.player_id === match.player2_id).length
      },
      doubleFaults: {
        player1: (eventsByType.double_fault || []).filter(e => e.player_id === match.player1_id).length,
        player2: (eventsByType.double_fault || []).filter(e => e.player_id === match.player2_id).length
      },
      unforcedErrors: {
        player1: (eventsByType.unforced_error || []).filter(e => e.player_id === match.player1_id).length,
        player2: (eventsByType.unforced_error || []).filter(e => e.player_id === match.player2_id).length
      }
    };

    // Calculate player analytics (use statistics if available, otherwise estimate)
    const calculatePlayerAnalytics = (playerId: string): PlayerAnalytics => {
      const playerEvents = (events || []).filter(e => e.player_id === playerId);
      const shots = playerEvents.filter(e => e.event_type === 'shot');
      const serves = playerEvents.filter(e => e.event_type === 'serve');
      const aces = playerEvents.filter(e => e.event_type === 'ace');
      const winners = playerEvents.filter(e => e.event_type === 'winner');
      const errors = playerEvents.filter(e => e.event_type === 'unforced_error');
      
      const totalShots = shots.length;
      const successfulShots = winners.length + aces.length;
      const shotAccuracy = totalShots > 0 ? (successfulShots / totalShots) * 100 : 0;
      
      const firstServes = serves.filter(s => s.metadata?.serve_number === 1);
      const firstServeIn = firstServes.filter(s => s.metadata?.result === 'in');
      const firstServeWon = firstServes.filter(s => s.metadata?.point_won === true);
      
      return {
        shotAccuracy: Math.min(100, Math.max(0, shotAccuracy)),
        firstServePercentage: firstServes.length > 0 ? (firstServeIn.length / firstServes.length) * 100 : 65,
        firstServeWinPercentage: firstServeIn.length > 0 ? (firstServeWon.length / firstServeIn.length) * 100 : 70,
        courtCoverage: Math.min(100, 60 + (playerEvents.length / 10)), // Estimate based on activity
        movementEfficiency: Math.min(100, 70 + (successfulShots / Math.max(1, totalShots)) * 30),
        stamina: Math.max(60, 100 - (duration / 3600) * 20), // Decrease over time
        momentum: Math.min(100, 50 + (successfulShots - errors.length) * 5),
        shotSpeed: {
          average: 85 + Math.random() * 20, // Would need actual speed data
          serve: 120 + Math.random() * 40
        }
      };
    };

    const playerAnalytics = {
      player1: calculatePlayerAnalytics(match.player1_id),
      player2: calculatePlayerAnalytics(match.player2_id)
    };

    // Generate key moments
    const keyMoments: KeyMoment[] = (events || [])
      .filter(e => ['ace', 'winner', 'break_point', 'double_fault'].includes(e.event_type))
      .slice(-10) // Last 10 key moments
      .map(event => ({
        id: event.id,
        timestamp: new Date(event.created_at).getTime(),
        type: event.event_type as KeyMoment['type'],
        description: event.description || `${event.event_type} by ${event.player_id === match.player1_id ? match.player1?.username : match.player2?.username}`,
        player: event.player_id === match.player1_id ? 'player1' : 'player2'
      }));

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: {
          matchStats,
          playerAnalytics,
          keyMoments,
          match: {
            id: match.id,
            status: match.status,
            player1: match.player1?.username,
            player2: match.player2?.username
          }
        },
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Match Analytics error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch match analytics',
        timestamp: new Date().toISOString()
      })
    };
  }
};