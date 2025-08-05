import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import LoadingSpinner from './components/LoadingSpinner'
import { ErrorFallback } from './components/ErrorFallback'
import { queryClient } from './lib/queryClient'
import './index.css'

// Add React import validation for production debugging
console.log('[MAIN] React import validation:', {
  React: typeof React,
  createRoot: typeof createRoot,
  BrowserRouter: typeof BrowserRouter,
  QueryClientProvider: typeof QueryClientProvider,
  ErrorBoundary: typeof ErrorBoundary
});

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

// Lazy load App component for better initial load performance
const App = lazy(() => {
  console.log('[MAIN] Loading App component');
  return import('./App');
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

console.log('[MAIN] Starting application initialization');
console.log('[MAIN] Environment:', import.meta.env.MODE);
console.log('[MAIN] React version:', React.version);

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[MAIN] Root element not found!');
  throw new Error('Root element not found');
}

console.log('[MAIN] Root element found, creating React root');

try {
  createRoot(rootElement).render(
    // Disable StrictMode to avoid double-mount and duplicate realtime subscriptions in dev
    <>
      <ErrorBoundary 
        FallbackComponent={ErrorFallback}
        onError={(error, errorInfo) => {
          console.error('[ERROR BOUNDARY]', {
            error: error.message,
            stack: error.stack,
            errorInfo
          });
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
  console.log('[MAIN] React app rendered successfully');
} catch (error) {
  console.error('[MAIN] Failed to render React app:', error);
  throw error;
}