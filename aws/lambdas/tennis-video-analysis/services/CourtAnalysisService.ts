// Court analysis service without canvas dependencies

interface CourtDetection {
  courtBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  serviceBoxes: {
    deuce: { x: number; y: number; width: number; height: number };
    ad: { x: number; y: number; width: number; height: number };
  };
  netPosition: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  baselines: {
    near: { x1: number; y1: number; x2: number; y2: number };
    far: { x1: number; y1: number; x2: number; y2: number };
  };
  sidelines: {
    left: { x1: number; y1: number; x2: number; y2: number };
    right: { x1: number; y1: number; x2: number; y2: number };
  };
  serviceLines: {
    near: { x1: number; y1: number; x2: number; y2: number };
    far: { x1: number; y1: number; x2: number; y2: number };
  };
  centerServiceLine: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  confidence: number;
  perspective: {
    homographyMatrix: number[][];
    realWorldCoordinates: boolean;
    viewAngle: number;
    distortion: number;
  };
}

interface LineDetection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angle: number;
  length: number;
  strength: number;
  type: 'horizontal' | 'vertical' | 'diagonal';
}



export class CourtAnalysisService {
  private readonly CANNY_LOW_THRESHOLD = 50;
  private readonly CANNY_HIGH_THRESHOLD = 150;
  private readonly HOUGH_THRESHOLD = 100;
  private readonly MIN_LINE_LENGTH = 50;
  private readonly MAX_LINE_GAP = 10;
  private readonly ANGLE_TOLERANCE = 5; // degrees
  
  // Tennis court real-world dimensions (in feet)
  private readonly COURT_DIMENSIONS = {
    length: 78, // feet
    width: 36, // feet
    serviceBoxLength: 21, // feet
    serviceBoxWidth: 13.5, // feet
    netHeight: 3.5, // feet at posts
    alleyWidth: 4.5 // feet
  };

  constructor() {}

  async analyzeCourt(): Promise<CourtDetection> {
    try {
      console.log('Starting enhanced court analysis...');
      
      // Simulate image processing for now
      const imageWidth = 640;
      const imageHeight = 480;
      
      // Create mock image data
      const imageData = {
        data: new Uint8ClampedArray(imageWidth * imageHeight * 4),
        width: imageWidth,
        height: imageHeight
      };
      
      // Step 1: Enhanced edge detection for tennis courts
      const edges = this.detectTennisCourtEdges(imageData);
      
      // Step 2: Line detection using Hough transform
      const lines = this.detectLinesHough(edges, imageWidth, imageHeight);
      
      // Step 3: Filter and classify lines
      const classifiedLines = this.classifyCourtLines(lines);
      
      // Step 4: Construct court geometry
      const courtGeometry = this.constructCourtGeometry(classifiedLines, imageWidth, imageHeight);
      
      // Step 5: Perspective analysis and correction
      const perspective = this.analyzePerspective(courtGeometry);
      
      // Step 6: Validate and refine detection
      const refinedCourt = this.validateAndRefine(courtGeometry, perspective);
      
      console.log(`Court analysis complete. Confidence: ${refinedCourt.confidence}`);
      
      return {
        ...refinedCourt,
        perspective
      };
    } catch (error) {
      console.error('Error in court analysis:', error);
      throw new Error('Court analysis failed');
    }
  }

  private detectTennisCourtEdges(imageData: { data: Uint8ClampedArray; width: number; height: number }): Uint8ClampedArray {
    const { data, width, height } = imageData;
    const edges = new Uint8ClampedArray(width * height);
    
    // Convert to grayscale with tennis court color emphasis
    const grayscale = new Uint8ClampedArray(width * height);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Emphasize white lines and green court surface
      let gray;
      if (this.isWhiteLine(r, g, b)) {
        gray = 255; // Enhance white lines
      } else if (this.isGreenCourt(r, g, b)) {
        gray = (r + g + b) / 3 * 0.8; // Slightly darken court surface
      } else {
        gray = (r + g + b) / 3;
      }
      
      grayscale[Math.floor(i / 4)] = gray;
    }
    
    // Apply Gaussian blur to reduce noise
    const blurred = this.gaussianBlur(grayscale, width, height, 1.0);
    
    // Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Sobel X kernel
        const gx = 
          -1 * blurred[(y - 1) * width + (x - 1)] +
          -2 * blurred[y * width + (x - 1)] +
          -1 * blurred[(y + 1) * width + (x - 1)] +
           1 * blurred[(y - 1) * width + (x + 1)] +
           2 * blurred[y * width + (x + 1)] +
           1 * blurred[(y + 1) * width + (x + 1)];
        
        // Sobel Y kernel
        const gy = 
          -1 * blurred[(y - 1) * width + (x - 1)] +
          -2 * blurred[(y - 1) * width + x] +
          -1 * blurred[(y - 1) * width + (x + 1)] +
           1 * blurred[(y + 1) * width + (x - 1)] +
           2 * blurred[(y + 1) * width + x] +
           1 * blurred[(y + 1) * width + (x + 1)];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        
        // Apply Canny thresholding
        if (magnitude > this.CANNY_HIGH_THRESHOLD) {
          edges[idx] = 255;
        } else if (magnitude > this.CANNY_LOW_THRESHOLD) {
          // Check if connected to strong edge
          edges[idx] = this.isConnectedToStrongEdge(edges, x, y, width, height) ? 255 : 0;
        } else {
          edges[idx] = 0;
        }
      }
    }
    
    return edges;
  }

  private isWhiteLine(r: number, g: number, b: number): boolean {
    return r > 200 && g > 200 && b > 200 && 
           Math.abs(r - g) < 30 && Math.abs(g - b) < 30;
  }

  private isGreenCourt(r: number, g: number, b: number): boolean {
    return g > r && g > b && g > 80 && r < 150 && b < 150;
  }

  private gaussianBlur(data: Uint8ClampedArray, width: number, height: number, sigma: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(data.length);
    const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
    const kernel = this.generateGaussianKernel(kernelSize, sigma);
    const halfKernel = Math.floor(kernelSize / 2);
    
    // Horizontal pass
    const temp = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let i = -halfKernel; i <= halfKernel; i++) {
          const px = Math.max(0, Math.min(width - 1, x + i));
          const weight = kernel[i + halfKernel];
          sum += data[y * width + px] * weight;
          weightSum += weight;
        }
        
        temp[y * width + x] = sum / weightSum;
      }
    }
    
    // Vertical pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let i = -halfKernel; i <= halfKernel; i++) {
          const py = Math.max(0, Math.min(height - 1, y + i));
          const weight = kernel[i + halfKernel];
          sum += temp[py * width + x] * weight;
          weightSum += weight;
        }
        
        result[y * width + x] = sum / weightSum;
      }
    }
    
    return result;
  }

  private generateGaussianKernel(size: number, sigma: number): number[] {
    const kernel = new Array(size);
    const center = Math.floor(size / 2);
    let sum = 0;
    
    for (let i = 0; i < size; i++) {
      const x = i - center;
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      sum += kernel[i];
    }
    
    // Normalize
    for (let i = 0; i < size; i++) {
      kernel[i] /= sum;
    }
    
    return kernel;
  }

  private isConnectedToStrongEdge(edges: Uint8ClampedArray, x: number, y: number, width: number, height: number): boolean {
    // Check 8-connected neighbors for strong edges
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (edges[ny * width + nx] === 255) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private detectLinesHough(edges: Uint8ClampedArray, width: number, height: number): LineDetection[] {
    const lines: LineDetection[] = [];
    const maxRho = Math.sqrt(width * width + height * height);
    const rhoStep = 1;
    const thetaStep = Math.PI / 180; // 1 degree
    
    const rhoSize = Math.ceil(2 * maxRho / rhoStep);
    const thetaSize = Math.ceil(Math.PI / thetaStep);
    const accumulator = new Array(rhoSize * thetaSize).fill(0);
    
    // Build accumulator
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edges[y * width + x] === 255) {
          for (let thetaIdx = 0; thetaIdx < thetaSize; thetaIdx++) {
            const theta = thetaIdx * thetaStep;
            const rho = x * Math.cos(theta) + y * Math.sin(theta);
            const rhoIdx = Math.floor((rho + maxRho) / rhoStep);
            
            if (rhoIdx >= 0 && rhoIdx < rhoSize) {
              accumulator[rhoIdx * thetaSize + thetaIdx]++;
            }
          }
        }
      }
    }
    
    // Find peaks in accumulator
    for (let rhoIdx = 0; rhoIdx < rhoSize; rhoIdx++) {
      for (let thetaIdx = 0; thetaIdx < thetaSize; thetaIdx++) {
        const votes = accumulator[rhoIdx * thetaSize + thetaIdx];
        
        if (votes > this.HOUGH_THRESHOLD) {
          const rho = (rhoIdx * rhoStep) - maxRho;
          const theta = thetaIdx * thetaStep;
          
          // Convert to line endpoints
          const line = this.rhoThetaToLine(rho, theta, width, height);
          if (line && line.length > this.MIN_LINE_LENGTH) {
            lines.push({
              ...line,
              strength: votes,
              type: this.classifyLineOrientation(theta)
            });
          }
        }
      }
    }
    
    // Merge nearby lines
    return this.mergeNearbyLines(lines);
  }

  private rhoThetaToLine(rho: number, theta: number, width: number, height: number): {
    x1: number; y1: number; x2: number; y2: number; angle: number; length: number;
  } | null {
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    
    let x1, y1, x2, y2;
    
    if (Math.abs(cosTheta) > 0.001) {
      // Line is not vertical
      x1 = 0;
      y1 = (rho - x1 * cosTheta) / sinTheta;
      x2 = width - 1;
      y2 = (rho - x2 * cosTheta) / sinTheta;
    } else {
      // Line is vertical
      y1 = 0;
      x1 = (rho - y1 * sinTheta) / cosTheta;
      y2 = height - 1;
      x2 = (rho - y2 * sinTheta) / cosTheta;
    }
    
    // Clip to image bounds
    if (x1 < 0 || x1 >= width) {
      if (x1 < 0) {
        y1 = y1 + (0 - x1) * (y2 - y1) / (x2 - x1);
        x1 = 0;
      } else {
        y1 = y1 + (width - 1 - x1) * (y2 - y1) / (x2 - x1);
        x1 = width - 1;
      }
    }
    
    if (x2 < 0 || x2 >= width) {
      if (x2 < 0) {
        y2 = y1 + (0 - x1) * (y2 - y1) / (x2 - x1);
        x2 = 0;
      } else {
        y2 = y1 + (width - 1 - x1) * (y2 - y1) / (x2 - x1);
        x2 = width - 1;
      }
    }
    
    if (y1 < 0 || y1 >= height || y2 < 0 || y2 >= height) {
      return null;
    }
    
    const length = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    
    return {
      x1: Math.round(x1),
      y1: Math.round(y1),
      x2: Math.round(x2),
      y2: Math.round(y2),
      angle: theta,
      length
    };
  }

  private classifyLineOrientation(theta: number): 'horizontal' | 'vertical' | 'diagonal' {
    const degrees = (theta * 180 / Math.PI) % 180;
    
    if (degrees < this.ANGLE_TOLERANCE || degrees > 180 - this.ANGLE_TOLERANCE) {
      return 'horizontal';
    } else if (Math.abs(degrees - 90) < this.ANGLE_TOLERANCE) {
      return 'vertical';
    } else {
      return 'diagonal';
    }
  }

  private mergeNearbyLines(lines: LineDetection[]): LineDetection[] {
    const merged: LineDetection[] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      
      const line1 = lines[i];
      const similarLines = [line1];
      used.add(i);
      
      for (let j = i + 1; j < lines.length; j++) {
        if (used.has(j)) continue;
        
        const line2 = lines[j];
        if (this.areLinesSimilar(line1, line2)) {
          similarLines.push(line2);
          used.add(j);
        }
      }
      
      // Merge similar lines
      const mergedLine = this.mergeSimilarLines(similarLines);
      merged.push(mergedLine);
    }
    
    return merged;
  }

  private areLinesSimilar(line1: LineDetection, line2: LineDetection): boolean {
    const angleDiff = Math.abs(line1.angle - line2.angle) * 180 / Math.PI;
    const parallelThreshold = 10; // degrees
    
    if (angleDiff > parallelThreshold && angleDiff < 180 - parallelThreshold) {
      return false;
    }
    
    // Check distance between lines
    const distance = this.distanceBetweenLines(line1, line2);
    return distance < 20; // pixels
  }

  private distanceBetweenLines(line1: LineDetection, line2: LineDetection): number {
    // Calculate average distance between line midpoints
    const mid1 = {
      x: (line1.x1 + line1.x2) / 2,
      y: (line1.y1 + line1.y2) / 2
    };
    const mid2 = {
      x: (line2.x1 + line2.x2) / 2,
      y: (line2.y1 + line2.y2) / 2
    };
    
    return Math.sqrt(
      (mid1.x - mid2.x) * (mid1.x - mid2.x) +
      (mid1.y - mid2.y) * (mid1.y - mid2.y)
    );
  }

  private mergeSimilarLines(lines: LineDetection[]): LineDetection {
    if (lines.length === 1) return lines[0];
    
    // Weight by strength and merge
    let totalWeight = 0;
    let weightedX1 = 0, weightedY1 = 0, weightedX2 = 0, weightedY2 = 0;
    let maxStrength = 0;
    let avgAngle = 0;
    
    lines.forEach(line => {
      const weight = line.strength;
      totalWeight += weight;
      weightedX1 += line.x1 * weight;
      weightedY1 += line.y1 * weight;
      weightedX2 += line.x2 * weight;
      weightedY2 += line.y2 * weight;
      maxStrength = Math.max(maxStrength, line.strength);
      avgAngle += line.angle * weight;
    });
    
    const mergedLine: LineDetection = {
      x1: Math.round(weightedX1 / totalWeight),
      y1: Math.round(weightedY1 / totalWeight),
      x2: Math.round(weightedX2 / totalWeight),
      y2: Math.round(weightedY2 / totalWeight),
      angle: avgAngle / totalWeight,
      length: 0, // Will be recalculated
      strength: maxStrength,
      type: lines[0].type
    };
    
    mergedLine.length = Math.sqrt(
      (mergedLine.x2 - mergedLine.x1) * (mergedLine.x2 - mergedLine.x1) +
      (mergedLine.y2 - mergedLine.y1) * (mergedLine.y2 - mergedLine.y1)
    );
    
    return mergedLine;
  }

  private classifyCourtLines(lines: LineDetection[]): {
    horizontalLines: LineDetection[];
    verticalLines: LineDetection[];
    baselines: LineDetection[];
    serviceLines: LineDetection[];
    sidelines: LineDetection[];
    netLine: LineDetection | null;
    centerServiceLine: LineDetection | null;
  } {
    const horizontalLines = lines.filter(line => line.type === 'horizontal').sort((a, b) => {
      const midY_a = (a.y1 + a.y2) / 2;
      const midY_b = (b.y1 + b.y2) / 2;
      return midY_a - midY_b;
    });
    
    const verticalLines = lines.filter(line => line.type === 'vertical').sort((a, b) => {
      const midX_a = (a.x1 + a.x2) / 2;
      const midX_b = (b.x1 + b.x2) / 2;
      return midX_a - midX_b;
    });
    
    // Identify specific court lines
    const baselines: LineDetection[] = [];
    const serviceLines: LineDetection[] = [];
    let netLine: LineDetection | null = null;
    
    // Find baselines (top and bottom horizontal lines)
    if (horizontalLines.length >= 2) {
      baselines.push(horizontalLines[0]); // Top baseline
      baselines.push(horizontalLines[horizontalLines.length - 1]); // Bottom baseline
    }
    
    // Find net line (middle horizontal line)
    if (horizontalLines.length >= 3) {
      const middleIndex = Math.floor(horizontalLines.length / 2);
      netLine = horizontalLines[middleIndex];
    }
    
    // Find service lines
    horizontalLines.forEach(line => {
      if (!baselines.includes(line) && line !== netLine) {
        serviceLines.push(line);
      }
    });
    
    // Find sidelines (leftmost and rightmost vertical lines)
    const sidelines: LineDetection[] = [];
    if (verticalLines.length >= 2) {
      sidelines.push(verticalLines[0]); // Left sideline
      sidelines.push(verticalLines[verticalLines.length - 1]); // Right sideline
    }
    
    // Find center service line (middle vertical line)
    let centerServiceLine: LineDetection | null = null;
    if (verticalLines.length >= 3) {
      const middleIndex = Math.floor(verticalLines.length / 2);
      centerServiceLine = verticalLines[middleIndex];
    }
    
    return {
      horizontalLines,
      verticalLines,
      baselines,
      serviceLines,
      sidelines,
      netLine,
      centerServiceLine
    };
  }

  private constructCourtGeometry(classifiedLines: {
    baselines: LineDetection[];
    serviceLines: LineDetection[];
    sidelines: LineDetection[];
    netLine: LineDetection | null;
    centerServiceLine: LineDetection | null;
  }, width: number, height: number): Omit<CourtDetection, 'perspective'> {
    const { baselines, serviceLines, sidelines, netLine, centerServiceLine } = classifiedLines;
    
    // Calculate court bounds
    let courtBounds = {
      x: 0,
      y: 0,
      width: width,
      height: height
    };
    
    if (sidelines.length >= 2 && baselines.length >= 2) {
      const leftSideline = sidelines[0];
      const rightSideline = sidelines[sidelines.length - 1];
      const topBaseline = baselines[0];
      const bottomBaseline = baselines[baselines.length - 1];
      
      courtBounds = {
        x: Math.min(leftSideline.x1, leftSideline.x2),
        y: Math.min(topBaseline.y1, topBaseline.y2),
        width: Math.max(rightSideline.x1, rightSideline.x2) - Math.min(leftSideline.x1, leftSideline.x2),
        height: Math.max(bottomBaseline.y1, bottomBaseline.y2) - Math.min(topBaseline.y1, topBaseline.y2)
      };
    }
    
    // Calculate service boxes
    const serviceBoxes = this.calculateServiceBoxes(courtBounds, serviceLines, centerServiceLine, netLine);
    
    // Calculate confidence based on detected lines
    const confidence = this.calculateDetectionConfidence(classifiedLines);
    
    return {
      courtBounds,
      serviceBoxes,
      netPosition: netLine ? {
        x1: netLine.x1,
        y1: netLine.y1,
        x2: netLine.x2,
        y2: netLine.y2
      } : { x1: 0, y1: height / 2, x2: width, y2: height / 2 },
      baselines: {
        near: baselines[0] ? {
          x1: baselines[0].x1,
          y1: baselines[0].y1,
          x2: baselines[0].x2,
          y2: baselines[0].y2
        } : { x1: 0, y1: 0, x2: width, y2: 0 },
        far: baselines[1] ? {
          x1: baselines[1].x1,
          y1: baselines[1].y1,
          x2: baselines[1].x2,
          y2: baselines[1].y2
        } : { x1: 0, y1: height, x2: width, y2: height }
      },
      sidelines: {
        left: sidelines[0] ? {
          x1: sidelines[0].x1,
          y1: sidelines[0].y1,
          x2: sidelines[0].x2,
          y2: sidelines[0].y2
        } : { x1: 0, y1: 0, x2: 0, y2: height },
        right: sidelines[1] ? {
          x1: sidelines[1].x1,
          y1: sidelines[1].y1,
          x2: sidelines[1].x2,
          y2: sidelines[1].y2
        } : { x1: width, y1: 0, x2: width, y2: height }
      },
      serviceLines: {
        near: serviceLines[0] ? {
          x1: serviceLines[0].x1,
          y1: serviceLines[0].y1,
          x2: serviceLines[0].x2,
          y2: serviceLines[0].y2
        } : { x1: 0, y1: height * 0.33, x2: width, y2: height * 0.33 },
        far: serviceLines[1] ? {
          x1: serviceLines[1].x1,
          y1: serviceLines[1].y1,
          x2: serviceLines[1].x2,
          y2: serviceLines[1].y2
        } : { x1: 0, y1: height * 0.67, x2: width, y2: height * 0.67 }
      },
      centerServiceLine: centerServiceLine ? {
        x1: centerServiceLine.x1,
        y1: centerServiceLine.y1,
        x2: centerServiceLine.x2,
        y2: centerServiceLine.y2
      } : { x1: width / 2, y1: 0, x2: width / 2, y2: height },
      confidence
    };
  }

  private calculateServiceBoxes(courtBounds: { x: number; y: number; width: number; height: number }, serviceLines: LineDetection[], centerServiceLine: LineDetection | null, netLine: LineDetection | null) {
    const netY = netLine ? (netLine.y1 + netLine.y2) / 2 : courtBounds.height / 2;
    const centerX = centerServiceLine ? (centerServiceLine.x1 + centerServiceLine.x2) / 2 : courtBounds.width / 2;
    
    const serviceBoxHeight = courtBounds.height * 0.3; // Approximate
    const serviceBoxWidth = courtBounds.width / 2;
    
    return {
      deuce: {
        x: courtBounds.x,
        y: netY - serviceBoxHeight / 2,
        width: serviceBoxWidth,
        height: serviceBoxHeight
      },
      ad: {
        x: centerX,
        y: netY - serviceBoxHeight / 2,
        width: serviceBoxWidth,
        height: serviceBoxHeight
      }
    };
  }

  private calculateDetectionConfidence(classifiedLines: {
    baselines: LineDetection[];
    serviceLines: LineDetection[];
    sidelines: LineDetection[];
    netLine: LineDetection | null;
    centerServiceLine: LineDetection | null;
  }): number {
    let confidence = 0;
    
    // Base confidence on number of detected lines
    const totalExpectedLines = 7; // 2 baselines, 2 service lines, 2 sidelines, 1 net, 1 center service
    const detectedLines = 
      classifiedLines.baselines.length +
      classifiedLines.serviceLines.length +
      classifiedLines.sidelines.length +
      (classifiedLines.netLine ? 1 : 0) +
      (classifiedLines.centerServiceLine ? 1 : 0);
    
    confidence = detectedLines / totalExpectedLines;
    
    // Bonus for strong lines
    const avgStrength = classifiedLines.horizontalLines.concat(classifiedLines.verticalLines)
      .reduce((sum: number, line: LineDetection) => sum + line.strength, 0) / 
      (classifiedLines.horizontalLines.length + classifiedLines.verticalLines.length);
    
    confidence += Math.min(0.3, avgStrength / 1000);
    
    return Math.min(1.0, confidence);
  }

  private analyzePerspective(courtGeometry: {
    baselines: { top: LineDetection | null; bottom: LineDetection | null };
    sidelines: { left: LineDetection | null; right: LineDetection | null };
  }): CourtDetection['perspective'] {
    // Analyze perspective distortion and calculate homography matrix
    const { baselines, sidelines } = courtGeometry;
    
    // Calculate view angle based on court line convergence
    let viewAngle = 0;
    if (sidelines.left && sidelines.right) {
      const leftAngle = Math.atan2(sidelines.left.y2 - sidelines.left.y1, sidelines.left.x2 - sidelines.left.x1);
      const rightAngle = Math.atan2(sidelines.right.y2 - sidelines.right.y1, sidelines.right.x2 - sidelines.right.x1);
      viewAngle = Math.abs(leftAngle - rightAngle) * 180 / Math.PI;
    }
    
    // Calculate distortion based on baseline length difference
    let distortion = 0;
    if (baselines.near && baselines.far) {
      const nearLength = Math.sqrt(
        (baselines.near.x2 - baselines.near.x1) ** 2 + 
        (baselines.near.y2 - baselines.near.y1) ** 2
      );
      const farLength = Math.sqrt(
        (baselines.far.x2 - baselines.far.x1) ** 2 + 
        (baselines.far.y2 - baselines.far.y1) ** 2
      );
      distortion = Math.abs(nearLength - farLength) / Math.max(nearLength, farLength);
    }
    
    // Generate identity homography matrix (would be calculated properly in production)
    const homographyMatrix = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    
    return {
      homographyMatrix,
      realWorldCoordinates: courtGeometry.confidence > 0.7,
      viewAngle,
      distortion
    };
  }

  private validateAndRefine(courtGeometry: Omit<CourtDetection, 'perspective'>, perspective: CourtDetection['perspective']): Omit<CourtDetection, 'perspective'> {
    // Validate court geometry against tennis court rules
    let refinedGeometry = { ...courtGeometry };
    
    // Ensure service boxes are reasonable size
    const courtArea = refinedGeometry.courtBounds.width * refinedGeometry.courtBounds.height;
    const serviceBoxArea = refinedGeometry.serviceBoxes.deuce.width * refinedGeometry.serviceBoxes.deuce.height;
    
    if (serviceBoxArea / courtArea > 0.5 || serviceBoxArea / courtArea < 0.1) {
      // Recalculate service boxes with standard proportions
      refinedGeometry.serviceBoxes = this.calculateServiceBoxes(
        refinedGeometry.courtBounds,
        [],
        null,
        null
      );
    }
    
    // Adjust confidence based on validation
    if (perspective.distortion > 0.3) {
      refinedGeometry.confidence *= 0.8;
    }
    
    if (perspective.viewAngle > 45) {
      refinedGeometry.confidence *= 0.9;
    }
    
    return refinedGeometry;
  }

  // Public utility methods
  public worldToPixel(worldX: number, worldY: number, homographyMatrix: number[][]): { x: number; y: number } {
    // Transform world coordinates to pixel coordinates using homography
    const [h11, h12, h13] = homographyMatrix[0];
    const [h21, h22, h23] = homographyMatrix[1];
    const [h31, h32, h33] = homographyMatrix[2];
    
    const w = h31 * worldX + h32 * worldY + h33;
    const x = (h11 * worldX + h12 * worldY + h13) / w;
    const y = (h21 * worldX + h22 * worldY + h23) / w;
    
    return { x, y };
  }

  public pixelToWorld(pixelX: number, pixelY: number): { x: number; y: number } {
    // Transform pixel coordinates to world coordinates (inverse homography)
    // This would require matrix inversion in production
    return { x: pixelX, y: pixelY };
  }

  dispose(): void {
    // Cleanup resources if needed
  }
}

export default CourtAnalysisService;