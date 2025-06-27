import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

// Set up API auth token from Supabase session
import { supabase } from './lib/supabase'
import { setApiAuthToken } from './lib/aws'

// Create a client
const queryClient = new QueryClient()

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)