#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Checking deployment status for stack: africa-tennis-platform-stack"
echo "----------------------------------------------"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed.${NC}"
    echo "Please install AWS CLI first: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${YELLOW}Warning: AWS credentials not properly configured.${NC}"
    echo "Please ensure you have configured your AWS credentials using:"
    echo "  aws configure"
    echo "Or set the following environment variables:"
    echo "  export AWS_ACCESS_KEY_ID=your_access_key"
    echo "  export AWS_SECRET_ACCESS_KEY=your_secret_key"
    echo "  export AWS_REGION=your_region (e.g., us-east-1)"
    exit 1
fi

echo -e "${GREEN}CloudFormation Stack Status:${NC}"
aws cloudformation describe-stacks --stack-name africa-tennis-platform-stack --query "Stacks[0].StackStatus" --output text || echo -e "${RED}Stack not found or error retrieving status${NC}"

echo ""
echo -e "${GREEN}API Gateway Endpoint:${NC}"
API_URL=$(aws cloudformation describe-stacks --stack-name africa-tennis-platform-stack --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)

if [ -n "$API_URL" ]; then
    echo -e "${GREEN}$API_URL${NC}"
    
    # Test the API endpoint
    echo ""
    echo -e "${GREEN}Testing API endpoint:${NC}"
    curl -s "$API_URL/health" || echo -e "${RED}Failed to connect to API endpoint${NC}"
else
    echo -e "${RED}API URL not found in stack outputs${NC}"
fi

echo ""
echo -e "${GREEN}Lambda Functions:${NC}"
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'africa-tennis') || contains(FunctionName, 'UpdateScore') || contains(FunctionName, 'GenerateBracket')].{Name:FunctionName,Runtime:Runtime,Memory:MemorySize,Timeout:Timeout}" --output table

echo "----------------------------------------------"
echo "Deployment check complete!"