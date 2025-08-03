import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface PerformanceMetrics {
  navigationStart: number;
  loadComplete: number;
  loadTime: number;
  route: string;
}

export const usePerformanceMonitor = () => {
  const location = useLocation();
  const navigationStartRef = useRef<number>(Date.now());
  const metricsRef = useRef<PerformanceMetrics[]>([]);

  useEffect(() => {
    // Record navigation start time
    navigationStartRef.current = Date.now();

    // Record load complete time after a short delay to ensure rendering is done
    const timer = setTimeout(() => {
      const loadComplete = Date.now();
      const loadTime = loadComplete - navigationStartRef.current;
      
      const metrics: PerformanceMetrics = {
        navigationStart: navigationStartRef.current,
        loadComplete,
        loadTime,
        route: location.pathname
      };

      metricsRef.current.push(metrics);

      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 Page Load Performance:`, {
          route: location.pathname,
          loadTime: `${loadTime}ms`,
          status: loadTime < 500 ? '✅ Fast' : loadTime < 1000 ? '⚠️ Moderate' : '🐌 Slow'
        });
      }

      // Keep only last 10 metrics to prevent memory leaks
      if (metricsRef.current.length > 10) {
        metricsRef.current = metricsRef.current.slice(-10);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  const getAverageLoadTime = () => {
    if (metricsRef.current.length === 0) return 0;
    const total = metricsRef.current.reduce((sum, metric) => sum + metric.loadTime, 0);
    return Math.round(total / metricsRef.current.length);
  };

  const getMetrics = () => metricsRef.current;

  return {
    getAverageLoadTime,
    getMetrics
  };
};