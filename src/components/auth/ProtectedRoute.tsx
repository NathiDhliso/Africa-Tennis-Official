import React, { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { redirectToLogin } from '../../lib/redirect';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuthStore();

  useEffect(() => {
    if (!loading && !user) {
      redirectToLogin();
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Redirecting
  }

  return <>{children}</>;
};