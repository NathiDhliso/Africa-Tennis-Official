import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Mock AI Coach endpoint
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

// Mock other endpoints
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Mock API server is running' });
});

app.get('/matches', (req, res) => {
  res.json({ success: true, data: [] });
});

app.post('/matches/:matchId/generate-summary', (req, res) => {
  res.json({ success: true, data: { summary: 'Mock match summary' } });
});

app.post('/matches/:matchId/umpire-insight', (req, res) => {
  res.json({ success: true, data: { insight: 'Mock umpire insight' } });
});

app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
});

export default app;