import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Video, Play, Pause, Save, Trash, Zap, Target, Award, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface VideoTrackingPanelProps {
  matchId: string;
  onVideoSaved: (videoUrl: string) => void;
  onClose: () => void;
}

const VideoTrackingPanel: React.FC<VideoTrackingPanelProps> = ({ matchId, onVideoSaved, onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [detectedEvents, setDetectedEvents] = useState<any[]>([]);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);

  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const { user } = useAuthStore();

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

  const handleStartRecording = useCallback(() => {
    setRecordedChunks([]);
    setRecordingTime(0);
    setIsRecording(true);

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
    if (!videoUrl || recordedChunks.length === 0) {
      setError('No video to analyze');
      return;
    }

    setIsAnalyzing(true);
    setProcessingProgress(0);

    try {
      // Simulate AI processing with progress updates
      const totalSteps = 5;
      for (let step = 1; step <= totalSteps; step++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setProcessingProgress(Math.floor((step / totalSteps) * 100));
      }

      // Generate mock analysis results
      const mockResults = {
        playerMovements: {
          player1: {
            courtCoverage: Math.floor(Math.random() * 30) + 60, // 60-90%
            netApproaches: Math.floor(Math.random() * 10),
            baselineTime: Math.floor(Math.random() * 30) + 60, // 60-90%
          },
          player2: {
            courtCoverage: Math.floor(Math.random() * 30) + 60, // 60-90%
            netApproaches: Math.floor(Math.random() * 10),
            baselineTime: Math.floor(Math.random() * 30) + 60, // 60-90%
          }
        },
        shotAnalysis: {
          player1: {
            forehandWinners: Math.floor(Math.random() * 10),
            backhandWinners: Math.floor(Math.random() * 8),
            aces: Math.floor(Math.random() * 5),
            unforcedErrors: Math.floor(Math.random() * 15),
          },
          player2: {
            forehandWinners: Math.floor(Math.random() * 10),
            backhandWinners: Math.floor(Math.random() * 8),
            aces: Math.floor(Math.random() * 5),
            unforcedErrors: Math.floor(Math.random() * 15),
          }
        },
        keyMoments: [
          {
            time: `00:${Math.floor(Math.random() * 59).toString().padStart(2, '0')}`,
            description: 'Powerful ace down the T',
            type: 'ace'
          },
          {
            time: `01:${Math.floor(Math.random() * 59).toString().padStart(2, '0')}`,
            description: 'Forehand winner cross-court',
            type: 'winner'
          },
          {
            time: `02:${Math.floor(Math.random() * 59).toString().padStart(2, '0')}`,
            description: 'Break point converted',
            type: 'break'
          }
        ],
        recommendations: [
          'Player 1 should focus on improving second serve consistency',
          'Player 2 needs to work on backhand return positioning',
          'Both players could benefit from more aggressive net play'
        ]
      };

      setAnalysisResults(mockResults);
      
      // Add detected events
      setDetectedEvents(mockResults.keyMoments);
    } catch (err) {
      console.error('Error analyzing video:', err);
      setError('Failed to analyze video. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [videoUrl, recordedChunks]);

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

  return (
    <div className="video-tracking-panel">
      <div className="video-tracking-header">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Video className="text-quantum-cyan" />
          Video Match Tracking
          <span className="text-xs px-2 py-0.5 bg-warning-orange text-white rounded-full">BETA</span>
        </h2>
        <p className="text-sm text-text-subtle mb-4">
          Record and analyze match play to generate insights and track key moments
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
            <div className="video-preview-container">
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
              
              <Webcam
                audio={true}
                ref={webcamRef}
                videoConstraints={{
                  deviceId: selectedCamera || undefined,
                  width: 1280,
                  height: 720
                }}
                className="video-preview"
              />
              
              {isRecording && (
                <div className="recording-indicator">
                  <div className="recording-dot"></div>
                  <span className="recording-time">{formatTime(recordingTime)}</span>
                </div>
              )}
            </div>
            
            <div className="video-controls">
              {!isRecording ? (
                <button 
                  onClick={handleStartRecording} 
                  className="btn btn-primary btn-lg"
                  disabled={!selectedCamera}
                >
                  <Play size={20} className="mr-2" />
                  Start Recording
                </button>
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
                        <span>{event.type}</span>
                      </div>
                      <div className="event-description">{event.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoTrackingPanel;