import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { TournamentDetails } from '../components/tournaments/TournamentDetails';
import { apiClient } from '../lib/aws';

const TournamentDetailPage: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuthStore();

  if (!tournamentId) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium" style={{ color: 'var(--error-pink)' }}>
          Tournament ID is missing
        </h3>
        <button
          onClick={() => navigate('/tournaments')}
          className="mt-4 btn btn-primary"
        >
          Go Back to Tournaments
        </button>
      </div>
    );
  }

  const handleBack = () => {
    navigate('/tournaments');
  };

  return (
    <TournamentDetails
      tournamentId={tournamentId}
      onBack={handleBack}
    />
  );
};

export default TournamentDetailPage;