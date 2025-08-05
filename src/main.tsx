import React, { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import LoadingSpinner from './components/LoadingSpinner'
import { ErrorFallback } from './components/ErrorFallback'
import { queryClient } from './lib/queryClient'
import './index.css'

// Basic React validation for critical errors only
if (typeof React === 'undefined' || React === null) {
  console.error('[MAIN] CRITICAL: React is undefined or null!');
}

if (typeof createRoot !== 'function') {
  console.error('[MAIN] CRITICAL: createRoot is not available!');
}

// Import all CSS files
import './styles/base.css'
import './styles/dark-mode.css'
import './styles/light-mode.css'
import './styles/animations.css'
import './styles/shared.css'
import './styles/sidebar.css'
import './styles/rankings.css'
import './styles/pages/dashboard.css'
import './styles/pages/matches.css'
import './styles/pages/tournaments.css'
import './styles/pages/profile.css'
import './styles/pages/login.css'
import './styles/pages/onboarding.css'
import './styles/pages/umpire.css'
import './styles/pages/ai-coach.css'
import './styles/pages/video-analysis.css'
import './styles/components/multi-select-calendar.css'
import './styles/components/tournament-form.css'

// Lazy load App component with error handling
if (typeof React.lazy !== 'function') {
  console.error('[MAIN] CRITICAL: React.lazy is not a function!', typeof React.lazy);
}

const App = lazy(() => {
  return import('./App').catch(error => {
    console.error('[MAIN] Failed to import App module:', error);
    throw error;
  });
});

// Add global error handler for production debugging
window.addEventListener('error', (event) => {
  console.error('[GLOBAL ERROR]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED REJECTION]', {
    reason: event.reason,
    promise: event.promise
  });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[MAIN] Root element not found!');
  throw new Error('Root element not found');
}

try {
  if (typeof createRoot !== 'function') {
    console.error('[MAIN] CRITICAL: createRoot is not a function!', typeof createRoot);
    throw new Error('createRoot is not a function');
  }
  
  const root = createRoot(rootElement);
  root.render(
    // Disable StrictMode to avoid double-mount and duplicate realtime subscriptions in dev
    <>
      <ErrorBoundary 
        FallbackComponent={ErrorFallback}
        onError={(error, errorInfo) => {
          console.error('[ERROR BOUNDARY] Component error:', error.message, errorInfo);
        }}
      >
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="large" text="Loading Africa Tennis" />
              </div>
            }>
              <App />
            </Suspense>
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </>
  );
} catch (error) {
  console.error('[MAIN] Failed to render React app:', error);
  throw error;
}