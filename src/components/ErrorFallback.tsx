import React from 'react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  // Log detailed error information for debugging
  console.error('[ERROR FALLBACK] Error caught by boundary:', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    cause: error.cause
  });
  
  // Log additional context
  console.error('[ERROR FALLBACK] Current URL:', window.location.href);
  console.error('[ERROR FALLBACK] User Agent:', navigator.userAgent);
  console.error('[ERROR FALLBACK] Timestamp:', new Date().toISOString());
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-deep-space">
      <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-error-pink">Something went wrong</h2>
        <p className="mb-4 text-text-standard">{error.message}</p>
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-gray-400 mb-2">Error Details (Dev Only)</summary>
            <pre className="text-xs bg-gray-800 p-2 rounded overflow-auto max-h-32">
              {error.stack}
            </pre>
          </details>
        )}
        <button
          onClick={() => {
            console.log('[ERROR FALLBACK] Reset button clicked');
            resetErrorBoundary();
          }}
          className="btn btn-primary w-full"
        >
          Try again
        </button>
      </div>
    </div>
  );
}