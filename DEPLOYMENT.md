# Africa Tennis Platform Deployment Guide

## Backend (AWS Lambda Functions)

The backend Lambda functions are already deployed using:
```bash
npm run deploy:aws
```

API Gateway Endpoint: `https://dd7v2jtghk.execute-api.us-west-2.amazonaws.com/prod/`

## Frontend Deployment

### Build with Production Environment Variables

**Option 1: Windows (PowerShell)**
```powershell
$env:VITE_API_BASE_URL="https://dd7v2jtghk.execute-api.us-west-2.amazonaws.com/prod"
npm run build
```

**Option 2: Windows (Command Prompt)**
```cmd
set VITE_API_BASE_URL=https://dd7v2jtghk.execute-api.us-west-2.amazonaws.com/prod
npm run build
```

**Option 3: Linux/Mac**
```bash
VITE_API_BASE_URL=https://dd7v2jtghk.execute-api.us-west-2.amazonaws.com/prod npm run build
```

### Deploy the Frontend

After building, deploy the contents of the `dist` folder to your hosting service:

#### For AWS S3 + CloudFront:
```bash
aws s3 sync dist/ s3://your-bucket-name --delete
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

#### For Vercel:
```bash
vercel --prod
```

#### For Netlify:
```bash
netlify deploy --prod --dir dist
```

## Environment Variables Required

- `VITE_API_BASE_URL`: The AWS API Gateway endpoint URL
- `VITE_SUPABASE_URL`: https://ppuqbimzeplznqdchvve.supabase.co
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Troubleshooting

If you're getting 404 errors on API calls:
1. Ensure the frontend was built with the correct `VITE_API_BASE_URL`
2. Check that the Lambda functions are deployed (`npm run deploy:aws`)
3. Verify the API Gateway endpoint is accessible
4. Check browser console for CORS errors 