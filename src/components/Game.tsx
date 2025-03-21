
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import LoadingScreen from './LoadingScreen';
import { GameScene } from '@/utils/three/scene';
import gameAudio from '@/utils/three/audio';
import { toast } from 'sonner';

interface GameState {
  isLoading: boolean;
  loadingProgress: number;
  playerHealth: number;
  playerMaxHealth: number;
  enemyHealth: number;
  enemyMaxHealth: number;
  gameOver: boolean;
  victory: boolean;
  isStarted: boolean;
  hasError: boolean;
  debugMode: boolean;
}

const Game: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameSceneRef = useRef<GameScene | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    isLoading: true,
    loadingProgress: 0,
    playerHealth: 100,
    playerMaxHealth: 100,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    gameOver: false,
    victory: false,
    isStarted: false,
    hasError: false,
    debugMode: true // Start with debug mode on
  });
  
  const initializeGame = async () => {
    if (containerRef.current) {
      console.log("Initializing game scene...");
      
      const onLoadProgress = (progress: number) => {
        console.log(`Loading progress: ${progress * 100}%`);
        setGameState(prev => ({ ...prev, loadingProgress: progress }));
      };
      
      const onLoadComplete = () => {
        console.log("Loading complete!");
        setTimeout(() => {
          setGameState(prev => ({ ...prev, isLoading: false }));
        }, 1000);
      };
      
      try {
        const gameScene = new GameScene(
          containerRef.current,
          onLoadProgress,
          onLoadComplete
        );
        
        await gameScene.initialize();
        gameSceneRef.current = gameScene;
        
        // Force enable debug view to fix visibility issues
        setTimeout(() => {
          if (gameSceneRef.current) {
            gameSceneRef.current.enableDebugView();
            console.log("Debug view enabled in game initialization");
          }
        }, 1000);
        
        console.log("Game scene initialized");
      } catch (error) {
        console.error("Failed to initialize game:", error);
        setGameState(prev => ({ 
          ...prev, 
          hasError: true, 
          isLoading: false 
        }));
        toast.error("Game initialization failed. Try refreshing the page.");
      }
    }
  };
  
  useEffect(() => {
    initializeGame();
    
    return () => {
      if (gameSceneRef.current) {
        gameSceneRef.current.cleanup();
      }
    };
  }, []);
  
  useEffect(() => {
    if (gameSceneRef.current && !gameState.isLoading && gameState.isStarted) {
      const updateInterval = setInterval(() => {
        try {
          const player = gameSceneRef.current?.getPlayer();
          const combatSystem = gameSceneRef.current?.getCombatSystem();
          
          if (player && combatSystem) {
            const playerHealth = player.getHealth();
            const playerMaxHealth = player.getMaxHealth();
            
            const enemies = combatSystem.getEnemies();
            const enemy = enemies[0];
            const enemyHealth = enemy ? enemy.getHealth() : 0;
            const enemyMaxHealth = enemy ? enemy.getMaxHealth() : 100;
            
            const playerDefeated = playerHealth <= 0;
            const enemyDefeated = enemies.length > 0 && enemies.every(e => !e.isAlive());
            
            setGameState(prev => ({
              ...prev,
              playerHealth,
              playerMaxHealth,
              enemyHealth,
              enemyMaxHealth,
              gameOver: playerDefeated,
              victory: enemyDefeated
            }));
            
            if (playerDefeated || enemyDefeated) {
              clearInterval(updateInterval);
              gameSceneRef.current?.unlockControls();
              gameSceneRef.current?.stopBackgroundMusic();
            }
          }
        } catch (error) {
          console.error("Error updating game state:", error);
        }
      }, 100);
      
      return () => clearInterval(updateInterval);
    }
  }, [gameState.isLoading, gameState.isStarted]);
  
  const handleRestart = () => {
    window.location.reload();
  };
  
  const handleUserInteraction = () => {
    console.log("User interaction detected, resuming audio");
    try {
      gameAudio.resumeAudio();
      
      if (gameSceneRef.current) {
        gameSceneRef.current.startBackgroundMusic();
        
        // Lock controls to enable interaction
        gameSceneRef.current.lockControls();
        
        // Explicitly enable debug view to make scene visible
        if (gameState.debugMode) {
          gameSceneRef.current.enableDebugView();
          console.log("Debug view enabled after user interaction");
        }
      }
    } catch (error) {
      console.error("Error handling user interaction:", error);
    }
  };
  
  const handleGameStart = () => {
    setGameState(prev => ({
      ...prev,
      isStarted: true
    }));
    
    // Small delay to ensure the scene is ready
    setTimeout(() => {
      if (gameSceneRef.current) {
        try {
          // Try to initialize audio on user interaction
          gameAudio.resumeAudio();
          gameSceneRef.current.startBackgroundMusic();
          
          // Enable debug view to make scene visible
          gameSceneRef.current.enableDebugView();
          console.log("Debug view enabled after game start");
          
          // Lock controls to start the game
          gameSceneRef.current.lockControls();
        } catch (error) {
          console.error("Error starting game:", error);
        }
      }
    }, 500);
  };
  
  const toggleDebugMode = () => {
    setGameState(prev => ({ ...prev, debugMode: !prev.debugMode }));
    
    if (gameSceneRef.current) {
      if (!gameState.debugMode) {
        gameSceneRef.current.enableDebugView();
        console.log("Debug view enabled");
      } else {
        gameSceneRef.current.disableDebugView();
        console.log("Debug view disabled");
      }
    }
  };
  
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {(gameState.isLoading || !gameState.isStarted) && (
        <LoadingScreen 
          progress={gameState.loadingProgress} 
          isLoaded={!gameState.isLoading}
          onStart={handleGameStart}
        />
      )}
      
      <div 
        ref={containerRef} 
        className="w-full h-full" 
        onClick={handleUserInteraction}
        style={{ display: gameState.isStarted ? 'block' : 'none' }}
      />
      
      {!gameState.isLoading && gameState.isStarted && !gameState.gameOver && !gameState.victory && (
        <motion.div 
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 4, duration: 1 }}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center text-white bg-black/70 p-4 rounded-lg"
        >
          <p className="text-lg">Click to lock mouse controls</p>
          <p className="text-sm mt-2">WASD to move, Mouse to look</p>
          <p className="text-sm">Left-click to attack, Right-click to block</p>
          <p className="text-sm mt-2">Click anywhere to start audio</p>
        </motion.div>
      )}
      
      {gameState.isStarted && (
        <div className="fixed top-6 left-0 w-full px-6 flex justify-between items-center pointer-events-none">
          <div className="player-health w-2/5">
            <div className="text-sm text-blue-500 font-medium mb-1">Player</div>
            <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${(gameState.playerHealth / gameState.playerMaxHealth) * 100}%` }}
              />
            </div>
          </div>
          
          <div className="enemy-health w-2/5">
            <div className="text-sm text-red-500 font-medium mb-1 text-right">Enemy</div>
            <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${(gameState.enemyHealth / gameState.enemyMaxHealth) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Debug toggle button */}
      <button 
        onClick={toggleDebugMode}
        className="fixed bottom-6 right-6 bg-gray-800 text-white px-4 py-2 rounded-md z-50"
      >
        {gameState.debugMode ? "Disable Debug" : "Enable Debug"}
      </button>
      
      {gameState.hasError && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/80"
        >
          <div className="text-center p-8 bg-gray-900/80 rounded-lg">
            <h2 className="text-3xl font-bold text-red-500 mb-4">Game Error</h2>
            <p className="text-gray-300 mb-6">There was a problem loading the game assets.</p>
            <button 
              onClick={handleRestart} 
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </motion.div>
      )}
      
      {gameState.gameOver && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/80"
        >
          <div className="text-center p-8 bg-gray-900/80 rounded-lg">
            <h2 className="text-4xl font-bold text-red-500 mb-4">Defeated</h2>
            <p className="text-gray-300 mb-6">You have been defeated by the enemy.</p>
            <button 
              onClick={handleRestart} 
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </motion.div>
      )}
      
      {gameState.victory && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/80"
        >
          <div className="text-center p-8 bg-gray-900/80 rounded-lg">
            <h2 className="text-4xl font-bold text-blue-500 mb-4">Victory!</h2>
            <p className="text-gray-300 mb-6">You have defeated the enemy!</p>
            <button 
              onClick={handleRestart} 
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Play Again
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Game;
