import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,GET'
};

interface PerformanceMetrics {
  shotAccuracy: number;
  movementEfficiency: number;
  courtCoverage: number;
  stamina: number;
  reactionTime: number;
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
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Match not found' })
      };
    }

    // Fetch match events for performance calculation
    const { data: events, error: eventsError } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    // Calculate performance metrics for each player
    const calculatePerformanceMetrics = (playerId: string): PerformanceMetrics => {
      const playerEvents = (events || []).filter(e => e.player_id === playerId);
      
      // Calculate shot accuracy
      const shots = playerEvents.filter(e => e.event_type === 'shot');
      const successfulShots = playerEvents.filter(e => 
        ['winner', 'ace', 'forced_error'].includes(e.event_type)
      );
      const errors = playerEvents.filter(e => 
        ['unforced_error', 'double_fault'].includes(e.event_type)
      );
      
      const shotAccuracy = shots.length > 0 
        ? Math.max(0, Math.min(100, ((successfulShots.length) / (shots.length + errors.length)) * 100))
        : 75; // Default value
      
      // Calculate movement efficiency based on court coverage events
      const movementEvents = playerEvents.filter(e => 
        e.metadata && e.metadata.position
      );
      const movementEfficiency = movementEvents.length > 10 
        ? Math.min(100, 60 + (movementEvents.length / 5))
        : 70; // Default value
      
      // Calculate court coverage based on position variety
      const positions = movementEvents.map(e => e.metadata?.position).filter(Boolean);
      const uniquePositions = new Set(positions.map(p => `${Math.floor(p.x/50)},${Math.floor(p.y/50)}`));
      const courtCoverage = Math.min(100, (uniquePositions.size * 10) + 40);
      
      // Calculate stamina based on match duration and activity
      const matchDuration = (Date.now() - new Date(match.created_at).getTime()) / 1000 / 60; // minutes
      const activityLevel = playerEvents.length / Math.max(1, matchDuration);
      const stamina = Math.max(60, 100 - (matchDuration / 120) * 30 + (activityLevel * 2));
      
      // Calculate reaction time based on response events
      const reactionEvents = playerEvents.filter(e => 
        e.metadata && e.metadata.reaction_time
      );
      const avgReactionTime = reactionEvents.length > 0
        ? reactionEvents.reduce((sum, e) => sum + (e.metadata?.reaction_time || 250), 0) / reactionEvents.length
        : 250; // Default 250ms
      
      return {
        shotAccuracy: Math.round(shotAccuracy * 10) / 10,
        movementEfficiency: Math.round(movementEfficiency * 10) / 10,
        courtCoverage: Math.round(courtCoverage * 10) / 10,
        stamina: Math.round(stamina * 10) / 10,
        reactionTime: Math.round(avgReactionTime)
      };
    };

    const performanceData = {
      player1: calculatePerformanceMetrics(match.player1_id),
      player2: calculatePerformanceMetrics(match.player2_id)
    };

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: performanceData,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Match Performance error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch match performance data',
        timestamp: new Date().toISOString()
      })
    };
  }
};