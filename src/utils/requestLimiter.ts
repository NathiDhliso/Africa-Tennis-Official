// Simple request rate limiter to prevent API exhaustion
class RequestLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequestsPerMinute: number;
  private readonly windowMs: number;

  constructor(maxRequestsPerMinute = 30, windowMs = 60000) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.windowMs = windowMs;
  }

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove requests older than the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    // Check if we can make another request
    if (validRequests.length >= this.maxRequestsPerMinute) {
      return false;
    }
    
    // Add current request and update
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }

  waitTime(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    if (requests.length < this.maxRequestsPerMinute) {
      return 0;
    }
    
    const oldestRequest = Math.min(...requests);
    return Math.max(0, this.windowMs - (now - oldestRequest));
  }

  reset(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
}

// Global instance
export const supabaseRateLimiter = new RequestLimiter(20, 60000); // 20 requests per minute

// Helper function to create a rate-limited request
export async function rateLimitedRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  fallbackValue?: T
): Promise<T | undefined> {
  if (!supabaseRateLimiter.canMakeRequest(key)) {
    const waitTime = supabaseRateLimiter.waitTime(key);
    console.warn(`Rate limit exceeded for ${key}. Wait ${waitTime}ms`);
    
    if (fallbackValue !== undefined) {
      return fallbackValue;
    }
    
    // Wait if the wait time is reasonable (less than 10 seconds)
    if (waitTime < 10000) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return rateLimitedRequest(key, requestFn, fallbackValue);
    }
    
    return undefined;
  }

  try {
    return await requestFn();
  } catch (error) {
    console.error(`Rate-limited request failed for ${key}:`, error);
    return fallbackValue;
  }
}

export default RequestLimiter; 