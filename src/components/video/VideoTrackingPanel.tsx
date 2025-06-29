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
  const [modelsLoaded, setModelsLoaded] = useState<{ tf: boolean, object: boolean, pose: boolean }>({
    tf: false,
    object: false,
    pose: false
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

        const objects = await objectDetectionModel.detect(video);
        setDetectedObjects(objects);
        
        // The 'detectedPoses' state was unused and has been removed from the state updates.
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

            if (prevBallPosition) {
              const dx = ballX - prevBallPosition.x;
              const dy = ballY - prevBallPosition.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const timeDiff = (currentTime - prevBallPosition.time) / 1000;
              const speed = distance / timeDiff;
              const speedMph = speed * 0.1; // Approximation

              setTrackingStats(prev => ({ ...prev, ballSpeed: speedMph }));
            }
            prevBallPosition = { x: ballX, y: ballY, time: currentTime };
          }
        });

        poses.forEach(pose => {
          pose.keypoints.forEach(keypoint => {
            if (keypoint.score && keypoint.score > 0.3) {
              ctx.fillStyle = '#FF3366';
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
              ctx.fill();
            }
          });

          const hip = pose.keypoints.find(kp => kp.name === 'left_hip' || kp.name === 'right_hip');
          // CORRECTED: Added check for hip.score existence
          if (hip?.score && hip.score > 0.3) {
            const randomMovement = Math.random() * 2 + 1; // Placeholder
            setTrackingStats(prev => ({ ...prev, playerMovement: randomMovement }));
          }

          // The unused 'rightElbow' and 'leftElbow' variables have been removed.
          const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
          const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');

          // CORRECTED: Added checks for wrist.score existence
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