# CI/CD Setup Guide for Africa Tennis Platform

## Overview
This project includes comprehensive CI/CD pipelines for both frontend (Amplify) and backend (AWS Lambda) deployments.

## 🚀 GitHub Actions Workflow

### Features
- **Automated Testing**: TypeScript checks, linting, and unit tests
- **Frontend Build**: Vite build with environment variables
- **Backend Deployment**: SAM CLI deployment to AWS Lambda
- **E2E Testing**: Cypress tests on pull requests
- **Notifications**: Success/failure status updates

### Required GitHub Secrets
Add these secrets in your GitHub repository settings:

#### Frontend Secrets
```
VITE_SUPABASE_URL=https://ppuqbimzeplznqdchvve.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=https://your-api-gateway-url.amazonaws.com/prod
VITE_AWS_ACCESS_KEY_ID=AKIAURIUEMXAI32GZZER
VITE_AWS_SECRET_ACCESS_KEY=your_aws_secret_key
VITE_AWS_S3_BUCKET=atrhighlightsvid
```

#### Backend Secrets
```
AWS_ACCESS_KEY_ID=AKIAURIUEMXAI32GZZER
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SES_EMAIL_SOURCE=info@africatennis.com
FRONTEND_URL=your_amplify_domain.amplifyapp.com
```

### Workflow Triggers
- **Push to main**: Full deployment (frontend + backend)
- **Push to develop**: Testing and build validation
- **Pull Requests**: Testing and E2E validation

## 🌐 AWS Amplify Configuration

### Features
- **Frontend Build**: Automated Vite build
- **Backend Integration**: SAM CLI deployment
- **Environment Variables**: Secure configuration
- **Testing Phase**: TypeScript and linting checks

### Amplify Console Setup

1. **Connect Repository**
   - Go to AWS Amplify Console
   - Connect your GitHub repository
   - Select the main branch

2. **Environment Variables**
   Add these in Amplify Console → Environment variables:
   ```
   VITE_SUPABASE_URL=https://ppuqbimzeplznqdchvve.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_API_BASE_URL=https://your-api-gateway-url.amazonaws.com/prod
   VITE_AWS_ACCESS_KEY_ID=AKIAURIUEMXAI32GZZER
   VITE_AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   VITE_AWS_REGION=us-west-2
   VITE_AWS_S3_BUCKET=atrhighlightsvid
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   SES_EMAIL_SOURCE=info@africatennis.com
   FRONTEND_URL=your_amplify_domain.amplifyapp.com
   ```

3. **Build Settings**
   - Amplify will automatically detect the `amplify.yml` file
   - Enable backend deployment if needed

4. **IAM Role Configuration**
   Ensure your Amplify service role has these policies:
   - `AWSCloudFormationFullAccess`
   - `IAMFullAccess`
   - `AWSLambdaFullAccess`
   - `AmazonAPIGatewayAdministrator`
   - `AmazonS3FullAccess`

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- AWS CLI configured
- SAM CLI installed

### Commands
```bash
# Frontend development
npm run dev

# Backend deployment
cd aws
npm run build
sam build
sam deploy

# Run tests
npm test
npx cypress run
```

## 📊 Monitoring and Debugging

### GitHub Actions
- Check the "Actions" tab in your GitHub repository
- View logs for each step
- Download artifacts (build files, test results)

### Amplify Console
- Monitor build logs in real-time
- View deployment history
- Check environment variables

### AWS CloudWatch
- Lambda function logs
- API Gateway metrics
- Error tracking

## 🚨 Troubleshooting

### Common Issues

1. **IAM Permission Errors**
   - Verify Amplify service role permissions
   - Check AWS credentials in secrets

2. **Build Failures**
   - Check TypeScript errors
   - Verify environment variables
   - Review dependency versions

3. **Deployment Timeouts**
   - Increase timeout in SAM template
   - Check Lambda memory allocation

4. **Environment Variable Issues**
   - Ensure all required variables are set
   - Check for typos in variable names
   - Verify secret values are correct

### Debug Commands
```bash
# Check TypeScript
npx tsc --noEmit

# Validate SAM template
sam validate

# Local SAM testing
sam local start-api

# Check AWS credentials
aws sts get-caller-identity
```

## 🔄 Deployment Flow

1. **Developer pushes code** → GitHub
2. **GitHub Actions triggers** → Runs tests and builds
3. **Backend deployment** → SAM deploys to AWS Lambda
4. **Frontend deployment** → Amplify builds and deploys
5. **E2E tests** → Cypress validates functionality
6. **Notifications** → Status updates

## 📈 Next Steps

1. Set up monitoring with AWS CloudWatch
2. Configure custom domain in Amplify
3. Add staging environment
4. Implement blue-green deployments
5. Set up automated security scanning

---

**Note**: Make sure to update all placeholder values with your actual configuration before deploying.