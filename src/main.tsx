import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import LoadingSpinner from './components/LoadingSpinner'
import './index.css'

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
const App = lazy(() => import('./App'))

// Set up API auth token from Supabase session
import { supabase } from './lib/supabase'
import { setApiAuthToken } from './lib/aws'

// Create a client with optimized settings and enhanced error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
      gcTime: 15 * 60 * 1000, // 15 minutes - keep in memory longer
      retry: (failureCount, error: unknown) => {
        // Don't retry on insufficient resources or network errors
        if ((error as Error)?.message?.includes('ERR_INSUFFICIENT_RESOURCES') || 
            (error as Error)?.message?.includes('Failed to fetch') ||
            (error as { status?: number })?.status >= 400) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // Don't refetch when user returns to tab
      refetchOnMount: false, // Don't refetch when component mounts if data exists
      refetchOnReconnect: 'always', // Always refetch when network reconnects
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: (failureCount, error: unknown) => {
        // Don't retry mutations on resource errors
        if ((error as Error)?.message?.includes('ERR_INSUFFICIENT_RESOURCES')) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
})

// Get session and set API token
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.access_token) {
    setApiAuthToken(session.access_token)
  }
})

// Listen for auth changes to update API token
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) {
    setApiAuthToken(session.access_token)
  } else {
    setApiAuthToken('')
  }
})

// Preload critical resources
const preloadResources = () => {
  // Preload important images or other resources
  const preloadLinks: string[] = [
    // Add any critical resources here
  ];
  
  preloadLinks.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = url.endsWith('.css') ? 'style' : 'image';
    link.href = url;
    document.head.appendChild(link);
  });
};

// Execute preloading
preloadResources();

// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-deep-space">
      <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-error-pink">Something went wrong</h2>
        <p className="mb-4 text-text-standard">{error.message}</p>
        <button
          onClick={resetErrorBoundary}
          className="btn btn-primary w-full"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  // Disable StrictMode to avoid double-mount and duplicate realtime subscriptions in dev
  <>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
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
)