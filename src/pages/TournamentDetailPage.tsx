import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TournamentDetails } from '../components/tournaments/TournamentDetails';

const TournamentDetailPage: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();

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