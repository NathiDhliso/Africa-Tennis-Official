import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,GET'
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Get environment variables to check configuration
    const supabaseUrl = process.env.SUPABASE_URL;
    const frontendUrl = process.env.FRONTEND_URL;
    
    // Check if Bedrock is available
    let bedrockStatus = 'unknown';
    try {
      const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });
      bedrockStatus = 'available';
    } catch (error) {
      console.error('Bedrock client initialization error:', error);
      bedrockStatus = 'unavailable';
    }
    
    // Return health status
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: {
          supabaseConfigured: !!supabaseUrl,
          frontendConfigured: !!frontendUrl,
          region: process.env.AWS_REGION || 'unknown',
          bedrockStatus: bedrockStatus
        },
        version: '1.0.0'
      })
    };
  } catch (error) {
    console.error('Health check error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'unhealthy',
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      })
    };
  }
};