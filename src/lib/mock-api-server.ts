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
    const mockAnalysis = `**Playing Style Analysis for Player ${playerId}**

**Strengths:**
• Consistent baseline play with strong groundstrokes
• Excellent court positioning and movement
• Strong mental game and match composure
• Effective serve placement and variety

**Areas for Improvement:**
• Net play and volleys could be more aggressive
• Return of serve positioning needs refinement
• Fitness and endurance for longer matches
• Tactical variety in shot selection

**Recommended Training Focus:**
1. **Technical:** Practice approach shots and net play drills
2. **Tactical:** Work on serve-and-volley patterns
3. **Physical:** Increase cardiovascular endurance training
4. **Mental:** Develop pre-point routines for consistency

**Playing Style:** Aggressive baseline player with strong defensive capabilities. Shows excellent court coverage and shot consistency, but could benefit from more offensive net play to finish points earlier.`;

    res.json({
      success: true,
      data: {
        playerStyleAnalysis: mockAnalysis
      }
    });
  }, 2000);
});

// Mock Match Summary Generation
app.post('/matches/:matchId/generate-summary', (req, res) => {
  const { matchId } = req.params;
  
  // Simulate processing delay
  setTimeout(() => {
    const mockSummary = `In an exciting match at Center Court, Player A showcased exceptional skill against Player B, securing a decisive victory with a score of 6-4, 7-5. 

Player A's powerful serves, registering 8 aces throughout the match, proved to be a significant advantage. Their baseline game was particularly strong, with 24 winners compared to Player B's 18.

The first set saw Player A break serve in the 7th game, maintaining that advantage to close out 6-4. The second set was more competitive, with Player B fighting back from an early break to level at 5-5, before Player A's experience showed in the crucial moments, breaking again and serving out for the match.

This victory marks Player A's third consecutive win this season, demonstrating their excellent form and positioning them well for upcoming tournaments.`;

    res.json({
      success: true,
      data: {
        summary: mockSummary
      }
    });
  }, 3000);
});

// Mock Umpire Insight
app.post('/matches/:matchId/umpire-insight', (req, res) => {
  const { matchId } = req.params;
  const { scoreSnapshot } = req.body || {};
  
  // Simulate processing delay
  setTimeout(() => {
    const insights = [
      "Player A is showing excellent first serve percentage in this game, putting pressure on the returner.",
      "Player B's backhand down the line has been particularly effective in the last few points.",
      "The longer rallies are favoring Player A, who seems to have better court coverage today.",
      "Player B might want to consider approaching the net more often to disrupt Player A's rhythm.",
      "Player A's second serve is becoming predictable - mostly going to the backhand side.",
      "Player B is showing signs of fatigue, taking more time between points.",
      "Player A has won 8 of the last 10 points, showing a clear momentum shift.",
      "Player B's slice backhand is effectively neutralizing Player A's aggressive forehand."
    ];
    
    // Select a random insight based on match ID to simulate different insights
    const randomIndex = parseInt(matchId.slice(-2), 16) % insights.length;
    
    res.json({
      success: true,
      data: {
        insight: insights[randomIndex],
        matchId: matchId,
        timestamp: new Date().toISOString()
      }
    });
  }, 1500);
});

// Mock Tournament Bracket Generation
app.post('/tournaments/:tournamentId/generate-bracket', (req, res) => {
  const { tournamentId } = req.params;
  
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
    // Create a mock tennis score object
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
  
  // Create mock matches data
  const mockMatches = [
    {
      id: '1',
      player1_id: userId,
      player2_id: 'opponent-1',
      player1: { username: 'You', elo_rating: 1500 },
      player2: { username: 'John Doe', elo_rating: 1450 },
      date: new Date(Date.now() + 86400000).toISOString(), // tomorrow
      location: 'Center Court, Johannesburg',
      status: 'pending',
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      player1_id: 'opponent-2',
      player2_id: userId,
      player1: { username: 'Jane Smith', elo_rating: 1550 },
      player2: { username: 'You', elo_rating: 1500 },
      date: new Date(Date.now() - 86400000).toISOString(), // yesterday
      location: 'Tennis Club, Pretoria',
      status: 'completed',
      winner_id: userId,
      winner: { username: 'You' },
      score: {
        sets: [
          { player1_games: 4, player2_games: 6 },
          { player1_games: 3, player2_games: 6 }
        ],
        current_game: { player1: '0', player2: '0' },
        server_id: userId,
        is_tiebreak: false
      },
      created_at: new Date(Date.now() - 172800000).toISOString() // 2 days ago
    },
    {
      id: '3',
      player1_id: userId,
      player2_id: 'opponent-3',
      player1: { username: 'You', elo_rating: 1500 },
      player2: { username: 'Michael Johnson', elo_rating: 1600 },
      date: new Date().toISOString(), // today
      location: 'Community Courts, Cape Town',
      status: 'in_progress',
      created_at: new Date(Date.now() - 43200000).toISOString() // 12 hours ago
    }
  ];
  
  res.json({
    success: true,
    data: mockMatches
  });
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