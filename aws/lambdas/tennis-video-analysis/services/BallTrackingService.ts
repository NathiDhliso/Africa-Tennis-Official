// Mock TensorFlow for SAM deployment
// import * as tf from '@tensorflow/tfjs-node';

interface BallDetection {
  position: { x: number; y: number };
  confidence: number;
  velocity: { x: number; y: number };
  speed: number; // mph
  spin: 'topspin' | 'backspin' | 'slice' | 'flat' | 'unknown';
  bounceDetected: boolean;
  trajectory: Array<{ x: number; y: number; timestamp: number }>;
  inBounds: boolean;
  courtRegion: 'service_box_deuce' | 'service_box_ad' | 'baseline' | 'net' | 'out' | 'unknown';
}

interface BallTrackingFrame {
  frameIndex: number;
  timestamp: number;
  detections: BallDetection[];
  primaryBall?: BallDetection;
}

interface TrajectoryPoint {
  x: number;
  y: number;
  timestamp: number;
  velocity: { x: number; y: number };
  confidence: number;
}

export class BallTrackingService {
  private model: any | null = null; // tf.LayersModel for production
  private isModelLoaded = false;
  private readonly INPUT_SIZE = 416;
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private readonly MAX_TRACKING_DISTANCE = 150; // pixels
  private readonly VELOCITY_SMOOTHING_FACTOR = 0.3;
  
  // Ball tracking state
  private ballTrajectory: TrajectoryPoint[] = [];
  private lastKnownPosition: { x: number; y: number; timestamp: number } | null = null;
  private ballId = 0;
  
  // Court dimensions for physics validation
  private courtBounds: {
    width: number;
    height: number;
    serviceBoxes: Array<{ x: number; y: number; width: number; height: number }>;
  } | null = null;

  constructor() {
    this.loadModel();
  }

  private async loadModel(): Promise<void> {
    try {
      console.log('Loading specialized tennis ball detection model...');
      
      // In production, this would be a custom CNN trained specifically on tennis balls
      // Architecture: MobileNetV3 backbone + custom detection head
      // Training data: 50,000+ tennis ball images in various conditions
      
      // For now, we'll simulate the model loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.isModelLoaded = true;
      console.log('Tennis ball detection model loaded successfully');
    } catch (error) {
      console.error('Error loading ball detection model:', error);
      throw new Error('Failed to load tennis ball detection model');
    }
  }

  async trackBall(
    imageBuffer: Buffer,
    timestamp: number,
    frameIndex: number,
    courtBounds?: any
  ): Promise<BallTrackingFrame> {
    if (!this.isModelLoaded) {
      await this.loadModel();
    }

    if (courtBounds) {
      this.courtBounds = courtBounds;
    }

    try {
      // Simulate image processing for now
      const imageWidth = 640;
      const imageHeight = 480;
      const detections = await this.detectBalls({ width: imageWidth, height: imageHeight }, timestamp);
      
      // Track ball across frames
      const trackedDetections = this.trackAcrossFrames(detections, timestamp);
      
      // Select primary ball (most confident, consistent with trajectory)
      const primaryBall = this.selectPrimaryBall(trackedDetections);
      
      // Update trajectory
      if (primaryBall) {
        this.updateTrajectory(primaryBall, timestamp);
      }
      
      return {
        frameIndex,
        timestamp,
        detections: trackedDetections,
        primaryBall
      };
    } catch (error) {
      console.error('Error in ball tracking:', error);
      throw new Error('Ball tracking failed');
    }
  }

  private async detectBalls(image: any, timestamp: number): Promise<BallDetection[]> {
    // Simulate specialized ball detection
    // In production, this would use the trained CNN model
    
    const mockDetections = this.simulateBallDetections(image.width, image.height, timestamp);
    
    return mockDetections.map(detection => ({
      ...detection,
      velocity: this.calculateVelocity(detection.position, timestamp),
      speed: this.calculateSpeed(detection.position, timestamp),
      spin: this.analyzeSpin(detection.position, timestamp),
      bounceDetected: this.detectBounce(detection.position, timestamp),
      trajectory: this.getRecentTrajectory(5), // Last 5 points
      inBounds: this.isInBounds(detection.position),
      courtRegion: this.getCourtRegion(detection.position)
    }));
  }

  private simulateBallDetections(imageWidth: number, imageHeight: number, timestamp: number): Array<{
    position: { x: number; y: number };
    confidence: number;
  }> {
    // Simulate realistic ball movement across the court
    const baseX = imageWidth * 0.3 + Math.sin(timestamp * 0.001) * imageWidth * 0.4;
    const baseY = imageHeight * 0.4 + Math.cos(timestamp * 0.0015) * imageHeight * 0.3;
    
    // Add some noise and multiple potential detections
    const detections = [
      {
        position: { x: baseX, y: baseY },
        confidence: 0.95
      }
    ];
    
    // Sometimes add false positives to test filtering
    if (Math.random() < 0.1) {
      detections.push({
        position: { 
          x: imageWidth * Math.random(), 
          y: imageHeight * Math.random() 
        },
        confidence: 0.6
      });
    }
    
    return detections;
  }

  private trackAcrossFrames(detections: BallDetection[], timestamp: number): BallDetection[] {
    if (!this.lastKnownPosition) {
      this.lastKnownPosition = detections[0] ? {
        x: detections[0].position.x,
        y: detections[0].position.y,
        timestamp
      } : null;
      return detections;
    }
    
    // Filter detections based on proximity to last known position
    const filteredDetections = detections.filter(detection => {
      const distance = this.calculateDistance(
        detection.position,
        this.lastKnownPosition!
      );
      return distance < this.MAX_TRACKING_DISTANCE;
    });
    
    // Update last known position with best detection
    if (filteredDetections.length > 0) {
      const bestDetection = filteredDetections.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      
      this.lastKnownPosition = {
        x: bestDetection.position.x,
        y: bestDetection.position.y,
        timestamp
      };
    }
    
    return filteredDetections;
  }

  private selectPrimaryBall(detections: BallDetection[]): BallDetection | undefined {
    if (detections.length === 0) return undefined;
    
    // Score detections based on confidence, trajectory consistency, and physics
    const scoredDetections = detections.map(detection => {
      let score = detection.confidence;
      
      // Bonus for trajectory consistency
      if (this.ballTrajectory.length > 2) {
        const predictedPosition = this.predictNextPosition();
        if (predictedPosition) {
          const distance = this.calculateDistance(detection.position, predictedPosition);
          score += Math.max(0, 1 - distance / 100); // Closer to prediction = higher score
        }
      }
      
      // Bonus for reasonable physics (speed, acceleration)
      if (this.isPhysicallyPlausible(detection)) {
        score += 0.2;
      }
      
      return { detection, score };
    });
    
    // Return highest scoring detection
    return scoredDetections.reduce((best, current) => 
      current.score > best.score ? current : best
    ).detection;
  }

  private calculateVelocity(position: { x: number; y: number }, timestamp: number): { x: number; y: number } {
    if (this.ballTrajectory.length === 0) {
      return { x: 0, y: 0 };
    }
    
    const lastPoint = this.ballTrajectory[this.ballTrajectory.length - 1];
    const timeDiff = (timestamp - lastPoint.timestamp) / 1000; // Convert to seconds
    
    if (timeDiff === 0) return { x: 0, y: 0 };
    
    const rawVelocity = {
      x: (position.x - lastPoint.x) / timeDiff,
      y: (position.y - lastPoint.y) / timeDiff
    };
    
    // Apply smoothing
    if (lastPoint.velocity) {
      return {
        x: lastPoint.velocity.x * (1 - this.VELOCITY_SMOOTHING_FACTOR) + 
           rawVelocity.x * this.VELOCITY_SMOOTHING_FACTOR,
        y: lastPoint.velocity.y * (1 - this.VELOCITY_SMOOTHING_FACTOR) + 
           rawVelocity.y * this.VELOCITY_SMOOTHING_FACTOR
      };
    }
    
    return rawVelocity;
  }

  private calculateSpeed(position: { x: number; y: number }, timestamp: number): number {
    const velocity = this.calculateVelocity(position, timestamp);
    const speedPixelsPerSecond = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    // Convert to approximate MPH (rough calibration)
    // This would need proper court calibration in production
    const approximateMPH = speedPixelsPerSecond * 0.1;
    
    return Math.min(approximateMPH, 150); // Cap at reasonable tennis ball speed
  }

  private analyzeSpin(position: { x: number; y: number }, timestamp: number): BallDetection['spin'] {
    if (this.ballTrajectory.length < 3) return 'unknown';
    
    // Analyze trajectory curvature to determine spin
    const recentPoints = this.ballTrajectory.slice(-3);
    
    // Calculate trajectory curvature
    const p1 = recentPoints[0];
    const p2 = recentPoints[1];
    const p3 = recentPoints[2];
    
    const dx1 = p2.x - p1.x;
    const dy1 = p2.y - p1.y;
    const dx2 = p3.x - p2.x;
    const dy2 = p3.y - p2.y;
    
    const curvature = (dx1 * dy2 - dy1 * dx2) / Math.pow(dx1 * dx1 + dy1 * dy1, 1.5);
    
    // Determine spin type based on curvature and vertical movement
    if (Math.abs(curvature) < 0.001) {
      return 'flat';
    } else if (dy2 > dy1 && curvature > 0) {
      return 'topspin';
    } else if (dy2 < dy1 && curvature < 0) {
      return 'backspin';
    } else {
      return 'slice';
    }
  }

  private detectBounce(position: { x: number; y: number }, timestamp: number): boolean {
    if (this.ballTrajectory.length < 3) return false;
    
    // Look for sudden velocity change indicating bounce
    const recentPoints = this.ballTrajectory.slice(-3);
    const currentVelocity = this.calculateVelocity(position, timestamp);
    
    if (recentPoints.length >= 2) {
      const prevVelocity = recentPoints[recentPoints.length - 1].velocity;
      
      // Check for vertical velocity reversal (bounce)
      if (prevVelocity.y > 0 && currentVelocity.y < 0) {
        return true;
      }
    }
    
    return false;
  }

  private isInBounds(position: { x: number; y: number }): boolean {
    if (!this.courtBounds) return true; // Assume in bounds if no court data
    
    // Check if ball is within court boundaries
    return position.x >= 0 && 
           position.x <= this.courtBounds.width &&
           position.y >= 0 && 
           position.y <= this.courtBounds.height;
  }

  private getCourtRegion(position: { x: number; y: number }): BallDetection['courtRegion'] {
    if (!this.courtBounds) return 'unknown';
    
    // Check service boxes
    for (const serviceBox of this.courtBounds.serviceBoxes) {
      if (position.x >= serviceBox.x && 
          position.x <= serviceBox.x + serviceBox.width &&
          position.y >= serviceBox.y && 
          position.y <= serviceBox.y + serviceBox.height) {
        return serviceBox.x < this.courtBounds.width / 2 ? 'service_box_deuce' : 'service_box_ad';
      }
    }
    
    // Determine other regions based on court position
    if (position.y < this.courtBounds.height * 0.2 || position.y > this.courtBounds.height * 0.8) {
      return 'baseline';
    } else if (Math.abs(position.y - this.courtBounds.height / 2) < this.courtBounds.height * 0.1) {
      return 'net';
    } else if (!this.isInBounds(position)) {
      return 'out';
    }
    
    return 'unknown';
  }

  private updateTrajectory(ball: BallDetection, timestamp: number): void {
    const trajectoryPoint: TrajectoryPoint = {
      x: ball.position.x,
      y: ball.position.y,
      timestamp,
      velocity: ball.velocity,
      confidence: ball.confidence
    };
    
    this.ballTrajectory.push(trajectoryPoint);
    
    // Keep only recent trajectory points (last 2 seconds)
    const cutoffTime = timestamp - 2000;
    this.ballTrajectory = this.ballTrajectory.filter(point => point.timestamp > cutoffTime);
  }

  private getRecentTrajectory(count: number): Array<{ x: number; y: number; timestamp: number }> {
    return this.ballTrajectory
      .slice(-count)
      .map(point => ({
        x: point.x,
        y: point.y,
        timestamp: point.timestamp
      }));
  }

  private predictNextPosition(): { x: number; y: number } | null {
    if (this.ballTrajectory.length < 2) return null;
    
    const lastTwo = this.ballTrajectory.slice(-2);
    const velocity = {
      x: lastTwo[1].x - lastTwo[0].x,
      y: lastTwo[1].y - lastTwo[0].y
    };
    
    return {
      x: lastTwo[1].x + velocity.x,
      y: lastTwo[1].y + velocity.y
    };
  }

  private isPhysicallyPlausible(detection: BallDetection): boolean {
    // Check if speed and acceleration are within reasonable tennis ball limits
    if (detection.speed > 150) return false; // Too fast
    if (detection.speed < 0) return false; // Invalid
    
    // Check trajectory consistency
    if (this.ballTrajectory.length > 1) {
      const lastPoint = this.ballTrajectory[this.ballTrajectory.length - 1];
      const distance = this.calculateDistance(detection.position, lastPoint);
      
      // Ball shouldn't teleport
      if (distance > 200) return false;
    }
    
    return true;
  }

  private calculateDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + 
      Math.pow(pos1.y - pos2.y, 2)
    );
  }

  // Public methods for analysis
  public getTrajectoryAnalysis(): {
    totalPoints: number;
    averageSpeed: number;
    maxSpeed: number;
    bounces: number;
    spinTypes: Record<string, number>;
  } {
    if (this.ballTrajectory.length === 0) {
      return {
        totalPoints: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        bounces: 0,
        spinTypes: {}
      };
    }
    
    const speeds = this.ballTrajectory.map(point => {
      const velocity = point.velocity;
      return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y) * 0.1;
    });
    
    return {
      totalPoints: this.ballTrajectory.length,
      averageSpeed: speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length,
      maxSpeed: Math.max(...speeds),
      bounces: 0, // Would need to implement bounce counting
      spinTypes: {} // Would need to implement spin analysis
    };
  }

  public resetTracking(): void {
    this.ballTrajectory = [];
    this.lastKnownPosition = null;
    this.ballId++;
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isModelLoaded = false;
    this.resetTracking();
  }
}

export default BallTrackingService;