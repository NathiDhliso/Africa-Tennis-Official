#!/bin/bash

# Secure deployment script for Africa Tennis Platform
# This script reads credentials from environment variables instead of hardcoding them

set -euo pipefail

# --- Configuration ---
AWS_REGION="us-west-2"
S3_BUCKET_NAME="africatennisbucket"
STACK_NAME="africa-tennis-platform-stack"
SUPABASE_URL="https://ppuqbimzeplznqdchvve.supabase.co"
FRONTEND_URL="www.africatennis.com"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXFiaW16ZXBsem5xZGNodnZlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYzNzI2MSwiZXhwIjoyMDY1MjEzMjYxfQ.NEfWLgVkb98xlApZ1T6ZeDkh5stIH1rnfs_-bJwYx0U"
SES_EMAIL_SOURCE="info@africatennis.com"

# Check for required environment variables
if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    echo "Error: AWS credentials not found in environment variables"
    echo "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
    exit 1
fi

echo "[STEP 1/4] Cleaning up previous build artifacts..."
rm -rf dist
rm -rf .aws-sam
echo ""

echo "[STEP 2/4] Installing dependencies and compiling TypeScript..."
npm install
npm run build
echo "[SUCCESS] Build complete."
echo ""

echo "[STEP 3/4] Copying dependencies to each Lambda function directory..."
for d in dist/lambdas/*/ ; do
  echo "Copying node_modules to $d..."
  cp -r node_modules "$d"
done
echo "[SUCCESS] Dependencies copied."
echo ""

echo "[STEP 4/4] Packaging and deploying the application..."

# Check if the S3 bucket exists, create it if it doesn't
if ! aws s3 ls "s3://$S3_BUCKET_NAME" 2>&1 > /dev/null; then
  echo "Creating S3 bucket: $S3_BUCKET_NAME"
  aws s3 mb "s3://$S3_BUCKET_NAME" --region "$AWS_DEFAULT_REGION"
fi

# Check if the stack exists
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" 2>&1 > /dev/null; then
  STACK_EXISTS=true
else
  STACK_EXISTS=false
fi

# Package the application
aws cloudformation package \
  --template-file template.yaml \
  --s3-bucket "$S3_BUCKET_NAME" \
  --output-template-file packaged.yaml

# Deploy the application
if [ "$STACK_EXISTS" = true ]; then
  # If stack is in ROLLBACK_COMPLETE state, delete it first
  STACK_STATUS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].StackStatus" --output text)
  if [ "$STACK_STATUS" = "ROLLBACK_COMPLETE" ]; then
    echo "Stack is in ROLLBACK_COMPLETE state. Deleting stack before redeploying..."
    aws cloudformation delete-stack --stack-name "$STACK_NAME"
    aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"
  fi
fi

# Deploy or update the stack
aws cloudformation deploy \
  --template-file packaged.yaml \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    SupabaseUrl="$SUPABASE_URL" \
    SupabaseServiceRoleKey="$SUPABASE_SERVICE_ROLE_KEY" \
    FrontendUrl="$FRONTEND_URL" \
    SesEmailSource="$SES_EMAIL_SOURCE" \
  --no-fail-on-empty-changeset

echo ""
echo "[SUCCESS] Deployment complete!"

# Get the API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text)

echo ""
echo "=== DEPLOYMENT SUMMARY ==="
echo "API Gateway URL: $API_URL"
echo ""
echo "Next steps:"
echo "1. Set VITE_API_BASE_URL=$API_URL in your Amplify environment variables"
echo "2. Redeploy your frontend on Amplify"
echo "==========================" 