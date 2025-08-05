import { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { setApiAuthToken } from './aws'

// Create a client with optimized settings and enhanced error handling
export const queryClient = new QueryClient({
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
        if ((error as { status?: number })?.status >= 400) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
})

// Set up API auth token from Supabase session
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.access_token) {
    setApiAuthToken(session.access_token);
  }
})

// Listen for auth changes
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.access_token) {
    setApiAuthToken(session.access_token);
  } else {
    setApiAuthToken(null);
  }
})

// Preload critical resources
export const preloadResources = () => {
  // Preload critical fonts
  const fontPreloads = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
  ];
  
  fontPreloads.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    document.head.appendChild(link);
  });
};

// Initialize preloading
preloadResources();