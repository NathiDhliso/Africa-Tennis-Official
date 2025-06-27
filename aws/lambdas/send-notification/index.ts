import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

// Initialize SES client
const sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

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
    // Parse webhook payload
    const payload = event.body ? JSON.parse(event.body) : {};
    
    // Validate payload
    if (!payload.record || !payload.record.id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Invalid webhook payload' })
      };
    }

    // Extract match data from the payload
    const match = payload.record;
    
    // Initialize Supabase client with service role key to bypass RLS
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Server configuration error' })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the challenged player (player2_id)
    const challengedPlayerId = match.player2_id;
    
    // Fetch the challenged player's profile to get their email
    const { data: challengedPlayer, error: playerError } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', challengedPlayerId)
      .single();

    if (playerError) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Challenged player not found' })
      };
    }

    // Fetch the challenger's profile
    const { data: challengerPlayer, error: challengerError } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', match.player1_id)
      .single();

    if (challengerError) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Challenger player not found' })
      };
    }

    // Get the user's email from auth.users table
    let email: string | null = null;
    
    // Try to get email from auth table first
    let { data: userData, error: userError } = await supabase
      .from('auth')
      .select('email')
      .eq('id', challengedPlayerId)
      .single();

    if (!userError && userData?.email) {
      email = userData.email;
    } else {
      // If we can't get the email from auth table, try to get it from auth.users
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(challengedPlayerId);
      
      if (authError || !authUser?.user?.email) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ success: false, error: 'User email not found' })
        };
      }
      
      email = authUser.user.email;
    }

    // Format the match date
    const matchDate = new Date(match.date);
    const formattedDate = matchDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedTime = matchDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Prepare email parameters
    if (!email) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'No email address found for the user' })
      };
    }

    const emailParams = {
      Source: 'noreply@africatennis.com',
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: `New Match Challenge from ${challengerPlayer.username}`
        },
        Body: {
          Html: {
            Data: `
              <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                    .button { display: inline-block; background-color: #0066cc; color: white; padding: 10px 20px; 
                              text-decoration: none; border-radius: 4px; margin-top: 20px; }
                    .match-details { background-color: white; padding: 15px; border-radius: 4px; margin: 20px 0; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>New Match Challenge</h1>
                    </div>
                    <div class="content">
                      <p>Hello ${challengedPlayer.username},</p>
                      <p><strong>${challengerPlayer.username}</strong> has challenged you to a tennis match!</p>
                      
                      <div class="match-details">
                        <h3>Match Details:</h3>
                        <p><strong>Date:</strong> ${formattedDate}</p>
                        <p><strong>Time:</strong> ${formattedTime}</p>
                        <p><strong>Location:</strong> ${match.location}</p>
                      </div>
                      
                      <p>Please log in to your Africa Tennis account to accept or decline this challenge.</p>
                      
                      <a href="${process.env.FRONTEND_URL || 'https://africatennis.com'}/matches" class="button">
                        View Match Request
                      </a>
                    </div>
                    <div class="footer">
                      <p>This is an automated message from Africa Tennis. Please do not reply to this email.</p>
                    </div>
                  </div>
                </body>
              </html>
            `
          },
          Text: {
            Data: `
              New Match Challenge
              
              Hello ${challengedPlayer.username},
              
              ${challengerPlayer.username} has challenged you to a tennis match!
              
              Match Details:
              Date: ${formattedDate}
              Time: ${formattedTime}
              Location: ${match.location}
              
              Please log in to your Africa Tennis account to accept or decline this challenge.
              
              ${process.env.FRONTEND_URL || 'https://africatennis.com'}/matches
              
              This is an automated message from Africa Tennis. Please do not reply to this email.
            `
          }
        }
      }
    };

    // Send the email
    const command = new SendEmailCommand(emailParams);
    await sesClient.send(command);

    // Return success response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true, 
        message: `Notification sent to ${challengedPlayer.username}` 
      })
    };
  } catch (error) {
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'An unexpected error occurred' })
    };
  }
};