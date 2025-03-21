import React, { useEffect, useRef, useState, useCallback } from 'react';
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
    debugMode: true, // Start with debug mode on
  });
  
  const initializationAttempts = useRef(0);
  const maxInitAttempts = 3;
  
  const initializeGame = async () => {
    // Reset states at start
    setGameState(prev => ({ 
      ...prev, 
      isLoading: true,
      loadingProgress: 0 
    }));
    
    console.log("Initialize game called");

    if (containerRef.current) {
      console.log("Initializing game scene...");
      
      const onLoadProgress = (progress: number) => {
        console.log(`Loading progress: ${progress * 100}%`);
        setGameState(prev => ({ ...prev, loadingProgress: progress }));
      };
      
      const onLoadComplete = () => {
        console.log("Loading complete callback triggered!");
        // Add a small timeout to ensure UI updates properly
        setTimeout(() => {
          setGameState(prev => ({ ...prev, isLoading: false }));
        }, 1000);
      };
      
      try {
        // Remove any previous game scene
        if (gameSceneRef.current) {
          gameSceneRef.current.cleanup();
          gameSceneRef.current = null;
        }
        
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
        gameSceneRef.current = null;
      }
    };
  }, []);
  
  useEffect(() => {
    const forceRenderTimeout = setTimeout(() => {
      if (gameState.isLoading) {
        console.log("Force rendering game after timeout");
        setGameState(prev => ({ ...prev, isLoading: false }));
      }
    }, 15000); // 15 second max loading time
    
    return () => clearTimeout(forceRenderTimeout);
  }, []);
  
  const handleGameStart = useCallback(() => {
    console.log("Game start triggered");
    setGameState(prev => ({
      ...prev,
      isStarted: true
    }));
    
    // Try to initialize audio on user interaction
    try {
      gameAudio.resumeAudio();
      
      if (gameSceneRef.current) {
        console.log("Starting game elements...");
        gameSceneRef.current.startBackgroundMusic();
        gameSceneRef.current.lockControls();
      } else {
        console.error("Game scene not available at start");
        toast.error("Game scene not fully initialized. Try refreshing the page.");
      }
    } catch (error) {
      console.error("Error starting game:", error);
      toast.error("Error starting game. You may experience issues with audio or controls.");
    }
  }, []);
  
  const handleRetryLoading = useCallback(() => {
    console.log("Manually retrying game initialization");
    initializationAttempts.current += 1;
    
    if (initializationAttempts.current <= maxInitAttempts) {
      setGameState(prev => ({
        ...prev, 
        isLoading: true,
        loadingProgress: 0.1,
        hasError: false
      }));
      initializeGame();
    } else {
      toast.error("Maximum retry attempts reached. Please refresh the page.");
    }
  }, []);
  
  const handleRestart = () => {
    window.location.reload();
  };
  
  const toggleDebugMode = () => {
    setGameState(prev => ({
      ...prev,
      debugMode: !prev.debugMode
    }));
    
    if (gameSceneRef.current) {
      if (gameState.debugMode) {
        gameSceneRef.current.disableDebugView();
      } else {
        gameSceneRef.current.enableDebugView();
      }
    }
  };
  
  return (
    <div className="relative w-full h-full">
      {gameState.hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90 z-50">
          <div className="text-center space-y-6 p-8 bg-gray-900 rounded-lg max-w-md">
            <h2 className="text-3xl font-bold text-red-500">Initialization Error</h2>
            <p className="text-white">There was a problem loading the game.</p>
            <div className="flex space-x-4">
              <button 
                onClick={handleRetryLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
              >
                Retry
              </button>
              <button 
                onClick={handleRestart}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      )}
      
      {gameState.isLoading && (
        <LoadingScreen 
          progress={gameState.loadingProgress} 
          isLoaded={gameState.loadingProgress >= 0.95}
          onStart={() => {
            console.log("Start game from loading screen");
            setGameState(prev => ({ ...prev, isLoading: false }));
            handleGameStart();
          }}
          onSkip={() => {
            console.log("Skipping loading screen");
            setGameState(prev => ({ ...prev, isLoading: false }));
          }}
        />
      )}
      
      {gameState.isStarted && (
        <div className="absolute top-4 left-0 right-0 flex justify-center items-center mx-auto z-10 pointer-events-none">
          <div className="flex items-center justify-between w-4/5 max-w-3xl bg-gray-900/70 p-3 rounded-lg">
            <div className="player-health w-2/5">
              <div className="text-sm text-blue-500 font-medium mb-1">Player</div>
              <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(gameState.playerHealth / gameState.playerMaxHealth) * 100}%` }}
                />
              </div>
            </div>
            
            <div className="vs-text text-white font-bold">VS</div>
            
            <div className="enemy-health w-2/5">
              <div className="text-sm text-red-500 font-medium mb-1 text-right">Enemy</div>
              <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${(gameState.enemyHealth / gameState.enemyMaxHealth) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!gameState.isStarted && !gameState.isLoading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/80 z-30"
        >
          <div className="text-center p-8 bg-gray-900/80 rounded-lg">
            <h1 className="text-4xl font-bold text-blue-500 mb-6">Lightsaber Duel</h1>
            <p className="text-gray-300 mb-8">Prepare for battle!</p>
            <button 
              onClick={handleGameStart} 
              className="px-8 py-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Start Game
            </button>
          </div>
        </motion.div>
      )}
      
      {/* Debug toggle button */}
      <button 
        onClick={toggleDebugMode}
        className="fixed bottom-6 right-6 bg-gray-800 text-white px-4 py-2 rounded-md z-50"
      >
        {gameState.debugMode ? "Disable Debug" : "Enable Debug"}
      </button>
      
      {/* Game over and victory screens */}
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
