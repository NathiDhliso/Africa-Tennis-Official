import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

interface RequestBody {
  winningPlayerId: string;
  pointType?: string;
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

    // Parse request body
    const body: RequestBody = event.body ? JSON.parse(event.body) : {};
    
    if (!body.winningPlayerId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'winningPlayerId is required' })
      };
    }

    // Initialize Supabase client with service role key to bypass RLS
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

    // Call the database function to update the score
    const { data, error } = await supabase.rpc(
      'calculate_tennis_score',
      {
        match_id: matchId,
        winning_player_id: body.winningPlayerId,
        point_type: body.pointType || 'point_won'
      }
    );

    if (error) {
      console.error('Error updating score:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: error.message })
      };
    }

    // Return the updated score
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, data })
    };
  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'An unexpected error occurred' })
    };
  }
};