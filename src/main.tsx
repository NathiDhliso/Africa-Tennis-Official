import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import LoadingSpinner from './components/LoadingSpinner'
import { queryClient } from './lib/queryClient'
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