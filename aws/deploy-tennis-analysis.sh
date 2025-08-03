#!/bin/bash

# Deploy Tennis Video Analysis Function
echo "🎾 Deploying Tennis Video Analysis System..."

# Step 1: Build the TypeScript code
echo "📦 Building TypeScript code..."
cd lambdas/tennis-video-analysis
npm run build
cd ../..

# Step 2: Create deployment package
echo "📁 Creating deployment package..."
mkdir -p dist/lambdas/tennis-video-analysis

# Copy compiled JavaScript files
cp -r lambdas/tennis-video-analysis/dist/* dist/lambdas/tennis-video-analysis/

# Copy package.json (without problematic dependencies)
cat > dist/lambdas/tennis-video-analysis/package.json << 'EOF'
{
  "name": "tennis-video-analysis",
  "version": "1.0.0",
  "description": "Tennis video analysis with multi-model pipeline",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0",
    "@supabase/supabase-js": "^2.0.0"
  }
}
EOF

# Step 3: Install production dependencies
echo "📦 Installing production dependencies..."
cd dist/lambdas/tennis-video-analysis
npm install --production
cd ../../..

# Step 4: Deploy with SAM
echo "🚀 Deploying to AWS..."
sam build --use-container
sam deploy --guided

echo "✅ Tennis Video Analysis System deployed successfully!"
echo "🎯 Next steps:"
echo "   1. Configure environment variables in AWS Lambda console"
echo "   2. Test with sample tennis videos"
echo "   3. Monitor CloudWatch logs for performance"
echo "   4. Update frontend to use new analysis endpoint"