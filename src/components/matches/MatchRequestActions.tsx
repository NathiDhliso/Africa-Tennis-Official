import React, { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Match } from '../../types';

interface MatchRequestActionsProps {
  match: Match;
  onActionComplete: () => void;
}

const MatchRequestActions: React.FC<MatchRequestActionsProps> = ({ match, onActionComplete }) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'in_progress' })
        .eq('id', match.id);

      if (error) throw error;
      onActionComplete();
    } catch (error: unknown) {
      console.error('Error accepting match:', error);
      setError('Failed to accept match. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'cancelled' })
        .eq('id', match.id);

      if (error) throw error;
      onActionComplete();
    } catch (error: unknown) {
      console.error('Error declining match:', error);
      setError('Failed to decline match. Please try again.');
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-4 p-3 rounded-md text-sm" style={{ backgroundColor: 'rgba(255, 51, 102, 0.1)', color: 'var(--error-pink)' }}>
          {error}
        </div>
      )}
      
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleAccept}
          disabled={isAccepting || isDeclining}
          className="btn btn-primary flex-1"
        >
          {isAccepting ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              Accepting...
            </>
          ) : (
            <>
              <Check size={16} className="mr-2" />
              Accept Match
            </>
          )}
        </button>
        
        <button
          onClick={handleDecline}
          disabled={isAccepting || isDeclining}
          className="btn btn-ghost flex-1"
        >
          {isDeclining ? (
            <>
              <Loader2 size={16} className="animate-spin mr-2" />
              Declining...
            </>
          ) : (
            <>
              <X size={16} className="mr-2" />
              Decline
            </>
          )}
        </button>
      </div>
    </>
  );
};

export default MatchRequestActions;