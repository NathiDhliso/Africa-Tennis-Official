import { handler } from '../generate-match-summary/index';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
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

describe('GenerateMatchSummaryFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should generate a summary for a completed match', async () => {
    // Mock match data
    const mockMatch = {
      id: 'match1',
      status: 'completed',
      player1_id: 'player1',
      player2_id: 'player2',
      winner_id: 'player1',
      score: { sets: [{ player1_games: 6, player2_games: 4 }] },
      date: new Date().toISOString(),
      location: 'Center Court',
      player1: { username: 'John Doe', elo_rating: 1500 },
      player2: { username: 'Jane Smith', elo_rating: 1450 },
      winner: { username: 'John Doe' },
      summary: null
    };
    
    mockSupabase.single.mockResolvedValue({ data: mockMatch, error: null });
    mockSupabase.update.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    
    // Mock Bedrock response
    const mockBedrockResponse = {
      body: Buffer.from(JSON.stringify({
        completion: 'This was an exciting match between John Doe and Jane Smith...'
      })),
    };
    mockBedrockSend.mockResolvedValue(mockBedrockResponse);
    
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { matchId: 'match1' },
    };
    
    const result = await handler(event as APIGatewayProxyEvent);
    
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data.summary).toBeDefined();
    expect(mockBedrockSend).toHaveBeenCalled();
    expect(mockSupabase.update).toHaveBeenCalled();
  });
  
  it('should return a 400 error if match is not completed', async () => {
    const mockMatch = {
      id: 'match1',
      status: 'in_progress',
      player1_id: 'player1',
      player2_id: 'player2',
      summary: null
    };
    
    mockSupabase.single.mockResolvedValue({ data: mockMatch, error: null });
    
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { matchId: 'match1' },
    };
    
    const result = await handler(event as APIGatewayProxyEvent);
    
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('must be completed');
  });
  
  it('should return existing summary if already generated', async () => {
    const mockMatch = {
      id: 'match1',
      status: 'completed',
      summary: 'Existing summary text'
    };
    
    mockSupabase.single.mockResolvedValue({ data: mockMatch, error: null });
    
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { matchId: 'match1' },
    };
    
    const result = await handler(event as APIGatewayProxyEvent);
    
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data.summary).toBe('Existing summary text');
    expect(mockBedrockSend).not.toHaveBeenCalled();
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
});