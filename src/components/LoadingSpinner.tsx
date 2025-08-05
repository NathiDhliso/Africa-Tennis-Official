import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  subtext?: string;
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  text = 'Loading...',
  subtext,
  color
}) => {
  console.log('[LOADING_SPINNER] Rendering with props:', { size, text, subtext, color });
  console.log('[LOADING_SPINNER] React available:', typeof React);
  const spinnerSizes = {
    small: 'w-6 h-6',
    medium: 'w-10 h-10',
    large: 'w-16 h-16'
  };
  
  const textSizes = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-xl'
  };

  const spinnerColor = color || 'var(--quantum-cyan)';

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div 
        className={`loading-spinner ${spinnerSizes[size]} mb-4`}
        style={{ borderTopColor: spinnerColor }}
      ></div>
      {text && (
        <p className={`${textSizes[size]} font-medium`} style={{ color: 'var(--text-standard)' }}>
          {text}
        </p>
      )}
      {subtext && (
        <p className="text-sm mt-2" style={{ color: 'var(--text-subtle)' }}>
          {subtext}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;