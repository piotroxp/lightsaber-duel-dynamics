
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LoadingScreenProps {
  progress: number;
  isLoaded: boolean;
}

const LoadingScreen = ({ progress, isLoaded }: LoadingScreenProps) => {
  const [showTip, setShowTip] = useState(0);
  
  const tips = [
    "Move with WASD, look around with your mouse",
    "Left-click to attack with your lightsaber",
    "Right-click to block incoming attacks",
    "Dodge enemy attacks by moving sideways",
    "Watch your health bar and strike when the enemy is vulnerable"
  ];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setShowTip(prev => (prev + 1) % tips.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`loading-screen ${isLoaded ? 'loaded' : ''}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <div className="w-40 h-40 relative mb-8">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-20 lightsaber-hilt rounded-b-md"></div>
          <div className={`lightsaber-blade h-0 ${isLoaded ? 'h-96 animate-saber-ignite' : ''}`}>
            <div className="lightsaber-blade-inner h-96 blade-blue"></div>
            <div className="lightsaber-blade-glow h-96 blade-blue-glow"></div>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold mb-6 text-center">
          Lightsaber Duel Dynamics
        </h1>
        
        <div className="w-64 h-2 bg-secondary rounded-full mb-8 overflow-hidden">
          <motion.div 
            className="h-full bg-saber-blue"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        
        <motion.div
          key={showTip}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="text-muted-foreground text-center max-w-xs"
        >
          {tips[showTip]}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
