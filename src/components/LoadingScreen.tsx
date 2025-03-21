
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LoadingScreenProps {
  progress: number;
  isLoaded: boolean;
  onStart: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  progress, 
  isLoaded, 
  onStart 
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
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-900 z-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="mb-8 relative flex flex-col items-center">
          {/* Lightsaber hilt */}
          <div className="w-6 h-20 bg-gray-300 rounded-b-md mb-2"></div>
          
          {/* Lightsaber blade */}
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: progress * 300 }}
            className="w-4 relative"
            style={{ height: `${progress * 300}px` }}
          >
            <div className="absolute inset-0 bg-blue-500 rounded-t-md"></div>
            <div className="absolute inset-0 bg-blue-300 rounded-t-md blur-md opacity-70"></div>
          </motion.div>
        </div>
        
        <h1 className="text-3xl font-bold mb-6 text-white">
          Lightsaber Duel
        </h1>
        
        <div className="w-64 h-2 bg-gray-700 rounded-full mb-8 overflow-hidden">
          <motion.div 
            className="h-full bg-blue-500"
            initial={{ width: "0%" }}
            animate={{ width: `${Math.max(5, progress * 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        
        <motion.div
          key={showTip}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="text-gray-400 text-center max-w-xs mb-8"
        >
          {tips[showTip]}
        </motion.div>
        
        {showStartButton && (
          <motion.button 
            className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            onClick={onStart}
          >
            Start Game
          </motion.button>
        )}
        
        {!showStartButton && (
          <div className="text-blue-300">Loading... {Math.round(progress * 100)}%</div>
        )}
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
