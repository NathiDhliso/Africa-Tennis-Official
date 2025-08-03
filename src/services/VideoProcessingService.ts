import { supabase } from '../lib/supabase';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://dd7v2jtghk.execute-api.us-west-2.amazonaws.com/prod').replace(/\/$/, '');

export interface VideoProcessingOptions {
  matchId?: string;
  highlightType?: string;
  description?: string;
  userId?: string;
  analysisFps?: number;
  maxFrames?: number;
  enableAI?: boolean;
}

export interface PlayerPose {
  keypoints: Array<{
    x: number;
    y: number;
    confidence: number;
    name: string;
  }>;
  confidence: number;
}

export interface CourtRegion {
  type: 'service_box' | 'baseline' | 'net' | 'sideline';
  coordinates: Array<{ x: number; y: number }>;
  confidence: number;
}

export interface BallTrajectory {
  points: Array<{ x: number; y: number; timestamp: number }>;
  speed: number;
  spin: { type: string; rpm: number };
  confidence: number;
}

export interface BouncePoint {
  position: { x: number; y: number };
  timestamp: number;
  type: 'first_bounce' | 'second_bounce';
  inBounds: boolean;
}

export interface CourtAnalysis {
  dimensions: { width: number; height: number };
  orientation: number;
  surfaceType: string;
  conditions: string;
}

export interface UmpireInsight {
  call: string;
  confidence: number;
  timestamp: number;
  reasoning: string;
}

export interface PlayerAnalysis {
  movementPatterns: Array<{
    type: string;
    frequency: number;
    effectiveness: number;
  }>;
  shotAnalysis: {
    forehand: { count: number; accuracy: number; power: number };
    backhand: { count: number; accuracy: number; power: number };
    serve: { count: number; accuracy: number; speed: number };
    volley: { count: number; accuracy: number };
  };
  positioning: {
    courtCoverage: number;
    netApproaches: number;
    baselinePlay: number;
  };
  fitness: {
    distanceCovered: number;
    averageSpeed: number;
    sprintCount: number;
  };
}

export interface TechnicalAnalysis {
  strokeMechanics: Record<string, {
    consistency: number;
    power: number;
    accuracy: number;
    recommendations: string[];
  }>;
  footwork: {
    efficiency: number;
    balance: number;
    recommendations: string[];
  };
}

export interface TacticalAnalysis {
  gameStyle: string;
  strengths: string[];
  weaknesses: string[];
  patternRecognition: Array<{
    pattern: string;
    frequency: number;
    success_rate: number;
  }>;
}

export interface PerformanceMetrics {
  overall_score: number;
  technical_score: number;
  tactical_score: number;
  fitness_score: number;
  mental_score: number;
}

export interface CoachingRecommendation {
  category: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  drills: string[];
}

export interface ComparativeAnalysis {
  peer_comparison: {
    ranking_percentile: number;
    similar_players: string[];
  };
  improvement_areas: string[];
}

export interface PersonalizedDrill {
  name: string;
  description: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  focus_areas: string[];
}

export interface VideoProcessingResult {
  videoUrl: string;
  compressedSize?: number;
  compressionRatio?: string;
  analysisResult?: {
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
        pose: PlayerPose;
      }>;
    }>;
    courtDetection: {
      lines: Array<{ start: { x: number; y: number }; end: { x: number; y: number }; type: string }>;
      regions: CourtRegion[];
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
  };
}

export interface TennisAnalysisResult {
  success: boolean;
  data?: {
    analysisKey: string;
    analysis: {
      matchStatistics: {
        totalRallies: number;
        averageRallyLength: number;
        longestRally: number;
        totalShots: number;
        aces: number;
        winners: number;
        unforcedErrors: number;
      };
      playerAnalysis: { [playerId: string]: PlayerAnalysis };
      ballAnalysis: {
        trajectories: BallTrajectory[];
        bouncePoints: BouncePoint[];
      };
      courtAnalysis: CourtAnalysis;
      highlights: Array<{
        startTime: number;
        endTime: number;
        type: string;
        description: string;
        confidence: number;
      }>;
      umpireInsights: UmpireInsight[];
    };
    processingTime: number;
  };
  error?: string;
}

export interface VideoCoachingResult {
  success: boolean;
  data?: {
    coachingAnalysis: {
      technicalAnalysis: TechnicalAnalysis;
      tacticalAnalysis: TacticalAnalysis;
      performanceMetrics: PerformanceMetrics;
      recommendations: CoachingRecommendation[];
      comparativeAnalysis: ComparativeAnalysis;
      personalizedDrills: PersonalizedDrill[];
    };
    analysisKey: string;
    summary: string;
  };
  error?: string;
}

class VideoProcessingService {
  private async getAuthToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }

  private async makeRequest(endpoint: string, data: Record<string, unknown>): Promise<unknown> {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Process and upload video to S3 with compression and basic analysis
   */
  async processVideoUpload(
    videoBlob: Blob,
    options: VideoProcessingOptions = {}
  ): Promise<VideoProcessingResult> {
    try {
      // Convert blob to base64
      const videoBase64 = await this.blobToBase64(videoBlob);
      
      const response = await this.makeRequest('/video/process-upload', {
        videoData: videoBase64,
        matchId: options.matchId,
        userId: options.userId,
        highlightType: options.highlightType,
        description: options.description,
        analysisOptions: {
          enableAI: true,
          analysisFps: options.analysisFps || 5,
          maxFrames: options.maxFrames || 300
        }
      });

      // Transform response to match expected interface
      if (response.success && response.data) {
        return {
          videoUrl: response.data.videoUrl,
          compressedSize: response.data.compressedSize,
          compressionRatio: response.data.compressionRatio,
          analysisResult: response.data.analysis ? {
            ballTracking: response.data.analysis.ballTracking || [],
            playerPositions: response.data.analysis.playerPositions || [],
            courtDetection: response.data.analysis.courtDetection || { lines: [], regions: {}, confidence: 0 },
            highlights: response.data.analysis.highlights || []
          } : undefined
        };
      } else {
        throw new Error(response.error || 'Video processing failed');
      }
    } catch (error) {
      console.error('Video processing error:', error);
      throw new Error(error instanceof Error ? error.message : 'Video processing failed');
    }
  }

  /**
   * Perform advanced tennis-specific analysis on processed video
   */
  async analyzeTennisVideo(
    videoKey: string,
    matchId?: string,
    options: VideoProcessingOptions = {}
  ): Promise<TennisAnalysisResult> {
    try {
      const response = await this.makeRequest('/video/tennis-analysis', {
        videoKey,
        matchId,
        analysisOptions: {
          analysisFps: options.analysisFps || 5, // Higher fps for detailed analysis
          maxFrames: options.maxFrames || 300,
          enableCourtDetection: true,
          enableBallTracking: true,
          enablePlayerTracking: true,
          enableUmpireInsights: true
        }
      });

      return response;
    } catch (error) {
      console.error('Tennis analysis error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tennis analysis failed'
      };
    }
  }

  /**
   * Generate video-based AI coaching insights
   */
  async generateVideoCoaching(
    playerId: string,
    videoAnalysisKeys: string[],
    matchId?: string,
    coachingFocus: string = 'comprehensive'
  ): Promise<VideoCoachingResult> {
    try {
      const response = await this.makeRequest('/video/ai-coaching', {
        playerId,
        videoAnalysisKeys,
        matchId,
        coachingFocus
      });

      return response;
    } catch (error) {
      console.error('Video coaching error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Video coaching analysis failed'
      };
    }
  }

  /**
   * Complete video processing pipeline: upload -> analyze -> coach
   */
  async processVideoComplete(
    videoBlob: Blob,
    playerId: string,
    matchId?: string,
    options: VideoProcessingOptions = {}
  ): Promise<{
    processing: VideoProcessingResult;
    analysis?: TennisAnalysisResult;
    coaching?: VideoCoachingResult;
  }> {
    try {
      // Step 1: Process and upload video
      const processingResult = await this.processVideoUpload(
        videoBlob,
        options
      );

      // Step 2: Perform tennis analysis
      const videoKey = processingResult.videoUrl || '';
      const analysisResult = await this.analyzeTennisVideo(
        videoKey,
        matchId,
        options
      );

      if (!analysisResult.success) {
        return { processing: processingResult, analysis: analysisResult };
      }

      // Step 3: Generate coaching insights
      const coachingResult = await this.generateVideoCoaching(
        playerId,
        [analysisResult.data?.analysisKey || ''],
        matchId,
        (options.enableAI !== false) ? 'comprehensive' : 'basic'
      );

      return {
        processing: processingResult,
        analysis: analysisResult,
        coaching: coachingResult
      };
    } catch (error) {
      console.error('Complete video processing error:', error);
      throw error;
    }
  }

  /**
   * Get video processing status for long-running operations
   */
  async getProcessingStatus(processingId: string): Promise<{
    status: 'processing' | 'completed' | 'failed';
    progress: number;
    result?: unknown;
    error?: string;
  }> {
    try {
      const response = await this.makeRequest('/video/status', {
        processingId
      });

      return response;
    } catch (error) {
      console.error('Status check error:', error);
      return {
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Status check failed'
      };
    }
  }

  /**
   * Utility function to convert blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data URL prefix (data:video/webm;base64,)
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Utility function to estimate video file size reduction
   */
  estimateCompression(originalSize: number): {
    estimatedSize: number;
    estimatedSavings: number;
    estimatedSavingsPercent: number;
  } {
    // Based on typical video compression ratios
    const compressionRatio = 0.3; // 70% size reduction expected
    const estimatedSize = Math.round(originalSize * compressionRatio);
    const estimatedSavings = originalSize - estimatedSize;
    const estimatedSavingsPercent = Math.round((estimatedSavings / originalSize) * 100);

    return {
      estimatedSize,
      estimatedSavings,
      estimatedSavingsPercent
    };
  }

  /**
   * Validate video file before processing
   */
  validateVideo(videoBlob: Blob): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size (max 100MB)
    if (videoBlob.size > 100 * 1024 * 1024) {
      errors.push('Video file is too large (max 100MB)');
    }

    // Check file type
    if (!videoBlob.type.startsWith('video/')) {
      errors.push('File is not a valid video format');
    }

    // Warn about large files
    if (videoBlob.size > 50 * 1024 * 1024) {
      warnings.push('Large video files may take longer to process');
    }

    // Warn about unsupported formats
    if (videoBlob.type && !['video/mp4', 'video/webm', 'video/avi'].includes(videoBlob.type)) {
      warnings.push('Video format may not be optimally supported');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export const videoProcessingService = new VideoProcessingService();