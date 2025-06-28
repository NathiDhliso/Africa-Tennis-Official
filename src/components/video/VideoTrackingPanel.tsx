import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { Video, Play, Pause, Save, Trash, Zap, Target, Award, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as poseDetection from '@tensorflow-models/pose-detection';

interface VideoTrackingPanelProps {
  matchId?: string;
  onSaveHighlight?: (data: {
    timestamp: number;
    type: string;
    description: string;
    videoBlob?: Blob;
  }) => void;
}

const VideoTrackingPanel: React.FC<VideoTrackingPanelProps> = ({ 
  matchId,
  onSaveHighlight 
}) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<any[]>([]);
  const [detectedPoses, setDetectedPoses] = useState<any[]>([]);
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
  const [isRecordingHighlight, setIsRecordingHighlight] = useState(false);
  const [objectDetectionModel, setObjectDetectionModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [poseDetectionModel, setPoseDetectionModel] = useState<poseDetection.PoseDetector | null>(null);
  
  // Load TensorFlow models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        
        // Load TensorFlow.js backend
        await tf.setBackend('webgl');
        console.log('TensorFlow backend loaded:', tf.getBackend());
        
        // Load COCO-SSD model for object detection (ball, racket)
        const objectModel = await cocoSsd.load();
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
    };
  }, []);

  // Start video capture
  const handleStartCapture = useCallback(() => {
    if (!webcamRef.current?.video) return;
    
    setCapturing(true);
    setRecordedChunks([]);
    
    const stream = webcamRef.current.video.srcObject as MediaStream;
    
    if (!stream) {
      setError('No video stream available');
      return;
    }
    
    try {
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });
      
      mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
      mediaRecorderRef.current.addEventListener('stop', handleStopCapture);
      mediaRecorderRef.current.start();
      
      // Start tracking
      setIsTracking(true);
      startTracking();
    } catch (err) {
      console.error('Error starting media recorder:', err);
      setError('Failed to start video recording. Your browser may not support this feature.');
      setCapturing(false);
    }
  }, [webcamRef, setCapturing, setRecordedChunks]);

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
  }, [mediaRecorderRef, setCapturing]);

  // Save recorded video
  const handleSave = useCallback(() => {
    if (recordedChunks.length === 0) {
      setError('No video recorded');
      return;
    }
    
    setIsProcessingVideo(true);
    
    try {
      const blob = new Blob(recordedChunks, {
        type: 'video/webm'
      });
      
      if (onSaveHighlight) {
        onSaveHighlight({
          timestamp: Date.now(),
          type: highlightType,
          description: highlightDescription || `${highlightType} highlight`,
          videoBlob: blob
        });
      }
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style.display = 'none';
      a.href = url;
      a.download = `tennis-highlight-${Date.now()}.webm`;
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setRecordedChunks([]);
      setHighlightDescription('');
      setIsProcessingVideo(false);
    } catch (err) {
      console.error('Error saving video:', err);
      setError('Failed to save video');
      setIsProcessingVideo(false);
    }
  }, [recordedChunks, highlightType, highlightDescription, onSaveHighlight]);

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
          
          // Draw skeleton
          const adjacentKeyPoints = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);
          adjacentKeyPoints.forEach(([i, j]) => {
            const kp1 = pose.keypoints[i];
            const kp2 = pose.keypoints[j];
            
            // Only draw if both keypoints are detected with high confidence
            if (kp1.score > 0.3 && kp2.score > 0.3) {
              ctx.strokeStyle = '#FF3366';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(kp1.x, kp1.y);
              ctx.lineTo(kp2.x, kp2.y);
              ctx.stroke();
            }
          });
        });
        
        // Update tracking stats based on detections
        updateTrackingStats(objects, poses);
        
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

  // Update tracking statistics based on detections
  const updateTrackingStats = useCallback((objects: cocoSsd.DetectedObject[], poses: poseDetection.Pose[]) => {
    // Find the ball
    const ball = objects.find(obj => obj.class === 'sports ball');
    
    // Find the rackets
    const rackets = objects.filter(obj => obj.class === 'sports racket' || obj.class === 'tennis racket');
    
    // Calculate ball speed (simplified)
    let ballSpeed = 0;
    if (ball) {
      // In a real implementation, you would track the ball position over time
      // and calculate the actual speed based on the distance traveled
      ballSpeed = Math.random() * 100 + 50; // Placeholder
    }
    
    // Calculate player movement (simplified)
    let playerMovement = 0;
    if (poses.length > 0) {
      // In a real implementation, you would track the player position over time
      // and calculate the actual movement based on the distance traveled
      playerMovement = Math.random() * 10 + 2; // Placeholder
    }
    
    // Determine shot type based on pose and racket position (simplified)
    let shotType = 'Unknown';
    if (rackets.length > 0 && poses.length > 0) {
      const shotTypes = ['Forehand', 'Backhand', 'Serve', 'Volley', 'Smash'];
      shotType = shotTypes[Math.floor(Math.random() * shotTypes.length)]; // Placeholder
    }
    
    // Update rally length (increment counter)
    const rallyLength = trackingStats.rallyLength + (ball ? 1 : 0);
    
    setTrackingStats({
      ballSpeed,
      playerMovement,
      rallyLength,
      shotType
    });
  }, [trackingStats]);

  // Start recording a highlight
  const handleStartHighlight = useCallback(() => {
    setIsRecordingHighlight(true);
    handleStartCapture();
  }, [handleStartCapture]);

  // Stop recording a highlight
  const handleStopHighlight = useCallback(() => {
    setIsRecordingHighlight(false);
    handleStopCapture();
  }, [handleStopCapture]);

  // Discard recorded video
  const handleDiscard = useCallback(() => {
    setRecordedChunks([]);
    setHighlightDescription('');
  }, []);

  return (
    <div className="video-tracking-panel">
      <div className="video-tracking-header">
        <h2 className="video-tracking-title">
          <Video className="h-5 w-5 mr-2" />
          Video Analysis
        </h2>
        <p className="video-tracking-subtitle">
          AI-powered tracking for tennis matches
        </p>
      </div>

      {error && (
        <div className="video-tracking-error">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            className="video-tracking-error-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="video-tracking-content">
        <div className="video-container">
          {isModelLoading ? (
            <div className="video-loading">
              <Loader2 className="h-12 w-12 animate-spin" />
              <p>Loading AI tracking models...</p>
              <p className="text-sm text-text-subtle">This may take a moment</p>
            </div>
          ) : (
            <>
              <Webcam
                audio={true}
                ref={webcamRef}
                className="video-feed"
                videoConstraints={{
                  width: 1280,
                  height: 720,
                  facingMode: "environment"
                }}
              />
              <canvas
                ref={canvasRef}
                className="tracking-overlay"
              />
              
              {isTracking && (
                <div className="tracking-indicators">
                  <div className="tracking-indicator">
                    <Target className="h-4 w-4" />
                    <span>AI Tracking Active</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="video-controls">
          {!isRecordingHighlight && !recordedChunks.length ? (
            <button
              onClick={handleStartHighlight}
              disabled={isModelLoading || capturing}
              className="video-control-btn video-record-btn"
            >
              {isModelLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 mr-2" />
                  Record Highlight
                </>
              )}
            </button>
          ) : isRecordingHighlight ? (
            <button
              onClick={handleStopHighlight}
              className="video-control-btn video-stop-btn"
            >
              <Pause className="h-5 w-5 mr-2" />
              Stop Recording
            </button>
          ) : (
            <div className="video-save-controls">
              <div className="video-highlight-form">
                <select
                  value={highlightType}
                  onChange={(e) => setHighlightType(e.target.value)}
                  className="video-highlight-select"
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
                  className="video-highlight-input"
                />
              </div>
              <div className="video-action-buttons">
                <button
                  onClick={handleDiscard}
                  disabled={isProcessingVideo}
                  className="video-control-btn video-discard-btn"
                >
                  <Trash className="h-5 w-5 mr-2" />
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={isProcessingVideo}
                  className="video-control-btn video-save-btn"
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

        <div className="video-tracking-stats">
          <h3 className="video-stats-title">
            <Sparkles className="h-5 w-5 mr-2" />
            AI Tracking Insights
          </h3>
          
          <div className="video-stats-grid">
            <div className="video-stat-card">
              <div className="video-stat-icon">
                <Zap />
              </div>
              <div className="video-stat-value">{Math.round(trackingStats.ballSpeed)} mph</div>
              <div className="video-stat-label">Ball Speed</div>
            </div>
            
            <div className="video-stat-card">
              <div className="video-stat-icon">
                <Target />
              </div>
              <div className="video-stat-value">{trackingStats.shotType}</div>
              <div className="video-stat-label">Shot Type</div>
            </div>
            
            <div className="video-stat-card">
              <div className="video-stat-icon">
                <Award />
              </div>
              <div className="video-stat-value">{trackingStats.rallyLength}</div>
              <div className="video-stat-label">Rally Length</div>
            </div>
            
            <div className="video-stat-card">
              <div className="video-stat-icon">
                <Activity />
              </div>
              <div className="video-stat-value">{trackingStats.playerMovement.toFixed(1)} m/s</div>
              <div className="video-stat-label">Player Movement</div>
            </div>
          </div>
          
          <div className="video-detection-summary">
            <h4 className="video-detection-title">Detected Objects</h4>
            <div className="video-detection-list">
              {detectedObjects.length === 0 ? (
                <div className="video-no-detections">No objects detected</div>
              ) : (
                detectedObjects.map((obj, index) => (
                  <div key={index} className="video-detection-item">
                    <span className="video-detection-class">{obj.class}</span>
                    <span className="video-detection-confidence">{Math.round(obj.score * 100)}%</span>
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