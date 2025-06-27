import { handler } from '../get-umpire-insight/index';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
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

describe('GetUmpireInsightFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should generate an umpire insight for a match', async () => {
    // Mock match data
    const mockMatch = {
      id: 'match1',
      player1_id: 'player1',
      player2_id: 'player2',
      status: 'in_progress',
      score: {
        sets: [{ player1_games: 3, player2_games: 2 }],
        current_game: { player1: '30', player2: '15' },
        server_id: 'player1',
        is_tiebreak: false
      },
      player1: { username: 'John Doe', elo_rating: 1500, skill_level: 'intermediate' },
      player2: { username: 'Jane Smith', elo_rating: 1450, skill_level: 'intermediate' }
    };
    
    // Mock events data
    const mockEvents = [
      {
        id: 'event1',
        match_id: 'match1',
        timestamp: new Date().toISOString(),
        event_type: 'point_won',
        player_id: 'player1',
        description: 'Point won by John Doe'
      }
    ];
    
    mockSupabase.single.mockResolvedValue({ data: mockMatch, error: null });
    mockSupabase.limit.mockResolvedValue({ data: mockEvents, error: null });
    
    // Mock Bedrock response
    const mockBedrockResponse = {
      body: Buffer.from(JSON.stringify({
        content: [
          {
            type: 'text',
            text: 'John Doe is showing excellent control on his service games, maintaining a slight advantage with that 3-2 lead in the first set. His first serve percentage has been particularly impressive in the last few points.'
          }
        ]
      })),
    };
    mockBedrockSend.mockResolvedValue(mockBedrockResponse);
    
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { matchId: 'match1' },
      body: JSON.stringify({ scoreSnapshot: mockMatch.score })
    };
    
    const result = await handler(event as APIGatewayProxyEvent);
    
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.insight).toBeDefined();
    expect(mockBedrockSend).toHaveBeenCalled();
  });
  
  it('should return a 404 error if match is not found', async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { matchId: 'nonexistent' },
    };
    
    const result = await handler(event as APIGatewayProxyEvent);
    
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Match not found');
  });
  
  it('should handle missing match ID', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: {},
    };
    
    const result = await handler(event as APIGatewayProxyEvent);
    
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Match ID is required');
  });
});