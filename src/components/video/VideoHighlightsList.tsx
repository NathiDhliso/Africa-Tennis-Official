import React, { useState, useEffect, memo } from 'react';
import { Play, Trash, Download, Video, Activity, Star, TrendingUp, Zap, Target, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useInView } from 'react-intersection-observer';

interface VideoHighlight {
  id: string;
  match_id: string | null;
  timestamp: string;
  type: string;
  description: string | null;
  video_url: string;
  created_at: string | null;
}

interface VideoHighlightsListProps {
  matchId?: string;
  onPlayHighlight?: (highlight: VideoHighlight) => void;
}

// Debounce utility
const debounce = <T extends (...args: unknown[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => func(...args), delay);
  };
};

// Signed URL cache to reduce API calls
const signedUrlCache = new Map<string, { url: string; expires: number }>();

const getCachedSignedUrl = async (highlightId: string, videoPath: string): Promise<string | null> => {
  const cached = signedUrlCache.get(highlightId);
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }
  
  try {
    const { data, error } = await supabase.storage
      .from('match-highlights')
      .createSignedUrl(videoPath, 300); // 5 minutes expiry
      
    if (error) throw error;
    
    if (data?.signedUrl) {
      signedUrlCache.set(highlightId, {
        url: data.signedUrl,
        expires: Date.now() + 240000 // Cache for 4 minutes (less than expiry)
      });
      return data.signedUrl;
    }
  } catch (err) {
    console.error('Error creating signed URL:', err);
  }
  
  return null;
};

// Memoized component to prevent unnecessary re-renders
const VideoHighlightsList: React.FC<VideoHighlightsListProps> = memo(({ 
  matchId,
  onPlayHighlight 
}) => {
  const [highlights, setHighlights] = useState<VideoHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHighlight, setSelectedHighlight] = useState<VideoHighlight | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 6;
  
  // Use intersection observer for infinite scrolling
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  });

  // Load more highlights when bottom is reached
  useEffect(() => {
    if (inView && !isLoading && hasMore) {
      loadMoreHighlights();
    }
  }, [inView]);

  // Initial load of highlights
  useEffect(() => {
    fetchHighlights(0);
    
    // Debounced invalidation to prevent excessive refetches
    const debouncedRefetch = debounce(() => {
      setPage(0);
      fetchHighlights(0);
    }, 500);
    
    // Set up real-time subscription for highlights
    const highlightsSubscription = supabase
      .channel('match-highlights')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'match_highlights' },
        debouncedRefetch
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(highlightsSubscription);
    };
  }, [matchId]);

  // Fetch highlights with pagination
  const fetchHighlights = async (pageNum: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('match_highlights')
        .select('id, match_id, timestamp, type, description, video_url, created_at')
        .order('timestamp', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);
        
      if (matchId) {
        query = query.eq('match_id', matchId);
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      if (pageNum === 0) {
        setHighlights(data || []);
      } else {
        setHighlights(prev => [...prev, ...(data || [])]);
      }
      
      // Check if there are more highlights to load
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching highlights:', err);
      setError('Failed to load video highlights');
    } finally {
      setIsLoading(false);
    }
  };

  // Load more highlights
  const loadMoreHighlights = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchHighlights(nextPage);
  };

  const handlePlayHighlight = (highlight: VideoHighlight) => {
    setSelectedHighlight(highlight);
    if (onPlayHighlight) {
      onPlayHighlight(highlight);
    }
  };

  const handleDownloadHighlight = async (highlight: VideoHighlight) => {
    try {
      // Use cached signed URL to reduce API calls
      const signedUrl = await getCachedSignedUrl(highlight.id, highlight.video_url);
      
      if (signedUrl) {
        // Create a temporary anchor element to trigger download
        const a = document.createElement('a');
        a.href = signedUrl;
        a.download = `tennis-highlight-${highlight.id}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error('Failed to generate download URL');
      }
    } catch (err) {
      console.error('Error downloading highlight:', err);
      setError('Failed to download highlight video');
    }
  };

  const handleDeleteHighlight = async (highlight: VideoHighlight) => {
    setSelectedHighlight(highlight);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedHighlight) return;
    
    try {
      // Delete the video file from storage using the stored file path
      const { error: storageError } = await supabase.storage
        .from('match-highlights')
        .remove([selectedHighlight.video_url]);
        
      if (storageError) {
        console.error('Error deleting from storage:', storageError);
        // Don't throw here as the file might not exist
      }
      
      // Delete the highlight record from the database
      const { error: dbError } = await supabase
        .from('match_highlights')
        .delete()
        .eq('id', selectedHighlight.id);
        
      if (dbError) throw dbError;
      
      // Update local state
      setHighlights(highlights.filter(h => h.id !== selectedHighlight.id));
      setShowDeleteConfirm(false);
      setSelectedHighlight(null);
    } catch (err) {
      console.error('Error deleting highlight:', err);
      setError('Failed to delete highlight');
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setSelectedHighlight(null);
  };

  const getHighlightTypeIcon = (type: string) => {
    switch (type) {
      case 'rally':
        return <Activity className="h-5 w-5" />;
      case 'ace':
        return <Zap className="h-5 w-5" />;
      case 'winner':
        return <Star className="h-5 w-5" />;
      case 'break_point':
        return <Target className="h-5 w-5" />;
      case 'comeback':
        return <TrendingUp className="h-5 w-5" />;
      default:
        return <Video className="h-5 w-5" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (isLoading && highlights.length === 0) {
    return (
      <div className="video-highlights-loading">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>Loading highlights...</p>
      </div>
    );
  }

  if (error && highlights.length === 0) {
    return (
      <div className="video-highlights-error">
        <AlertCircle className="h-8 w-8" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="video-highlights-list">
      <h3 className="video-highlights-title">
        <Play className="h-5 w-5 mr-2" />
        Match Highlights
      </h3>
      
      {highlights.length === 0 ? (
        <div className="video-no-highlights">
          <Video className="h-12 w-12" />
          <p>No highlights recorded yet</p>
          <p className="text-sm">Record match highlights to see them here</p>
        </div>
      ) : (
        <>
          <div className="video-highlights-grid">
            {highlights.map((highlight) => (
              <div key={highlight.id} className="video-highlight-card">
                <div className="video-highlight-header">
                  <div className="video-highlight-type">
                    {getHighlightTypeIcon(highlight.type)}
                    <span>{highlight.type.replace('_', ' ')}</span>
                  </div>
                  <div className="video-highlight-timestamp">
                    {formatTimestamp(highlight.timestamp)}
                  </div>
                </div>
                
                <div className="video-highlight-description">
                  {highlight.description}
                </div>
                
                <div className="video-highlight-actions">
                  <button
                    onClick={() => handlePlayHighlight(highlight)}
                    className="video-highlight-action video-highlight-play"
                  >
                    <Play className="h-4 w-4" />
                    Play
                  </button>
                  
                  <button
                    onClick={() => handleDownloadHighlight(highlight)}
                    className="video-highlight-action video-highlight-download"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  
                  <button
                    onClick={() => handleDeleteHighlight(highlight)}
                    className="video-highlight-action video-highlight-delete"
                  >
                    <Trash className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Load more trigger */}
          {hasMore && (
            <div ref={ref} className="flex justify-center mt-6 py-4">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-quantum-cyan" />
              ) : (
                <button 
                  onClick={loadMoreHighlights}
                  className="btn btn-secondary"
                >
                  Load More Highlights
                </button>
              )}
            </div>
          )}
        </>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedHighlight && (
        <div className="video-delete-modal">
          <div className="video-delete-modal-content">
            <h4 className="video-delete-modal-title">
              <AlertCircle className="h-5 w-5 mr-2" />
              Delete Highlight
            </h4>
            
            <p className="video-delete-modal-message">
              Are you sure you want to delete this highlight? This action cannot be undone.
            </p>
            
            <div className="video-delete-modal-actions">
              <button
                onClick={cancelDelete}
                className="video-delete-modal-cancel"
              >
                Cancel
              </button>
              
              <button
                onClick={confirmDelete}
                className="video-delete-modal-confirm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

VideoHighlightsList.displayName = 'VideoHighlightsList';

export default VideoHighlightsList;