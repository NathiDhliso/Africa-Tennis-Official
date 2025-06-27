import { handler } from '../generate-player-style/index';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock the Bedrock client
const mockBedrockSend = jest.fn();
const mockBedrockClient = {
  send: mockBedrockSend,
};

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => mockBedrockClient),
  InvokeModelCommand: jest.fn(),
}));

describe('GeneratePlayerStyleFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should generate a player style analysis', async () => {
    // Mock player profile data
    const mockProfile = {
      user_id: 'player1',
      username: 'John Doe',
      elo_rating: 1500,
      matches_played: 20,
      matches_won: 12,
      skill_level: 'intermediate',
      bio: 'Tennis enthusiast from Johannesburg',
      player_style_analysis: null
    };
    
    // Mock matches data
    const mockMatches = [
      {
        id: 'match1',
        player1_id: 'player1',
        player2_id: 'player2',
        winner_id: 'player1',
        player1: { username: 'John Doe', elo_rating: 1500 },
        player2: { username: 'Jane Smith', elo_rating: 1450 },
        date: new Date().toISOString()
      }
    ];
    
    // Mock tournaments data
    const mockTournaments = [
      {
        player_id: 'player1',
        tournament: {
          id: 'tourney1',
          name: 'Local Championship',
          format: 'single_elimination',
          status: 'completed'
        }
      }
    ];
    
    // Mock player stats data
    const mockPlayerStats = {
      user_id: 'player1',
      win_rate_vs_higher_elo: 40.0,
      win_rate_vs_lower_elo: 75.0,
      avg_tournament_placement: 3
    };
    
    mockSupabase.single.mockImplementation((table) => {
      if (table === 'profiles') {
        return { data: mockProfile, error: null };
      } else if (table === 'player_stats') {
        return { data: mockPlayerStats, error: null };
      }
      return { data: null, error: { message: 'Not found' } };
    });
    
    mockSupabase.limit.mockImplementation((table) => {
      if (table === 'matches') {
        return { data: mockMatches, error: null };
      } else if (table === 'tournament_participants') {
        return { data: mockTournaments, error: null };
      }
      return { data: [], error: null };
    });
    
    // Mock Bedrock response
    const mockBedrockResponse = {
      body: Buffer.from(JSON.stringify({
        content: [
          {
            type: 'text',
            text: 'John Doe is a solid intermediate player with a balanced all-court game. His 60% win rate demonstrates consistent performance, particularly excelling against lower-rated opponents (75% win rate). As a baseline player, he relies on steady groundstrokes and good court coverage rather than an overpowering serve. His tournament experience shows he can handle competitive pressure, typically finishing in the top positions. To advance to advanced level, John should focus on developing a more aggressive net game and improving his win rate against higher-rated players (currently 40%). His playing style is reminiscent of consistent tour professionals who grind out points rather than seeking quick winners.'
          }
        ]
      })),
    };
    mockBedrockSend.mockResolvedValue(mockBedrockResponse);
    
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { playerId: 'player1' },
    };
    
    const result = await handler(event as APIGatewayProxyEvent);
    
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.playerStyleAnalysis).toBeDefined();
    expect(mockBedrockSend).toHaveBeenCalled();
    expect(mockSupabase.update).toHaveBeenCalled();
  });
  
  it('should return existing player style analysis if already generated', async () => {
    const mockProfile = {
      user_id: 'player1',
      username: 'John Doe',
      player_style_analysis: 'Existing style analysis'
    };
    
    mockSupabase.single.mockResolvedValue({ data: mockProfile, error: null });
    
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { playerId: 'player1' },
    };
    
    const result = await handler(event as APIGatewayProxyEvent);
    
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data.playerStyleAnalysis).toBe('Existing style analysis');
    expect(mockBedrockSend).not.toHaveBeenCalled();
  });
  
  it('should return a 404 error if player is not found', async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { playerId: 'nonexistent' },
    };
    
    const result = await handler(event as APIGatewayProxyEvent);
    
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Player not found');
  });
});