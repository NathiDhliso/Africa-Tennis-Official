import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

interface VideoAnalysisResult {
  ballTracking: Array<{
    timestamp: number;
    position: { x: number; y: number };
    speed: number;
    inBounds: boolean;
  }>;
  playerPositions: Array<{
    timestamp: number;
    players: Array<{
      id: string;
      position: { x: number; y: number };
      pose: Record<string, unknown>;
    }>;
  }>;
  courtDetection: {
    lines: Record<string, unknown>[];
    regions: Record<string, unknown>;
    confidence: number;
  };
  highlights: Array<{
    startTime: number;
    endTime: number;
    type: string;
    description: string;
    confidence: number;
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
    const { videoData, matchId, userId, analysisOptions = {} } = body;

    if (!videoData || !userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: false, 
          error: 'Video data and user ID are required' 
        })
      };
    }

    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const timestamp = Date.now();
    const videoKey = `raw/${userId}/${matchId || 'practice'}/${timestamp}.webm`;
    const processedVideoKey = `processed/${userId}/${matchId || 'practice'}/${timestamp}.mp4`;
    const thumbnailKey = `thumbnails/${userId}/${matchId || 'practice'}/${timestamp}.jpg`;
    const analyticsKey = `analytics/${userId}/${matchId || 'practice'}/${timestamp}.json`;

    // Step 1: Upload raw video to S3
    const videoBuffer = Buffer.from(videoData, 'base64');
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: videoKey,
      Body: videoBuffer,
      ContentType: 'video/webm',
      Metadata: {
        userId,
        matchId: matchId || '',
        uploadTime: timestamp.toString()
      }
    }));

    // Step 2: For now, use the same video as "processed" (no compression)
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: processedVideoKey,
      Body: videoBuffer,
      ContentType: 'video/mp4',
      Metadata: {
        originalSize: videoBuffer.length.toString(),
        compressedSize: videoBuffer.length.toString(),
        compressionRatio: '0'
      }
    }));

    // Step 3: Generate placeholder thumbnail
    const thumbnailBuffer = Buffer.from('placeholder-thumbnail', 'utf-8');
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg'
    }));

    // Step 4: Perform placeholder AI analysis
    let analysisResult: VideoAnalysisResult | null = null;
    if (analysisOptions.enableAI !== false) {
      analysisResult = {
        ballTracking: [{
          timestamp: 0,
          position: { x: 320, y: 240 },
          speed: 0,
          inBounds: true
        }],
        playerPositions: [{
          timestamp: 0,
          players: [{
            id: 'player_1',
            position: { x: 200, y: 300 },
            pose: []
          }]
        }],
        courtDetection: {
          lines: [],
          regions: { service_box: true, baseline: true },
          confidence: 0.5
        },
        highlights: [{
          startTime: 0,
          endTime: 5,
          type: 'rally',
          description: 'Placeholder highlight',
          confidence: 0.5
        }]
      };
      
      // Store analysis results
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: analyticsKey,
        Body: JSON.stringify(analysisResult, null, 2),
        ContentType: 'application/json'
      }));
    }

    // Step 5: Update database with processed video info
    const videoRecord = {
      match_id: matchId,
      created_by: userId,
      video_url: processedVideoKey,
      thumbnail_url: thumbnailKey,
      analytics_url: analyticsKey,
      type: analysisResult?.highlights[0]?.type || 'general',
      description: analysisResult?.highlights[0]?.description || 'Tennis video highlight',
      metadata: {
        originalSize: videoBuffer.length,
        compressedSize: videoBuffer.length,
        compressionRatio: '0',
        analysisEnabled: analysisOptions.enableAI !== false,
        duration: analysisOptions.duration || 0
      }
    };

    const { error: dbError } = await supabase
      .from('match_highlights')
      .insert(videoRecord);

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save video record to database');
    }

    // Step 6: Generate URLs for frontend access
    const videoUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${processedVideoKey}`;
    const thumbnailUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${thumbnailKey}`;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          videoUrl,
          thumbnailUrl,
          originalSize: videoBuffer.length,
          compressedSize: videoBuffer.length,
          compressionRatio: '0',
          analysis: analysisResult,
          processingTime: Date.now() - timestamp
        }
      })
    };

  } catch (error) {
    console.error('Video processing error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Video processing failed'
      })
    };
  }
};