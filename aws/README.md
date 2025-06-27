# Africa Tennis Platform - AWS Lambda Functions

This directory contains the AWS Lambda functions used by the Africa Tennis Platform.

## Deployment Instructions

### Prerequisites

1. Install AWS CLI:
   - [AWS CLI Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

2. Configure AWS credentials:
   ```bash
   aws configure
   ```
   You'll need to provide:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region (e.g., us-east-1)
   - Default output format (json)

3. Set Supabase service role key as an environment variable:
   ```bash
   export SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

### Deployment

Run the deployment script:

```bash
# Make the script executable
chmod +x ./aws/deploy.sh

# Run the deployment
cd aws
./deploy.sh
```

### Check Deployment Status

```bash
# Make the script executable
chmod +x ./aws/check-deployment.sh

# Check status
./aws/check-deployment.sh
```

## Functions

### 1. Update Score (`update-score`)
- **Trigger**: API Gateway - POST /matches/{matchId}/score
- **Purpose**: Updates the score of a tennis match in real-time
- **Parameters**:
  - `matchId`: Path parameter - ID of the match to update
  - Request body:
    - `winningPlayerId`: ID of the player who won the point
    - `pointType`: (Optional) Type of point (e.g., 'ace', 'double_fault')

### 2. Generate Tournament Bracket (`generate-bracket`)
- **Trigger**: API Gateway - POST /tournaments/{tournamentId}/generate-bracket
- **Purpose**: Creates the initial match structure for a tournament based on its format
- **Parameters**:
  - `tournamentId`: Path parameter - ID of the tournament to generate brackets for

### 3. Send Notification (`send-notification`)
- **Trigger**: Supabase Database Webhook (on INSERT into matches table)
- **Purpose**: Sends email notifications to players when they are challenged to a match
- **Parameters**:
  - Webhook payload containing the new match record

### 4. Aggregate Player Statistics (`aggregate-stats`)
- **Trigger**: EventBridge scheduled event (daily)
- **Purpose**: Pre-calculates complex player statistics for analytics
- **Parameters**: None (runs on schedule)

### 5. Get Matches Function (`get-matches`)
- **Trigger**: API Gateway - GET /matches
- **Purpose**: Retrieves match data for a specific user with optimized queries and joins
- **Parameters**:
  - `userId`: Query parameter - ID of the user whose matches to retrieve

## Troubleshooting

If you encounter issues with deployment:

1. Check AWS credentials:
   ```bash
   aws sts get-caller-identity
   ```

2. Ensure S3 bucket exists:
   ```bash
   aws s3 ls s3://africa-tennis-artifacts-nathi-2025
   ```

3. Check CloudFormation stack status:
   ```bash
   aws cloudformation describe-stacks --stack-name africa-tennis-platform-stack
   ```

4. View CloudWatch logs for Lambda functions:
   ```bash
   aws logs describe-log-groups --query "logGroups[?contains(logGroupName, 'africa-tennis')].logGroupName"
   ```