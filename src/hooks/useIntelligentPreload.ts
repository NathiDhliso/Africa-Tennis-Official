import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

// Preload map for intelligent route prediction
const ROUTE_PRELOAD_MAP: Record<string, string[]> = {
  '/dashboard': ['/matches', '/profile', '/rankings'],
  '/matches': ['/tournaments', '/profile', '/dashboard'],
  '/tournaments': ['/matches', '/rankings', '/dashboard'],
  '/profile': ['/matches', '/dashboard', '/rankings'],
  '/rankings': ['/matches', '/profile', '/tournaments'],
  '/video-analysis': ['/ai-coach', '/umpire', '/matches'],
  '/ai-coach': ['/video-analysis', '/matches', '/profile'],
  '/umpire': ['/video-analysis', '/matches', '/tournaments']
};

// Component import functions
const COMPONENT_IMPORTS: Record<string, () => Promise<any>> = {
  '/dashboard': () => import('../pages/DashboardPage'),
  '/matches': () => import('../pages/MatchesPage'),
  '/tournaments': () => import('../pages/TournamentsPage'),
  '/profile': () => import('../pages/ProfilePage'),
  '/rankings': () => import('../pages/RankingsPage'),
  '/video-analysis': () => import('../pages/VideoAnalysisPage'),
  '/ai-coach': () => import('../pages/AICoachPage'),
  '/umpire': () => import('../pages/UmpirePage')
};

interface UseIntelligentPreloadOptions {
  enabled?: boolean;
  delay?: number;
  maxConcurrent?: number;
}

export const useIntelligentPreload = ({
  enabled = true,
  delay = 1000,
  maxConcurrent = 3
}: UseIntelligentPreloadOptions = {}) => {
  const location = useLocation();

  const preloadRoute = useCallback(async (route: string) => {
    if (COMPONENT_IMPORTS[route]) {
      try {
        await COMPONENT_IMPORTS[route]();
        console.log(`✅ Preloaded: ${route}`);
      } catch (error) {
        console.warn(`❌ Failed to preload: ${route}`, error);
      }
    }
  }, []);

  const preloadRelatedRoutes = useCallback(async (currentPath: string) => {
    if (!enabled) return;

    const relatedRoutes = ROUTE_PRELOAD_MAP[currentPath] || [];
    const routesToPreload = relatedRoutes.slice(0, maxConcurrent);

    // Preload routes with staggered timing
    routesToPreload.forEach((route, index) => {
      setTimeout(() => {
        preloadRoute(route);
      }, delay + (index * 500));
    });
  }, [enabled, delay, maxConcurrent, preloadRoute]);

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Preload related routes based on current location
    preloadRelatedRoutes(currentPath);
  }, [location.pathname, preloadRelatedRoutes]);

  // Manual preload function for hover events
  const preloadOnHover = useCallback((route: string) => {
    if (enabled && COMPONENT_IMPORTS[route]) {
      preloadRoute(route);
    }
  }, [enabled, preloadRoute]);

  return {
    preloadOnHover,
    preloadRoute
  };
};

export default useIntelligentPreload;