# Deploy AI Backend Endpoints Script (PowerShell)
# This script builds and deploys the new AI system backend endpoints

Write-Host "🚀 Deploying AI Backend Endpoints for Africa Tennis Platform" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Check if AWS CLI is installed
try {
    aws --version | Out-Null
    Write-Host "✅ AWS CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

# Check if SAM CLI is installed
try {
    sam --version | Out-Null
    Write-Host "✅ SAM CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ SAM CLI is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

# Navigate to AWS directory
Set-Location aws

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install main dependencies" -ForegroundColor Red
    exit 1
}

# Install dependencies for new Lambda functions
Write-Host "📦 Installing dependencies for AI Systems Status..." -ForegroundColor Yellow
Set-Location lambdas/ai-systems-status
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install AI Systems Status dependencies" -ForegroundColor Red
    exit 1
}
Set-Location ../..

Write-Host "📦 Installing dependencies for Match Analytics..." -ForegroundColor Yellow
Set-Location lambdas/match-analytics
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Match Analytics dependencies" -ForegroundColor Red
    exit 1
}
Set-Location ../..

Write-Host "📦 Installing dependencies for Match Performance..." -ForegroundColor Yellow
Set-Location lambdas/match-performance
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Match Performance dependencies" -ForegroundColor Red
    exit 1
}
Set-Location ../..

Write-Host "🔨 Building TypeScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TypeScript build failed" -ForegroundColor Red
    exit 1
}

Write-Host "🏗️ Building SAM application..." -ForegroundColor Yellow
sam build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SAM build failed" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Deploying to AWS..." -ForegroundColor Yellow
sam deploy --no-confirm-changeset --no-fail-on-empty-changeset

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "New API Endpoints Available:" -ForegroundColor Green
    Write-Host "• GET /api/ai-systems/status - AI Systems Dashboard data"
    Write-Host "• GET /api/match-analytics/{matchId} - Real-time match analytics"
    Write-Host "• GET /api/match-performance/{matchId} - Match performance metrics"
    Write-Host ""
    Write-Host "📋 Getting API Gateway URL..." -ForegroundColor Yellow
    $apiUrl = aws cloudformation describe-stacks --stack-name africa-tennis --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
    Write-Host "API Gateway URL: $apiUrl" -ForegroundColor Cyan
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 AI Backend deployment complete!" -ForegroundColor Green
Write-Host "The AI Systems Dashboard will now display real data from your backend." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update your frontend environment variables with the API Gateway URL"
Write-Host "2. Set VITE_USE_AWS=true in your .env file"
Write-Host "3. Restart your development server"

# Return to original directory
Set-Location ..