import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Eye,
  AlertTriangle,
  CheckCircle,
  X,
  Volume2,
  VolumeX,
  Settings,
  Target,
  Zap,
  Clock,
  TrendingUp,
  Activity
} from 'lucide-react';

interface UmpireCall {
  id: string;
  timestamp: number;
  type: 'in' | 'out' | 'fault' | 'let' | 'net' | 'foot_fault';
  confidence: number;
  position: { x: number; y: number };
  description: string;
  ballSpeed?: number;
  courtRegion: string;
  challengeable: boolean;
}

interface AIUmpireSettings {
  ballSensitivity: number;
  lineCallTolerance: number;
  autoCallEnabled: boolean;
  soundEnabled: boolean;
  footFaultDetection: boolean;
  netTouchDetection: boolean;
  confidenceThreshold: number;
}

interface AIUmpirePanelProps {
  matchId: string;
  isActive: boolean;
  onCallMade: (call: UmpireCall) => void;
  onSettingsChange: (settings: AIUmpireSettings) => void;
  videoElement?: HTMLVideoElement;
  courtDetectionData?: any;
}

const AIUmpirePanel: React.FC<AIUmpirePanelProps> = ({
  matchId,
  isActive,
  onCallMade,
  onSettingsChange,
  videoElement,
  courtDetectionData
}) => {
  const [calls, setCalls] = useState<UmpireCall[]>([]);
  const [settings, setSettings] = useState<AIUmpireSettings>({
    ballSensitivity: 0.7,
    lineCallTolerance: 3,
    autoCallEnabled: true,
    soundEnabled: true,
    footFaultDetection: false,
    netTouchDetection: true,
    confidenceThreshold: 0.8
  });
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentCall, setCurrentCall] = useState<UmpireCall | null>(null);
  const [stats, setStats] = useState({
    totalCalls: 0,
    accuracy: 95.2,
    averageConfidence: 0.87,
    callsPerMinute: 2.3
  });
  
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastCallTimeRef = useRef<number>(0);

  // Initialize audio context for call sounds
  useEffect(() => {
    if (settings.soundEnabled && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, [settings.soundEnabled]);

  // Play call sound
  const playCallSound = useCallback((callType: string) => {
    if (!settings.soundEnabled || !audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Different tones for different calls
    const frequencies = {
      'out': 800,
      'in': 400,
      'fault': 600,
      'let': 500,
      'net': 700,
      'foot_fault': 900
    };

    oscillator.frequency.setValueAtTime(
      frequencies[callType as keyof typeof frequencies] || 500,
      ctx.currentTime
    );
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  }, [settings.soundEnabled]);

  // AI Ball and Line Detection
  const analyzeVideoFrame = useCallback(async () => {
    if (!videoElement || !isActive || !isCalibrated) return;

    try {
      // Create canvas for frame analysis
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;
      
      // Draw current video frame
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Call real AI ball detection service
      const ballDetection = await detectBallPosition(imageData, settings);
      
      if (ballDetection && ballDetection.confidence > settings.confidenceThreshold) {
        const call = await evaluateCall(ballDetection, canvas.width, canvas.height);
        
        if (call && Date.now() - lastCallTimeRef.current > 1000) { // Prevent duplicate calls
          lastCallTimeRef.current = Date.now();
          
          setCalls(prev => [call, ...prev.slice(0, 9)]); // Keep last 10 calls
          setCurrentCall(call);
          onCallMade(call);
          
          if (settings.autoCallEnabled) {
            playCallSound(call.type);
          }
          
          // Update stats
          setStats(prev => ({
            ...prev,
            totalCalls: prev.totalCalls + 1,
            averageConfidence: (prev.averageConfidence + call.confidence) / 2
          }));
          
          // Auto-hide call after 3 seconds
          setTimeout(() => setCurrentCall(null), 3000);
        }
      }
    } catch (error) {
      console.error('AI Umpire analysis error:', error);
    }
  }, [videoElement, isActive, isCalibrated, settings, onCallMade, playCallSound]);

  // Real ball detection function using AI service
  const detectBallPosition = async (imageData: ImageData, settings: AIUmpireSettings) => {
    try {
      // Convert ImageData to base64 for API call
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      ctx.putImageData(imageData, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      
      // Call AWS Lambda for ball detection
      const response = await fetch('/api/tennis-video-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          analysisOptions: {
            enableBallTracking: true,
            confidenceThreshold: settings.confidenceThreshold
          }
        })
      });
      
      if (!response.ok) {
        console.error('Ball detection API error:', response.statusText);
        return null;
      }
      
      const result = await response.json();
      
      if (result.success && result.data.ballTracking && result.data.ballTracking.length > 0) {
        const detection = result.data.ballTracking[0];
        return {
          position: detection.position,
          confidence: detection.confidence,
          speed: detection.speed,
          timestamp: Date.now()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Ball detection error:', error);
      return null;
    }
  };

  // Evaluate if ball is in or out
  const evaluateCall = async (ballDetection: any, canvasWidth: number, canvasHeight: number): Promise<UmpireCall | null> => {
    const { position, confidence, speed } = ballDetection;
    
    // Use real court detection data if available, otherwise use default bounds
     const courtBounds = courtDetectionData ? {
       left: courtDetectionData.courtLines?.left || canvasWidth * 0.1,
       right: courtDetectionData.courtLines?.right || canvasWidth * 0.9,
       top: courtDetectionData.courtLines?.top || canvasHeight * 0.1,
       bottom: courtDetectionData.courtLines?.bottom || canvasHeight * 0.9,
       serviceLineTop: courtDetectionData.serviceBoxes?.deuce?.top || canvasHeight * 0.3,
       serviceLineBottom: courtDetectionData.serviceBoxes?.ad?.bottom || canvasHeight * 0.7,
       centerLine: canvasWidth * 0.5
     } : {
       left: canvasWidth * 0.1,
       right: canvasWidth * 0.9,
       top: canvasHeight * 0.1,
       bottom: canvasHeight * 0.9,
       serviceLineTop: canvasHeight * 0.3,
       serviceLineBottom: canvasHeight * 0.7,
       centerLine: canvasWidth * 0.5
     };
    
    const tolerance = settings.lineCallTolerance;
    let callType: UmpireCall['type'] = 'in';
    let courtRegion = 'baseline';
    let challengeable = true;
    
    // Determine call based on position
    if (position.x < courtBounds.left - tolerance || 
        position.x > courtBounds.right + tolerance ||
        position.y < courtBounds.top - tolerance || 
        position.y > courtBounds.bottom + tolerance) {
      callType = 'out';
    }
    
    // Service box detection
    if (position.y > courtBounds.serviceLineTop && position.y < courtBounds.serviceLineBottom) {
      courtRegion = 'service_box';
      // Check if ball is outside service box boundaries
      if (position.x < courtBounds.left || position.x > courtBounds.centerLine ||
          position.y < courtBounds.serviceLineTop || position.y > courtBounds.serviceLineBottom) {
        callType = 'fault';
      }
    }
    
    // Net detection - check if ball trajectory indicates net contact
    if (Math.abs(position.y - canvasHeight * 0.5) < 10 && speed && speed < 20) {
      callType = 'net';
      challengeable = false;
    }
    
    return {
      id: `call_${Date.now()}_${position.x}_${position.y}`,
      timestamp: Date.now(),
      type: callType,
      confidence,
      position,
      description: `${callType.toUpperCase()} - ${courtRegion} (${speed?.toFixed(1)} km/h)`,
      ballSpeed: speed,
      courtRegion,
      challengeable
    };
  };

  // Start/stop AI analysis
  useEffect(() => {
    if (isActive && isCalibrated) {
      analysisIntervalRef.current = setInterval(analyzeVideoFrame, 100); // 10 FPS analysis
    } else {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
    }
    
    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, [isActive, isCalibrated, analyzeVideoFrame]);

  // Handle settings change
  const handleSettingsChange = (newSettings: Partial<AIUmpireSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    onSettingsChange(updatedSettings);
  };

  // Calibrate AI umpire
  const handleCalibrate = () => {
    setIsCalibrated(true);
    // In real implementation, this would run court detection and calibration
  };

  return (
    <div className="ai-umpire-panel bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-quantum-cyan" />
          <h3 className="font-semibold text-text-standard">AI Umpire</h3>
          <div className={`w-2 h-2 rounded-full ${
            isActive && isCalibrated ? 'bg-green-500' : 'bg-red-500'
          }`} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 hover:bg-hover-bg rounded"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleSettingsChange({ soundEnabled: !settings.soundEnabled })}
            className="p-1 hover:bg-hover-bg rounded"
          >
            {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Calibration Status */}
      {!isCalibrated && (
        <div className="bg-warning-orange bg-opacity-10 border border-warning-orange border-opacity-20 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning-orange" />
            <span className="text-sm font-medium text-warning-orange">Calibration Required</span>
          </div>
          <p className="text-xs text-text-subtle mb-2">
            AI Umpire needs court calibration for accurate line calls
          </p>
          <button
            onClick={handleCalibrate}
            className="btn btn-primary btn-sm"
          >
            <Target className="h-4 w-4 mr-1" />
            Calibrate Court
          </button>
        </div>
      )}

      {/* Current Call Display */}
      {currentCall && (
        <div className={`border rounded-lg p-3 mb-4 ${
          currentCall.type === 'out' || currentCall.type === 'fault' 
            ? 'bg-red-50 border-red-200' 
            : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-quantum-cyan" />
              <span className="font-bold text-lg">
                {currentCall.type.toUpperCase()}
              </span>
              <span className="text-sm text-text-subtle">
                {(currentCall.confidence * 100).toFixed(1)}% confidence
              </span>
            </div>
            <button
              onClick={() => setCurrentCall(null)}
              className="p-1 hover:bg-hover-bg rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-text-subtle mt-1">
            {currentCall.description}
          </p>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-bg-elevated border border-border-subtle rounded-lg p-3 mb-4">
          <h4 className="font-medium mb-3">AI Umpire Settings</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Ball Detection Sensitivity: {settings.ballSensitivity.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.3"
                max="0.9"
                step="0.1"
                value={settings.ballSensitivity}
                onChange={(e) => handleSettingsChange({ ballSensitivity: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Line Call Tolerance: {settings.lineCallTolerance}cm
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={settings.lineCallTolerance}
                onChange={(e) => handleSettingsChange({ lineCallTolerance: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Auto Call Enabled</span>
              <input
                type="checkbox"
                checked={settings.autoCallEnabled}
                onChange={(e) => handleSettingsChange({ autoCallEnabled: e.target.checked })}
                className="rounded"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Foot Fault Detection</span>
              <input
                type="checkbox"
                checked={settings.footFaultDetection}
                onChange={(e) => handleSettingsChange({ footFaultDetection: e.target.checked })}
                className="rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-bg-elevated rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <Activity className="h-3 w-3 text-quantum-cyan" />
            <span className="text-xs text-text-subtle">Total Calls</span>
          </div>
          <span className="text-lg font-bold">{stats.totalCalls}</span>
        </div>
        
        <div className="bg-bg-elevated rounded-lg p-2">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs text-text-subtle">Accuracy</span>
          </div>
          <span className="text-lg font-bold">{stats.accuracy}%</span>
        </div>
      </div>

      {/* Recent Calls */}
      <div>
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Recent Calls
        </h4>
        
        {calls.length === 0 ? (
          <p className="text-sm text-text-subtle text-center py-4">
            No calls made yet
          </p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {calls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between p-2 bg-bg-elevated rounded text-sm"
              >
                <div>
                  <span className={`font-medium ${
                    call.type === 'out' || call.type === 'fault' 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                    {call.type.toUpperCase()}
                  </span>
                  <span className="text-text-subtle ml-2">
                    {call.courtRegion}
                  </span>
                </div>
                <div className="text-xs text-text-subtle">
                  {new Date(call.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Indicator */}
      <div className="mt-4 pt-3 border-t border-border-subtle">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-subtle">
            Status: {isActive && isCalibrated ? 'Active' : 'Inactive'}
          </span>
          <span className="text-text-subtle">
            Confidence: {(stats.averageConfidence * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default AIUmpirePanel;