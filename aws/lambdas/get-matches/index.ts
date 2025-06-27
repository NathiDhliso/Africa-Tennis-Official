import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,GET'
};

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
    // Get userId from query parameters
    const userId = event.queryStringParameters?.userId;
    
    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'userId query parameter is required' })
      };
    }

    // Initialize Supabase client with service role key to bypass RLS
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Server configuration error: Supabase credentials are not set.' })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch matches for the user with a more robust query that explicitly defines the relationships
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        player1:profiles!matches_player1_id_fkey(username, elo_rating),
        player2:profiles!matches_player2_id_fkey(username, elo_rating),
        winner:profiles!matches_winner_id_fkey(username)
      `)
      .order('date', { ascending: false })
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);

    if (error) {
      console.error('Error fetching matches from Supabase:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: `Supabase query failed: ${error.message}` })
      };
    }

    // Return the matches
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data })
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('Unexpected error in handler:', errorMessage);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: errorMessage })
    };
  }
};
