import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LoadingScreenProps {
  progress: number;
  isLoaded: boolean;
  onStart: () => void;
  onSkip: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  progress, 
  isLoaded, 
  onStart,
  onSkip
}) => {
  const [showTip, setShowTip] = useState(0);
  const [showStartButton, setShowStartButton] = useState(false);
  
  const tips = [
    "Move with WASD, look around with your mouse",
    "Left-click to attack with your lightsaber",
    "Right-click to block incoming attacks",
    "Dodge enemy attacks by moving sideways",
    "Watch your health bar and strike when the enemy is vulnerable"
  ];
  
  useEffect(() => {
    // Rotate through tips
    const interval = setInterval(() => {
      setShowTip(prev => (prev + 1) % tips.length);
    }, 3000);
    
    // Show start button when loaded
    if (isLoaded) {
      setShowStartButton(true);
    }
    
    return () => clearInterval(interval);
  }, [isLoaded, tips.length]);
  
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold text-blue-500">Lightsaber Duel</h1>
        <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${Math.max(5, progress * 100)}%` }} // Minimum 5% width for visibility
          />
        </div>
        <p className="text-gray-300 text-xl">{Math.floor(progress * 100)}%</p>
        
        {/* Add a skip button in case loading gets stuck */}
        {progress > 0.1 && progress < 0.99 && (
          <button 
            onClick={onSkip} 
            className="mt-8 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
          >
            Skip Loading
          </button>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
