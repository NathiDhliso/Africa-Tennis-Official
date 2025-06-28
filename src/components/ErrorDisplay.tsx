import React from 'react';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';

export type ErrorType = 'error' | 'warning' | 'info' | 'success';

interface ErrorDisplayProps {
  type: ErrorType;
  title: string;
  message: string;
  details?: string;
  onDismiss?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  type,
  title,
  message,
  details,
  onDismiss
}) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'error':
        return {
          bgColor: 'bg-error-pink bg-opacity-10',
          borderColor: 'border-error-pink',
          textColor: 'text-error-pink',
          icon: <AlertTriangle className="h-5 w-5" />
        };
      case 'warning':
        return {
          bgColor: 'bg-warning-orange bg-opacity-10',
          borderColor: 'border-warning-orange',
          textColor: 'text-warning-orange',
          icon: <AlertTriangle className="h-5 w-5" />
        };
      case 'info':
        return {
          bgColor: 'bg-quantum-cyan bg-opacity-10',
          borderColor: 'border-quantum-cyan',
          textColor: 'text-quantum-cyan',
          icon: <Info className="h-5 w-5" />
        };
      case 'success':
        return {
          bgColor: 'bg-success-green bg-opacity-10',
          borderColor: 'border-success-green',
          textColor: 'text-success-green',
          icon: <CheckCircle className="h-5 w-5" />
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className={`bg-glass-bg backdrop-filter-blur border rounded-lg p-4 mb-6 ${styles.borderColor}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className={styles.textColor}>{styles.icon}</div>
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-medium mb-1 ${styles.textColor}`}>
            {title}
          </h3>
          <p className="text-text-standard mb-2">{message}</p>
          {details && (
            <details className="mt-2">
              <summary className="text-sm cursor-pointer text-text-subtle">Technical details</summary>
              <p className="mt-1 text-sm text-text-subtle bg-bg-elevated p-2 rounded">{details}</p>
            </details>
          )}
          {onDismiss && (
            <div className="mt-3">
              <button 
                onClick={onDismiss}
                className="text-sm font-medium px-3 py-1 rounded-md bg-bg-elevated hover:bg-hover-bg"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
        {onDismiss && (
          <button 
            onClick={onDismiss}
            className="text-text-subtle hover:text-text-standard"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;