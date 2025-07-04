import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_AWS_API_ENDPOINT || 'https://your-api-gateway-url.execute-api.region.amazonaws.com/prod';

export interface VideoProcessingOptions {
  enableAI?: boolean;
  analysisFps?: number;
  maxFrames?: number;
  duration?: number;
}

export interface VideoProcessingResult {
  success: boolean;
  data?: {
    videoUrl: string;
    thumbnailUrl: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: string;
    analysis?: any;
    processingTime: number;
  };
  error?: string;
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
      playerAnalysis: { [playerId: string]: any };
      ballAnalysis: {
        trajectories: any[];
        bouncePoints: any[];
      };
      courtAnalysis: any;
      highlights: any[];
      umpireInsights: any;
    };
    processingTime: number;
  };
  error?: string;
}

export interface VideoCoachingResult {
  success: boolean;
  data?: {
    coachingAnalysis: {
      technicalAnalysis: any;
      tacticalAnalysis: any;
      performanceMetrics: any;
      recommendations: any;
      comparativeAnalysis: any;
      personalizedDrills: any[];
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

  private async makeRequest(endpoint: string, data: any): Promise<any> {
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
    matchId?: string,
    userId?: string,
    options: VideoProcessingOptions = {}
  ): Promise<VideoProcessingResult> {
    try {
      // Convert blob to base64
      const videoBase64 = await this.blobToBase64(videoBlob);
      
      const response = await this.makeRequest('/video/process-upload', {
        videoData: videoBase64,
        matchId,
        userId,
        analysisOptions: {
          enableAI: options.enableAI !== false, // Default to true
          analysisFps: options.analysisFps || 2,
          maxFrames: options.maxFrames || 60,
          duration: options.duration || 0
        }
      });

      return response;
    } catch (error) {
      console.error('Video processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Video processing failed'
      };
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
        matchId,
        playerId,
        options
      );

      if (!processingResult.success) {
        return { processing: processingResult };
      }

      // Step 2: Perform tennis analysis
      const videoKey = processingResult.data?.videoUrl || '';
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
        options.enableAI ? 'comprehensive' : 'basic'
      );

      return {
        processing: processingResult,
        analysis: analysisResult,
        coaching: coachingResult
      };
    } catch (error) {
      console.error('Complete video processing error:', error);
      return {
        processing: {
          success: false,
          error: error instanceof Error ? error.message : 'Complete video processing failed'
        }
      };
    }
  }

  /**
   * Get video processing status for long-running operations
   */
  async getProcessingStatus(processingId: string): Promise<{
    status: 'processing' | 'completed' | 'failed';
    progress: number;
    result?: any;
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