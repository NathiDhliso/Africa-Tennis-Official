import { createClient } from '@supabase/supabase-js';

interface Player {
  user_id: string;
  username: string;
  elo_rating: number;
  seed?: number;
}

interface BracketMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id?: string;
  player2_id?: string;
  winner_id?: string;
  score?: string;
  status: 'pending' | 'in_progress' | 'completed';
  scheduled_date?: string;
  location: string;
}

interface Tournament {
  id: string;
  name: string;
  format: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss';
  max_participants: number;
  status: string;
  location: string;
}

export const handler = async (event: {
  pathParameters?: { tournamentId?: string };
  queryStringParameters?: Record<string, string>;
  httpMethod?: string;
}): Promise<{
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

    // Extract tournament ID from path parameters
    const tournamentId = event.pathParameters?.tournamentId;
    
    if (!tournamentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Tournament ID is required'
        })
      };
    }

    // Fetch tournament details
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Tournament not found'
        })
      };
    }

    // Check if tournament is in the right state to generate bracket
    if (tournament.status !== 'registration_closed') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Tournament registration must be closed before generating bracket'
        })
      };
    }

    // Fetch tournament participants with their profiles
    const { data: participants, error: participantsError } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        profiles (
          user_id,
          username,
          elo_rating
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('seed', { ascending: true });

    if (participantsError) {
      throw new Error(`Failed to fetch participants: ${participantsError.message}`);
    }

    if (!participants || participants.length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'At least 2 participants required to generate bracket'
        })
      };
    }

    // Convert participants to players
    const players: Player[] = participants.map((p: {
      profiles: { user_id: string; username: string; elo_rating: number };
      seed?: number;
    }) => ({
      user_id: p.profiles.user_id,
      username: p.profiles.username,
      elo_rating: p.profiles.elo_rating,
      seed: p.seed || undefined
    }));

    // Generate bracket based on tournament format
    let matches: BracketMatch[] = [];
    
    switch (tournament.format) {
      case 'single_elimination':
        matches = generateSingleEliminationBracket(players, tournament);
        break;
      case 'round_robin':
        matches = generateRoundRobinBracket(players, tournament);
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Tournament format ${tournament.format} not yet supported`
          })
        };
    }

    // Insert matches into database
    if (matches.length > 0) {
      const { error: matchInsertError } = await supabase
        .from('matches')
        .insert(matches);

      if (matchInsertError) {
        throw new Error(`Failed to create matches: ${matchInsertError.message}`);
      }
    }

    // Update tournament status to in_progress
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ 
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', tournamentId);

    if (updateError) {
      throw new Error(`Failed to update tournament status: ${updateError.message}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        data: { 
          tournamentId,
          format: tournament.format,
          participantCount: players.length,
          matchCount: matches.length,
          message: 'Tournament bracket generated successfully'
        }
      })
    };

  } catch (error: unknown) {
    console.error('Error generating tournament bracket:', error);
    
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

function generateSingleEliminationBracket(players: Player[], tournament: Tournament): BracketMatch[] {
  const matches: BracketMatch[] = [];
  const matchDate = new Date();
  matchDate.setDate(matchDate.getDate() + 1); // Schedule for tomorrow
  
  // Calculate number of rounds needed
  const numPlayers = players.length;
  const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
  
  // First round matches
  const firstRoundMatches = Math.floor(nextPowerOfTwo / 2);
  
  // If we have exactly a power of 2 players, create all first round matches
  // Otherwise, some players get byes to the second round
  if (numPlayers === nextPowerOfTwo) {
    // Perfect bracket - all players play in first round
    for (let i = 0; i < firstRoundMatches; i++) {
      const player1 = players[i * 2];
      const player2 = players[i * 2 + 1];
      
      matches.push({
        id: `${tournament.id}-r1-m${i + 1}`,
        tournament_id: tournament.id,
        round: 1,
        match_number: i + 1,
        player1_id: player1.user_id,
        player2_id: player2.user_id,
        status: 'pending',
        scheduled_date: matchDate.toISOString(),
        location: tournament.location
      });
    }
  } else {
    // Some players get byes - top seeded players should get byes
    const playersWithByes = nextPowerOfTwo - numPlayers;
    const playersInFirstRound = numPlayers - playersWithByes;
    
    // Create first round matches for players without byes
    for (let i = 0; i < Math.floor(playersInFirstRound / 2); i++) {
      const player1 = players[playersWithByes + i * 2];
      const player2 = players[playersWithByes + i * 2 + 1];
    
    matches.push({
        id: `${tournament.id}-r1-m${i + 1}`,
        tournament_id: tournament.id,
        round: 1,
        match_number: i + 1,
        player1_id: player1.user_id,
        player2_id: player2.user_id,
      status: 'pending',
        scheduled_date: matchDate.toISOString(),
        location: tournament.location
    });
  }
}

  // Generate subsequent rounds (placeholders for winners)
  const totalRounds = Math.ceil(Math.log2(nextPowerOfTwo));
  
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = Math.pow(2, totalRounds - round);
    const roundDate = new Date(matchDate);
    roundDate.setDate(roundDate.getDate() + round - 1);
    
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        id: `${tournament.id}-r${round}-m${i + 1}`,
        tournament_id: tournament.id,
        round,
        match_number: i + 1,
        status: 'pending',
        scheduled_date: roundDate.toISOString(),
        location: tournament.location
      });
    }
  }
  
  return matches;
}

function generateRoundRobinBracket(players: Player[], tournament: Tournament): BracketMatch[] {
  const matches: BracketMatch[] = [];
  const matchDate = new Date();
  matchDate.setDate(matchDate.getDate() + 1);
  
  let matchNumber = 1;
  
  // Generate all possible pairings
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const roundDate = new Date(matchDate);
      roundDate.setDate(roundDate.getDate() + Math.floor((matchNumber - 1) / 3)); // Spread matches over multiple days
      
      matches.push({
        id: `${tournament.id}-rr-m${matchNumber}`,
        tournament_id: tournament.id,
        round: 1, // All matches are in "round 1" for round robin
        match_number: matchNumber,
        player1_id: players[i].user_id,
        player2_id: players[j].user_id,
        status: 'pending',
        scheduled_date: roundDate.toISOString(),
        location: tournament.location
      });
      
      matchNumber++;
    }
  }
  
  return matches;
}