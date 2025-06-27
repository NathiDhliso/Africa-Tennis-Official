import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
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
    // Get tournament ID from path parameters
    const tournamentId = event.pathParameters?.tournamentId;
    
    if (!tournamentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Tournament ID is required' })
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

    // 1. Fetch the tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tournamentError) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Tournament not found' })
      };
    }

    // 2. Verify tournament status is registration_closed
    if (tournament.status !== 'registration_closed') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false, 
          error: `Tournament must be in 'registration_closed' status to generate brackets. Current status: ${tournament.status}` 
        })
      };
    }

    // 3. Fetch all registered players
    const { data: participants, error: participantsError } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        player:profiles!tournament_participants_player_id_fkey(user_id, username, elo_rating)
      `)
      .eq('tournament_id', tournamentId);

    if (participantsError) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Failed to fetch tournament participants' })
      };
    }

    if (!participants || participants.length < 2) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Tournament needs at least 2 participants' })
      };
    }

    // 4. Seed players by ELO rating
    const seededParticipants = [...participants].sort((a, b) => 
      (b.player?.elo_rating || 0) - (a.player?.elo_rating || 0)
    );

    // 5. Update seed numbers in tournament_participants table
    for (let i = 0; i < seededParticipants.length; i++) {
      const { error: updateError } = await supabase
        .from('tournament_participants')
        .update({ seed: i + 1 })
        .eq('id', seededParticipants[i].id);
      
      if (updateError) {
        console.error(`Failed to update seed for participant ${seededParticipants[i].id}:`, updateError);
      }
    }

    // 6. Generate matches based on tournament format
    const matches = [];
    const now = new Date();
    const tournamentStartDate = new Date(tournament.start_date);
    
    switch (tournament.format) {
      case 'single_elimination':
        matches.push(...generateSingleEliminationMatches(
          tournamentId,
          seededParticipants,
          tournamentStartDate
        ));
        break;
      
      case 'double_elimination':
        matches.push(...generateDoubleEliminationMatches(
          tournamentId,
          seededParticipants,
          tournamentStartDate
        ));
        break;
      
      case 'round_robin':
        matches.push(...generateRoundRobinMatches(
          tournamentId,
          seededParticipants,
          tournamentStartDate
        ));
        break;
      
      default:
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: `Unsupported tournament format: ${tournament.format}` })
        };
    }

    // 7. Insert matches into the database
    if (matches.length > 0) {
      const { error: matchesError } = await supabase
        .from('matches')
        .insert(matches);

      if (matchesError) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: 'Failed to create tournament matches' })
        };
      }
    }

    // 8. Update tournament status to in_progress
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ status: 'in_progress' })
      .eq('id', tournamentId);

    if (updateError) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Failed to update tournament status' })
      };
    }

    // Return success response with match count
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true, 
        data: { 
          matchesCreated: matches.length,
          tournamentStatus: 'in_progress'
        }
      })
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

// Helper function to generate single elimination tournament matches
function generateSingleEliminationMatches(
  tournamentId: string,
  participants: any[],
  startDate: Date
): any[] {
  const matches = [];
  const numParticipants = participants.length;
  
  // Calculate the number of rounds needed
  const numRounds = Math.ceil(Math.log2(numParticipants));
  
  // Calculate the number of first-round matches
  const numFirstRoundMatches = Math.pow(2, numRounds - 1);
  
  // Calculate the number of byes needed
  const numByes = numFirstRoundMatches * 2 - numParticipants;
  
  // Create first round matches with seeded participants
  let matchNumber = 1;
  
  // Seed the bracket using standard tournament seeding
  const seededPositions = generateSeededPositions(numFirstRoundMatches * 2);
  
  for (let i = 0; i < numFirstRoundMatches; i++) {
    const position1 = seededPositions[i * 2];
    const position2 = seededPositions[i * 2 + 1];
    
    const player1 = position1 <= numParticipants ? participants[position1 - 1] : null;
    const player2 = position2 <= numParticipants ? participants[position2 - 1] : null;
    
    // If both players are null (shouldn't happen in proper seeding), skip this match
    if (!player1 && !player2) continue;
    
    // If one player is null, the other gets a bye (handled in later rounds)
    if (!player1 || !player2) continue;
    
    // Calculate match date (staggered throughout the tournament)
    const matchDate = new Date(startDate);
    matchDate.setHours(startDate.getHours() + (i % 4) * 2); // Stagger matches by 2 hours
    
    matches.push({
      tournament_id: tournamentId,
      player1_id: player1.player.user_id,
      player2_id: player2.player.user_id,
      status: 'pending',
      date: matchDate.toISOString(),
      location: 'Main Court', // This could be more sophisticated
      round: 1,
      match_number: matchNumber++
    });
  }
  
  return matches;
}

// Helper function to generate double elimination tournament matches
function generateDoubleEliminationMatches(
  tournamentId: string,
  participants: any[],
  startDate: Date
): any[] {
  // For now, we'll just create the winners bracket like single elimination
  // In a real implementation, you'd also set up the losers bracket structure
  return generateSingleEliminationMatches(tournamentId, participants, startDate);
}

// Helper function to generate round robin tournament matches
function generateRoundRobinMatches(
  tournamentId: string,
  participants: any[],
  startDate: Date
): any[] {
  const matches = [];
  const numParticipants = participants.length;
  let matchNumber = 1;
  
  // Generate a match for each pair of participants
  for (let i = 0; i < numParticipants; i++) {
    for (let j = i + 1; j < numParticipants; j++) {
      // Calculate match date (staggered throughout the tournament)
      const matchDate = new Date(startDate);
      const matchIndex = matchNumber - 1;
      matchDate.setHours(startDate.getHours() + Math.floor(matchIndex / 4) * 2); // 4 matches per time slot
      matchDate.setDate(startDate.getDate() + Math.floor(matchIndex / 8)); // 8 matches per day
      
      matches.push({
        tournament_id: tournamentId,
        player1_id: participants[i].player.user_id,
        player2_id: participants[j].player.user_id,
        status: 'pending',
        date: matchDate.toISOString(),
        location: 'Court ' + ((matchNumber % 3) + 1), // Distribute across courts
        round: 1, // All matches are considered round 1 in round robin
        match_number: matchNumber++
      });
    }
  }
  
  return matches;
}

// Helper function to generate seeded positions for a bracket
function generateSeededPositions(numPositions: number): number[] {
  if (numPositions <= 1) return [1];
  
  const positions = Array(numPositions).fill(0);
  positions[0] = 1; // Top seed
  positions[numPositions - 1] = 2; // Second seed
  
  if (numPositions <= 2) return positions;
  
  // Place 3rd and 4th seeds
  positions[numPositions / 2] = 3;
  positions[numPositions / 2 - 1] = 4;
  
  // For larger tournaments, we would continue with more sophisticated seeding
  // but this is sufficient for basic implementation
  
  // Fill remaining positions
  let currentSeed = 5;
  for (let i = 0; i < numPositions; i++) {
    if (positions[i] === 0) {
      positions[i] = currentSeed++;
    }
  }
  
  return positions;
}