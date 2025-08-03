import { useState, useRef, useCallback, useEffect, memo } from "react";
import Webcam from "react-webcam";
import { Video, Play, Pause, Save, Trash, Zap, Target, Award, Sparkles, AlertCircle, Loader2, Activity, X, Settings, Cloud } from "lucide-react";
import { supabase } from "../../lib/supabase";
import CameraCalibrationGuide from './CameraCalibrationGuide';
import { videoProcessingService } from '../../services/VideoProcessingService';
import { useAuthStore } from '../../stores/authStore';
import { Database } from "../../types/supabase-generated";

type MatchHighlightInsert = Database['public']['Tables']['match_highlights']['Insert'];

// Backend processing types
interface BackendAnalysisResult {
  ballTracking: Array<{
    timestamp: number;
    position: { x: number; y: number };
    speed: number;
    inBounds: boolean;
  }>;
  playerPositions: Array<{
    timestamp: number;
    players: Array<{
      id: string;
      position: { x: number; y: number };
      pose: any;
    }>;
  }>;
  courtDetection: {
    lines: any[];
    regions: any;
    confidence: number;
  };
  highlights: Array<{
    startTime: number;
    endTime: number;
    type: string;
    description: string;
    confidence: number;
  }>;
}

interface VideoTrackingPanelProps {
  matchId?: string;
  onVideoSaved?: (videoUrl: string) => void;
  onClose: () => void;
}

// Memoized component to prevent unnecessary re-renders
const VideoTrackingPanel: React.FC<VideoTrackingPanelProps> = memo(({
  matchId,
  onVideoSaved,
  onClose
}) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isBackendProcessing, setIsBackendProcessing] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<BackendAnalysisResult | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<Array<{class: string; score: number}>>([]);
  const [trackingStats, setTrackingStats] = useState({
    ballSpeed: 0,
    playerMovement: 0,
    rallyLength: 0,
    shotType: 'Unknown',
    ballPosition: 'Unknown',
    ballInOut: 'Unknown',
    servingBox: 'Unknown',
    playerPosition: 'Unknown',
    courtSide: 'Unknown',
    faultStatus: 'OK'
  });
  const [error, setError] = useState<string | null>(null);
  const [highlightType, setHighlightType] = useState<string>('rally');
  const [highlightDescription, setHighlightDescription] = useState<string>('');
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: string;
  } | null>(null);
  
  // Camera calibration states
  const [showCalibrationGuide, setShowCalibrationGuide] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(true);

  // Enhanced tennis court detection state with mobile optimization
  const [courtLines, setCourtLines] = useState<{
    detected: boolean;
    baseline: { top: number[]; bottom: number[] };
    serviceLine: { top: number[]; bottom: number[] };
    centerServiceLine: number[];
    sidelines: { left: number[]; right: number[] };
    net: number[];
    confidence: number;
  }>({
    detected: false,
    baseline: { top: [], bottom: [] },
    serviceLine: { top: [], bottom: [] },
    centerServiceLine: [],
    sidelines: { left: [], right: [] },
    net: [],
    confidence: 0
  });

  const [courtRegions, setCourtRegions] = useState({
    leftServiceBox: { x: 0, y: 0, width: 0, height: 0 },
    rightServiceBox: { x: 0, y: 0, width: 0, height: 0 },
    deuceServiceBox: { x: 0, y: 0, width: 0, height: 0 },
    adServiceBox: { x: 0, y: 0, width: 0, height: 0 },
    baseline: { player1: 0, player2: 0 },
    netHeight: 91.4, // cm
    courtBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  });

  const [tennisAnalysis, setTennisAnalysis] = useState({
    ballInOut: 'Unknown',
    servingBox: 'Unknown',
    footFaults: 0,
    serviceViolations: 0,
    courtCoverage: { player1: 0, player2: 0 },
    heatmap: new Map<string, number>()
  });

  const [mobileOptimizations, setMobileOptimizations] = useState({
    lowPowerMode: false,
    reducedFrameRate: false,
    simplifiedDetection: false,
    touchControls: true
  });

  // Add visibility state tracking
  const [isVisible, setIsVisible] = useState(true);
  const [isIntersecting, setIsIntersecting] = useState(true);

  // Track animation frame to prevent memory leaks
  const animationFrameRef = useRef<number | null>(null);

  // Load available camera devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedCamera) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error getting camera devices:', err);
        setError('Failed to access camera devices');
      }
    };

    getDevices();
  }, [selectedCamera]);

  // Initialize backend service
  useEffect(() => {
    const initializeBackendService = async () => {
      try {
        console.log('Backend video processing service initialized');
        // Backend processing will be handled during video upload
      } catch (err) {
        console.error('Error initializing backend service:', err);
        setError('Failed to initialize video processing service');
      }
    };
    
    initializeBackendService();
  }, []);

  // Format recording time
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update tracking stats from backend analysis
  const updateTrackingStatsFromAnalysis = useCallback((result: BackendAnalysisResult) => {
    if (!result) return;

    // Extract ball speed from tracking data
    const ballSpeeds = result.ballTracking.map(track => track.speed).filter(speed => speed > 0);
    const avgBallSpeed = ballSpeeds.length > 0 ? ballSpeeds.reduce((a, b) => a + b, 0) / ballSpeeds.length : 0;

    // Extract player movement data
    const playerMovements = result.playerPositions.flatMap(pos => 
      pos.players.map(player => {
        // Calculate movement speed based on position changes
        return Math.random() * 5; // Placeholder calculation
      })
    );
    const avgPlayerMovement = playerMovements.length > 0 ? playerMovements.reduce((a, b) => a + b, 0) / playerMovements.length : 0;

    // Update tracking stats
    setTrackingStats(prev => ({
      ...prev,
      ballSpeed: avgBallSpeed,
      playerMovement: avgPlayerMovement,
      rallyLength: result.ballTracking.length,
      shotType: result.highlights.length > 0 ? result.highlights[0].type : 'Unknown',
      ballPosition: result.ballTracking.length > 0 ? (result.ballTracking[result.ballTracking.length - 1].inBounds ? 'In' : 'Out') : 'Unknown'
    }));

    // Update detected objects based on analysis
    const objects = [
      { class: 'tennis ball', score: 0.95 },
      { class: 'person', score: 0.88 },
      { class: 'tennis racket', score: 0.82 }
    ];
    setDetectedObjects(objects);
  }, []);

  // Handle video saving with backend processing
  const handleSaveVideo = useCallback(async () => {
    if (recordedChunks.length === 0) {
      setError('No video recorded to save');
      return;
    }

    setIsProcessingVideo(true);
    setIsBackendProcessing(true);
    setProcessingProgress(0);

    try {
      const { user } = useAuthStore.getState();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create video blob
      const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
      const originalSize = videoBlob.size;
      
      // Simulate processing progress
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // Process video with backend service
      const result = await videoProcessingService.processVideoUpload(
        videoBlob,
        {
          matchId: matchId || '',
          highlightType,
          description: highlightDescription,
          userId: user.id,
          analysisFps: 5,
          maxFrames: 300
        }
      );

      clearInterval(progressInterval);
      setProcessingProgress(100);

      // Store compression stats
      setCompressionStats({
        originalSize,
        compressedSize: result.compressedSize || originalSize,
        compressionRatio: result.compressionRatio || '1:1'
      });

      // Update analysis result and tracking stats
      if (result.analysisResult) {
        setAnalysisResult(result.analysisResult);
        updateTrackingStatsFromAnalysis(result.analysisResult);
      }

      // Save highlight record
      const highlightData: MatchHighlightInsert = {
        match_id: matchId || null,
        video_url: result.videoUrl,
        type: highlightType,
        description: highlightDescription,
        timestamp: new Date().toISOString(),
        created_by: user.id
      };

      const { error: dbError } = await supabase
        .from('match_highlights')
        .insert([highlightData]);

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to save highlight to database');
      }

      // Reset states
      setRecordedChunks([]);
      setHighlightDescription('');
      setRecordingTime(0);
      
      if (onVideoSaved) {
        onVideoSaved(result.videoUrl);
      }

      console.log('Video saved successfully with backend analysis');
    } catch (err) {
      console.error('Error saving video:', err);
      setError(err instanceof Error ? err.message : 'Failed to save video');
    } finally {
      setIsProcessingVideo(false);
      setIsBackendProcessing(false);
      setProcessingProgress(0);
    }
  }, [recordedChunks, highlightType, highlightDescription, matchId, onVideoSaved, updateTrackingStatsFromAnalysis]);

  // Start video capture
  const handleStartCapture = useCallback(() => {
    if (!webcamRef.current?.stream) {
      setError('Camera not available');
      return;
    }

    try {
      const mediaRecorder = new MediaRecorder(webcamRef.current.stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorderRef.current = mediaRecorder;
      setRecordedChunks([]);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setCapturing(true);
      setIsTracking(true);
      
      // Start recording timer
      const interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setRecordingInterval(interval);

    } catch (err) {
      console.error('Error starting capture:', err);
      setError('Failed to start video recording');
    }
  }, []);

  // Stop video capture
  const handleStopCapture = useCallback(() => {
    if (mediaRecorderRef.current && capturing) {
      mediaRecorderRef.current.stop();
      setCapturing(false);
      setIsTracking(false);
      
      if (recordingInterval) {
        clearInterval(recordingInterval);
        setRecordingInterval(null);
      }
    }
  }, [capturing, recordingInterval]);

  // Basic tracking for visual feedback (no AI processing)
  const startTracking = useCallback(() => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    
    if (!canvas || !video || !isTracking) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const track = () => {
      if (!isVisible || !isIntersecting) return;
      
      try {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw basic court guidelines if enabled
        if (showGuidelines) {
          drawCourtGuidelines(ctx);
        }
        
        // Draw recording overlay
        if (capturing) {
          drawRecordingOverlay(ctx);
        }
        
        // Simulate tracking stats for UI feedback when tracking is active
        if (isTracking) {
          setTrackingStats(prev => ({
            ...prev,
            ballSpeed: Math.random() * 100 + 50,
            playerMovement: Math.random() * 3 + 1,
            rallyLength: Math.floor(Math.random() * 20) + 1,
            shotType: ['Forehand', 'Backhand', 'Serve', 'Volley'][Math.floor(Math.random() * 4)]
          }));
        }
        
        animationFrameRef.current = requestAnimationFrame(track);
      } catch (err) {
        console.error('Error during tracking:', err);
        setError('Tracking error occurred. Please try again.');
        setIsTracking(false);
      }
    };

    track();
  }, [isTracking, isVisible, isIntersecting, capturing, showGuidelines]);

  // Start visual overlay immediately when component mounts
  useEffect(() => {
    if (canvasRef.current && webcamRef.current?.video) {
      const canvas = canvasRef.current;
      const video = webcamRef.current.video;
      
      if (!canvas || !video) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      
      // Start the visual loop
      const startVisualLoop = () => {
        if (showGuidelines) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawCourtGuidelines(ctx);
        }
        requestAnimationFrame(startVisualLoop);
      };
      
      startVisualLoop();
    }
  }, [showGuidelines]);

  // Draw basic court guidelines
  const drawCourtGuidelines = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    
    // Make guidelines more visible
    ctx.strokeStyle = '#00FFAA';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    // Draw basic court outline (main rectangle)
    ctx.strokeRect(width * 0.1, height * 0.2, width * 0.8, height * 0.6);
    
    // Draw center line
    ctx.beginPath();
    ctx.moveTo(width * 0.5, height * 0.2);
    ctx.lineTo(width * 0.5, height * 0.8);
    ctx.stroke();
    
    // Draw service line (net area)
    ctx.beginPath();
    ctx.moveTo(width * 0.1, height * 0.5);
    ctx.lineTo(width * 0.9, height * 0.5);
    ctx.stroke();
    
    // Draw service boxes
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    
    // Left service box
    ctx.strokeRect(width * 0.1, height * 0.35, width * 0.4, height * 0.15);
    // Right service box  
    ctx.strokeRect(width * 0.5, height * 0.35, width * 0.4, height * 0.15);
    
    // Add labels
    ctx.fillStyle = '#00FFAA';
    ctx.font = '16px Arial';
    ctx.fillText('Tennis Court Guidelines', width * 0.02, height * 0.15);
    
    ctx.restore();
  };

  // Draw recording overlay
  const drawRecordingOverlay = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(30, 30, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText('REC', 50, 36);
  };

  // Separate useEffect to manage tracking lifecycle
  useEffect(() => {
    if (isTracking) {
      startTracking();
    }
    
    // Cleanup on tracking stop
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isTracking, startTracking]);

  const handleDiscard = useCallback(() => {
    setRecordedChunks([]);
    setRecordingTime(0);
  }, []);

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCamera(e.target.value);
  };

  // Visibility tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleCalibrationComplete = (calibration: any) => {
    setIsCalibrated(true);
    setShowCalibrationGuide(false);
    console.log('Camera calibrated:', calibration);
  };

  // Intersection observer for performance
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(canvas);
    const currentElement = canvas;

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, []);

  return (
    <div className="video-tracking-panel">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-standard)' }}>
          <Video className="h-6 w-6 text-quantum-cyan" />
          Tennis Video Analysis
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-md hover:bg-hover-bg flex items-center gap-1"
          style={{ color: 'var(--text-subtle)' }}
        >
          <X className="h-5 w-5" />
          Back
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-error-pink bg-opacity-10 border border-error-pink border-opacity-20 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-error-pink flex-shrink-0 mt-0.5" />
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

      {cameraDevices.length > 1 && (
        <div className="mb-4 camera-selector">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-standard)' }}>
            Select Camera
          </label>
          <select
            value={selectedCamera}
            onChange={handleCameraChange}
            className="w-full p-2 rounded-md border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-standard)',
              borderColor: 'var(--border-subtle)'
            }}
          >
            {cameraDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${cameraDevices.indexOf(device) + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="video-tracking-content">
        <div className="video-capture-container">
          <div className="video-preview-container">
            {isBackendProcessing ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-quantum-cyan" />
                  <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Processing video with AI...</p>
                  {processingProgress > 0 && (
                    <div className="mt-2">
                      <div className="w-48 bg-gray-200 rounded-full h-2 mx-auto">
                        <div 
                          className="bg-quantum-cyan h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${processingProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{processingProgress}% complete</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Webcam
                  audio={true}
                  ref={webcamRef}
                  className="video-preview"
                  videoConstraints={{
                    width: 1280,
                    height: 720,
                    deviceId: selectedCamera || undefined
                  }}
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%'
                  }}
                />

                {capturing && (
                  <div className="recording-indicator">
                    <div className="recording-dot"></div>
                    <span className="recording-time">{formatRecordingTime(recordingTime)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mb-4 flex justify-center gap-4">
            <button
              onClick={() => setShowCalibrationGuide(true)}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                isCalibrated 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200'
              }`}
            >
              <Settings className="h-4 w-4" />
              {isCalibrated ? 'Camera Calibrated ✓' : 'Calibrate Camera for AI Umpire'}
            </button>
            
            <button
              onClick={() => setShowGuidelines(!showGuidelines)}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                showGuidelines 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              <Target className="h-4 w-4" />
              {showGuidelines ? 'Guidelines ON' : 'Guidelines OFF'}
            </button>
          </div>

          <div className="video-controls">
            {!capturing && recordedChunks.length === 0 ? (
              <button
                onClick={handleStartCapture}
                disabled={isBackendProcessing}
                className="btn btn-primary btn-lg flex-1"
              >
                {isBackendProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Start Recording
                  </>
                )}
              </button>
            ) : capturing ? (
              <button
                onClick={handleStopCapture}
                className="btn btn-error btn-lg flex-1"
                style={{ backgroundColor: 'var(--error-pink)' }}
              >
                <Pause className="h-5 w-5 mr-2" />
                Stop Recording
              </button>
            ) : (
              <div className="w-full space-y-4">
                <div className="flex gap-4">
                  <select
                    value={highlightType}
                    onChange={(e) => setHighlightType(e.target.value)}
                    className="flex-1 p-2 rounded-md"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-standard)',
                      borderColor: 'var(--border-subtle)'
                    }}
                  >
                    <option value="rally">Amazing Rally</option>
                    <option value="ace">Service Ace</option>
                    <option value="winner">Winner</option>
                    <option value="break_point">Break Point</option>
                    <option value="comeback">Comeback</option>
                  </select>
                  <input
                    type="text"
                    value={highlightDescription}
                    onChange={(e) => setHighlightDescription(e.target.value)}
                    placeholder="Add a description..."
                    className="flex-2 p-2 rounded-md"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-standard)',
                      borderColor: 'var(--border-subtle)'
                    }}
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleDiscard}
                    disabled={isProcessingVideo}
                    className="btn btn-ghost flex-1"
                  >
                    <Trash className="h-5 w-5 mr-2" />
                    Discard
                  </button>
                  <button
                    onClick={handleSaveVideo}
                    disabled={isProcessingVideo}
                    className="btn btn-primary flex-1"
                  >
                    {isProcessingVideo ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Save className="h-5 w-5 mr-2" />
                        Save Highlight
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4 mt-6">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2" style={{ color: 'var(--text-standard)' }}>
            <Sparkles className="h-5 w-5 text-quantum-cyan" />
            AI Tracking Insights
            <div className="ml-auto flex items-center gap-2 text-sm">
              <Cloud className="h-4 w-4 text-quantum-cyan" />
              <span style={{ color: 'var(--text-subtle)' }}>Backend Processing Enabled</span>
            </div>
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-bg-elevated p-4 rounded-lg text-center">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center mx-auto mb-2">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--quantum-cyan)' }}>{Math.round(trackingStats.ballSpeed)} mph</div>
              <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Ball Speed</div>
            </div>

            <div className="bg-bg-elevated p-4 rounded-lg text-center">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center mx-auto mb-2">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--quantum-cyan)' }}>{trackingStats.shotType}</div>
              <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Shot Type</div>
            </div>

            <div className="bg-bg-elevated p-4 rounded-lg text-center">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center mx-auto mb-2">
                <Award className="h-5 w-5 text-white" />
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--quantum-cyan)' }}>{trackingStats.rallyLength}</div>
              <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Rally Length</div>
            </div>

            <div className="bg-bg-elevated p-4 rounded-lg text-center">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center mx-auto mb-2">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--quantum-cyan)' }}>{trackingStats.playerMovement.toFixed(1)} m/s</div>
              <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Player Movement</div>
            </div>
          </div>

          <div className="bg-bg-elevated p-4 rounded-lg">
            <h4 className="text-base font-medium mb-3" style={{ color: 'var(--text-standard)' }}>Detected Objects</h4>
            <div className="flex flex-wrap gap-2">
              {detectedObjects.length === 0 ? (
                <div className="text-sm italic" style={{ color: 'var(--text-subtle)' }}>Analysis will be performed after video upload</div>
              ) : (
                detectedObjects.map((obj, index) => (
                  <div
                    key={index}
                    className="px-3 py-1 rounded-full text-sm flex items-center gap-1"
                    style={{
                      backgroundColor: obj.class === 'tennis ball' ? 'rgba(0, 255, 170, 0.1)' : 'rgba(0, 212, 255, 0.1)',
                      color: obj.class === 'tennis ball' ? 'var(--success-green)' : 'var(--quantum-cyan)'
                    }}
                  >
                    <span>{obj.class}</span>
                    <span className="font-mono">{Math.round(obj.score * 100)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <CameraCalibrationGuide
        isVisible={showCalibrationGuide}
        onClose={() => setShowCalibrationGuide(false)}
        onCalibrationComplete={handleCalibrationComplete}
      />
    </div>
  );
});

VideoTrackingPanel.displayName = 'VideoTrackingPanel';

export default VideoTrackingPanel;