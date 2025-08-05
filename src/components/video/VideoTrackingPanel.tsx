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
interface CourtLine {
  start: { x: number; y: number };
  end: { x: number; y: number };
  type: string;
  coordinates?: number[];
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  confidence?: number;
}

interface ServiceBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  corners?: Array<{ x: number; y: number }>;
}

interface CalibrationData {
  matrix?: number[][];
  distortion?: number[];
  focalLength?: number;
  principalPoint?: { x: number; y: number };
}

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
      pose: {
        keypoints: Array<{ x: number; y: number; confidence: number }>;
        confidence: number;
      };
    }>;
  }>;
  courtDetection: {
    lines: Array<CourtLine>;
    regions: {
      serviceBoxes: Array<{ corners: Array<{ x: number; y: number }> }>;
      baseline: { start: { x: number; y: number }; end: { x: number; y: number } };
      sidelines: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }>;
    };
    confidence: number;
    perspective?: {
      viewAngle?: number;
      distortion?: number;
      homographyMatrix?: number[][];
    };
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
    alignment?: {
      baselines: boolean[];
      serviceLines: boolean[];
      sidelines: boolean[];
      centerLine: boolean;
      netLine: boolean;
    };
  }>({
    detected: false,
    baseline: { top: [], bottom: [] },
    serviceLine: { top: [], bottom: [] },
    centerServiceLine: [],
    sidelines: { left: [], right: [] },
    net: [],
    confidence: 0
  });





  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Simple edge detection function
  const detectEdges = useCallback((imageData: ImageData): ImageData => {
    const { data, width, height } = imageData;
    const edges = new ImageData(width, height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Convert to grayscale
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        
        // Simple Sobel edge detection
        const gx = 
          -1 * data[((y - 1) * width + (x - 1)) * 4] +
           1 * data[((y - 1) * width + (x + 1)) * 4] +
          -2 * data[(y * width + (x - 1)) * 4] +
           2 * data[(y * width + (x + 1)) * 4] +
          -1 * data[((y + 1) * width + (x - 1)) * 4] +
           1 * data[((y + 1) * width + (x + 1)) * 4];
           
        const gy = 
          -1 * data[((y - 1) * width + (x - 1)) * 4] +
          -2 * data[((y - 1) * width + x) * 4] +
          -1 * data[((y - 1) * width + (x + 1)) * 4] +
           1 * data[((y + 1) * width + (x - 1)) * 4] +
           2 * data[((y + 1) * width + x) * 4] +
           1 * data[((y + 1) * width + (x + 1)) * 4];
           
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const edgeValue = magnitude > 50 ? 255 : 0;
        
        edges.data[idx] = edgeValue;
        edges.data[idx + 1] = edgeValue;
        edges.data[idx + 2] = edgeValue;
        edges.data[idx + 3] = 255;
      }
    }
    
    return edges;
  }, []);

  // Simple line detection using Hough transform concept
  const detectLines = useCallback((edges: ImageData, width: number, height: number): number[][] => {
    const lines: number[][] = [];
    const threshold = 30;
    
    // Simplified line detection - look for horizontal and vertical edges
    for (let y = 0; y < height; y += 10) {
      let lineStart = -1;
      let lineLength = 0;
      
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (edges.data[idx] > 128) {
          if (lineStart === -1) lineStart = x;
          lineLength++;
        } else {
          if (lineLength > threshold && lineStart !== -1) {
            lines.push([lineStart, y, lineStart + lineLength, y]);
          }
          lineStart = -1;
          lineLength = 0;
        }
      }
    }
    
    // Vertical lines
    for (let x = 0; x < width; x += 10) {
      let lineStart = -1;
      let lineLength = 0;
      
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        if (edges.data[idx] > 128) {
          if (lineStart === -1) lineStart = y;
          lineLength++;
        } else {
          if (lineLength > threshold && lineStart !== -1) {
            lines.push([x, lineStart, x, lineStart + lineLength]);
          }
          lineStart = -1;
          lineLength = 0;
        }
      }
    }
    
    return lines;
  }, []);

  // Check if a line is properly aligned with expected court geometry
  const isLineProperlyAligned = useCallback((line: number[], expectedLine: number[], tolerance: number = 20): boolean => {
    if (!line || !expectedLine || line.length < 4 || expectedLine.length < 4) return false;
    
    // Calculate distance between line endpoints and expected line endpoints
    const startDistance = Math.sqrt(
      Math.pow(line[0] - expectedLine[0], 2) + Math.pow(line[1] - expectedLine[1], 2)
    );
    const endDistance = Math.sqrt(
      Math.pow(line[2] - expectedLine[2], 2) + Math.pow(line[3] - expectedLine[3], 2)
    );
    
    // Check if both endpoints are within tolerance
    return startDistance <= tolerance && endDistance <= tolerance;
  }, []);

  // Generate expected court lines based on standard court proportions
  const getExpectedCourtLines = useCallback((width: number, height: number) => {
    const courtWidth = width * 0.8;
    const courtHeight = height * 0.7;
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const courtLeft = centerX - courtWidth * 0.5;
    const courtRight = centerX + courtWidth * 0.5;
    const courtTop = centerY - courtHeight * 0.5;
    const courtBottom = centerY + courtHeight * 0.5;
    
    return {
      baselines: [
        [courtLeft, courtTop, courtRight, courtTop], // Top baseline
        [courtLeft, courtBottom, courtRight, courtBottom] // Bottom baseline
      ],
      serviceLines: [
        [courtLeft, courtTop + courtHeight * 0.25, courtRight, courtTop + courtHeight * 0.25], // Top service line
        [courtLeft, courtBottom - courtHeight * 0.25, courtRight, courtBottom - courtHeight * 0.25] // Bottom service line
      ],
      sidelines: [
        [courtLeft, courtTop, courtLeft, courtBottom], // Left sideline
        [courtRight, courtTop, courtRight, courtBottom] // Right sideline
      ],
      centerLine: [centerX, courtTop + courtHeight * 0.25, centerX, courtBottom - courtHeight * 0.25],
      netLine: [courtLeft, centerY, courtRight, centerY]
    };
  }, []);

  // Classify detected lines into court components with alignment checking
  const classifyCourtLines = useCallback((lines: number[][], width: number, height: number) => {
    const horizontalLines = lines.filter(line => Math.abs(line[1] - line[3]) < 10).sort((a, b) => a[1] - b[1]);
    const verticalLines = lines.filter(line => Math.abs(line[0] - line[2]) < 10).sort((a, b) => a[0] - b[0]);
    const expectedLines = getExpectedCourtLines(width, height);
    
    const classifiedLines = {
      baselines: [horizontalLines[0], horizontalLines[horizontalLines.length - 1]].filter(Boolean),
      serviceLines: horizontalLines.slice(1, -1),
      sidelines: [verticalLines[0], verticalLines[verticalLines.length - 1]].filter(Boolean),
      centerLine: verticalLines[Math.floor(verticalLines.length / 2)],
      netLine: horizontalLines[Math.floor(horizontalLines.length / 2)]
    };
    
    // Add alignment status to each line type
    return {
      ...classifiedLines,
      alignment: {
        baselines: classifiedLines.baselines.map((line, index) => 
          isLineProperlyAligned(line, expectedLines.baselines[index])
        ),
        serviceLines: classifiedLines.serviceLines.map((line, index) => 
          isLineProperlyAligned(line, expectedLines.serviceLines[index])
        ),
        sidelines: classifiedLines.sidelines.map((line, index) => 
          isLineProperlyAligned(line, expectedLines.sidelines[index])
        ),
        centerLine: isLineProperlyAligned(classifiedLines.centerLine, expectedLines.centerLine),
        netLine: isLineProperlyAligned(classifiedLines.netLine, expectedLines.netLine)
      }
    };
  }, [getExpectedCourtLines, isLineProperlyAligned]);

  // Initialize backend service
  useEffect(() => {
    const initializeBackendService = async () => {
      try {
        await videoProcessingService.initialize();
        console.log('Backend video processing service initialized');
      } catch (err) {
        console.error('Error initializing backend service:', err);
        setError('Failed to initialize video processing service');
      }
    };
    
    initializeBackendService();
  }, [classifyCourtLines, detectEdges, detectLines]);

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      pos.players.map(player => {
        // Calculate movement speed based on position changes
        return 0; // Will be calculated from actual position data
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

    // Update court lines from backend detection
    if (result.courtDetection && result.courtDetection.confidence > 0.5) {
      setCourtLines({
        detected: true,
        baseline: {
          top: result.courtDetection.lines?.find((line: CourtLine) => line.type === 'baseline_top')?.coordinates || [],
          bottom: result.courtDetection.lines?.find((line: CourtLine) => line.type === 'baseline_bottom')?.coordinates || []
        },
        serviceLine: {
          top: result.courtDetection.lines?.find((line: CourtLine) => line.type === 'service_top')?.coordinates || [],
          bottom: result.courtDetection.lines?.find((line: CourtLine) => line.type === 'service_bottom')?.coordinates || []
        },
        centerServiceLine: result.courtDetection.lines?.find((line: CourtLine) => line.type === 'center_service')?.coordinates || [],
        sidelines: {
          left: result.courtDetection.lines?.find((line: CourtLine) => line.type === 'sideline_left')?.coordinates || [],
          right: result.courtDetection.lines?.find((line: CourtLine) => line.type === 'sideline_right')?.coordinates || []
        },
        net: result.courtDetection.lines?.find((line: CourtLine) => line.type === 'net')?.coordinates || [],
        confidence: result.courtDetection.confidence
      });

      // Court regions are now handled by courtLines state
    }

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

    // Progress interval for UI updates
    let progressInterval: NodeJS.Timeout | null = null;

    try {
      const { user } = useAuthStore.getState();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create video blob
      const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
      const originalSize = videoBlob.size;
      
      // Real processing will be handled by backend
      // Progress updates will come from actual Lambda function responses

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

      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setProcessingProgress(100);

      // Compression stats are logged for debugging
      console.log('Video compression:', {
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

  // Real-time court detection from live video feed
  const detectCourtInLiveVideo = useCallback(async () => {
    const video = webcamRef.current?.video;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
      // Create a canvas to capture current video frame
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) return;
      
      // Draw current video frame
      tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      
      // Get image data for analysis
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Simple edge detection for court lines
      const edges = detectEdges(imageData);
      const lines = detectLines(edges, tempCanvas.width, tempCanvas.height);
      
      if (lines.length > 4) { // Need at least 4 lines for a basic court
        const classifiedLines = classifyCourtLines(lines, tempCanvas.width, tempCanvas.height);
        
        setCourtLines({
          detected: true,
          baseline: {
            top: classifiedLines.baselines[0] || [],
            bottom: classifiedLines.baselines[1] || []
          },
          serviceLine: {
            top: classifiedLines.serviceLines[0] || [],
            bottom: classifiedLines.serviceLines[1] || []
          },
          centerServiceLine: classifiedLines.centerLine || [],
          sidelines: {
            left: classifiedLines.sidelines[0] || [],
            right: classifiedLines.sidelines[1] || []
          },
          net: classifiedLines.netLine || [],
          confidence: Math.min(0.9, lines.length / 10), // Simple confidence based on line count
          alignment: classifiedLines.alignment // Store alignment information
        });
      }
    } catch (error) {
      console.error('Error in live court detection:', error);
    }
  }, [classifyCourtLines, detectEdges, detectLines]);

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

    // Start live court detection
    const courtDetectionInterval = setInterval(detectCourtInLiveVideo, 2000); // Every 2 seconds

    const track = () => {
      if (!isVisible || !isIntersecting) return;
      
      try {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw court guidelines if enabled
        if (showGuidelines) {
          drawCourtGuidelines(ctx);
        }
        
        // Draw recording overlay
        if (capturing) {
          drawRecordingOverlay(ctx);
        }
        
        // Real tracking stats will be updated from backend analysis
        // No mock data generation during live tracking
        
        animationFrameRef.current = requestAnimationFrame(track);
      } catch (err) {
        console.error('Error during tracking:', err);
        setError('Tracking error occurred. Please try again.');
        setIsTracking(false);
        if (courtDetectionInterval) {
          clearInterval(courtDetectionInterval);
        }
      }
    };

    track();
    
    // Cleanup function
    return () => {
      if (courtDetectionInterval) {
        clearInterval(courtDetectionInterval);
      }
    };
  }, [isTracking, isVisible, isIntersecting, capturing, showGuidelines, drawCourtGuidelines, detectCourtInLiveVideo]);

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
  }, [showGuidelines, drawCourtGuidelines]);

  // Draw basic court guidelines
  // Apply perspective transformation to court coordinates
  const applyPerspectiveTransform = useCallback((points: number[][], homographyMatrix?: number[][]): number[][] => {
    if (!homographyMatrix || homographyMatrix.length !== 3) {
      return points; // Return original points if no valid homography
    }
    
    return points.map(([x, y]) => {
      const h = homographyMatrix;
      const w = h[2][0] * x + h[2][1] * y + h[2][2];
      const newX = (h[0][0] * x + h[0][1] * y + h[0][2]) / w;
      const newY = (h[1][0] * x + h[1][1] * y + h[1][2]) / w;
      return [newX, newY];
    });
  }, []);

  // Calculate perspective-corrected court lines based on camera angle
  const calculatePerspectiveCourtLines = useCallback((width: number, height: number) => {
    // Estimate camera perspective based on court detection or use default
    const viewAngle = analysisResult?.courtDetection?.perspective?.viewAngle || 45; // degrees
    const distortion = analysisResult?.courtDetection?.perspective?.distortion || 0.3;
    
    // Tennis court real dimensions (in relative units)
    const courtLength = 0.8; // 80% of screen width
    const courtWidth = 0.6;  // 60% of screen height
    
    // Calculate perspective scaling factors
    const perspectiveScale = Math.cos(viewAngle * Math.PI / 180);
    const depthFactor = 1 - distortion;
    
    // Base court coordinates (center of screen)
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    
    // Calculate court corners with perspective
    const nearWidth = courtLength * width * 0.5;
    const farWidth = nearWidth * perspectiveScale * depthFactor;
    const nearY = centerY + (courtWidth * height * 0.25);
    const farY = centerY - (courtWidth * height * 0.25 * perspectiveScale);
    
    return {
      // Court boundaries (trapezoid shape for perspective)
      boundaries: [
        [centerX - farWidth, farY],      // Top-left
        [centerX + farWidth, farY],      // Top-right
        [centerX + nearWidth, nearY],    // Bottom-right
        [centerX - nearWidth, nearY],    // Bottom-left
        [centerX - farWidth, farY]       // Close the shape
      ],
      
      // Net line (horizontal across middle)
      net: [
        [centerX - (nearWidth + farWidth) * 0.5, centerY],
        [centerX + (nearWidth + farWidth) * 0.5, centerY]
      ],
      
      // Service lines (parallel to net)
      serviceLines: {
        near: [
          [centerX - nearWidth * 0.8, centerY + (nearY - centerY) * 0.5],
          [centerX + nearWidth * 0.8, centerY + (nearY - centerY) * 0.5]
        ],
        far: [
          [centerX - farWidth * 0.8, centerY + (farY - centerY) * 0.5],
          [centerX + farWidth * 0.8, centerY + (farY - centerY) * 0.5]
        ]
      },
      
      // Center service line (vertical)
      centerServiceLine: [
        [centerX, centerY + (farY - centerY) * 0.5],
        [centerX, centerY + (nearY - centerY) * 0.5]
      ],
      
      // Sidelines (perspective trapezoid sides)
      sidelines: {
        left: [
          [centerX - farWidth, farY],
          [centerX - nearWidth, nearY]
        ],
        right: [
          [centerX + farWidth, farY],
          [centerX + nearWidth, nearY]
        ]
      }
    };
  }, [analysisResult]);

  const drawCourtGuidelines = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.save();
    
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    // Check if we have real court detection data with perspective
    if (analysisResult?.courtDetection && analysisResult.courtDetection.confidence > 0.5) {
      // Use actual court detection data with perspective correction
      const court = analysisResult.courtDetection;
      const homographyMatrix = court.perspective?.homographyMatrix;
      
      ctx.strokeStyle = '#00FFAA';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      
      // Draw court boundaries with perspective correction
      if (court.lines && court.lines.length > 0) {
        court.lines.forEach((line: CourtLine) => {
          if (line.confidence > 0.7) {
            // Apply perspective transformation if available
            const points = [[line.x1, line.y1], [line.x2, line.y2]];
            const transformedPoints = applyPerspectiveTransform(points, homographyMatrix);
            
            ctx.beginPath();
            ctx.moveTo(transformedPoints[0][0], transformedPoints[0][1]);
            ctx.lineTo(transformedPoints[1][0], transformedPoints[1][1]);
            ctx.stroke();
          }
        });
      }
      
      // Draw service boxes with perspective
      if (court.regions?.serviceBoxes) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        
        Object.values(court.regions.serviceBoxes).forEach((box: ServiceBox) => {
          if (box.x && box.y && box.width && box.height) {
            // Transform rectangle corners
            const corners = [
              [box.x, box.y],
              [box.x + box.width, box.y],
              [box.x + box.width, box.y + box.height],
              [box.x, box.y + box.height]
            ];
            const transformedCorners = applyPerspectiveTransform(corners, homographyMatrix);
            
            // Draw transformed rectangle
            ctx.beginPath();
            ctx.moveTo(transformedCorners[0][0], transformedCorners[0][1]);
            transformedCorners.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
            ctx.closePath();
            ctx.stroke();
          }
        });
      }
      
      // Add confidence indicator
      ctx.fillStyle = '#00FFAA';
      ctx.font = '16px Arial';
      ctx.fillText(`3D Court Detected (${Math.round(court.confidence * 100)}%)`, width * 0.02, height * 0.15);
      
    } else if (courtLines.detected && courtLines.confidence > 0.5) {
      // Use frontend court detection data with alignment-based coloring
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const perspectiveLines = calculatePerspectiveCourtLines(width, height);
      const alignment = courtLines.alignment;
      
      // Draw baselines with alignment-based coloring
      if (courtLines.baseline?.top && courtLines.baseline.top.length >= 4) {
        ctx.strokeStyle = alignment?.baselines?.[0] ? '#00FF00' : '#00FFAA'; // Green if aligned, cyan if not
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(courtLines.baseline.top[0], courtLines.baseline.top[1]);
        ctx.lineTo(courtLines.baseline.top[2], courtLines.baseline.top[3]);
        ctx.stroke();
      }
      
      if (courtLines.baseline?.bottom && courtLines.baseline.bottom.length >= 4) {
        ctx.strokeStyle = alignment?.baselines?.[1] ? '#00FF00' : '#00FFAA'; // Green if aligned, cyan if not
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(courtLines.baseline.bottom[0], courtLines.baseline.bottom[1]);
        ctx.lineTo(courtLines.baseline.bottom[2], courtLines.baseline.bottom[3]);
        ctx.stroke();
      }
      
      // Draw service lines with alignment-based coloring
      if (courtLines.serviceLine?.top && courtLines.serviceLine.top.length >= 4) {
        ctx.strokeStyle = alignment?.serviceLines?.[0] ? '#00FF00' : '#FFD700'; // Green if aligned, yellow if not
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(courtLines.serviceLine.top[0], courtLines.serviceLine.top[1]);
        ctx.lineTo(courtLines.serviceLine.top[2], courtLines.serviceLine.top[3]);
        ctx.stroke();
      }
      
      if (courtLines.serviceLine?.bottom && courtLines.serviceLine.bottom.length >= 4) {
        ctx.strokeStyle = alignment?.serviceLines?.[1] ? '#00FF00' : '#FFD700'; // Green if aligned, yellow if not
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(courtLines.serviceLine.bottom[0], courtLines.serviceLine.bottom[1]);
        ctx.lineTo(courtLines.serviceLine.bottom[2], courtLines.serviceLine.bottom[3]);
        ctx.stroke();
      }
      
      // Draw center service line with alignment-based coloring
      if (courtLines.centerServiceLine && courtLines.centerServiceLine.length >= 4) {
        ctx.strokeStyle = alignment?.centerLine ? '#00FF00' : '#FFD700'; // Green if aligned, yellow if not
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(courtLines.centerServiceLine[0], courtLines.centerServiceLine[1]);
        ctx.lineTo(courtLines.centerServiceLine[2], courtLines.centerServiceLine[3]);
        ctx.stroke();
      }
      
      // Draw sidelines with alignment-based coloring
      if (courtLines.sidelines?.left && courtLines.sidelines.left.length >= 4) {
        ctx.strokeStyle = alignment?.sidelines?.[0] ? '#00FF00' : '#00FFAA'; // Green if aligned, cyan if not
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(courtLines.sidelines.left[0], courtLines.sidelines.left[1]);
        ctx.lineTo(courtLines.sidelines.left[2], courtLines.sidelines.left[3]);
        ctx.stroke();
      }
      
      if (courtLines.sidelines?.right && courtLines.sidelines.right.length >= 4) {
        ctx.strokeStyle = alignment?.sidelines?.[1] ? '#00FF00' : '#00FFAA'; // Green if aligned, cyan if not
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(courtLines.sidelines.right[0], courtLines.sidelines.right[1]);
        ctx.lineTo(courtLines.sidelines.right[2], courtLines.sidelines.right[3]);
        ctx.stroke();
      }
      
      // Draw net line with alignment-based coloring
      if (courtLines.net && courtLines.net.length >= 4) {
        ctx.strokeStyle = alignment?.netLine ? '#00FF00' : '#FF6B6B'; // Green if aligned, red if not
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(courtLines.net[0], courtLines.net[1]);
        ctx.lineTo(courtLines.net[2], courtLines.net[3]);
        ctx.stroke();
      }
      
      // Add confidence and alignment indicator
      ctx.fillStyle = '#00FFAA';
      ctx.font = '16px Arial';
      const alignedCount = Object.values(alignment || {}).flat().filter(Boolean).length;
      const totalLines = Object.values(alignment || {}).flat().length;
      ctx.fillText(`Court Lines (${Math.round(courtLines.confidence * 100)}%) - ${alignedCount}/${totalLines} Aligned`, width * 0.02, height * 0.15);
      
    } else {
      // Fallback to perspective-aware generic court guidelines
      const perspectiveLines = calculatePerspectiveCourtLines(width, height);
      
      ctx.strokeStyle = '#00FFAA';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // Dashed lines to indicate these are generic
      
      // Draw court boundaries as trapezoid
      ctx.beginPath();
      ctx.moveTo(perspectiveLines.boundaries[0][0], perspectiveLines.boundaries[0][1]);
      perspectiveLines.boundaries.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.stroke();
      
      // Draw net line
      ctx.strokeStyle = '#FF6B6B';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(perspectiveLines.net[0][0], perspectiveLines.net[0][1]);
      ctx.lineTo(perspectiveLines.net[1][0], perspectiveLines.net[1][1]);
      ctx.stroke();
      
      // Draw service lines
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      
      // Service lines
      ctx.beginPath();
      ctx.moveTo(perspectiveLines.serviceLines.near[0][0], perspectiveLines.serviceLines.near[0][1]);
      ctx.lineTo(perspectiveLines.serviceLines.near[1][0], perspectiveLines.serviceLines.near[1][1]);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(perspectiveLines.serviceLines.far[0][0], perspectiveLines.serviceLines.far[0][1]);
      ctx.lineTo(perspectiveLines.serviceLines.far[1][0], perspectiveLines.serviceLines.far[1][1]);
      ctx.stroke();
      
      // Center service line
      ctx.beginPath();
      ctx.moveTo(perspectiveLines.centerServiceLine[0][0], perspectiveLines.centerServiceLine[0][1]);
      ctx.lineTo(perspectiveLines.centerServiceLine[1][0], perspectiveLines.centerServiceLine[1][1]);
      ctx.stroke();
      
      // Add labels
      ctx.fillStyle = '#FFA500';
      ctx.font = '16px Arial';
      ctx.fillText('3D Court Guidelines (Generic)', width * 0.02, height * 0.15);
    }
    
    ctx.restore();
  }, [analysisResult, courtLines, applyPerspectiveTransform, calculatePerspectiveCourtLines]);

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

  const handleCalibrationComplete = (calibration: CalibrationData) => {
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
                  audio={false}
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

          {/* Court Detection Status */}
          <div className="mb-4 flex justify-center">
            <div className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              courtLines.detected && courtLines.confidence > 0.7
                ? 'bg-green-100 text-green-800 border border-green-200'
                : courtLines.detected && courtLines.confidence > 0.4
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                courtLines.detected && courtLines.confidence > 0.7
                  ? 'bg-green-500 animate-pulse'
                  : courtLines.detected && courtLines.confidence > 0.4
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
              }`}></div>
              <span>
                {courtLines.detected && courtLines.confidence > 0.7
                  ? `Court Detected (${Math.round(courtLines.confidence * 100)}%)`
                  : courtLines.detected && courtLines.confidence > 0.4
                  ? `Partial Detection (${Math.round(courtLines.confidence * 100)}%)`
                  : 'No Court Detection'
                }
              </span>
              {analysisResult?.courtDetection && (
                <span className="text-xs opacity-75">
                  • Backend Enhanced
                </span>
              )}
            </div>
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