import React from 'react';
import { useAuthStore } from '../stores/authStore';
import AIIntegrationDashboard from '../components/admin/AIIntegrationDashboard';
import { Navigate } from 'react-router-dom';

const AIIntegrationPage: React.FC = () => {
  const { user } = useAuthStore();
  
  // Check if user has admin privileges (you can adjust this logic based on your user roles)
  const isAdmin = Boolean(user?.user_metadata?.role === 'admin' || user?.email?.includes('admin'));
  
  // For demo purposes, allow all authenticated users to view the dashboard
  // In production, you might want to restrict this to admins only
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="ai-integration-page">
      <AIIntegrationDashboard 
        isAdmin={isAdmin}
        tournamentId={undefined} // Can be passed from URL params if needed
      />
    </div>
  );
};

export default AIIntegrationPage;