# AI Backend Deployment Guide

This guide explains how to deploy the real backend endpoints for the AI Systems Dashboard and analytics components.

## Overview

The following new Lambda functions have been created to provide real data:

- **AI Systems Status** (`/api/ai-systems/status`) - Provides real-time AI system metrics
- **Match Analytics** (`/api/match-analytics/{matchId}`) - Real-time match analytics data
- **Match Performance** (`/api/match-performance/{matchId}`) - Player performance metrics

## Prerequisites

1. **AWS CLI** installed and configured
2. **SAM CLI** installed
3. **Node.js 22+** installed
4. **AWS Account** with appropriate permissions
5. **Supabase** project with environment variables configured

## Quick Deployment

### Option 1: PowerShell (Windows)
```powershell
.\deploy-ai-backend.ps1
```

### Option 2: Bash (Linux/Mac/WSL)
```bash
chmod +x deploy-ai-backend.sh
./deploy-ai-backend.sh
```

### Option 3: Manual Deployment
```bash
cd aws
npm install

# Install dependencies for new functions
cd lambdas/ai-systems-status && npm install && cd ../..
cd lambdas/match-analytics && npm install && cd ../..
cd lambdas/match-performance && npm install && cd ../..

# Build and deploy
npm run build
sam build
sam deploy
```

## Environment Configuration

After deployment, update your frontend environment:

### 1. Get API Gateway URL
```bash
aws cloudformation describe-stacks --stack-name africa-tennis --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
```

### 2. Update Frontend Environment
Create or update `.env` file:
```env
VITE_USE_AWS=true
VITE_AWS_API_URL=https://your-api-gateway-url.execute-api.region.amazonaws.com/prod
```

### 3. Restart Development Server
```bash
npm run dev
```

## API Endpoints

### AI Systems Status
- **URL**: `GET /api/ai-systems/status`
- **Description**: Returns real-time status of all AI systems
- **Response**: System metrics, accuracy, uptime, error rates

### Match Analytics
- **URL**: `GET /api/match-analytics/{matchId}`
- **Description**: Real-time match analytics and statistics
- **Response**: Match stats, player analytics, key moments

### Match Performance
- **URL**: `GET /api/match-performance/{matchId}`
- **Description**: Player performance metrics for coaching
- **Response**: Shot accuracy, movement efficiency, stamina, etc.

## Data Sources

The backend functions fetch real data from:

- **Matches Table** - Match information and status
- **Match Events Table** - Real-time match events (shots, aces, errors)
- **Match Statistics Table** - Aggregated match statistics
- **Profiles Table** - Player information

## Real vs Mock Data

### Before Backend Deployment
- ✅ Frontend components created
- ❌ Hardcoded initial values displayed
- ❌ No real-time updates
- ❌ No actual AI system monitoring

### After Backend Deployment
- ✅ Real data from Supabase database
- ✅ Calculated metrics based on actual events
- ✅ Real-time updates every 3-5 seconds
- ✅ Actual system performance monitoring

## Monitoring

### CloudWatch Logs
Monitor Lambda function logs:
```bash
aws logs tail /aws/lambda/africa-tennis-AISystemsStatusFunction --follow
aws logs tail /aws/lambda/africa-tennis-MatchAnalyticsFunction --follow
aws logs tail /aws/lambda/africa-tennis-MatchPerformanceFunction --follow
```

### API Gateway Metrics
View API performance in AWS Console:
- API Gateway → africa-tennis → Monitoring
- CloudWatch → Metrics → API Gateway

## Troubleshooting

### Common Issues

1. **"Server configuration error"**
   - Check Supabase environment variables in Lambda
   - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

2. **"Match not found"**
   - Ensure match exists in database
   - Check match ID format (UUID)

3. **CORS errors**
   - Verify CORS headers in Lambda responses
   - Check API Gateway CORS configuration

4. **Empty data responses**
   - Check if match has events in `match_events` table
   - Verify database permissions

### Debug Mode
Enable debug logging by setting environment variable:
```env
DEBUG=true
```

## Cost Estimation

### Lambda Costs
- **AI Systems Status**: ~$0.01 per 1000 requests
- **Match Analytics**: ~$0.02 per 1000 requests
- **Match Performance**: ~$0.02 per 1000 requests

### API Gateway Costs
- ~$3.50 per million requests
- Data transfer: $0.09 per GB

### Total Estimated Cost
- **Low usage** (1000 requests/day): ~$1-2/month
- **Medium usage** (10,000 requests/day): ~$10-15/month
- **High usage** (100,000 requests/day): ~$50-75/month

## Next Steps

1. **Deploy the backend** using the provided scripts
2. **Update frontend environment** variables
3. **Test the AI Systems Dashboard** to see real data
4. **Monitor performance** using CloudWatch
5. **Scale as needed** based on usage patterns

## Support

For issues or questions:
1. Check CloudWatch logs for errors
2. Verify environment configuration
3. Test API endpoints directly with curl/Postman
4. Review Supabase database structure

The AI Systems Dashboard will now display real, live data from your tennis matches and AI systems!