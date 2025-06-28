AWS SAM CLI Deployment Guide for Africa Tennis Platform
Prerequisites
Install AWS CLI and SAM CLI

./deploy-frontend.sh

cd aws
./deploy.sh          # or  bash ./deploy.sh

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install SAM CLI
pip install aws-sam-cli
Configure AWS Credentials


aws configure
You'll need to provide:

AWS Access Key ID
AWS Secret Access Key
Default region (e.g., us-west-2)
Default output format (json)
Deployment Steps
Build the Lambda Functions


cd aws
npm install
npm run build
Package and Deploy with SAM CLI


# Create an S3 bucket for deployment artifacts (if it doesn't exist)
aws s3 mb s3://africa-tennis-artifacts-$(date +%Y%m%d)

# Package the application
sam package \
  --template-file template.yaml \
  --s3-bucket africa-tennis-artifacts-$(date +%Y%m%d) \
  --output-template-file packaged.yaml

# Deploy the application
sam deploy \
  --template-file packaged.yaml \
  --stack-name africa-tennis-platform-stack \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    SupabaseUrl=https://ppuqbimzeplznqdchvve.supabase.co \
    SupabaseServiceRoleKey=your_supabase_service_role_key \
    FrontendUrl=www.africatennis.com \
    SesEmailSource=info@africatennis.com
Check Deployment Status


# Get the API Gateway URL
aws cloudformation describe-stacks \
  --stack-name africa-tennis-platform-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text
Test the Deployed API


# Test the health endpoint
curl $(aws cloudformation describe-stacks \
  --stack-name africa-tennis-platform-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)health
Lambda Functions Included
The deployment includes these Lambda functions:

UpdateScoreFunction - Updates tennis match scores in real-time

Endpoint: POST /matches/{matchId}/score
GenerateBracketFunction - Creates tournament brackets

Endpoint: POST /tournaments/{tournamentId}/generate-bracket
SendNotificationFunction - Sends email notifications for match challenges

Endpoint: POST /notifications/new-match
AggregateStatsFunction - Calculates player statistics

Scheduled daily at 2 AM UTC
GetMatchesFunction - Retrieves match data

Endpoint: GET /matches
GenerateMatchSummaryFunction - Creates AI-powered match summaries

Endpoint: POST /matches/{matchId}/generate-summary
GeneratePlayerStyleFunction - Analyzes player styles with AI

Endpoint: POST /players/{playerId}/generate-style
GetUmpireInsightFunction - Provides AI umpire insights during matches

Endpoint: POST /matches/{matchId}/umpire-insight
HealthCheckFunction - Verifies API health

Endpoint: GET /health
After Deployment
Update your frontend environment variables with the API Gateway URL:


VITE_API_BASE_URL=https://your-api-gateway-url.execute-api.us-west-2.amazonaws.com/prod
Redeploy your frontend application to use the new API endpoints.

Troubleshooting
Permission Issues: Ensure your AWS user has sufficient permissions for CloudFormation, Lambda, API Gateway, and S3.
Stack Creation Failure: Check CloudFormation events for detailed error messages.
Lambda Execution Errors: Check CloudWatch Logs for each function.
API Gateway Issues: Verify CORS settings and endpoint configurations.
For more detailed information, refer to the AWS SAM CLI documentation: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html