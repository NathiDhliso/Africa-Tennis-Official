import React, { useEffect, useState } from 'react';
import { useIntelligentPreload } from '../hooks/useIntelligentPreload';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  enableStagger?: boolean;
  showSkeleton?: boolean;
  skeletonDelay?: number;
}

const PageWrapper: React.FC<PageWrapperProps> = ({
  children,
  className = '',
  enableStagger = true,
  showSkeleton = false,
  skeletonDelay = 300
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showContent, setShowContent] = useState(!showSkeleton);
  
  // Initialize intelligent preloading
  useIntelligentPreload();

  useEffect(() => {
    // Content loads immediately without artificial delay
    if (showSkeleton) {
      setShowContent(true);
    }
  }, [showSkeleton]);

  useEffect(() => {
    // Mark as loaded after mount
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);

  const wrapperClasses = [
    'page-wrapper',
    enableStagger ? 'content-stagger' : '',
    isLoaded ? 'loaded' : 'loading',
    className
  ].filter(Boolean).join(' ');

  if (showSkeleton && !showContent) {
    return (
      <div className={wrapperClasses}>
        <div className="page-skeleton">
          <div className="skeleton-header">
            <div className="skeleton-title"></div>
            <div className="skeleton-subtitle"></div>
          </div>
          <div className="skeleton-content">
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClasses}>
      {children}
    </div>
  );
};

export default PageWrapper;