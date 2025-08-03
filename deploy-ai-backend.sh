#!/bin/bash

# Deploy AI Backend Endpoints Script
# This script builds and deploys the new AI system backend endpoints

set -e

echo "🚀 Deploying AI Backend Endpoints for Africa Tennis Platform"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo -e "${RED}❌ SAM CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Navigate to AWS directory
cd aws

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Install dependencies for new Lambda functions
echo -e "${YELLOW}📦 Installing dependencies for AI Systems Status...${NC}"
cd lambdas/ai-systems-status && npm install && cd ../..

echo -e "${YELLOW}📦 Installing dependencies for Match Analytics...${NC}"
cd lambdas/match-analytics && npm install && cd ../..

echo -e "${YELLOW}📦 Installing dependencies for Match Performance...${NC}"
cd lambdas/match-performance && npm install && cd ../..

echo -e "${YELLOW}🔨 Building TypeScript...${NC}"
npm run build

echo -e "${YELLOW}🏗️ Building SAM application...${NC}"
sam build

echo -e "${YELLOW}🚀 Deploying to AWS...${NC}"
sam deploy --no-confirm-changeset --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo -e "${GREEN}New API Endpoints Available:${NC}"
    echo "• GET /api/ai-systems/status - AI Systems Dashboard data"
    echo "• GET /api/match-analytics/{matchId} - Real-time match analytics"
    echo "• GET /api/match-performance/{matchId} - Match performance metrics"
    echo ""
    echo -e "${YELLOW}📋 Getting API Gateway URL...${NC}"
    aws cloudformation describe-stacks --stack-name africa-tennis --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 AI Backend deployment complete!${NC}"
echo "The AI Systems Dashboard will now display real data from your backend."