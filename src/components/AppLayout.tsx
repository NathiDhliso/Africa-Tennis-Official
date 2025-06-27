import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ThemeProvider } from '../contexts/ThemeContext';
import { Dashboard } from './dashboard/Dashboard';
import { MatchList } from './matches/MatchList';
import { TournamentList } from './tournaments/TournamentList';
import { ProfileForm } from './profile/ProfileForm';
import Sidebar from './Sidebar';

const AppLayout: React.FC = () => {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ThemeProvider>
      <div className="app-layout">
        {/* Sidebar Navigation with Theme Toggle */}
        <Sidebar />

        {/* Main Content with Router */}
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/matches" element={<MatchList />} />
            <Route path="/tournaments" element={<TournamentList />} />
            <Route path="/profile" element={<ProfileForm />} />
            {/* Catch-all route for unknown paths */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </ThemeProvider>
  );
};

export default AppLayout;