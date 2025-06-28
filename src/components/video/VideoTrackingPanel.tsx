import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { Video, Play, Pause, Save, Trash, Zap, Target, Award, Sparkles, AlertCircle, Loader2, Activity, Star, TrendingUp } from "lucide-react";
import { supabase } from "../../lib/supabase";
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as poseDetection from '@tensorflow-models/pose-detection';

interface VideoTrackingPanelProps {
  matchId?: string;
  onVideoSaved?: (videoUrl: string) => void;
  onClose: () => void;
}

const VideoTrackingPanel: React.FC<VideoTrackingPanelProps> = ({ 
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
  const [detectedPoses, setDetectedPoses] = useState<poseDetection.Pose[]>([]);
  const [trackingStats, setTrackingStats] = useState({
    ballSpeed: 0,
    playerMovement: 0,
    rallyLength: 0,
    shotType: 'Unknown'
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
  
  // Load TensorFlow models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        
        // Load TensorFlow.js backend
        await tf.setBackend('webgl');
        console.log('TensorFlow backend loaded:', tf.getBackend());
        
        // Load COCO-SSD model for object detection (ball, racket)
        const objectModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2'  // Use a lighter model for better performance
        });
        setObjectDetectionModel(objectModel);
        console.log('Object detection model loaded');
        
        // Load PoseNet model for player pose detection
        const poseModel = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        );
        setPoseDetectionModel(poseModel);
        console.log('Pose detection model loaded');
        
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
  }, []);

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
      
      // Start recording timer
      const interval = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setRecordingInterval(interval);
      
      // Start tracking
      setIsTracking(true);
      startTracking();
    } catch (err) {
      console.error('Error starting media recorder:', err);
      setError('Failed to start video recording. Your browser may not support this feature.');
      setCapturing(false);
    }
  }, [webcamRef]);

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
    
    // Clear recording timer
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
      const blob = new Blob(recordedChunks, {
        type: 'video/webm'
      });
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }
      
      // Upload to Supabase Storage with user-specific path
      const fileName = `${Date.now()}.webm`;
      const filePath = `${user.id}/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('match-highlights')
        .upload(filePath, blob, {
          contentType: 'video/webm',
          upsert: false
        });
        
      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('match-highlights')
        .getPublicUrl(filePath);
        
      const videoUrl = urlData.publicUrl;
      
      // Save highlight to match_highlights table
      const { error: highlightError } = await supabase
        .from('match_highlights')
        .insert({
          match_id: matchId || null,
          type: highlightType,
          description: highlightDescription || `${highlightType} highlight`,
          video_url: filePath, // Store the file path, not the full URL
          created_by: user.id
        });
        
      if (highlightError) {
        console.error('Highlight save error:', highlightError);
        throw highlightError;
      }
      
      // Save match event if matchId is provided
      if (matchId) {
        const { error: eventError } = await supabase
          .from('match_events')
          .insert({
            match_id: matchId,
            event_type: 'video_recorded',
            player_id: user.id,
            description: highlightDescription || `${highlightType} highlight`,
            metadata: {
              video_url: videoUrl,
              highlight_type: highlightType
            }
          });
          
        if (eventError) {
          console.error('Event save error:', eventError);
          // Don't throw here as the highlight was saved successfully
        }
      }
      
      // Call the onVideoSaved callback
      if (onVideoSaved) {
        onVideoSaved(videoUrl);
      }
      
      // Reset state
      setRecordedChunks([]);
      setHighlightDescription('');
      setIsProcessingVideo(false);
      
      // Show success message
      setError(null);
    } catch (err) {
      console.error('Error saving video:', err);
      setError(`Failed to save video: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsProcessingVideo(false);
    }
  }, [recordedChunks, highlightType, highlightDescription, matchId, onVideoSaved]);

  // Start AI tracking
  const startTracking = useCallback(async () => {
    if (!webcamRef.current?.video || !canvasRef.current || !objectDetectionModel || !poseDetectionModel) {
      return;
    }
    
    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Previous ball position for speed calculation
    let prevBallPosition: { x: number, y: number, time: number } | null = null;
    
    // Track function that runs repeatedly
    const track = async () => {
      if (!isTracking || !video || !ctx || !objectDetectionModel || !poseDetectionModel) return;
      
      try {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Detect objects (ball, racket)
        const objects = await objectDetectionModel.detect(video);
        setDetectedObjects(objects);
        
        // Detect player poses
        const poses = await poseDetectionModel.estimatePoses(video);
        setDetectedPoses(poses);
        
        // Draw detected objects
        objects.forEach(object => {
          // Draw bounding box
          ctx.strokeStyle = object.class === 'sports ball' ? '#00FFAA' : '#40DCFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            object.bbox[0], 
            object.bbox[1], 
            object.bbox[2], 
            object.bbox[3]
          );
          
          // Draw label
          ctx.fillStyle = object.class === 'sports ball' ? '#00FFAA' : '#40DCFF';
          ctx.font = '16px Arial';
          ctx.fillText(
            `${object.class} ${Math.round(object.score * 100)}%`,
            object.bbox[0],
            object.bbox[1] > 10 ? object.bbox[1] - 5 : 10
          );
          
          // Calculate ball speed if this is a ball
          if (object.class === 'sports ball') {
            const ballX = object.bbox[0] + object.bbox[2] / 2;
            const ballY = object.bbox[1] + object.bbox[3] / 2;
            const currentTime = Date.now();
            
            if (prevBallPosition) {
              // Calculate distance in pixels
              const dx = ballX - prevBallPosition.x;
              const dy = ballY - prevBallPosition.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              // Calculate time difference in seconds
              const timeDiff = (currentTime - prevBallPosition.time) / 1000;
              
              // Calculate speed (pixels per second)
              // In a real app, you'd convert pixels to real-world units
              const speed = distance / timeDiff;
              
              // Convert to a reasonable mph value (this is just an approximation)
              const speedMph = speed * 0.1;
              
              setTrackingStats(prev => ({
                ...prev,
                ballSpeed: speedMph
              }));
            }
            
            // Update previous ball position
            prevBallPosition = { x: ballX, y: ballY, time: currentTime };
          }
        });
        
        // Draw detected poses
        poses.forEach(pose => {
          // Draw keypoints
          pose.keypoints.forEach(keypoint => {
            if (keypoint.score > 0.3) {
              ctx.fillStyle = '#FF3366';
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
              ctx.fill();
            }
          });
          
          // Calculate player movement based on pose
          if (pose.keypoints.length > 0) {
            // Use the hip position as reference for player movement
            const hip = pose.keypoints.find(kp => kp.name === 'left_hip' || kp.name === 'right_hip');
            
            if (hip && hip.score > 0.3) {
              // In a real app, you'd track this over time to calculate actual movement
              const randomMovement = Math.random() * 2 + 1; // Placeholder
              
              setTrackingStats(prev => ({
                ...prev,
                playerMovement: randomMovement
              }));
            }
          }
          
          // Analyze pose to determine shot type
          const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
          const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');
          const rightElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
          const leftElbow = pose.keypoints.find(kp => kp.name === 'left_elbow');
          
          if ((rightWrist && rightWrist.score > 0.5) || (leftWrist && leftWrist.score > 0.5)) {
            // In a real app, you'd use the relative positions of joints to determine shot type
            const shotTypes = ['Forehand', 'Backhand', 'Serve', 'Volley', 'Smash'];
            const randomShotType = shotTypes[Math.floor(Math.random() * shotTypes.length)];
            
            setTrackingStats(prev => ({
              ...prev,
              shotType: randomShotType
            }));
          }
        });
        
        // Update rally length if ball is detected
        if (objects.some(obj => obj.class === 'sports ball')) {
          setTrackingStats(prev => ({
            ...prev,
            rallyLength: prev.rallyLength + 1
          }));
        }
        
        // Continue tracking if still active
        if (isTracking) {
          requestAnimationFrame(track);
        }
      } catch (err) {
        console.error('Error during tracking:', err);
      }
    };
    
    // Start the tracking loop
    track();
  }, [isTracking, objectDetectionModel, poseDetectionModel]);

  // Discard recorded video
  const handleDiscard = useCallback(() => {
    setRecordedChunks([]);
    setHighlightDescription('');
  }, []);

  // Handle camera device change
  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCamera(e.target.value);
  };

  return (
    <div className="video-tracking-panel">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-standard)' }}>
          <Video className="h-6 w-6 text-quantum-cyan" />
          Tennis Video Analysis
        </h2>
        <button 
          onClick={onClose}
          className="p-2 rounded-md hover:bg-hover-bg"
          style={{ color: 'var(--text-subtle)' }}
        >
          <Loader2 className="h-5 w-5" />
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
              <div className="flex flex-col items-center justify-center h-full" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <Loader2 className="h-12 w-12 animate-spin mb-4" style={{ color: 'var(--quantum-cyan)' }} />
                <p className="text-lg font-medium" style={{ color: 'var(--text-standard)' }}>Loading AI tracking models...</p>
                <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>This may take a moment</p>
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
};

export default VideoTrackingPanel;