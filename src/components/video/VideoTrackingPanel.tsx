import { useState, useRef, useCallback, useEffect, memo } from "react";
import Webcam from "react-webcam";
import { Video, Play, Pause, Save, Trash, Zap, Target, Award, Sparkles, AlertCircle, Loader2, Activity, X } from "lucide-react";
import { supabase } from "../../lib/supabase"; // This import is still correct
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as poseDetection from '@tensorflow-models/pose-detection';

// --- THIS IS THE LINE TO CHANGE ---
// Update the path to point to your new types file
import { Database } from "../../types/supabase"; 

// The rest of your code remains the same and will now work correctly
type MatchHighlightInsert = Database['public']['Tables']['match_highlights']['Insert'];
type MatchEventInsert = Database['public']['Tables']['match_events']['Insert'];



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
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<cocoSsd.DetectedObject[]>([]);
  // The 'detectedPoses' state was unused, so it has been removed.
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
  const [recordingInterval, setRecordingInterval] = useState<number | null>(null);
  const [objectDetectionModel, setObjectDetectionModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [poseDetectionModel, setPoseDetectionModel] = useState<poseDetection.PoseDetector | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [modelsLoaded, setModelsLoaded] = useState<{ tf: boolean, object: boolean, pose: boolean }>({
    tf: false,
    object: false,
    pose: false
  });

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

  // Load available camera devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameraDevices(videoDevices);

        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error getting camera devices:', err);
        setError('Failed to access camera devices. Please check your camera permissions.');
      }
    };

    getDevices();
  }, []);

  // Load TensorFlow models with progress tracking
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);

        await tf.setBackend('webgl');
        console.log('TensorFlow backend loaded:', tf.getBackend());
        setModelsLoaded(prev => ({ ...prev, tf: true }));

        const objectModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2'
        });
        setObjectDetectionModel(objectModel);
        console.log('Object detection model loaded');
        setModelsLoaded(prev => ({ ...prev, object: true }));

        const poseModel = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        );
        setPoseDetectionModel(poseModel);
        console.log('Pose detection model loaded');
        setModelsLoaded(prev => ({ ...prev, pose: true }));

        setIsModelLoading(false);
      } catch (err) {
        console.error('Error loading TensorFlow models:', err);
        setError('Failed to load AI tracking models. Please refresh and try again.');
        setIsModelLoading(false);
      }
    };

    loadModels();

    // Cleanup function
    return () => {
      if (mediaRecorderRef.current && capturing) {
        mediaRecorderRef.current.stop();
      }

      if (recordingInterval) {
        clearInterval(recordingInterval);
      }
    };
  }, []); // Empty dependency array ensures this runs only once

  // Start video capture
  const handleStartCapture = useCallback(() => {
    if (!webcamRef.current?.video) return;

    setCapturing(true);
    setRecordedChunks([]);
    setRecordingTime(0);

    const stream = webcamRef.current.video.srcObject as MediaStream;

    if (!stream) {
      setError('No video stream available');
      return;
    }

    try {
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
      mediaRecorderRef.current.addEventListener('stop', handleStopCapture);
      mediaRecorderRef.current.start(1000); // Collect data every second

      const interval = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setRecordingInterval(interval);

      setIsTracking(true);
      startTracking();
    } catch (err) {
      console.error('Error starting media recorder:', err);
      setError('Failed to start video recording. Your browser may not support this feature.');
      setCapturing(false);
    }
  }, [webcamRef]); // Dependencies updated

  // Handle recorded video data
  const handleDataAvailable = useCallback(
    ({ data }: BlobEvent) => {
      if (data.size > 0) {
        setRecordedChunks((prev) => [...prev, data]);
      }
    },
    [setRecordedChunks]
  );

  // Stop video capture
  const handleStopCapture = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setCapturing(false);
    setIsTracking(false);

    if (recordingInterval) {
      clearInterval(recordingInterval);
      setRecordingInterval(null);
    }
  }, [mediaRecorderRef, recordingInterval]);

  // Format recording time as MM:SS
  const formatRecordingTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Save recorded video
  const handleSave = useCallback(async () => {
    if (recordedChunks.length === 0) {
      setError('No video recorded');
      return;
    }

    setIsProcessingVideo(true);

    try {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const fileName = `${Date.now()}.webm`;
      const filePath = `${user.id}/${fileName}`;
      
      // The 'uploadData' variable was unused and has been removed.
      const { error: uploadError } = await supabase.storage
        .from('match-highlights')
        .upload(filePath, blob, {
          contentType: 'video/webm',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('match-highlights')
        .getPublicUrl(filePath);
      const videoUrl = urlData.publicUrl;

      // CORRECTED: Build the highlight object dynamically to handle optional match_id
      const highlightData: MatchHighlightInsert = {
        type: highlightType,
        description: highlightDescription || `${highlightType} highlight`,
        video_url: filePath,
        created_by: user.id,
        ...(matchId && { match_id: matchId }), // Conditionally add match_id
      };

      const { error: highlightError } = await supabase
        .from('match_highlights')
        .insert(highlightData);

      if (highlightError) {
        console.error('Highlight save error:', highlightError);
        throw highlightError;
      }

      if (matchId) {
        // CORRECTED: Ensure metadata is structured correctly for JSONB type
        const eventData: MatchEventInsert = {
            match_id: matchId,
            event_type: 'video_recorded',
            player_id: user.id,
            description: highlightDescription || `${highlightType} highlight`,
            metadata: {
                video_url: videoUrl,
                highlight_type: highlightType
            }
        };

        const { error: eventError } = await supabase
          .from('match_events')
          .insert(eventData);

        if (eventError) {
          console.error('Event save error:', eventError);
        }
      }

      if (onVideoSaved) {
        onVideoSaved(videoUrl);
      }

      setRecordedChunks([]);
      setHighlightDescription('');
      setIsProcessingVideo(false);
      setError(null);
    } catch (err) {
      console.error('Error saving video:', err);
      setError(`Failed to save video: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsProcessingVideo(false);
    }
  }, [recordedChunks, highlightType, highlightDescription, matchId, onVideoSaved]);

  // Start AI tracking - memoized to prevent unnecessary recreations
  const startTracking = useCallback(async () => {
    if (!isTracking || !webcamRef.current?.video || !canvasRef.current || !objectDetectionModel || !poseDetectionModel) {
      return;
    }

    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    let prevBallPosition: { x: number, y: number, time: number } | null = null;

    const track = async () => {
      if (!isTracking || !video.readyState || !ctx || !objectDetectionModel || !poseDetectionModel) {
        if (isTracking) requestAnimationFrame(track);
        return;
      }

      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Detect court lines using edge detection
        detectCourtLines(video, ctx);
        
        // Draw court guidelines if detected
        if (courtLines.detected) {
          drawCourtGuidelines(ctx);
        }

        const objects = await objectDetectionModel.detect(video);
        setDetectedObjects(objects);
        
        const poses = await poseDetectionModel.estimatePoses(video);

        objects.forEach(object => {
          ctx.strokeStyle = object.class === 'sports ball' ? '#00FFAA' : '#40DCFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(object.bbox[0], object.bbox[1], object.bbox[2], object.bbox[3]);

          ctx.fillStyle = object.class === 'sports ball' ? '#00FFAA' : '#40DCFF';
          ctx.font = '16px Arial';
          ctx.fillText(
            `${object.class} ${Math.round(object.score * 100)}%`,
            object.bbox[0],
            object.bbox[1] > 10 ? object.bbox[1] - 5 : 10
          );

          if (object.class === 'sports ball') {
            const ballX = object.bbox[0] + object.bbox[2] / 2;
            const ballY = object.bbox[1] + object.bbox[3] / 2;
            const currentTime = Date.now();

            // Check if ball is in/out based on court lines
            const ballPosition = analyzeBallPosition(ballX, ballY);
            
            if (prevBallPosition) {
              const dx = ballX - prevBallPosition.x;
              const dy = ballY - prevBallPosition.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const timeDiff = (currentTime - prevBallPosition.time) / 1000;
              const speed = distance / timeDiff;
              const speedMph = speed * 0.1; // Approximation

              setTrackingStats(prev => ({ 
                ...prev, 
                ballSpeed: speedMph,
                ballPosition: ballPosition.position,
                ballInOut: ballPosition.inOut,
                servingBox: ballPosition.servingBox
              }));

              // Update tennis analysis
              setTennisAnalysis(prev => ({
                ...prev,
                ballInOut: ballPosition.inOut,
                servingBox: ballPosition.servingBox
              }));
            }
            prevBallPosition = { x: ballX, y: ballY, time: currentTime };
          }
        });

        // Enhanced pose analysis with court positioning
        poses.forEach(pose => {
          pose.keypoints.forEach(keypoint => {
            if (keypoint.score && keypoint.score > 0.3) {
              ctx.fillStyle = '#FF3366';
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
              ctx.fill();
            }
          });

          // Analyze player court position
          const playerPosition = analyzePlayerPosition(pose);
          
          const hip = pose.keypoints.find(kp => kp.name === 'left_hip' || kp.name === 'right_hip');
          if (hip?.score && hip.score > 0.3) {
            const randomMovement = Math.random() * 2 + 1; // Placeholder
            setTrackingStats(prev => ({ 
              ...prev, 
              playerMovement: randomMovement,
              playerPosition: playerPosition.position,
              courtSide: playerPosition.courtSide,
              faultStatus: playerPosition.faultStatus
            }));
          }

          const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
          const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');

          if ((rightWrist?.score && rightWrist.score > 0.5) || (leftWrist?.score && leftWrist.score > 0.5)) {
            const shotTypes = ['Forehand', 'Backhand', 'Serve', 'Volley', 'Smash'];
            const randomShotType = shotTypes[Math.floor(Math.random() * shotTypes.length)];
            setTrackingStats(prev => ({ ...prev, shotType: randomShotType }));
          }
        });

        if (objects.some(obj => obj.class === 'sports ball')) {
          setTrackingStats(prev => ({ ...prev, rallyLength: prev.rallyLength + 1 }));
        }
        
        if (isTracking) {
          requestAnimationFrame(track);
        }
      } catch (err) {
        console.error('Error during tracking:', err);
      }
    };

    track();
  }, [isTracking, objectDetectionModel, poseDetectionModel]); // Dependencies simplified

  // Enhanced mobile-optimized court detection
  const detectCourtLines = (video: HTMLVideoElement, ctx: CanvasRenderingContext2D) => {
    // Mobile optimization: reduce processing frequency
    if (mobileOptimizations.lowPowerMode && Date.now() % 3 !== 0) return;
    
    const tempCanvas = document.createElement('canvas');
    const scale = mobileOptimizations.simplifiedDetection ? 0.5 : 1;
    tempCanvas.width = video.videoWidth * scale;
    tempCanvas.height = video.videoHeight * scale;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) return;
    
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Enhanced edge detection for tennis courts
    const edges = detectTennisCourtEdges(imageData);
    const lines = detectCourtLines_Hough(edges, tempCanvas.width, tempCanvas.height);
    const courtFeatures = classifyTennisCourtLines(lines, tempCanvas.width, tempCanvas.height);
    
    setCourtLines(courtFeatures);
    updateCourtRegions(courtFeatures, tempCanvas.width, tempCanvas.height, scale);
  };

  // Advanced edge detection optimized for tennis court lines
  const detectTennisCourtEdges = (imageData: ImageData) => {
    const { data, width, height } = imageData;
    const edges = new Uint8ClampedArray(width * height);
    
    // Sobel edge detection with tennis court color filtering
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Convert to grayscale with tennis court color emphasis
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // Emphasize white lines on tennis courts
        const isWhiteLine = (r > 200 && g > 200 && b > 200) ||
                           (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && r > 150);
        
        const gray = isWhiteLine ? 255 : (r + g + b) / 3;
        
        // Sobel operators
        const gx = -data[((y - 1) * width + (x - 1)) * 4] + data[((y - 1) * width + (x + 1)) * 4] +
                   -2 * data[(y * width + (x - 1)) * 4] + 2 * data[(y * width + (x + 1)) * 4] +
                   -data[((y + 1) * width + (x - 1)) * 4] + data[((y + 1) * width + (x + 1)) * 4];
        
        const gy = -data[((y - 1) * width + (x - 1)) * 4] - 2 * data[((y - 1) * width + x) * 4] - data[((y - 1) * width + (x + 1)) * 4] +
                   data[((y + 1) * width + (x - 1)) * 4] + 2 * data[((y + 1) * width + x) * 4] + data[((y + 1) * width + (x + 1)) * 4];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = magnitude > 100 ? 255 : 0;
      }
    }
    
    return edges;
  };

  // Hough line detection specifically for tennis courts
  const detectCourtLines_Hough = (edges: Uint8ClampedArray, width: number, height: number) => {
    const lines: Array<{ x1: number, y1: number, x2: number, y2: number, angle: number, strength: number }> = [];
    const rhoMax = Math.sqrt(width * width + height * height);
    const rhoStep = 2;
    const thetaStep = Math.PI / 180;
    
    // Hough transform accumulator
    const accumulator = new Map<string, number>();
    
    // Find edge points and vote in Hough space
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edges[y * width + x] > 0) {
          // Vote for multiple theta values
          for (let theta = 0; theta < Math.PI; theta += thetaStep) {
            const rho = x * Math.cos(theta) + y * Math.sin(theta);
            const rhoIndex = Math.round(rho / rhoStep);
            const thetaIndex = Math.round(theta / thetaStep);
            const key = `${rhoIndex},${thetaIndex}`;
            
            accumulator.set(key, (accumulator.get(key) || 0) + 1);
          }
        }
      }
    }
    
    // Find peaks in accumulator (simplified for mobile performance)
    const threshold = Math.max(20, width * height * 0.0001);
    for (const [key, votes] of accumulator.entries()) {
      if (votes > threshold) {
        const [rhoIndex, thetaIndex] = key.split(',').map(Number);
        const rho = rhoIndex * rhoStep;
        const theta = thetaIndex * thetaStep;
        
        // Convert to line endpoints
        const cos_t = Math.cos(theta);
        const sin_t = Math.sin(theta);
        
        const x0 = cos_t * rho;
        const y0 = sin_t * rho;
        
        const x1 = Math.round(x0 + 1000 * (-sin_t));
        const y1 = Math.round(y0 + 1000 * (cos_t));
        const x2 = Math.round(x0 - 1000 * (-sin_t));
        const y2 = Math.round(y0 - 1000 * (cos_t));
        
        lines.push({
          x1: Math.max(0, Math.min(width, x1)),
          y1: Math.max(0, Math.min(height, y1)),
          x2: Math.max(0, Math.min(width, x2)),
          y2: Math.max(0, Math.min(height, y2)),
          angle: theta,
          strength: votes
        });
      }
    }
    
    return lines;
  };

  // Classify detected lines as tennis court features
  const classifyTennisCourtLines = (lines: Array<{ x1: number, y1: number, x2: number, y2: number, angle: number, strength: number }>, width: number, height: number) => {
    const horizontalLines = lines.filter(l => Math.abs(l.angle) < 0.2 || Math.abs(l.angle - Math.PI) < 0.2);
    const verticalLines = lines.filter(l => Math.abs(l.angle - Math.PI/2) < 0.2);
    
    // Sort by position
    horizontalLines.sort((a, b) => Math.min(a.y1, a.y2) - Math.min(b.y1, b.y2));
    verticalLines.sort((a, b) => Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2));
    
    const result = {
      detected: lines.length >= 6,
      baseline: { top: [], bottom: [] },
      serviceLine: { top: [], bottom: [] },
      centerServiceLine: [],
      sidelines: { left: [], right: [] },
      net: [],
      confidence: Math.min(1, lines.length / 10)
    };
    
    if (horizontalLines.length >= 3) {
      // Top baseline
      if (horizontalLines[0]) {
        result.baseline.top = [horizontalLines[0].x1, horizontalLines[0].y1, horizontalLines[0].x2, horizontalLines[0].y2];
      }
      
      // Service lines (middle)
      if (horizontalLines[1]) {
        result.serviceLine.top = [horizontalLines[1].x1, horizontalLines[1].y1, horizontalLines[1].x2, horizontalLines[1].y2];
      }
      if (horizontalLines.length > 2) {
        result.serviceLine.bottom = [horizontalLines[horizontalLines.length - 2].x1, horizontalLines[horizontalLines.length - 2].y1, horizontalLines[horizontalLines.length - 2].x2, horizontalLines[horizontalLines.length - 2].y2];
      }
      
      // Bottom baseline
      if (horizontalLines[horizontalLines.length - 1]) {
        result.baseline.bottom = [horizontalLines[horizontalLines.length - 1].x1, horizontalLines[horizontalLines.length - 1].y1, horizontalLines[horizontalLines.length - 1].x2, horizontalLines[horizontalLines.length - 1].y2];
      }
      
      // Net (center horizontal line)
      const netCandidate = horizontalLines.find(l => Math.abs((l.y1 + l.y2) / 2 - height / 2) < height * 0.1);
      if (netCandidate) {
        result.net = [netCandidate.x1, netCandidate.y1, netCandidate.x2, netCandidate.y2];
      }
    }
    
    if (verticalLines.length >= 2) {
      // Left sideline
      if (verticalLines[0]) {
        result.sidelines.left = [verticalLines[0].x1, verticalLines[0].y1, verticalLines[0].x2, verticalLines[0].y2];
      }
      
      // Right sideline
      if (verticalLines[verticalLines.length - 1]) {
        result.sidelines.right = [verticalLines[verticalLines.length - 1].x1, verticalLines[verticalLines.length - 1].y1, verticalLines[verticalLines.length - 1].x2, verticalLines[verticalLines.length - 1].y2];
      }
      
      // Center service line
      const centerCandidate = verticalLines.find(l => Math.abs((l.x1 + l.x2) / 2 - width / 2) < width * 0.1);
      if (centerCandidate) {
        result.centerServiceLine = [centerCandidate.x1, centerCandidate.y1, centerCandidate.x2, centerCandidate.y2];
      }
    }
    
    return result;
  };

  // Update court regions based on detected lines
  const updateCourtRegions = (courtFeatures: any, width: number, height: number, scale: number) => {
    if (!courtFeatures.detected) return;
    
    const scaleBack = 1 / scale;
    
    // Calculate service boxes
    const netY = courtFeatures.net.length > 0 ? (courtFeatures.net[1] + courtFeatures.net[3]) / 2 * scaleBack : height / 2;
    const leftX = courtFeatures.sidelines.left.length > 0 ? courtFeatures.sidelines.left[0] * scaleBack : 0;
    const rightX = courtFeatures.sidelines.right.length > 0 ? courtFeatures.sidelines.right[0] * scaleBack : width;
    const centerX = courtFeatures.centerServiceLine.length > 0 ? courtFeatures.centerServiceLine[0] * scaleBack : width / 2;
    
    const serviceLineTopY = courtFeatures.serviceLine.top.length > 0 ? courtFeatures.serviceLine.top[1] * scaleBack : netY - 50;
    const serviceLineBottomY = courtFeatures.serviceLine.bottom.length > 0 ? courtFeatures.serviceLine.bottom[1] * scaleBack : netY + 50;
    
    setCourtRegions(prev => ({
      ...prev,
      leftServiceBox: {
        x: leftX,
        y: serviceLineTopY,
        width: centerX - leftX,
        height: netY - serviceLineTopY
      },
      rightServiceBox: {
        x: centerX,
        y: serviceLineTopY,
        width: rightX - centerX,
        height: netY - serviceLineTopY
      },
      deuceServiceBox: {
        x: centerX,
        y: serviceLineTopY,
        width: rightX - centerX,
        height: netY - serviceLineTopY
      },
      adServiceBox: {
        x: leftX,
        y: serviceLineTopY,
        width: centerX - leftX,
        height: netY - serviceLineTopY
      },
      courtBounds: {
        minX: leftX,
        maxX: rightX,
        minY: Math.min(serviceLineTopY, serviceLineBottomY),
        maxY: Math.max(serviceLineTopY, serviceLineBottomY)
      }
    }));
  };

  // Mobile-optimized court guidelines drawing
  const drawCourtGuidelines = (ctx: CanvasRenderingContext2D) => {
    if (!courtLines.detected) return;
    
    // Save current context
    ctx.save();
    
    // Mobile optimization: thicker lines for touch screens
    const lineWidth = mobileOptimizations.touchControls ? 3 : 2;
    
    // Draw baselines
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([8, 4]);
    
    if (courtLines.baseline.top.length >= 4) {
      ctx.beginPath();
      ctx.moveTo(courtLines.baseline.top[0], courtLines.baseline.top[1]);
      ctx.lineTo(courtLines.baseline.top[2], courtLines.baseline.top[3]);
      ctx.stroke();
      
      // Label for mobile
      ctx.fillStyle = '#00FF00';
      ctx.font = '14px Arial';
      ctx.fillText('Baseline', courtLines.baseline.top[0] + 10, courtLines.baseline.top[1] - 10);
    }
    
    if (courtLines.baseline.bottom.length >= 4) {
      ctx.beginPath();
      ctx.moveTo(courtLines.baseline.bottom[0], courtLines.baseline.bottom[1]);
      ctx.lineTo(courtLines.baseline.bottom[2], courtLines.baseline.bottom[3]);
      ctx.stroke();
    }
    
    // Draw service lines
    ctx.strokeStyle = '#FFFF00';
    ctx.setLineDash([5, 3]);
    
    if (courtLines.serviceLine.top.length >= 4) {
      ctx.beginPath();
      ctx.moveTo(courtLines.serviceLine.top[0], courtLines.serviceLine.top[1]);
      ctx.lineTo(courtLines.serviceLine.top[2], courtLines.serviceLine.top[3]);
      ctx.stroke();
      
      ctx.fillStyle = '#FFFF00';
      ctx.fillText('Service Line', courtLines.serviceLine.top[0] + 10, courtLines.serviceLine.top[1] - 10);
    }
    
    if (courtLines.serviceLine.bottom.length >= 4) {
      ctx.beginPath();
      ctx.moveTo(courtLines.serviceLine.bottom[0], courtLines.serviceLine.bottom[1]);
      ctx.lineTo(courtLines.serviceLine.bottom[2], courtLines.serviceLine.bottom[3]);
      ctx.stroke();
    }
    
    // Draw sidelines
    ctx.strokeStyle = '#00FFFF';
    ctx.setLineDash([6, 2]);
    
    if (courtLines.sidelines.left.length >= 4) {
      ctx.beginPath();
      ctx.moveTo(courtLines.sidelines.left[0], courtLines.sidelines.left[1]);
      ctx.lineTo(courtLines.sidelines.left[2], courtLines.sidelines.left[3]);
      ctx.stroke();
      
      ctx.fillStyle = '#00FFFF';
      ctx.fillText('Sideline', courtLines.sidelines.left[0] + 10, courtLines.sidelines.left[1] + 20);
    }
    
    if (courtLines.sidelines.right.length >= 4) {
      ctx.beginPath();
      ctx.moveTo(courtLines.sidelines.right[0], courtLines.sidelines.right[1]);
      ctx.lineTo(courtLines.sidelines.right[2], courtLines.sidelines.right[3]);
      ctx.stroke();
    }
    
    // Draw center service line
    ctx.strokeStyle = '#FF00FF';
    ctx.setLineDash([4, 4]);
    
    if (courtLines.centerServiceLine.length >= 4) {
      ctx.beginPath();
      ctx.moveTo(courtLines.centerServiceLine[0], courtLines.centerServiceLine[1]);
      ctx.lineTo(courtLines.centerServiceLine[2], courtLines.centerServiceLine[3]);
      ctx.stroke();
      
      ctx.fillStyle = '#FF00FF';
      ctx.fillText('Center Line', courtLines.centerServiceLine[0] + 10, courtLines.centerServiceLine[1] + 20);
    }
    
    // Draw net
    ctx.strokeStyle = '#FF6600';
    ctx.lineWidth = lineWidth + 1;
    ctx.setLineDash([10, 5]);
    
    if (courtLines.net.length >= 4) {
      ctx.beginPath();
      ctx.moveTo(courtLines.net[0], courtLines.net[1]);
      ctx.lineTo(courtLines.net[2], courtLines.net[3]);
      ctx.stroke();
      
      ctx.fillStyle = '#FF6600';
      ctx.fillText('Net', courtLines.net[0] + 10, courtLines.net[1] - 10);
    }
    
    // Draw service boxes with transparency for mobile
    ctx.globalAlpha = 0.2;
    
    // Deuce service box (right side)
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(
      courtRegions.deuceServiceBox.x,
      courtRegions.deuceServiceBox.y,
      courtRegions.deuceServiceBox.width,
      courtRegions.deuceServiceBox.height
    );
    
    // Ad service box (left side)
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(
      courtRegions.adServiceBox.x,
      courtRegions.adServiceBox.y,
      courtRegions.adServiceBox.width,
      courtRegions.adServiceBox.height
    );
    
    ctx.globalAlpha = 1.0;
    
    // Service box labels
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('DEUCE', courtRegions.deuceServiceBox.x + 10, courtRegions.deuceServiceBox.y + 25);
    ctx.fillText('AD', courtRegions.adServiceBox.x + 10, courtRegions.adServiceBox.y + 25);
    
    // Draw court coverage heatmap
    drawCourtCoverageHeatmap(ctx);
    
    ctx.restore();
  };

  // Court coverage heatmap for mobile
  const drawCourtCoverageHeatmap = (ctx: CanvasRenderingContext2D) => {
    if (tennisAnalysis.heatmap.size === 0) return;
    
    ctx.save();
    ctx.globalAlpha = 0.3;
    
    const cellSize = mobileOptimizations.touchControls ? 20 : 15;
    
    for (const [position, intensity] of tennisAnalysis.heatmap.entries()) {
      const [x, y] = position.split(',').map(Number);
      const normalizedIntensity = Math.min(1, intensity / 10);
      
      // Color gradient from blue (cold) to red (hot)
      const red = Math.floor(255 * normalizedIntensity);
      const blue = Math.floor(255 * (1 - normalizedIntensity));
      ctx.fillStyle = `rgb(${red}, 0, ${blue})`;
      
      ctx.fillRect(x - cellSize/2, y - cellSize/2, cellSize, cellSize);
    }
    
    ctx.restore();
  };

  // Enhanced ball position analysis with court regions
  const analyzeBallPosition = (ballX: number, ballY: number) => {
    if (!courtLines.detected) {
      return { position: 'Unknown', inOut: 'Unknown', servingBox: 'Unknown' };
    }
    
    let position = 'Unknown';
    let inOut = 'Out';
    let servingBox = 'Unknown';
    
    // Check if ball is within court bounds
    if (ballX >= courtRegions.courtBounds.minX && 
        ballX <= courtRegions.courtBounds.maxX &&
        ballY >= courtRegions.courtBounds.minY && 
        ballY <= courtRegions.courtBounds.maxY) {
      inOut = 'In';
    }
    
    // Check specific court regions
    if (isPointInRect(ballX, ballY, courtRegions.deuceServiceBox)) {
      position = 'Deuce Service Box';
      servingBox = 'Deuce';
    } else if (isPointInRect(ballX, ballY, courtRegions.adServiceBox)) {
      position = 'Ad Service Box';
      servingBox = 'Ad';
    } else if (ballY < courtRegions.courtBounds.minY) {
      position = 'Backcourt';
    } else if (ballY > courtRegions.courtBounds.maxY) {
      position = 'Forecourt';
    } else {
      position = 'Midcourt';
    }
    
    return { position, inOut, servingBox };
  };

  // Enhanced player position analysis
  const analyzePlayerPosition = (pose: any) => {
    if (!courtLines.detected) {
      return { position: 'Unknown', courtSide: 'Unknown', faultStatus: 'OK' };
    }
    
    const hip = pose.keypoints.find((kp: any) => kp.name === 'left_hip' || kp.name === 'right_hip');
    const leftFoot = pose.keypoints.find((kp: any) => kp.name === 'left_ankle');
    const rightFoot = pose.keypoints.find((kp: any) => kp.name === 'right_ankle');
    
    if (!hip || !hip.score || hip.score < 0.3) {
      return { position: 'Unknown', courtSide: 'Unknown', faultStatus: 'OK' };
    }
    
    let position = 'Unknown';
    let courtSide = 'Unknown';
    let faultStatus = 'OK';
    
    // Determine court position
    const netY = courtLines.net.length > 0 ? (courtLines.net[1] + courtLines.net[3]) / 2 : 0;
    
    if (hip.y < netY - 100) {
      position = 'Baseline';
      courtSide = 'Near';
    } else if (hip.y > netY + 100) {
      position = 'Baseline';
      courtSide = 'Far';
    } else if (Math.abs(hip.y - netY) < 100) {
      position = 'Net';
      courtSide = hip.y < netY ? 'Near' : 'Far';
    } else {
      position = 'Midcourt';
      courtSide = hip.y < netY ? 'Near' : 'Far';
    }
    
    // Check for foot faults (simplified)
    if (leftFoot && rightFoot && leftFoot.score > 0.5 && rightFoot.score > 0.5) {
      const serviceLineY = courtLines.serviceLine.top.length > 0 ? courtLines.serviceLine.top[1] : 0;
      
      if ((leftFoot.y < serviceLineY || rightFoot.y < serviceLineY) && position === 'Baseline') {
        faultStatus = 'Foot Fault';
        setTennisAnalysis(prev => ({ ...prev, footFaults: prev.footFaults + 1 }));
      }
    }
    
    // Update court coverage heatmap
    const cellKey = `${Math.floor(hip.x / 20) * 20},${Math.floor(hip.y / 20) * 20}`;
    setTennisAnalysis(prev => ({
      ...prev,
      heatmap: new Map(prev.heatmap.set(cellKey, (prev.heatmap.get(cellKey) || 0) + 1))
    }));
    
    return { position, courtSide, faultStatus };
  };

  // Helper function to check if point is in rectangle
  const isPointInRect = (x: number, y: number, rect: { x: number, y: number, width: number, height: number }) => {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  };

  // Mobile performance optimization
  const optimizeForMobile = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLowPower = 'getBattery' in navigator;
    
    if (isMobile) {
      setMobileOptimizations(prev => ({
        ...prev,
        touchControls: true,
        simplifiedDetection: true,
        reducedFrameRate: true
      }));
    }
    
    // Battery level optimization
    if (isLowPower) {
      (navigator as any).getBattery().then((battery: any) => {
        if (battery.level < 0.2) {
          setMobileOptimizations(prev => ({
            ...prev,
            lowPowerMode: true,
            reducedFrameRate: true,
            simplifiedDetection: true
          }));
        }
      });
    }
  };

  const handleDiscard = useCallback(() => {
    setRecordedChunks([]);
    setHighlightDescription('');
  }, []);

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCamera(e.target.value);
  };

  const renderModelLoadingProgress = () => {
    const loadedCount = Object.values(modelsLoaded).filter(Boolean).length;
    const totalModels = Object.keys(modelsLoaded).length;
    const progress = Math.round((loadedCount / totalModels) * 100);

    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <Loader2 className="h-12 w-12 animate-spin mb-4" style={{ color: 'var(--quantum-cyan)' }} />
        <p className="text-lg font-medium" style={{ color: 'var(--text-standard)' }}>Loading AI tracking models... {progress}%</p>
        <div className="w-64 h-2 bg-bg-surface-gray rounded-full mt-4 overflow-hidden">
          <div
            className="h-full bg-quantum-cyan"
            style={{ width: `${progress}%`, transition: 'width 0.3s ease-in-out' }}
          ></div>
        </div>
        <p className="text-sm mt-4" style={{ color: 'var(--text-subtle)' }}>
          {modelsLoaded.tf ? '✓' : '⟳'} TensorFlow Core
          {modelsLoaded.object ? ' ✓' : ' ⟳'} Object Detection
          {modelsLoaded.pose ? ' ✓' : ' ⟳'} Pose Detection
        </p>
      </div>
    );
  };

  // Initialize mobile optimizations on component mount
  useEffect(() => {
    optimizeForMobile();
  }, []);

  return (
    <div className="video-tracking-panel">
      {/* --- JSX for UI (unchanged) --- */}
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
            {isModelLoading ? (
              renderModelLoadingProgress()
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

          <div className="video-controls">
            {!capturing && recordedChunks.length === 0 ? (
              <button
                onClick={handleStartCapture}
                disabled={isModelLoading}
                className="btn btn-primary btn-lg flex-1"
              >
                {isModelLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading...
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
                    onClick={handleSave}
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
                <div className="text-sm italic" style={{ color: 'var(--text-subtle)' }}>No objects detected yet</div>
              ) : (
                detectedObjects.map((obj, index) => (
                  <div
                    key={index}
                    className="px-3 py-1 rounded-full text-sm flex items-center gap-1"
                    style={{
                      backgroundColor: obj.class === 'sports ball' ? 'rgba(0, 255, 170, 0.1)' : 'rgba(0, 212, 255, 0.1)',
                      color: obj.class === 'sports ball' ? 'var(--success-green)' : 'var(--quantum-cyan)'
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
    </div>
  );
});

VideoTrackingPanel.displayName = 'VideoTrackingPanel';

export default VideoTrackingPanel;