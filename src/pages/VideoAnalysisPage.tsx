import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Video, Film, Zap, Info, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

// Lazy load components for better performance
const VideoTrackingPanel = lazy(() => import('../components/video/VideoTrackingPanel'));
const VideoHighlightsList = lazy(() => import('../components/video/VideoHighlightsList'));

interface VideoHighlight {
  id: string;
  match_id: string;
  timestamp: string;
  type: string;
  description: string;
  video_url: string;
  created_at: string;
}

const VideoAnalysisPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'live' | 'highlights'>('live');
  const [currentHighlight, setCurrentHighlight] = useState<VideoHighlight | null>(null);
  const [showHighlightPlayer, setShowHighlightPlayer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if storage bucket exists and create it if needed
  useEffect(() => {
    const checkStorageBucket = async () => {
      try {
        // Try to get bucket info
        const { error } = await supabase.storage.getBucket('match-highlights');
        
        if (error) {
          console.error('Error checking storage bucket:', error);
          setError('Storage setup issue. Please contact support.');
        }
      } catch (err) {
        console.error('Error in storage check:', err);
      }
    };
    
    checkStorageBucket();
  }, []);

  const handleBack = () => {
    if (matchId) {
      navigate(`/matches/${matchId}`);
    } else {
      navigate('/matches');
    }
  };

  const handleSaveHighlight = async (_videoUrl: string) => {
    // Switch to highlights tab after saving
    setActiveTab('highlights');
  };

  const handlePlayHighlight = (highlight: VideoHighlight) => {
    setCurrentHighlight(highlight);
    setShowHighlightPlayer(true);
  };

  const closeHighlightPlayer = () => {
    setShowHighlightPlayer(false);
    setCurrentHighlight(null);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Loading fallback component
  const TabContentFallback = () => (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner size="large" text="Loading content..." />
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: 'var(--bg-deep-space)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={handleBack}
            className="p-3 rounded-lg"
            style={{ 
              backgroundColor: 'var(--glass-bg)', 
              color: 'var(--text-subtle)',
              border: '1px solid var(--glass-border)'
            }}
          >
            <ArrowLeft size={20} />
          </button>
          
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: 'var(--text-standard)' }}>
              <Video className="h-8 w-8 text-quantum-cyan" />
              Video Analysis
            </h1>
            <p style={{ color: 'var(--text-subtle)' }}>
              AI-powered tennis match tracking and highlights
            </p>
          </div>
        </div>

        <div className="flex gap-2 p-1 mb-6 rounded-lg" style={{ backgroundColor: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
          <button
            onClick={() => setActiveTab('live')}
            className={`flex-1 py-3 px-4 rounded-md flex items-center justify-center gap-2 font-medium transition-all ${
              activeTab === 'live' 
                ? 'text-white' 
                : 'text-text-subtle hover:text-text-standard hover:bg-hover-bg'
            }`}
            style={{ 
              backgroundColor: activeTab === 'live' ? 'var(--quantum-cyan)' : 'transparent'
            }}
          >
            <Zap size={18} />
            Live Tracking
          </button>
          <button
            onClick={() => setActiveTab('highlights')}
            className={`flex-1 py-3 px-4 rounded-md flex items-center justify-center gap-2 font-medium transition-all ${
              activeTab === 'highlights' 
                ? 'text-white' 
                : 'text-text-subtle hover:text-text-standard hover:bg-hover-bg'
            }`}
            style={{ 
              backgroundColor: activeTab === 'highlights' ? 'var(--quantum-cyan)' : 'transparent'
            }}
          >
            <Film size={18} />
            Highlights
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-error-pink bg-opacity-10 border border-error-pink border-opacity-20 flex items-start gap-3">
            <Info className="h-5 w-5 text-error-pink flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-error-pink">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="text-sm text-error-pink underline mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <Suspense fallback={<TabContentFallback />}>
          {activeTab === 'live' ? (
            <VideoTrackingPanel 
              matchId={matchId} 
              onVideoSaved={handleSaveHighlight}
              onClose={() => setActiveTab('highlights')}
            />
          ) : (
            <div className="bg-glass-bg border border-glass-border rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--text-standard)' }}>
                <Film className="h-6 w-6 text-quantum-cyan" />
                Match Highlights
              </h2>
              
              <VideoHighlightsList 
                matchId={matchId}
                onPlayHighlight={handlePlayHighlight}
              />
            </div>
          )}
        </Suspense>

        {/* Info Banner */}
        <div 
          className="mt-8 p-6 rounded-lg flex items-start gap-4"
          style={{ 
            backgroundColor: 'var(--glass-bg)', 
            backdropFilter: 'blur(12px)', 
            border: '1px solid var(--glass-border)'
          }}
        >
          <Info className="h-6 w-6 flex-shrink-0 mt-1" style={{ color: 'var(--quantum-cyan)' }} />
          <div>
            <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-standard)' }}>About Video Analysis</h3>
            <p style={{ color: 'var(--text-subtle)' }}>
              This feature uses AI to track the ball, court, and players in real-time. 
              The system can detect player movements, shot types, and ball speed to provide 
              insights into your game. Record and save key moments as highlights for later review.
            </p>
          </div>
        </div>
      </div>

      {/* Highlight Player Modal */}
      {showHighlightPlayer && currentHighlight && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        >
          <div 
            className="max-w-4xl w-full rounded-lg overflow-hidden"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
          >
            <div className="flex justify-between items-center p-4">
              <h3 className="text-xl font-medium capitalize" style={{ color: 'var(--text-standard)' }}>
                {currentHighlight.type.replace('_', ' ')}
              </h3>
              <button
                onClick={closeHighlightPlayer}
                className="p-2 rounded-full hover:bg-hover-bg"
                style={{ color: 'var(--text-subtle)' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <video
              src={currentHighlight.video_url}
              controls
              autoPlay
              className="w-full"
              style={{ maxHeight: '70vh' }}
            />
            
            <div className="p-4">
              <p style={{ color: 'var(--text-standard)' }}>{currentHighlight.description}</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-subtle)' }}>
                {formatTimestamp(currentHighlight.timestamp)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoAnalysisPage;