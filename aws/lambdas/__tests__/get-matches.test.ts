import { handler } from '../get-matches/index';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  or: jest.fn(),
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('GetMatchesFunction', () => {
  beforeEach(() => {
    // Clear all mock implementations and calls before each test
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('should return matches for a valid user ID', async () => {
    const mockMatches = [{ id: 'match1', player1_id: 'user1' }];
    mockSupabase.or.mockResolvedValue({ data: mockMatches, error: null });

    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'GET',
      queryStringParameters: {
        userId: 'user1',
      },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).data).toEqual(mockMatches);
    expect(mockSupabase.from).toHaveBeenCalledWith('matches');
    expect(mockSupabase.or).toHaveBeenCalledWith('player1_id.eq.user1,player2_id.eq.user1');
  });

  it('should return a 400 error if userId is missing', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'GET',
      queryStringParameters: {},
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('userId query parameter is required');
  });

  it('should return a 500 error if Supabase query fails', async () => {
    const supabaseError = { message: 'Supabase query failed' };
    mockSupabase.or.mockResolvedValue({ data: null, error: supabaseError });

    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'GET',
      queryStringParameters: {
        userId: 'user1',
      },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toContain(supabaseError.message);
  });
});
