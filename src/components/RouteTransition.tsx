import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteTransitionProps {
  children: React.ReactNode;
}

const RouteTransition: React.FC<RouteTransitionProps> = ({ children }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState('fade-in');

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage('fade-out');
    }
  }, [location, displayLocation]);

  const onAnimationEnd = () => {
    if (transitionStage === 'fade-out') {
      setDisplayLocation(location);
      setTransitionStage('fade-in');
    }
  };

  return (
    <div
      className={`route-transition ${transitionStage}`}
      onAnimationEnd={onAnimationEnd}
    >
      {children}
    </div>
  );
};

export default RouteTransition;