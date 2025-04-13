import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LoadingScreenProps {
  progress: number;
  isLoaded: boolean;
  onStart: () => void;
  onSkip?: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  progress, 
  isLoaded, 
  onStart,
  onSkip
}) => {
  const [showTip, setShowTip] = useState(0);
  const [showStartButton, setShowStartButton] = useState(false);
  const [showSkipButton, setShowSkipButton] = useState(false);
  
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
    if (progress >= 0.95) {
      setTimeout(() => {
        setShowStartButton(true);
      }, 500);
    }
    
    // Show skip button after a delay if loading takes too long
    const skipTimer = setTimeout(() => {
      if (progress < 0.9) {
        setShowSkipButton(true);
      }
    }, 8000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(skipTimer);
    };
  }, [progress, tips.length]);
  
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold text-blue-500">Plasmablade Duel</h1>
        <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${Math.max(5, progress * 100)}%` }} // Minimum 5% width for visibility
          />
        </div>
        <p className="text-gray-300 text-xl">{Math.floor(progress * 100)}%</p>
        
        <div className="h-12">
          <motion.p
            key={showTip}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="text-gray-400"
          >
            {tips[showTip]}
          </motion.p>
        </div>
      </div>
      
      <div className="flex flex-col space-y-4 mt-8">
        {showStartButton && (
          <motion.button 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={onStart}
          >
            Start Game
          </motion.button>
        )}
        
        {showSkipButton && onSkip && (
          <motion.button 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ duration: 0.5 }}
            className="px-6 py-2 bg-gray-700 text-white text-sm rounded-md hover:bg-gray-600"
            onClick={onSkip}
          >
            Skip Loading
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
