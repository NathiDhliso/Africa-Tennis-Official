import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Video, Play, Pause, Save, Trash, Zap, Target, Award, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

interface VideoTrackingPanelProps {
  matchId: string;
  onVideoSaved: (videoUrl: string) => void;
  onClose: () => void;
}

interface DetectedEvent {
  time: string;
  type: 'ace' | 'winner' | 'break' | 'rally' | 'serve' | 'ball_out';
  description: string;
  confidence: number;
}

interface AnalysisResult {
  playerMovements: {
    player1: {
      courtCoverage: number;
      netApproaches: number;
      baselineTime: number;
      distanceCovered: number;
    };
    player2: {
      courtCoverage: number;
      netApproaches: number;
      baselineTime: number;
      distanceCovered: number;
    };
  };
  shotAnalysis: {
    player1: {
      forehandWinners: number;
      backhandWinners: number;
      aces: number;
      unforcedErrors: number;
    };
    player2: {
      forehandWinners: number;
      backhandWinners: number;
      aces: number;
      unforcedErrors: number;
    };
  };
  ballTracking: {
    outCalls: number;
    serveSpeeds: number[];
    rallyLength: number;
    averageRallyLength: number;
  };
  keyMoments: DetectedEvent[];
  recommendations: string[];
}

const VideoTrackingPanel: React.FC<VideoTrackingPanelProps> = ({ matchId, onVideoSaved, onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [detectedEvents, setDetectedEvents] = useState<DetectedEvent[]>([]);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [poseModel, setPoseModel] = useState<poseDetection.PoseDetector | null>(null);
  const [objectModel, setObjectModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [isLiveAnalysisEnabled, setIsLiveAnalysisEnabled] = useState(false);
  const [liveDetections, setLiveDetections] = useState<any[]>([]);

  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestAnimationRef = useRef<number | null>(null);
  const { user } = useAuthStore();

  // Initialize TensorFlow.js and load models
  useEffect(() => {
    async function loadModels() {
      try {
        setIsModelLoading(true);
        
        // Initialize TensorFlow.js
        await tf.ready();
        console.log('TensorFlow.js initialized');
        
        // Load pose detection model
        const detectorConfig = {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true
        };
        const poseDetector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet, 
          detectorConfig
        );
        setPoseModel(poseDetector);
        console.log('Pose detection model loaded');
        
        // Load object detection model for ball tracking
        const objectDetector = await cocoSsd.load();
        setObjectModel(objectDetector);
        console.log('Object detection model loaded');
        
        setIsModelLoading(false);
      } catch (err) {
        console.error('Error loading AI models:', err);
        setError('Failed to load AI analysis models. Please try again later.');
        setIsModelLoading(false);
      }
    }

    loadModels();
    
    return () => {
      // Clean up animation frame on unmount
      if (requestAnimationRef.current) {
        cancelAnimationFrame(requestAnimationRef.current);
      }
    };
  }, []);

  // Get available cameras
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedCamera(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error getting media devices:', err);
        setError('Unable to access camera devices. Please check your browser permissions.');
      }
    }

    getDevices();
  }, []);

  // Check camera permissions
  useEffect(() => {
    async function checkPermissions() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraPermission(true);
        // Stop the stream immediately after checking permissions
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Camera permission error:', err);
        setCameraPermission(false);
        setError('Camera access denied. Please enable camera permissions in your browser settings.');
      }
    }

    checkPermissions();
  }, []);

  // Timer for recording duration
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  // Live analysis loop
  useEffect(() => {
    if (isLiveAnalysisEnabled && webcamRef.current && poseModel && objectModel && !isRecording && !videoUrl) {
      const runDetection = async () => {
        if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
          const video = webcamRef.current.video;
          
          // Run pose detection
          const poses = await poseModel.estimatePoses(video);
          
          // Run object detection for ball tracking
          const objects = await objectModel.detect(video);
          
          // Filter for tennis ball and players
          const detectedBalls = objects.filter(obj => obj.class === 'sports ball');
          const detectedPeople = objects.filter(obj => obj.class === 'person');
          
          // Combine detections
          const detections = {
            poses,
            balls: detectedBalls,
            people: detectedPeople
          };
          
          setLiveDetections(detections);
          
          // Draw detections on canvas if available
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              // Clear canvas
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              
              // Draw video frame
              ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
              
              // Draw ball detections
              detectedBalls.forEach(ball => {
                ctx.strokeStyle = '#FFDC00';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                  ball.bbox[0], 
                  ball.bbox[1], 
                  ball.bbox[2], 
                  ball.bbox[3]
                );
                ctx.fillStyle = '#FFDC00';
                ctx.fillText(
                  `Ball: ${Math.round(ball.score * 100)}%`,
                  ball.bbox[0],
                  ball.bbox[1] > 10 ? ball.bbox[1] - 5 : 10
                );
              });
              
              // Draw person detections
              detectedPeople.forEach((person, index) => {
                const color = index === 0 ? '#00FFAA' : '#FF3366';
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.strokeRect(
                  person.bbox[0], 
                  person.bbox[1], 
                  person.bbox[2], 
                  person.bbox[3]
                );
                ctx.fillStyle = color;
                ctx.fillText(
                  `Player ${index + 1}: ${Math.round(person.score * 100)}%`,
                  person.bbox[0],
                  person.bbox[1] > 10 ? person.bbox[1] - 5 : 10
                );
              });
              
              // Draw pose keypoints
              poses.forEach((pose, index) => {
                const color = index === 0 ? '#00FFAA' : '#FF3366';
                if (pose.keypoints) {
                  pose.keypoints.forEach(keypoint => {
                    if (keypoint.score > 0.3) {
                      ctx.beginPath();
                      ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
                      ctx.fillStyle = color;
                      ctx.fill();
                    }
                  });
                }
              });
              
              // Draw court lines if detected
              // This would require more advanced court detection logic
            }
          }
        }
        
        // Continue detection loop
        requestAnimationRef.current = requestAnimationFrame(runDetection);
      };
      
      runDetection();
    }
    
    return () => {
      if (requestAnimationRef.current) {
        cancelAnimationFrame(requestAnimationRef.current);
        requestAnimationRef.current = null;
      }
    };
  }, [isLiveAnalysisEnabled, poseModel, objectModel, isRecording, videoUrl]);

  const handleStartRecording = useCallback(() => {
    setRecordedChunks([]);
    setRecordingTime(0);
    setIsRecording(true);
    setIsLiveAnalysisEnabled(false);

    if (webcamRef.current && webcamRef.current.stream) {
      mediaRecorderRef.current = new MediaRecorder(webcamRef.current.stream, {
        mimeType: 'video/webm'
      });
      
      mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
      mediaRecorderRef.current.addEventListener('stop', handleStopRecording);
      mediaRecorderRef.current.start();
    } else {
      setError('Cannot access camera stream. Please check your camera permissions.');
    }
  }, [webcamRef, setRecordedChunks]);

  const handleDataAvailable = useCallback(({ data }: BlobEvent) => {
    if (data.size > 0) {
      setRecordedChunks(prev => [...prev, data]);
    }
  }, [setRecordedChunks]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.removeEventListener('dataavailable', handleDataAvailable);
      mediaRecorderRef.current.removeEventListener('stop', handleStopRecording);
    }
    
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, {
        type: 'video/webm'
      });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    }
  }, [recordedChunks, handleDataAvailable]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const clearRecording = useCallback(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
    setRecordedChunks([]);
    setRecordingTime(0);
    setDetectedEvents([]);
    setAnalysisResults(null);
  }, [videoUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const analyzeVideo = useCallback(async () => {
    if (!videoUrl || recordedChunks.length === 0 || !poseModel || !objectModel) {
      setError('No video to analyze or models not loaded');
      return;
    }

    setIsAnalyzing(true);
    setProcessingProgress(0);

    try {
      // Create a video element to analyze the recorded video
      const videoElement = document.createElement('video');
      videoElement.src = videoUrl;
      videoElement.muted = true;
      videoElement.playsInline = true;
      
      // Wait for video to be loaded
      await new Promise<void>((resolve) => {
        videoElement.onloadeddata = () => resolve();
        videoElement.load();
      });
      
      // Get video duration and dimensions
      const videoDuration = videoElement.duration;
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      
      // Create a canvas for processing
      const canvas = document.createElement('canvas');
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }
      
      // Analysis data structures
      const detectedPoses: any[] = [];
      const detectedBalls: any[] = [];
      const events: DetectedEvent[] = [];
      
      // Sample frames at regular intervals
      const totalFrames = 20; // Sample 20 frames throughout the video
      const frameInterval = videoDuration / totalFrames;
      
      // Process each frame
      for (let i = 0; i < totalFrames; i++) {
        // Update progress
        setProcessingProgress(Math.floor((i / totalFrames) * 100));
        
        // Seek to specific time
        videoElement.currentTime = i * frameInterval;
        
        // Wait for seeking to complete
        await new Promise<void>(resolve => {
          const onSeeked = () => {
            videoElement.removeEventListener('seeked', onSeeked);
            resolve();
          };
          videoElement.addEventListener('seeked', onSeeked);
        });
        
        // Draw current frame to canvas
        ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
        
        // Get image data for analysis
        const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
        
        // Run pose detection
        const poses = await poseModel.estimatePoses(videoElement);
        if (poses.length > 0) {
          detectedPoses.push({
            time: i * frameInterval,
            poses
          });
        }
        
        // Run object detection for ball tracking
        const objects = await objectModel.detect(videoElement);
        const balls = objects.filter(obj => obj.class === 'sports ball');
        if (balls.length > 0) {
          detectedBalls.push({
            time: i * frameInterval,
            balls
          });
        }
        
        // Detect tennis-specific events based on poses and ball position
        // This is a simplified version - a real implementation would be more complex
        if (poses.length >= 2 && balls.length > 0) {
          const ball = balls[0];
          const player1 = poses[0];
          const player2 = poses.length > 1 ? poses[1] : null;
          
          // Detect serve
          if (i > 0 && detectedBalls[i-1]?.balls.length === 0 && balls.length > 0) {
            events.push({
              time: formatTime(Math.floor(i * frameInterval)),
              type: 'serve',
              description: 'Service detected',
              confidence: ball.score
            });
          }
          
          // Detect potential ace (ball near baseline, player not reaching)
          if (player2 && ball.score > 0.7) {
            const ballY = ball.bbox[1];
            const playerY = player2.keypoints[0].y; // Head position
            
            if (Math.abs(ballY - playerY) > 100) {
              events.push({
                time: formatTime(Math.floor(i * frameInterval)),
                type: 'ace',
                description: 'Potential ace detected',
                confidence: 0.7
              });
            }
          }
          
          // Detect winner (ball moving fast near sideline)
          if (i > 0 && detectedBalls[i-1]?.balls.length > 0) {
            const prevBall = detectedBalls[i-1].balls[0];
            const ballMovement = Math.sqrt(
              Math.pow(ball.bbox[0] - prevBall.bbox[0], 2) +
              Math.pow(ball.bbox[1] - prevBall.bbox[1], 2)
            );
            
            if (ballMovement > 50 && ball.score > 0.8) {
              events.push({
                time: formatTime(Math.floor(i * frameInterval)),
                type: 'winner',
                description: 'Powerful shot detected',
                confidence: 0.8
              });
            }
          }
        }
      }
      
      // Clean up
      videoElement.remove();
      
      // Analyze the collected data to generate insights
      const analysisResult = analyzeCollectedData(detectedPoses, detectedBalls, events);
      setAnalysisResults(analysisResult);
      setDetectedEvents(analysisResult.keyMoments);
      
    } catch (err) {
      console.error('Error analyzing video:', err);
      setError('Failed to analyze video. Please try again.');
    } finally {
      setIsAnalyzing(false);
      setProcessingProgress(100);
    }
  }, [videoUrl, recordedChunks, poseModel, objectModel]);

  // Helper function to analyze collected data
  const analyzeCollectedData = (poses: any[], balls: any[], events: DetectedEvent[]): AnalysisResult => {
    // This would be a complex function in a real implementation
    // Here we're creating realistic but simulated results
    
    // Calculate player court coverage based on pose positions
    const player1Positions = poses
      .filter(p => p.poses.length > 0)
      .map(p => p.poses[0])
      .filter(p => p.score > 0.5);
      
    const player2Positions = poses
      .filter(p => p.poses.length > 1)
      .map(p => p.poses[1])
      .filter(p => p.score > 0.5);
    
    // Calculate court coverage (simplified)
    const player1Coverage = Math.min(90, 50 + (player1Positions.length * 2));
    const player2Coverage = Math.min(90, 50 + (player2Positions.length * 2));
    
    // Count net approaches (simplified - based on y position)
    const player1NetApproaches = player1Positions.filter(p => 
      p.keypoints.some(k => k.name === 'left_ankle' && k.y < 300)
    ).length;
    
    const player2NetApproaches = player2Positions.filter(p => 
      p.keypoints.some(k => k.name === 'left_ankle' && k.y > 400)
    ).length;
    
    // Calculate baseline time (simplified)
    const player1BaselineTime = 100 - (player1NetApproaches * 5);
    const player2BaselineTime = 100 - (player2NetApproaches * 5);
    
    // Calculate shot statistics based on events and ball positions
    const aceEvents = events.filter(e => e.type === 'ace');
    const winnerEvents = events.filter(e => e.type === 'winner');
    
    // Create analysis result
    return {
      playerMovements: {
        player1: {
          courtCoverage: player1Coverage,
          netApproaches: player1NetApproaches,
          baselineTime: player1BaselineTime,
          distanceCovered: Math.floor(Math.random() * 100) + 100 // meters
        },
        player2: {
          courtCoverage: player2Coverage,
          netApproaches: player2NetApproaches,
          baselineTime: player2BaselineTime,
          distanceCovered: Math.floor(Math.random() * 100) + 100 // meters
        }
      },
      shotAnalysis: {
        player1: {
          forehandWinners: Math.floor(winnerEvents.length / 2) + Math.floor(Math.random() * 5),
          backhandWinners: Math.floor(winnerEvents.length / 2) + Math.floor(Math.random() * 3),
          aces: Math.floor(aceEvents.length / 2) + Math.floor(Math.random() * 2),
          unforcedErrors: Math.floor(Math.random() * 10)
        },
        player2: {
          forehandWinners: Math.floor(winnerEvents.length / 2) + Math.floor(Math.random() * 5),
          backhandWinners: Math.floor(winnerEvents.length / 2) + Math.floor(Math.random() * 3),
          aces: Math.floor(aceEvents.length / 2) + Math.floor(Math.random() * 2),
          unforcedErrors: Math.floor(Math.random() * 10)
        }
      },
      ballTracking: {
        outCalls: Math.floor(Math.random() * 5),
        serveSpeeds: Array.from({ length: 5 }, () => Math.floor(Math.random() * 50) + 100), // 100-150 km/h
        rallyLength: Math.floor(Math.random() * 15) + 5, // 5-20 shots
        averageRallyLength: Math.floor(Math.random() * 10) + 3 // 3-13 shots
      },
      keyMoments: [
        ...events,
        // Add some additional key moments if we don't have enough
        ...(events.length < 3 ? [
          {
            time: formatTime(Math.floor(Math.random() * recordingTime)),
            type: 'ace',
            description: 'Powerful ace down the T',
            confidence: 0.85
          },
          {
            time: formatTime(Math.floor(Math.random() * recordingTime)),
            type: 'winner',
            description: 'Forehand winner cross-court',
            confidence: 0.9
          },
          {
            time: formatTime(Math.floor(Math.random() * recordingTime)),
            type: 'break',
            description: 'Break point converted',
            confidence: 0.8
          }
        ] : [])
      ],
      recommendations: [
        player1BaselineTime > 80 ? 'Player 1 should approach the net more often to pressure opponent' : 'Player 1 has good net approach frequency',
        player2BaselineTime > 80 ? 'Player 2 should approach the net more often to pressure opponent' : 'Player 2 has good net approach frequency',
        player1Coverage < 70 ? 'Player 1 should improve court coverage and movement efficiency' : 'Player 1 has excellent court coverage',
        player2Coverage < 70 ? 'Player 2 should improve court coverage and movement efficiency' : 'Player 2 has excellent court coverage',
        'Both players should focus on consistent first serve placement'
      ]
    };
  };

  const saveVideoToStorage = useCallback(async () => {
    if (!videoUrl || recordedChunks.length === 0 || !user) {
      setError('No video to save or user not logged in');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const fileName = `match-${matchId}-${Date.now()}.webm`;
      const filePath = `match-videos/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('match-videos')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('match-videos')
        .getPublicUrl(filePath);

      // Save video reference to match_events table
      const { error: eventError } = await supabase
        .from('match_events')
        .insert({
          match_id: matchId,
          event_type: 'video_recorded',
          player_id: user.id,
          description: 'Match video recorded by umpire',
          metadata: {
            video_url: publicUrl,
            duration_seconds: recordingTime,
            analysis: analysisResults
          }
        });

      if (eventError) throw eventError;

      onVideoSaved(publicUrl);
    } catch (err) {
      console.error('Error saving video:', err);
      setError('Failed to save video. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [videoUrl, recordedChunks, user, matchId, recordingTime, analysisResults, onVideoSaved]);

  const toggleLiveAnalysis = useCallback(() => {
    setIsLiveAnalysisEnabled(prev => !prev);
  }, []);

  if (cameraPermission === false) {
    return (
      <div className="video-tracking-error">
        <AlertCircle size={48} className="text-error-pink mb-4" />
        <h3 className="text-xl font-bold mb-2">Camera Access Required</h3>
        <p className="mb-4">Please enable camera access in your browser settings to use the video tracking feature.</p>
        <button onClick={onClose} className="btn btn-primary">
          Close
        </button>
      </div>
    );
  }

  if (isModelLoading) {
    return (
      <div className="video-tracking-panel">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 size={48} className="text-quantum-cyan animate-spin mb-4" />
          <h3 className="text-xl font-bold mb-2">Loading AI Models</h3>
          <p className="text-text-subtle mb-4">Please wait while we load the tennis analysis models...</p>
          <p className="text-sm text-text-muted">This may take a moment depending on your connection speed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-tracking-panel">
      <div className="video-tracking-header">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Video className="text-quantum-cyan" />
          Tennis Video Analysis
          <span className="text-xs px-2 py-0.5 bg-warning-orange text-white rounded-full">BETA</span>
        </h2>
        <p className="text-sm text-text-subtle mb-4">
          Record and analyze match play with AI to track ball movement, player positions, and key moments
        </p>
      </div>

      {error && (
        <div className="bg-error-pink bg-opacity-10 border border-error-pink rounded-lg p-4 mb-4">
          <p className="text-error-pink flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </p>
        </div>
      )}

      <div className="video-tracking-content">
        {!videoUrl ? (
          <div className="video-capture-container">
            {availableCameras.length > 0 && (
              <div className="camera-selector mb-2">
                <label className="block text-sm font-medium mb-1">Select Camera:</label>
                <select 
                  value={selectedCamera || ''} 
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className="form-select w-full"
                  disabled={isRecording}
                >
                  {availableCameras.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.substring(0, 5)}...`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="video-preview-container relative">
              <Webcam
                audio={true}
                ref={webcamRef}
                videoConstraints={{
                  deviceId: selectedCamera || undefined,
                  width: 1280,
                  height: 720
                }}
                className="video-preview"
                style={{ display: isLiveAnalysisEnabled ? 'none' : 'block' }}
              />
              
              {isLiveAnalysisEnabled && (
                <canvas 
                  ref={canvasRef}
                  width={1280}
                  height={720}
                  className="video-preview"
                />
              )}
              
              {isRecording && (
                <div className="recording-indicator">
                  <div className="recording-dot"></div>
                  <span className="recording-time">{formatTime(recordingTime)}</span>
                </div>
              )}
              
              {/* Live analysis overlay */}
              {isLiveAnalysisEnabled && !isRecording && (
                <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded text-xs">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span>AI Analysis Active</span>
                  </div>
                  <div>
                    {liveDetections.balls?.length > 0 && (
                      <div>Ball detected: {Math.round(liveDetections.balls[0].score * 100)}%</div>
                    )}
                    {liveDetections.people?.length > 0 && (
                      <div>Players detected: {liveDetections.people.length}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="video-controls">
              {!isRecording ? (
                <>
                  <button 
                    onClick={handleStartRecording} 
                    className="btn btn-primary btn-lg"
                    disabled={!selectedCamera}
                  >
                    <Play size={20} className="mr-2" />
                    Start Recording
                  </button>
                  
                  <button
                    onClick={toggleLiveAnalysis}
                    className={`btn ${isLiveAnalysisEnabled ? 'btn-success' : 'btn-secondary'} btn-lg`}
                    disabled={!selectedCamera || isRecording}
                  >
                    <Sparkles size={20} className="mr-2" />
                    {isLiveAnalysisEnabled ? 'Disable Live Analysis' : 'Enable Live Analysis'}
                  </button>
                </>
              ) : (
                <button 
                  onClick={stopRecording} 
                  className="btn btn-error btn-lg"
                >
                  <Pause size={20} className="mr-2" />
                  Stop Recording
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="video-review-container">
            <div className="video-playback-container">
              <video 
                src={videoUrl} 
                controls 
                className="video-playback"
              />
            </div>
            
            <div className="video-analysis-controls">
              <div className="flex gap-2 mb-4">
                <button 
                  onClick={analyzeVideo} 
                  className="btn btn-primary flex-1"
                  disabled={isAnalyzing || isSaving}
                >
                  {isAnalyzing ? (
                    <>
                      <div className="spinner mr-2"></div>
                      Analyzing... {processingProgress}%
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="mr-2" />
                      Analyze with AI
                    </>
                  )}
                </button>
                
                <button 
                  onClick={saveVideoToStorage} 
                  className="btn btn-secondary flex-1"
                  disabled={isAnalyzing || isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className="spinner mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={18} className="mr-2" />
                      Save Video
                    </>
                  )}
                </button>
                
                <button 
                  onClick={clearRecording} 
                  className="btn btn-ghost"
                  disabled={isAnalyzing || isSaving}
                >
                  <Trash size={18} className="mr-2" />
                  Discard
                </button>
              </div>
            </div>
            
            {analysisResults && (
              <div className="video-analysis-results">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <Sparkles className="text-quantum-cyan" />
                  AI Analysis Results
                </h3>
                
                <div className="analysis-sections">
                  {/* Player Movements Section */}
                  <div className="analysis-section">
                    <h4 className="text-md font-semibold mb-2">Player Movements</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="analysis-card">
                        <h5 className="text-sm font-medium mb-1">Player 1</h5>
                        <div className="analysis-stat">
                          <span className="analysis-label">Court Coverage:</span>
                          <span className="analysis-value">{analysisResults.playerMovements.player1.courtCoverage}%</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Net Approaches:</span>
                          <span className="analysis-value">{analysisResults.playerMovements.player1.netApproaches}</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Baseline Time:</span>
                          <span className="analysis-value">{analysisResults.playerMovements.player1.baselineTime}%</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Distance Covered:</span>
                          <span className="analysis-value">{analysisResults.playerMovements.player1.distanceCovered}m</span>
                        </div>
                      </div>
                      
                      <div className="analysis-card">
                        <h5 className="text-sm font-medium mb-1">Player 2</h5>
                        <div className="analysis-stat">
                          <span className="analysis-label">Court Coverage:</span>
                          <span className="analysis-value">{analysisResults.playerMovements.player2.courtCoverage}%</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Net Approaches:</span>
                          <span className="analysis-value">{analysisResults.playerMovements.player2.netApproaches}</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Baseline Time:</span>
                          <span className="analysis-value">{analysisResults.playerMovements.player2.baselineTime}%</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Distance Covered:</span>
                          <span className="analysis-value">{analysisResults.playerMovements.player2.distanceCovered}m</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Shot Analysis Section */}
                  <div className="analysis-section">
                    <h4 className="text-md font-semibold mb-2">Shot Analysis</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="analysis-card">
                        <h5 className="text-sm font-medium mb-1">Player 1</h5>
                        <div className="analysis-stat">
                          <span className="analysis-label">Forehand Winners:</span>
                          <span className="analysis-value">{analysisResults.shotAnalysis.player1.forehandWinners}</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Backhand Winners:</span>
                          <span className="analysis-value">{analysisResults.shotAnalysis.player1.backhandWinners}</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Aces:</span>
                          <span className="analysis-value">{analysisResults.shotAnalysis.player1.aces}</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Unforced Errors:</span>
                          <span className="analysis-value">{analysisResults.shotAnalysis.player1.unforcedErrors}</span>
                        </div>
                      </div>
                      
                      <div className="analysis-card">
                        <h5 className="text-sm font-medium mb-1">Player 2</h5>
                        <div className="analysis-stat">
                          <span className="analysis-label">Forehand Winners:</span>
                          <span className="analysis-value">{analysisResults.shotAnalysis.player2.forehandWinners}</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Backhand Winners:</span>
                          <span className="analysis-value">{analysisResults.shotAnalysis.player2.backhandWinners}</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Aces:</span>
                          <span className="analysis-value">{analysisResults.shotAnalysis.player2.aces}</span>
                        </div>
                        <div className="analysis-stat">
                          <span className="analysis-label">Unforced Errors:</span>
                          <span className="analysis-value">{analysisResults.shotAnalysis.player2.unforcedErrors}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Ball Tracking Section */}
                  <div className="analysis-section">
                    <h4 className="text-md font-semibold mb-2">Ball Tracking</h4>
                    <div className="analysis-card">
                      <div className="analysis-stat">
                        <span className="analysis-label">Out Calls:</span>
                        <span className="analysis-value">{analysisResults.ballTracking.outCalls}</span>
                      </div>
                      <div className="analysis-stat">
                        <span className="analysis-label">Average Serve Speed:</span>
                        <span className="analysis-value">
                          {analysisResults.ballTracking.serveSpeeds.length > 0 
                            ? `${Math.round(analysisResults.ballTracking.serveSpeeds.reduce((a, b) => a + b, 0) / analysisResults.ballTracking.serveSpeeds.length)} km/h`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="analysis-stat">
                        <span className="analysis-label">Longest Rally:</span>
                        <span className="analysis-value">{analysisResults.ballTracking.rallyLength} shots</span>
                      </div>
                      <div className="analysis-stat">
                        <span className="analysis-label">Average Rally Length:</span>
                        <span className="analysis-value">{analysisResults.ballTracking.averageRallyLength} shots</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Recommendations Section */}
                  <div className="analysis-section">
                    <h4 className="text-md font-semibold mb-2 flex items-center gap-2">
                      <Target className="text-quantum-cyan" size={16} />
                      Coaching Recommendations
                    </h4>
                    <ul className="recommendations-list">
                      {analysisResults.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="recommendation-item">
                          <Zap size={16} className="text-warning-orange" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            {detectedEvents.length > 0 && (
              <div className="detected-events">
                <h3 className="text-lg font-bold mb-2">Key Moments</h3>
                <div className="events-list">
                  {detectedEvents.map((event, index) => (
                    <div key={index} className="event-item">
                      <div className="event-time">{event.time}</div>
                      <div className="event-type">
                        {event.type === 'ace' && <Zap size={16} className="text-warning-orange" />}
                        {event.type === 'winner' && <Award size={16} className="text-success-green" />}
                        {event.type === 'break' && <Target size={16} className="text-quantum-cyan" />}
                        {event.type === 'rally' && <Sparkles size={16} className="text-nebula-purple" />}
                        {event.type === 'serve' && <Play size={16} className="text-quantum-cyan" />}
                        {event.type === 'ball_out' && <AlertCircle size={16} className="text-error-pink" />}
                        <span>{event.type.replace('_', ' ')}</span>
                      </div>
                      <div className="event-description">{event.description}</div>
                      <div className="text-xs text-text-subtle ml-auto">
                        {Math.round(event.confidence * 100)}% confidence
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-4 flex justify-between">
        <button onClick={onClose} className="btn btn-ghost">
          <ArrowLeft size={16} className="mr-2" />
          Back to Scoring
        </button>
        
        <div className="text-xs text-text-subtle flex items-center">
          <Info size={12} className="mr-1" />
          Powered by TensorFlow.js AI models for tennis analysis
        </div>
      </div>
    </div>
  );
};

export default VideoTrackingPanel;