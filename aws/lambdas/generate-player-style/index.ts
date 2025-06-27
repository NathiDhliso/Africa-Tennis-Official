import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Type definitions for Bedrock responses
interface BedrockContentItem {
  type: 'text';
  text: string;
}

interface BedrockResponse {
  content?: BedrockContentItem[];
  completion?: string;
}

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });

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
    // Get player ID from path parameters
    const playerId = event.pathParameters?.playerId;
    
    if (!playerId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Player ID is required' })
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

    // Fetch player profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', playerId)
      .single();

    if (profileError) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Player not found' })
      };
    }

    // Check if player style analysis already exists
    if (profile.player_style_analysis) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true, 
          data: { playerStyleAnalysis: profile.player_style_analysis },
          message: 'Player style analysis already exists'
        })
      };
    }

    // Fetch player's matches
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        *,
        player1:profiles!matches_player1_id_fkey(username, elo_rating),
        player2:profiles!matches_player2_id_fkey(username, elo_rating),
        winner:profiles!matches_winner_id_fkey(username)
      `)
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
      .eq('status', 'completed')
      .order('date', { ascending: false })
      .limit(20);

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
    }

    // Fetch player's tournament participations
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        tournament:tournaments(
          id, name, format, status
        )
      `)
      .eq('player_id', playerId)
      .order('registered_at', { ascending: false })
      .limit(10);

    if (tournamentsError) {
      console.error('Error fetching tournaments:', tournamentsError);
    }

    // Fetch player stats if available
    const { data: playerStats, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .eq('user_id', playerId)
      .single();

    if (statsError && statsError.code !== 'PGRST116') {
      console.error('Error fetching player stats:', statsError);
    }

    // Calculate win rate
    const winRate = profile.matches_played > 0 
      ? ((profile.matches_won / profile.matches_played) * 100).toFixed(1) 
      : '0.0';

    // Calculate win/loss against higher/lower rated players
    let winsVsHigherRated = 0;
    let matchesVsHigherRated = 0;
    let winsVsLowerRated = 0;
    let matchesVsLowerRated = 0;

    if (matches) {
      matches.forEach(match => {
        const isPlayer1 = match.player1_id === playerId;
        const playerRating = profile.elo_rating;
        const opponentRating = isPlayer1 ? match.player2?.elo_rating : match.player1?.elo_rating;
        const isWinner = match.winner_id === playerId;
        
        if (opponentRating > playerRating) {
          matchesVsHigherRated++;
          if (isWinner) winsVsHigherRated++;
        } else {
          matchesVsLowerRated++;
          if (isWinner) winsVsLowerRated++;
        }
      });
    }

    // Construct prompt for Bedrock
    const prompt = `
    <human>
    Generate a detailed tennis player style analysis based on the following player data:
    
    Player: ${profile.username}
    Skill Level: ${profile.skill_level}
    ELO Rating: ${profile.elo_rating}
    Matches Played: ${profile.matches_played}
    Matches Won: ${profile.matches_won}
    Win Rate: ${winRate}%
    Bio: ${profile.bio || 'Not provided'}
    
    Additional Statistics:
    - Wins vs Higher Rated Players: ${winsVsHigherRated}/${matchesVsHigherRated} (${matchesVsHigherRated > 0 ? ((winsVsHigherRated/matchesVsHigherRated)*100).toFixed(1) : 0}%)
    - Wins vs Lower Rated Players: ${winsVsLowerRated}/${matchesVsLowerRated} (${matchesVsLowerRated > 0 ? ((winsVsLowerRated/matchesVsLowerRated)*100).toFixed(1) : 0}%)
    ${playerStats ? `- Win Rate vs Higher ELO: ${playerStats.win_rate_vs_higher_elo.toFixed(1)}%
    - Win Rate vs Lower ELO: ${playerStats.win_rate_vs_lower_elo.toFixed(1)}%
    - Average Tournament Placement: ${playerStats.avg_tournament_placement || 'N/A'}` : ''}
    
    Tournament History:
    ${tournaments && tournaments.length > 0 ? 
      tournaments.map(t => `- ${t.tournament.name} (${t.tournament.format.replace('_', ' ')}) - Status: ${t.tournament.status.replace('_', ' ')}`).join('\n') : 
      'No tournament participation data available'}
    
    Recent Match Results:
    ${matches && matches.length > 0 ? 
      matches.slice(0, 5).map(m => {
        const isPlayer1 = m.player1_id === playerId;
        const opponent = isPlayer1 ? m.player2?.username : m.player1?.username;
        const result = m.winner_id === playerId ? 'Won' : 'Lost';
        return `- ${result} against ${opponent} on ${new Date(m.date).toLocaleDateString()}`;
      }).join('\n') : 
      'No recent match data available'}
    
    Based on this data, provide a comprehensive analysis of the player's tennis style, including:
    1. Playing style (e.g., baseline player, serve-and-volley, all-court player)
    2. Strengths and weaknesses
    3. Tactical approach
    4. Potential areas for improvement
    5. Comparison to similar players at their level
    
    Keep the analysis between 150-200 words, use tennis terminology, and make it personalized to the player's statistics.
    </human>
    `;

    // Call Amazon Bedrock to generate the player style analysis
    const modelId = 'anthropic.claude-3-sonnet-20240229-v1:0'; // Using Claude 3 Sonnet
    
    const bedrockParams = {
      modelId: modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 500,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    };

    console.log('Calling Bedrock with params:', JSON.stringify(bedrockParams, null, 2));

    const command = new InvokeModelCommand(bedrockParams);
    const bedrockResponse = await bedrockClient.send(command);
    
    // Parse the response
    const responseBody: BedrockResponse = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    console.log('Bedrock response:', JSON.stringify(responseBody, null, 2));
    
    let generatedStyleAnalysis = '';
    
    // Handle different response formats based on the model
    if (responseBody.content && Array.isArray(responseBody.content)) {
      // Claude 3 format
      generatedStyleAnalysis = responseBody.content
        .filter((item: BedrockContentItem) => item.type === 'text')
        .map((item: BedrockContentItem) => item.text)
        .join('');
    } else if (responseBody.completion) {
      // Claude 2 format
      generatedStyleAnalysis = responseBody.completion;
    } else {
      throw new Error('Unexpected response format from Bedrock');
    }
    
    // Clean up the analysis
    generatedStyleAnalysis = generatedStyleAnalysis.trim();
    
    // Update the player profile with the generated style analysis
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ player_style_analysis: generatedStyleAnalysis })
      .eq('user_id', playerId);

    if (updateError) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Failed to update player profile with style analysis' })
      };
    }

    // Return success response with the generated style analysis
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true, 
        data: { playerStyleAnalysis: generatedStyleAnalysis }
      })
    };
  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred',
        details: errorMessage
      })
    };
  }
};