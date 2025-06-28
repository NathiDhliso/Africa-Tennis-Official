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