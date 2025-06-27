import * as Sentry from '@sentry/react';

// Only initialize Sentry if we have a valid DSN
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

function isValidSentryDsn(dsn: string): boolean {
  // Check if DSN follows the expected Sentry DSN format
  // Valid DSN format: https://[key]@[organization].ingest.sentry.io/[project-id]
  const sentryDsnRegex = /^https:\/\/[a-f0-9]+@[a-z0-9-]+\.ingest\.sentry\.io\/\d+$/;
  return sentryDsnRegex.test(dsn);
}

export function initSentry() {
  // Check if DSN is provided, valid, and not a placeholder
  if (sentryDsn && 
      sentryDsn.length > 10 && 
      !sentryDsn.includes('your_sentry_dsn') && 
      !sentryDsn.includes('sentry.io/oauth/authorize') &&
      !sentryDsn.includes('https://sentry.io/oauth/authorize/') &&
      isValidSentryDsn(sentryDsn)) {
    try {
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.VITE_ENVIRONMENT || 'development',
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
          }),
        ],
        tracesSampleRate: import.meta.env.VITE_ENVIRONMENT === 'production' ? 0.1 : 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
      });
      console.log('Sentry initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Sentry:', error);
    }
  } else {
    console.log('Sentry not initialized: No valid DSN provided or DSN is a placeholder');
  }
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
export { Sentry };