import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

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
    // Get match ID from path parameters
    const matchId = event.pathParameters?.matchId;
    
    if (!matchId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Match ID is required' })
      };
    }

    // Parse request body for score snapshot if provided
    let scoreSnapshot = null;
    if (event.body) {
      const body = JSON.parse(event.body);
      scoreSnapshot = body.scoreSnapshot;
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

    // Fetch match details with player information
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        player1:profiles!matches_player1_id_fkey(username, elo_rating, skill_level),
        player2:profiles!matches_player2_id_fkey(username, elo_rating, skill_level),
        winner:profiles!matches_winner_id_fkey(username)
      `)
      .eq('id', matchId)
      .single();

    if (matchError) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Match not found' })
      };
    }

    // Fetch recent match events
    const { data: events, error: eventsError } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (eventsError) {
      console.error('Error fetching match events:', eventsError);
    }

    // Use provided score snapshot or get from match
    const currentScore = scoreSnapshot || match.score;
    
    // Extract match details for the prompt
    const player1Name = match.player1?.username || 'Player 1';
    const player2Name = match.player2?.username || 'Player 2';
    
    // Format current score for display
    let scoreDisplay = '';
    let currentGameScore = '';
    let currentSetScore = '';
    
    if (currentScore && typeof currentScore === 'object') {
      try {
        // Get current game score
        currentGameScore = `${currentScore.current_game.player1}-${currentScore.current_game.player2}`;
        
        // Get set scores
        const sets = currentScore.sets || [];
        if (sets.length > 0) {
          currentSetScore = sets.map((set: any) => 
            `${set.player1_games}-${set.player2_games}`
          ).join(', ');
        }
        
        scoreDisplay = `Sets: ${currentSetScore || '0-0'}, Current Game: ${currentGameScore}`;
      } catch (err) {
        console.error('Error formatting score:', err);
        scoreDisplay = 'Score unavailable';
      }
    } else if (typeof currentScore === 'string') {
      scoreDisplay = currentScore;
    }

    // Format recent events for context
    const recentEventsText = events && events.length > 0 
      ? events.slice(0, 5).map(event => 
          `- ${new Date(event.timestamp).toLocaleTimeString()}: ${event.description}`
        ).join('\n')
      : 'No recent events available';

    // Construct prompt for Bedrock
    const prompt = `
    <human>
    You are an expert tennis umpire and commentator. Provide a brief, insightful observation about the current state of this tennis match:
    
    Player 1: ${player1Name} (Rating: ${match.player1?.elo_rating || 'Unknown'}, Skill: ${match.player1?.skill_level || 'Unknown'})
    Player 2: ${player2Name} (Rating: ${match.player2?.elo_rating || 'Unknown'}, Skill: ${match.player2?.skill_level || 'Unknown'})
    Current Score: ${scoreDisplay}
    Match Status: ${match.status}
    
    Recent Events:
    ${recentEventsText}
    
    Provide a single, concise insight (maximum 2 sentences) that a tennis umpire or commentator might make about the current state of play, momentum, or strategy. Focus on being helpful to the players or spectators. Be specific to the current match situation.
    </human>
    `;

    // Call Amazon Bedrock to generate the insight
    const modelId = 'anthropic.claude-3-sonnet-20240229-v1:0'; // Using Claude 3 Sonnet
    
    const bedrockParams = {
      modelId: modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 100,
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
    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    console.log('Bedrock response:', JSON.stringify(responseBody, null, 2));
    
    let generatedInsight = '';
    
    // Handle different response formats based on the model
    if (responseBody.content && Array.isArray(responseBody.content)) {
      // Claude 3 format
      generatedInsight = responseBody.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('');
    } else if (responseBody.completion) {
      // Claude 2 format
      generatedInsight = responseBody.completion;
    } else {
      throw new Error('Unexpected response format from Bedrock');
    }
    
    // Clean up the insight
    generatedInsight = generatedInsight.trim();
    
    // Return success response with the generated insight
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true, 
        data: { 
          insight: generatedInsight,
          matchId: matchId,
          timestamp: new Date().toISOString()
        }
      })
    };
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred',
        details: error.message
      })
    };
  }
};