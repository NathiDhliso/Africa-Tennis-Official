import React, { Suspense, useEffect, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import Sidebar from './components/layout/Sidebar';
import { initSentry } from './lib/sentry';
import LoadingSpinner from './components/LoadingSpinner';
import PageWrapper from './components/PageWrapper';
import { usePerformanceMonitor } from './hooks/usePerformanceMonitor';

// Lazy load page components for code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MatchesPage = lazy(() => import('./pages/MatchesPage'));
const MatchDetailPage = lazy(() => import('./pages/MatchDetailPage'));
const TournamentsPage = lazy(() => import('./pages/TournamentsPage'));
const TournamentDetailPage = lazy(() => import('./pages/TournamentDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const RankingsPage = lazy(() => import('./pages/RankingsPage'));
const UmpirePage = lazy(() => import('./pages/UmpirePage'));
const AICoachPage = lazy(() => import('./pages/AICoachPage'));
const AIIntegrationPage = lazy(() => import('./pages/AIIntegrationPage'));
const VideoAnalysisPage = lazy(() => import('./pages/VideoAnalysisPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

// Initialize Sentry
console.log('[APP] Initializing Sentry');
try {
  initSentry();
  console.log('[APP] Sentry initialized successfully');
} catch (error) {
  console.error('[APP] Sentry initialization failed:', error);
}

// Enhanced page loading fallback with skeleton
const PageLoadingFallback = () => {
  console.log('[PAGE_LOADING_FALLBACK] Component called');
  console.log('[PAGE_LOADING_FALLBACK] React available:', typeof React);
  console.log('[PAGE_LOADING_FALLBACK] LoadingSpinner available:', typeof LoadingSpinner);
  
  try {
    console.log('[PAGE_LOADING_FALLBACK] About to render JSX');
    return (
      <div className="page-transition-container">
        <div className="page-skeleton">
          <div className="skeleton-header">
            <div className="skeleton-title"></div>
            <div className="skeleton-subtitle"></div>
          </div>
          <div className="skeleton-content">
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
          </div>
        </div>
        <div className="loading-overlay">
          {console.log('[PAGE_LOADING_FALLBACK] About to render LoadingSpinner')}
          <LoadingSpinner size="large" text="Loading page..." />
        </div>
      </div>
    );
  } catch (error) {
    console.error('[PAGE_LOADING_FALLBACK] Error in component:', error);
    console.error('[PAGE_LOADING_FALLBACK] Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw error;
  }
};

function App() {
  console.log('[APP] App component rendering');
  
  const { initialize, loading, user } = useAuthStore();
  console.log('[APP] Auth state:', { loading, hasUser: !!user, userId: user?.id });
  
  // Monitor page load performance
  try {
    usePerformanceMonitor();
    console.log('[APP] Performance monitor initialized');
  } catch (error) {
    console.error('[APP] Performance monitor failed:', error);
  }

  useEffect(() => {
    console.log('[APP] useEffect - initializing auth state');
    
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        console.log('[APP] Calling auth initialize');
        const cleanup = await initialize();
        console.log('[APP] Auth initialize completed');
        return cleanup;
      } catch (error) {
        console.error('[APP] Auth initialize failed:', error);
      }
    };
    
    initializeAuth();
    
    // Enhanced preloading strategy
    const preloadPages = () => {
      console.log('[APP] Starting page preloading for user:', !!user);
      
      if (user) {
        console.log('[APP] Preloading authenticated user pages');
        // Preload most commonly accessed pages first
        import('./pages/DashboardPage').then(() => console.log('[APP] DashboardPage preloaded'));
        import('./pages/MatchesPage').then(() => console.log('[APP] MatchesPage preloaded'));
        
        // Preload secondary pages after a short delay
        setTimeout(() => {
          import('./pages/ProfilePage').then(() => console.log('[APP] ProfilePage preloaded'));
          import('./pages/RankingsPage').then(() => console.log('[APP] RankingsPage preloaded'));
          import('./pages/TournamentsPage').then(() => console.log('[APP] TournamentsPage preloaded'));
        }, 1000);
        
        // Preload heavy components last
        setTimeout(() => {
          import('./pages/VideoAnalysisPage').then(() => console.log('[APP] VideoAnalysisPage preloaded'));
          import('./pages/AICoachPage').then(() => console.log('[APP] AICoachPage preloaded'));
          import('./pages/AIIntegrationPage').then(() => console.log('[APP] AIIntegrationPage preloaded'));
          import('./pages/UmpirePage').then(() => console.log('[APP] UmpirePage preloaded'));
        }, 3000);
      } else {
        console.log('[APP] Preloading guest pages');
        import('./pages/LoginPage').then(() => console.log('[APP] LoginPage preloaded'));
        import('./pages/SignUpPage').then(() => console.log('[APP] SignUpPage preloaded'));
        
        // Preload password reset pages
        setTimeout(() => {
          import('./pages/ForgotPasswordPage').then(() => console.log('[APP] ForgotPasswordPage preloaded'));
          import('./pages/ResetPasswordPage').then(() => console.log('[APP] ResetPasswordPage preloaded'));
        }, 1000);
      }
    };
    
    // Start preloading after initial render
    const timer = setTimeout(preloadPages, 500);
    return () => clearTimeout(timer);
  }, [initialize, user]);

  if (loading) {
    console.log('[APP] Rendering loading state');
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  }

  console.log('[APP] Rendering main app with user:', !!user);

  console.log('[APP] About to render App component, loading:', loading, 'user:', !!user);
  
  try {
    return (
      <AuthProvider>
        <ThemeProvider>
          {user ? (
            <div className="app-layout">
              {console.log('[APP] Rendering authenticated layout')}
              <Sidebar />
              <main className="app-main">
                <PageWrapper enableStagger={true}>
                  {console.log('[APP] About to render Suspense for authenticated routes')}
                  <Suspense fallback={
                    <>
                      {console.log('[APP] Suspense fallback triggered for authenticated routes')}
                      <PageLoadingFallback />
                    </>
                  }>
                    {console.log('[APP] Rendering authenticated Routes')}
                    <Routes>
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/matches" element={<MatchesPage />} />
                      <Route path="/matches/:matchId" element={<MatchDetailPage />} />
                      <Route path="/tournaments" element={<TournamentsPage />} />
                      <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/rankings" element={<RankingsPage />} />
                      <Route path="/umpire" element={<UmpirePage />} />
                      <Route path="/ai-coach" element={<AICoachPage />} />
                      <Route path="/ai-integration" element={<AIIntegrationPage />} />
                      <Route path="/video-analysis" element={<VideoAnalysisPage />} />
                      <Route path="/video-analysis/:matchId" element={<VideoAnalysisPage />} />
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Suspense>
                </PageWrapper>
              </main>
            </div>
          ) : (
            <div className="min-h-screen">
              {console.log('[APP] Rendering guest layout')}
              <PageWrapper enableStagger={true}>
                {console.log('[APP] About to render Suspense for guest routes')}
                <Suspense fallback={
                  <>
                    {console.log('[APP] Suspense fallback triggered for guest routes')}
                    <PageLoadingFallback />
                  </>
                }>
                  {console.log('[APP] Rendering guest Routes')}
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                  </Routes>
                </Suspense>
              </PageWrapper>
            </div>
          )}
        </ThemeProvider>
      </AuthProvider>
    );
  } catch (error: unknown) {
    console.error('[APP] Error in App component:', error);
    console.error('[APP] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  }
}

export default App;