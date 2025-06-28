import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Set Content-Security-Policy header for all responses
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' *;"
  );
  next();
});

// Mock AI Coach endpoint - Player Style Analysis
app.post('/players/:playerId/generate-style', (req, res) => {
  const { playerId } = req.params;
  
  // Simulate processing delay
  setTimeout(() => {
    res.json({
      success: true,
      data: {
        playerStyleAnalysis: "This player demonstrates a balanced all-court game with strong baseline consistency. Their forehand is their primary weapon, showing good depth and placement. Backhand is solid but could be more aggressive in attacking opportunities. Serve is reliable rather than dominant, with good placement compensating for moderate power. At the net, they show decent volleying skills but could improve their approach shots. Mental game is strong, particularly in pressure situations. To advance further, focus should be on developing a more aggressive transition game and improving second serve consistency."
      }
    });
  }, 2000);
});

// Mock Match Summary Generation
app.post('/matches/:matchId/generate-summary', (req, res) => {
  const { matchId } = req.params;
  
  // Simulate processing delay
  setTimeout(() => {
    res.json({
      success: true,
      data: {
        summary: "In an exciting match at Center Court, the players showcased exceptional skill and determination. The match featured powerful serving, with several aces and strong baseline rallies. The first set was tightly contested with both players holding serve until a crucial break point was converted. The second set saw more aggressive play with impressive winners from both sides. The match demonstrated excellent court coverage and tactical awareness, particularly in the key moments. This victory marks another strong performance in what has been an impressive season so far."
      }
    });
  }, 3000);
});

// Mock Umpire Insight
app.post('/matches/:matchId/umpire-insight', (req, res) => {
  const { matchId } = req.params;
  const { scoreSnapshot } = req.body || {};
  
  console.log(`Mock API: Generating umpire insight for match ${matchId}`);
  
  // Simulate processing delay
  setTimeout(() => {
    res.json({
      success: true,
      data: {
        insight: "The server is showing excellent placement on their first serve, consistently pulling the returner wide to create open court opportunities.",
        matchId: matchId,
        timestamp: new Date().toISOString()
      }
    });
  }, 1500);
});

// Mock Tournament Bracket Generation
app.post('/tournaments/:tournamentId/generate-bracket', (req, res) => {
  const { tournamentId } = req.params;
  
  console.log(`Mock API: Generating bracket for tournament ${tournamentId}`);
  
  // Simulate processing delay
  setTimeout(() => {
    res.json({
      success: true,
      data: {
        tournamentId,
        format: "single_elimination",
        participantCount: 8,
        matchCount: 7,
        matchesCreated: 7,
        message: "Tournament bracket generated successfully"
      }
    });
  }, 2500);
});

// Mock Score Update
app.post('/matches/:matchId/score', (req, res) => {
  const { matchId } = req.params;
  const { winningPlayerId, pointType } = req.body;
  
  console.log(`Mock API: Updating score for match ${matchId}`, { winningPlayerId, pointType });
  
  // Simulate processing delay
  setTimeout(() => {
    // Create a realistic tennis score object
    const mockScore = {
      sets: [
        {
          player1_games: 3,
          player2_games: 2,
          games: []
        }
      ],
      current_game: {
        player1: pointType === 'ace' ? '40' : '30',
        player2: '15'
      },
      server_id: winningPlayerId,
      is_tiebreak: false
    };
    
    res.json({
      success: true,
      data: mockScore
    });
  }, 800);
});

// Mock player matches retrieval
app.get('/matches', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId query parameter is required'
    });
  }
  
  console.log(`Mock API: Getting matches for user ${userId}`);
  
  // Simulate processing delay
  setTimeout(() => {
    res.json({
      success: true,
      data: []
    });
  }, 800);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: {
      supabaseConfigured: true,
      frontendConfigured: true,
      region: 'mock-region',
      bedrockStatus: 'available'
    },
    version: '1.0.0'
  });
});

// Aggregate player stats
app.get('/aggregate-stats', (req, res) => {
  const { player_id } = req.query;
  
  if (!player_id) {
    return res.status(400).json({
      success: false,
      error: 'player_id is required'
    });
  }
  
  console.log(`Mock API: Aggregating stats for player ${player_id}`);
  
  setTimeout(() => {
    res.json({
      success: true,
      data: {
        playerId: player_id,
        totalMatches: 15,
        wins: 9,
        winRate: 60.0,
        recentForm: 70.0,
        avgOpponentElo: 1475,
        winRateVsHigherElo: 40.0,
        winRateVsLowerElo: 75.0,
        lastCalculated: new Date().toISOString()
      }
    });
  }, 1000);
});

// Catch-all route for debugging
app.use('*', (req, res) => {
  console.log(`Received request: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});

export default app;