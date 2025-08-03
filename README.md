# Africa Tennis Platform

A comprehensive tennis tournament management platform built with a modern frontend stack, using Supabase for the database and authentication, and a serverless architecture for backend logic.

## Architecture

### Frontend: 
- React (with Vite), TypeScript, and Tailwind CSS
- State Management: Zustand for centralized, hook-based state management

### Backend Services:
- **Database & Auth**: Supabase is used for the PostgreSQL database, user authentication, and real-time updates.
- **Business Logic**: Serverless functions on AWS Lambda handle specialized backend tasks like score processing.
- **Deployment**: Intended for Netlify (or similar) for CI/CD.
- **Monitoring**: Sentry for error tracking and performance monitoring.
- **Testing**: Cypress for End-to-End testing.

## AWS Architecture

The Africa Tennis Platform uses AWS Lambda functions for critical backend operations that require specialized processing or integration with other AWS services. This serverless approach allows for scalable, event-driven processing without maintaining a dedicated backend server.

```
┌─────────────────┐     ┌───────────────┐     ┌─────────────────┐
│                 │     │               │     │                 │
│  React Frontend │────▶│ API Gateway   │────▶│  AWS Lambda     │
│                 │     │               │     │  Functions      │
│                 │◀────│               │◀────│                 │
└─────────────────┘     └───────────────┘     └────────┬────────┘
                                                       │
                                                       ▼
┌─────────────────┐                           ┌─────────────────┐
│                 │                           │                 │
│  Supabase       │◀─────────────────────────▶│  Amazon SES     │
│  Database       │                           │  Email Service  │
│                 │                           │                 │
└─────────────────┘                           └─────────────────┘
```

### Lambda Functions

#### 1. Update Score Function (`update-score`)
- **Purpose**: Processes and updates tennis match scores in real-time using specialized tennis scoring rules. This function handles the complex logic of tennis scoring (0, 15, 30, 40, Advantage) and manages tiebreaks, set completion, and match completion.
- **Trigger**: API Gateway - POST /matches/{matchId}/score
- **AWS Services Used**: Integrates with Supabase database to update match records.
- **Parameters**:
  - `matchId`: Path parameter - ID of the match to update
  - Request body:
    - `winningPlayerId`: ID of the player who won the point
    - `pointType`: (Optional) Type of point (e.g., 'ace', 'double_fault')

#### 2. Generate Tournament Bracket (`generate-bracket`)
- **Purpose**: Automates the complex process of tournament bracket creation based on player seedings and tournament format. This eliminates the manual work of creating fair tournament structures and ensures proper seeding based on player ratings.
- **Trigger**: API Gateway - POST /tournaments/{tournamentId}/generate-bracket
- **AWS Services Used**: Integrates with Supabase database to create match records and update tournament status.
- **Parameters**:
  - `tournamentId`: Path parameter - ID of the tournament to generate brackets for

#### 3. Send Notification Function (`send-notification`)
- **Purpose**: Handles email notifications to players when they are challenged to a match. This improves user experience by providing immediate notifications outside the application.
- **Trigger**: Supabase Database Webhook (on INSERT into matches table)
- **AWS Services Used**: Amazon SES (Simple Email Service) for sending transactional emails.
- **Parameters**:
  - Webhook payload containing the new match record

#### 4. Aggregate Player Statistics (`aggregate-stats`)
- **Purpose**: Performs complex statistical analysis on player performance data. This function pre-calculates statistics that would be computationally expensive to generate on-demand, improving application performance.
- **Trigger**: EventBridge scheduled event (daily)
- **AWS Services Used**: Integrates with Supabase database to read match data and write aggregated statistics.
- **Parameters**: None (runs on schedule)

#### 5. Get Matches Function (`get-matches`)
- **Purpose**: Retrieves match data for a specific user with optimized queries and joins. This centralizes data access logic and provides consistent formatting.
- **Trigger**: API Gateway - GET /matches
- **AWS Services Used**: Integrates with Supabase database to fetch match records with related player information.
- **Parameters**:
  - `userId`: Query parameter - ID of the user whose matches to retrieve

### Deployment

The Lambda functions are deployed using AWS SAM (Serverless Application Model). The deployment configuration is defined in `aws/template.yaml`.

To deploy the Lambda functions:

1. Ensure you have the AWS CLI and SAM CLI installed.
2. Configure your AWS credentials.
3. Run the deployment script:
   ```
   cd aws
   ./deploy.bat  # Windows
   # or
   ./deploy.sh   # Linux/Mac
   ```

## Features

### Authentication
- Secure user sign-up, sign-in, and profile management powered by Supabase Auth.

### Automated ELO Rating System
- Player ratings are automatically calculated and updated after every completed match using PostgreSQL functions and triggers in the Supabase backend.

### Match Management
- Users can create individual matches, accept/decline challenges, and report final scores.

### Tournament Module:
- Create and view tournaments with different formats (Single Elimination, Round Robin, etc.).
- Players can register for open tournaments.

### Live Scoring (Umpire View)
- A dedicated dashboard for officials or players to score tournament matches live on a point-by-point basis.

### Real-time Updates
- Match scores and tournament statuses update in real-time for all viewers using Supabase Realtime subscriptions.

### Theming
- Includes both dark and light themes for user preference.

## Getting Started

### Prerequisites
- Node.js 22+
- A Supabase account
- An AWS account (for deploying Lambda functions)
- Sentry account (optional, for error tracking)

### Installation

1. Clone the repository.
2. Install dependencies:
```bash
npm install
```

3. Copy the example environment file:
```bash
cp .env.example .env
```

4. Update the `.env` file with your credentials:
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project.
   - `VITE_API_BASE_URL` for your AWS API Gateway that triggers your Lambda functions.
   - `VITE_SENTRY_DSN` from your Sentry project (optional).

### Database Setup

Your Supabase database schema, policies, and functions are defined in the migration files.

1. Set up the Supabase CLI.
2. Link your local project to your Supabase project:
```bash
supabase link --project-ref <your-project-id>
```

3. Push the database migrations to deploy your schema:
```bash
supabase db push
```

This will run all files in `supabase/migrations/` in order, setting up your tables, row-level security policies, and database functions.

### Development

Start the local development server:

```bash
npm run dev
```

### Testing

Run Cypress tests in an interactive mode:

```bash
npm run test
```

Run Cypress tests headlessly in the terminal:

```bash
npm run test:e2e
```

Run AWS Lambda function tests:

```bash
npm run test:aws
```

## Project Structure

```
src/
├── components/       # Reusable React components (UI)
│   ├── auth/
│   ├── dashboard/
│   ├── layout/
│   ├── matches/
│   └── tournaments/
├── contexts/         # React Context providers (Auth, Theme)
├── hooks/            # Custom React hooks
├── lib/              # Client-side libraries (Supabase, Sentry, AWS)
├── pages/            # Top-level page components for routes
├── services/         # Client-side data services
├── stores/           # Zustand global state stores (auth, matches, etc.)
├── styles/           # Global and component-specific CSS
└── types/            # TypeScript type definitions (database, app types)
supabase/
├── functions/        # Serverless backend logic (Edge Functions)
└── migrations/       # Database schema and SQL migrations
aws/
├── lambdas/          # AWS Lambda functions
│   ├── aggregate-stats/
│   ├── generate-bracket/
│   ├── get-matches/
│   ├── send-notification/
│   └── update-score/
├── template.yaml     # AWS SAM template for Lambda deployment
└── package.json      # Dependencies for Lambda functions
```

## Deployment Status

### Phase 1: Core Infrastructure
- [x] Supabase project setup
- [x] Database schema and RLS policies defined in migrations
- [x] Automated DB functions for user profile creation and ELO calculation
- [x] User authentication flow with Zustand state management
- [x] Core React application structure with routing

### Phase 2: Feature Implementation
- [x] User profile management and editing
- [x] ELO rating system (automated by database)
- [x] Match creation and final score reporting
- [x] Live point-by-point match scoring system
- [x] Real-time match score updates for spectators

### Phase 3: Advanced Features
- [x] Tournament bracket generation and visualization
- [x] Player statistics and analytics dashboard
- [x] User-to-user notification system

### Phase 4: Production Deployment
- [ ] Netlify CI/CD pipeline configuration
- [x] Production environment setup for AWS Lambda
- [x] Full Sentry integration for monitoring and logging
- [ ] Performance optimization and code splitting

## Contributing

1. Fork the repository.
2. Create a new feature branch (`git checkout -b feature/new-feature-name`).
3. Make your changes.
4. Commit your changes (`git commit -m 'Add some amazing feature'`).
5. Push to the branch (`git push origin feature/new-feature-name`).
6. Open a Pull Request.

## License

This project is licensed under the MIT License.