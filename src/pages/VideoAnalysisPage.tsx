import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Video, Film, Zap, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import VideoTrackingPanel from '../components/video/VideoTrackingPanel';
import VideoHighlightsList from '../components/video/VideoHighlightsList';
import { useAuthStore } from '../stores/authStore';

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
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'live' | 'highlights'>('live');
  const [currentHighlight, setCurrentHighlight] = useState<VideoHighlight | null>(null);
  const [showHighlightPlayer, setShowHighlightPlayer] = useState(false);

  const handleBack = () => {
    if (matchId) {
      navigate(`/matches/${matchId}`);
    } else {
      navigate('/matches');
    }
  };

  const handleSaveHighlight = async (data: {
    timestamp: number;
    type: string;
    description: string;
    videoBlob?: Blob;
  }) => {
    if (!data.videoBlob || !user) return;
    
    try {
      // Upload video to Supabase Storage
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('match-highlights')
        .upload(fileName, data.videoBlob);
        
      if (uploadError) throw uploadError;
      
      // Create highlight record in database
      const { error: dbError } = await supabase
        .from('match_highlights')
        .insert({
          match_id: matchId || null,
          timestamp: new Date(data.timestamp).toISOString(),
          type: data.type,
          description: data.description,
          video_url: fileName,
          created_by: user.id
        });
        
      if (dbError) throw dbError;
      
      // Switch to highlights tab
      setActiveTab('highlights');
    } catch (err) {
      console.error('Error saving highlight:', err);
      // Show error message
    }
  };

  const handlePlayHighlight = (highlight: VideoHighlight) => {
    setCurrentHighlight(highlight);
    setShowHighlightPlayer(true);
  };

  const closeHighlightPlayer = () => {
    setShowHighlightPlayer(false);
    setCurrentHighlight(null);
  };

  return (
    <div className="video-analysis-page">
      <div className="video-analysis-header">
        <button onClick={handleBack} className="video-back-btn">
          <ArrowLeft size={20} />
        </button>
        
        <div className="video-analysis-title-section">
          <h1 className="video-analysis-title">
            <Video size={24} className="mr-2" />
            Video Analysis
          </h1>
          <p className="video-analysis-subtitle">
            AI-powered tennis match tracking and highlights
          </p>
        </div>
      </div>

      <div className="video-analysis-tabs">
        <button
          onClick={() => setActiveTab('live')}
          className={`video-analysis-tab ${activeTab === 'live' ? 'active' : ''}`}
        >
          <Zap size={16} />
          Live Tracking
        </button>
        <button
          onClick={() => setActiveTab('highlights')}
          className={`video-analysis-tab ${activeTab === 'highlights' ? 'active' : ''}`}
        >
          <Film size={16} />
          Highlights
        </button>
      </div>

      <div className="video-analysis-content">
        {activeTab === 'live' ? (
          <VideoTrackingPanel 
            matchId={matchId} 
            onSaveHighlight={handleSaveHighlight}
          />
        ) : (
          <VideoHighlightsList 
            matchId={matchId}
            onPlayHighlight={handlePlayHighlight}
          />
        )}
      </div>

      {/* Highlight Player Modal */}
      {showHighlightPlayer && currentHighlight && (
        <div className="video-highlight-player-modal">
          <div className="video-highlight-player-content">
            <div className="video-highlight-player-header">
              <h3 className="video-highlight-player-title">
                {currentHighlight.type.replace('_', ' ')}
              </h3>
              <button
                onClick={closeHighlightPlayer}
                className="video-highlight-player-close"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="video-highlight-player-body">
              <video
                src={`${supabase.storage.from('match-highlights').getPublicUrl(currentHighlight.video_url).data.publicUrl}`}
                controls
                autoPlay
                className="video-highlight-player"
              />
              
              <div className="video-highlight-player-info">
                <p className="video-highlight-player-description">
                  {currentHighlight.description}
                </p>
                <p className="video-highlight-player-timestamp">
                  {new Date(currentHighlight.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="video-analysis-info-banner">
        <Info size={20} className="mr-2" />
        <div>
          <h4 className="video-analysis-info-title">About Video Analysis</h4>
          <p className="video-analysis-info-text">
            This feature uses AI to track the ball, court, and players in real-time. 
            Record and save key moments as highlights for later review.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VideoAnalysisPage;