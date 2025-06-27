import { handler } from '../generate-bracket/index';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Define a flexible mock structure with proper typing  
const fromMocks: Record<string, unknown> = {};
const mockSupabaseClient = {
  from: jest.fn((tableName: string) => fromMocks[tableName]),
};

// Mock the createClient function to return our mock client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

describe('GenerateBracketFunction', () => {
  // Use beforeEach to set up a clean mock for each test
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    // Set up the default mock behaviors for each table
    fromMocks.tournaments = {
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };
    fromMocks.tournament_participants = {
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(),
    };
    fromMocks.matches = {
      insert: jest.fn().mockResolvedValue({ error: null }),
    };
  });

  it('should generate a bracket for a valid tournament', async () => {
    const mockTournament = { id: 'tourney1', status: 'registration_closed', format: 'single_elimination', start_date: new Date().toISOString() };
    const mockParticipants = [
      { id: 'p1', player: { user_id: 'user1', elo_rating: 1500 } },
      { id: 'p2', player: { user_id: 'user2', elo_rating: 1400 } },
    ];
    
    // Configure specific mock return values for this test case
    fromMocks.tournaments.single.mockResolvedValue({ data: mockTournament, error: null });
    fromMocks.tournament_participants.eq.mockResolvedValue({ data: mockParticipants, error: null });
    
    // Correctly mock the chained .update().eq() calls
    fromMocks.tournaments.update.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    fromMocks.tournament_participants.update.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { tournamentId: 'tourney1' },
    };

    const result = await handler(event as APIGatewayProxyEvent);
    
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.matchesCreated).toBeGreaterThan(0);
    expect(fromMocks.tournaments.update).toHaveBeenCalledWith({ status: 'in_progress' });
  });

  it('should return a 400 error if tournament status is not registration_closed', async () => {
    const mockTournament = { id: 'tourney1', status: 'registration_open' };
    fromMocks.tournaments.single.mockResolvedValue({ data: mockTournament, error: null });

    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { tournamentId: 'tourney1' },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain("Tournament must be in 'registration_closed' status");
  });

  it('should return a 404 error if tournament is not found', async () => {
    fromMocks.tournaments.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      pathParameters: { tournamentId: 'nonexistent' },
    };

    const result = await handler(event as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('Tournament not found');
  });
});
