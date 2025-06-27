import { handler } from '../update-score/index';
import { createClient } from '@supabase/supabase-js';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the Supabase client
const mockSupabase = {
  rpc: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('UpdateScoreFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should successfully update the score', async () => {
    const updatedScore = { sets: [], current_game: { player1: '15', player2: '0' } };
    mockSupabase.rpc.mockResolvedValue({ data: updatedScore, error: null });

    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { matchId: 'match1' },
      body: JSON.stringify({
        winningPlayerId: 'player1',
        pointType: 'point_won',
      }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data).toEqual(updatedScore);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('calculate_tennis_score', {
      match_id: 'match1',
      winning_player_id: 'player1',
      point_type: 'point_won',
    });
  });

  it('should return a 400 error if matchId is missing', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: {},
      body: JSON.stringify({ winningPlayerId: 'player1' }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('Match ID is required');
  });

  it('should return a 500 error if Supabase RPC call fails', async () => {
    const supabaseError = { message: 'RPC call failed' };
    mockSupabase.rpc.mockResolvedValue({ data: null, error: supabaseError });

    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { matchId: 'match1' },
      body: JSON.stringify({ winningPlayerId: 'player1' }),
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe(supabaseError.message);
  });
});
