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
initSentry();

// Enhanced page loading fallback with skeleton
const PageLoadingFallback = () => (
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
      <LoadingSpinner size="large" text="Loading page..." />
    </div>
  </div>
);

function App() {
  const { initialize, loading, user } = useAuthStore();
  
  // Monitor page load performance
  usePerformanceMonitor();

  useEffect(() => {
    // Initialize auth state
    initialize();
    
    // Enhanced preloading strategy
    const preloadPages = () => {
      if (user) {
        // Preload most commonly accessed pages first
        import('./pages/DashboardPage');
        import('./pages/MatchesPage');
        
        // Preload secondary pages after a short delay
        setTimeout(() => {
          import('./pages/ProfilePage');
          import('./pages/RankingsPage');
          import('./pages/TournamentsPage');
        }, 1000);
        
        // Preload heavy components last
        setTimeout(() => {
          import('./pages/VideoAnalysisPage');
          import('./pages/AICoachPage');
          import('./pages/AIIntegrationPage');
          import('./pages/UmpirePage');
        }, 3000);
      } else {
        import('./pages/LoginPage');
        import('./pages/SignUpPage');
        
        // Preload password reset pages
        setTimeout(() => {
          import('./pages/ForgotPasswordPage');
          import('./pages/ResetPasswordPage');
        }, 1000);
      }
    };
    
    // Start preloading after initial render
    const timer = setTimeout(preloadPages, 500);
    return () => clearTimeout(timer);
  }, [initialize, user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  }

  try {
    return (
      <AuthProvider>
        <ThemeProvider>
          {user ? (
            <div className="app-layout">
              <Sidebar />
              <main className="app-main">
                <PageWrapper enableStagger={true}>
                  <Suspense fallback={<PageLoadingFallback />}>
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
              <PageWrapper enableStagger={true}>
                <Suspense fallback={<PageLoadingFallback />}>
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
    console.error('Error in App component:', error);
    return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  }
}

export default App;