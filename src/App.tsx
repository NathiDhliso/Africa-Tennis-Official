import React, { Suspense, useEffect, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import Sidebar from './components/layout/Sidebar';
import { initSentry } from './lib/sentry';
import LoadingSpinner from './components/LoadingSpinner';

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
const VideoAnalysisPage = lazy(() => import('./pages/VideoAnalysisPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

// Import core styles only
import './styles/base.css';
import './styles/dark-mode.css';
import './styles/light-mode.css';
import './styles/animations.css';
import './styles/shared.css';
import './styles/sidebar.css';
import './styles/rankings.css';

// Initialize Sentry
initSentry();

// Page loading fallback
const PageLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[80vh]">
    <LoadingSpinner size="large" />
  </div>
);

function App() {
  const { initialize, loading, user } = useAuthStore();

  useEffect(() => {
    // Initialize auth state
    initialize();
    
    // Preload critical pages
    const preloadPages = () => {
      // Preload based on auth state
      if (user) {
        import('./pages/DashboardPage');
        import('./pages/MatchesPage');
      } else {
        import('./pages/LoginPage');
        import('./pages/SignUpPage');
      }
    };
    
    // Delay preloading to prioritize current page render
    const timer = setTimeout(preloadPages, 2000);
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
                    <Route path="/video-analysis" element={<VideoAnalysisPage />} />
                    <Route path="/video-analysis/:matchId" element={<VideoAnalysisPage />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Suspense>
              </main>
            </div>
          ) : (
            <div className="min-h-screen">
              <Suspense fallback={<PageLoadingFallback />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignUpPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              </Suspense>
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