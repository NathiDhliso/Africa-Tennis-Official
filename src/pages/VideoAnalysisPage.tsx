import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Video, Film, Zap, Info, X } from 'lucide-react';
import VideoTrackingPanel from '../components/video/VideoTrackingPanel';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

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
  const [highlights, setHighlights] = useState<VideoHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHighlights = async () => {
      if (!user) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        let query = supabase
          .from('match_highlights')
          .select('*')
          .order('timestamp', { ascending: false });
          
        if (matchId) {
          query = query.eq('match_id', matchId);
        }
        
        const { data, error: fetchError } = await query;
        
        if (fetchError) throw fetchError;
        
        setHighlights(data || []);
      } catch (err) {
        console.error('Error fetching highlights:', err);
        setError('Failed to load video highlights');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchHighlights();
    
    // Set up real-time subscription for highlights
    const highlightsSubscription = supabase
      .channel('match-highlights')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'match_highlights' },
        fetchHighlights
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(highlightsSubscription);
    };
  }, [matchId, user]);

  const handleBack = () => {
    if (matchId) {
      navigate(`/matches/${matchId}`);
    } else {
      navigate('/matches');
    }
  };

  const handleSaveHighlight = async (videoUrl: string) => {
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

  const handleDeleteHighlight = async (highlight: VideoHighlight) => {
    try {
      // Delete the video file from storage
      const { error: storageError } = await supabase.storage
        .from('match-highlights')
        .remove([highlight.video_url]);
        
      if (storageError) throw storageError;
      
      // Delete the highlight record from the database
      const { error: dbError } = await supabase
        .from('match_highlights')
        .delete()
        .eq('id', highlight.id);
        
      if (dbError) throw dbError;
      
      // Update local state
      setHighlights(highlights.filter(h => h.id !== highlight.id));
    } catch (err) {
      console.error('Error deleting highlight:', err);
      setError('Failed to delete highlight');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

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
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-t-2 border-b-2 border-quantum-cyan rounded-full animate-spin mb-4"></div>
                <p style={{ color: 'var(--text-standard)' }}>Loading highlights...</p>
              </div>
            ) : highlights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Video className="h-16 w-16 mb-4" style={{ color: 'var(--text-muted)' }} />
                <h3 className="text-xl font-medium mb-2" style={{ color: 'var(--text-standard)' }}>No Highlights Available</h3>
                <p className="max-w-md" style={{ color: 'var(--text-subtle)' }}>
                  Record match highlights using the Live Tracking feature to see them here.
                </p>
                <button
                  onClick={() => setActiveTab('live')}
                  className="mt-6 btn btn-primary"
                >
                  <Zap className="h-5 w-5 mr-2" />
                  Start Recording
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {highlights.map((highlight) => (
                  <div 
                    key={highlight.id} 
                    className="rounded-lg overflow-hidden"
                    style={{ 
                      backgroundColor: 'var(--bg-elevated)', 
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div className="aspect-video bg-black relative">
                      <video 
                        src={highlight.video_url}
                        className="w-full h-full object-contain"
                        onClick={() => handlePlayHighlight(highlight)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div 
                        className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                      >
                        <button 
                          className="w-16 h-16 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'var(--quantum-cyan)' }}
                          onClick={() => handlePlayHighlight(highlight)}
                        >
                          <Play className="h-8 w-8 text-white" />
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div 
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{ 
                            backgroundColor: 'rgba(0, 212, 255, 0.1)', 
                            color: 'var(--quantum-cyan)'
                          }}
                        >
                          {highlight.type.replace('_', ' ')}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {formatTimestamp(highlight.timestamp)}
                        </div>
                      </div>
                      <p className="mb-4" style={{ color: 'var(--text-standard)' }}>
                        {highlight.description}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePlayHighlight(highlight)}
                          className="flex-1 py-2 rounded-md flex items-center justify-center gap-1 text-sm font-medium"
                          style={{ 
                            backgroundColor: 'var(--quantum-cyan)', 
                            color: 'white'
                          }}
                        >
                          <Play className="h-4 w-4" />
                          Play
                        </button>
                        <button
                          onClick={() => handleDeleteHighlight(highlight)}
                          className="py-2 px-3 rounded-md flex items-center justify-center text-sm"
                          style={{ 
                            backgroundColor: 'rgba(255, 51, 102, 0.1)', 
                            color: 'var(--error-pink)'
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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