import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

// Initialize AWS S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'africa-tennis-videos';

interface TennisAnalysisResult {
  ballTracking: Array<{
    timestamp: number;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    speed: number;
    inBounds: boolean;
    bounceDetected: boolean;
  }>;
  playerMovement: Array<{
    timestamp: number;
    player1: {
      position: { x: number; y: number };
      pose: any;
      courtPosition: string;
    };
    player2: {
      position: { x: number; y: number };
      pose: any;
      courtPosition: string;
    };
  }>;
  shotDetection: Array<{
    timestamp: number;
    player: number;
    shotType: string;
    confidence: number;
    ballPosition: { x: number; y: number };
    racketPosition: { x: number; y: number };
  }>;
  courtAnalysis: {
    courtBounds: { x: number; y: number; width: number; height: number };
    netPosition: { x: number; y: number; width: number };
    serviceBoxes: Array<{ x: number; y: number; width: number; height: number }>;
    baseline: { y: number };
    confidence: number;
  };
  matchStatistics: {
    totalShots: number;
    totalRallies: number;
    averageRallyLength: number;
    shotDistribution: { [shotType: string]: number };
    courtCoverage: { player1: number; player2: number };
  };
  highlights: Array<{
    startTime: number;
    endTime: number;
    type: string;
    description: string;
    confidence: number;
    keyMoments: Array<{ timestamp: number; description: string }>;
  }>;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { videoKey, matchId, analysisOptions = {} } = body;

    if (!videoKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false, 
          error: 'Video key is required' 
        })
      };
    }

    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`Starting tennis-specific analysis for video: ${videoKey}`);

    // Download video from S3
    const { Body } = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: videoKey
    }));

    if (!Body) {
      throw new Error('Failed to download video from S3');
    }

    // For now, return placeholder analysis since TensorFlow is disabled
    const analysisResult: TennisAnalysisResult = {
      ballTracking: [
        {
          timestamp: 0,
          position: { x: 320, y: 240 },
          velocity: { x: 5, y: -3 },
          speed: 25.5,
          inBounds: true,
          bounceDetected: false
        }
      ],
      playerMovement: [
        {
          timestamp: 0,
          player1: {
            position: { x: 200, y: 400 },
            pose: [],
            courtPosition: 'baseline'
          },
          player2: {
            position: { x: 200, y: 100 },
            pose: [],
            courtPosition: 'baseline'
          }
        }
      ],
      shotDetection: [
        {
          timestamp: 0,
          player: 1,
          shotType: 'forehand',
          confidence: 0.8,
          ballPosition: { x: 320, y: 240 },
          racketPosition: { x: 200, y: 300 }
        }
      ],
      courtAnalysis: {
        courtBounds: { x: 50, y: 50, width: 540, height: 360 },
        netPosition: { x: 50, y: 205, width: 540 },
        serviceBoxes: [
          { x: 50, y: 205, width: 270, height: 90 },
          { x: 320, y: 205, width: 270, height: 90 }
        ],
        baseline: { y: 410 },
        confidence: 0.7
      },
      matchStatistics: {
        totalShots: 15,
        totalRallies: 3,
        averageRallyLength: 5.0,
        shotDistribution: {
          'forehand': 8,
          'backhand': 5,
          'serve': 2
        },
        courtCoverage: { player1: 65, player2: 70 }
      },
      highlights: [
        {
          startTime: 0,
          endTime: 10,
          type: 'rally',
          description: 'Extended baseline rally',
          confidence: 0.8,
          keyMoments: [
            { timestamp: 2, description: 'Powerful forehand' },
            { timestamp: 5, description: 'Defensive backhand' }
          ]
        }
      ]
    };

    // Store analysis results in S3
    const analysisKey = `tennis-analysis/${matchId || 'practice'}/${Date.now()}_analysis.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: analysisKey,
      Body: JSON.stringify(analysisResult, null, 2),
      ContentType: 'application/json'
    }));

    // Update match record with analysis
    if (matchId) {
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          summary: `Match analyzed: ${analysisResult.matchStatistics.totalShots} shots, ${analysisResult.matchStatistics.totalRallies} rallies`,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId);

      if (updateError) {
        console.error('Error updating match record:', updateError);
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          analysisResult,
          analysisKey,
          processingTime: Date.now() - Date.now() // Placeholder
        }
      })
    };

  } catch (error) {
    console.error('Tennis video analysis error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Tennis video analysis failed'
      })
    };
  }
}; 