import React, { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import LoadingSpinner from './components/LoadingSpinner'
import { ErrorFallback } from './components/ErrorFallback'
import { queryClient } from './lib/queryClient'
import './index.css'

// Add React import validation for production debugging
// React import validation
console.log('[MAIN] React import validation:', {
  React: typeof React,
  createRoot: typeof createRoot,
  BrowserRouter: typeof BrowserRouter,
  QueryClientProvider: typeof QueryClientProvider,
  ErrorBoundary: typeof ErrorBoundary
});

// Deep React validation
console.log('[MAIN] Deep React validation:', {
  'React.createElement': typeof React?.createElement,
  'React.Component': typeof React?.Component,
  'React.useState': typeof React?.useState,
  'React.useEffect': typeof React?.useEffect,
  'React.lazy': typeof React?.lazy,
  'React.Suspense': typeof React?.Suspense,
  'React.StrictMode': typeof React?.StrictMode
});

// Check if React is properly defined
if (typeof React === 'undefined' || React === null) {
  console.error('[MAIN] CRITICAL: React is undefined or null!');
}

// Check React DOM
console.log('[MAIN] ReactDOM validation:', {
  'createRoot available': typeof createRoot !== 'undefined',
  'createRoot function': createRoot
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

// Lazy load App component with error handling
console.log('[MAIN] Starting lazy load of App component');
console.log('[MAIN] React.lazy function:', React.lazy);

// Validate lazy function before using
if (typeof React.lazy !== 'function') {
  console.error('[MAIN] CRITICAL: React.lazy is not a function!', typeof React.lazy);
}

const App = lazy(() => {
  console.log('[MAIN] Inside lazy loader function...');
  console.log('[MAIN] About to call import(\'./App\')');
  
  return import('./App').then(module => {
    console.log('[MAIN] App module imported successfully:', module);
    console.log('[MAIN] App component type:', typeof module.default);
    return module;
  }).catch(error => {
    console.error('[MAIN] Failed to import App module:', error);
    console.error('[MAIN] Error stack:', error.stack);
    throw error;
  });
});

console.log('[MAIN] App lazy component created:', App);

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
  console.log('[MAIN] About to create React root...');
  console.log('[MAIN] createRoot function check:', typeof createRoot, createRoot);
  
  if (typeof createRoot !== 'function') {
    console.error('[MAIN] CRITICAL: createRoot is not a function!', typeof createRoot);
    throw new Error('createRoot is not a function');
  }
  
  const root = createRoot(rootElement);
  console.log('[MAIN] React root created successfully:', root);
  console.log('[MAIN] Root render method:', typeof root.render);
  
  // Validate all React components before rendering
  console.log('[MAIN] Component validation before render:', {
    BrowserRouter: typeof BrowserRouter,
    QueryClientProvider: typeof QueryClientProvider,
    ErrorBoundary: typeof ErrorBoundary,
    Suspense: typeof Suspense,
    App: typeof App
  });
  
  console.log('[MAIN] Starting render...');
  root.render(
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
          console.error('[MAIN] Error occurred in component:', errorInfo.componentStack);
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
  console.error('[MAIN] Error stack:', error.stack);
  console.error('[MAIN] Error name:', error.name);
  console.error('[MAIN] Error message:', error.message);
  throw error;
}