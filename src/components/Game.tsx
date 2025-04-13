import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import LoadingScreen from './LoadingScreen';
import { GameScene } from '@/utils/three/scene';
import gameAudio from '@/utils/three/audio';
import { toast } from 'sonner';
import StanceSelector from './StanceSelector';

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
  sceneReady: boolean;
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
    sceneReady: false
  });
  
  const initializationAttempts = useRef(0);
  const maxInitAttempts = 3;
  
  const initializeGame = useCallback(async () => {
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
        // No delay needed if scene init handles it
        setGameState(prev => ({ 
          ...prev, 
          isLoading: false, 
          loadingProgress: 1,
          sceneReady: true // Mark scene as ready
        }));
      };
      
      // Clean up previous scene if exists
      if (gameSceneRef.current) {
        gameSceneRef.current.dispose();
      }
      
      // Create new scene instance
      gameSceneRef.current = new GameScene(
        containerRef.current,
        onLoadProgress,
        onLoadComplete
      );
      
      // Initialize the scene
      try {
        await gameSceneRef.current.initialize();
        // Pass initial debug state
        gameSceneRef.current.setDebugMode(gameState.debugMode); 
        console.log("Game scene initialized successfully");
      } catch (error) {
        console.error("Error initializing game:", error);
        setGameState(prev => ({ 
          ...prev, 
          hasError: true, 
          isLoading: false 
        }));
        toast.error("Game initialization failed. Try refreshing the page.");
      }
    }
  }, []);
  
  useEffect(() => {
    initializeGame();
    
    return () => {
      if (gameSceneRef.current) {
        gameSceneRef.current.cleanup();
        gameSceneRef.current = null;
      }
    };
  }, [initializeGame]);
  
  useEffect(() => {
    const forceRenderTimeout = setTimeout(() => {
      if (gameState.isLoading) {
        console.log("Force rendering game after timeout");
        setGameState(prev => ({ ...prev, isLoading: false }));
      }
    }, 15000); // 15 second max loading time
    
    return () => clearTimeout(forceRenderTimeout);
  }, []);
  
  const startGameWithScene = useCallback((gameScene: GameScene) => {
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
        
        // Delay lock controls to ensure everything is initialized
        setTimeout(() => {
          if (gameSceneRef.current) {
            gameSceneRef.current.lockControls();
          }
        }, 500);
      } else {
        console.error("Game scene not available at start");
        toast.error("Game scene not fully initialized. Try refreshing the page.");
        
        // Attempt to recover by re-initializing
        setTimeout(() => {
          if (handleRetryLoading) {
            handleRetryLoading();
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Error starting game:", error);
      toast.error("Error starting game. You may experience issues with audio or controls.");
    }
  }, []);
  
  const handleGameStart = useCallback(() => {
    console.log("Game start triggered");
    
    if (!gameSceneRef.current) {
      console.error("Game scene is not initialized, attempting to reinitialize...");
      // Try to reinitialize the scene
      initializeGame().then(() => {
        // After initialization, retry starting the game if successful
        if (gameSceneRef.current) {
          console.log("Reinitialization successful, starting game...");
          startGameWithScene(gameSceneRef.current);
        } else {
          console.error("Failed to reinitialize game scene");
          toast.error("Failed to start game. Please refresh the page.");
        }
      });
      return;
    }
    
    // If we have a valid game scene, start the game
    startGameWithScene(gameSceneRef.current);
  }, [initializeGame, startGameWithScene]);
  
  const handleRetryLoading = useCallback(() => {
    console.log("Manually retrying game initialization");
    initializationAttempts.current += 1;
    
    if (initializationAttempts.current <= maxInitAttempts) {
      setGameState(prev => ({
        ...prev, 
        isLoading: true,
        loadingProgress: 0.1,
        hasError: false,
        sceneReady: false
      }));
      initializeGame();
    } else {
      toast.error("Maximum retry attempts reached. Please refresh the page.");
    }
  }, [initializeGame]);
  
  const handleRestart = () => {
    window.location.reload();
  };
  
  const toggleDebugMode = () => {
    setGameState(prev => {
      const newDebugMode = !prev.debugMode;
      // Update debug mode in the scene
      gameSceneRef.current?.setDebugMode(newDebugMode); 
      console.log(`Debug mode toggled: ${newDebugMode}`);
      return { ...prev, debugMode: newDebugMode };
    });
  };
  
  useEffect(() => {
    if (gameSceneRef.current && gameSceneRef.current.isInitialized) {
      console.log("Debugging game scene from Game component");
      gameSceneRef.current.debug();
    }
  }, [gameState.isStarted]);
  
  // Add this component for the scoreboard
  const Scoreboard = ({ playerScore, enemyScore }) => {
    return (
      <div className="fixed bottom-4 left-32 transform -translate-x-1/2 bg-black/70 text-white px-6 py-2 rounded-lg flex items-center gap-8 font-mono text-xl">
        <div className="flex flex-col items-center">
          <span className="text-blue-400">PLAYER</span>
          <span className="text-2xl font-bold">{playerScore}</span>
        </div>
        <div className="text-gray-400 text-2xl">VS</div>
        <div className="flex flex-col items-center">
          <span className="text-red-400">ENEMY</span>
          <span className="text-2xl font-bold">{enemyScore}</span>
        </div>
      </div>
    );
  };

  // Add state for scores in your Game component
  const [playerScore, setPlayerScore] = useState(0);
  const [enemyScore, setEnemyScore] = useState(0);

  // Add event listeners for score changes
  useEffect(() => {
    const handlePlayerScoreChange = (event) => {
      setPlayerScore(event.detail.score);
    };
    
    const handleEnemyScoreChange = (event) => {
      setEnemyScore(event.detail.score);
    };
    
    document.addEventListener('playerScoreChanged', handlePlayerScoreChange);
    document.addEventListener('enemyScoreChanged', handleEnemyScoreChange);
    
    return () => {
      document.removeEventListener('playerScoreChanged', handlePlayerScoreChange);
      document.removeEventListener('enemyScoreChanged', handleEnemyScoreChange);
    };
  }, []);

  // Add state for stance
  const [currentStance, setCurrentStance] = useState(1);
  const [stances, setStances] = useState([
    { id: 1, name: "Form I:", description: "Balanced, fundamental form" },
    { id: 2, name: "Form II:", description: "Precision dueling form" },
    { id: 3, name: "Form III:", description: "Ultimate defensive form" },
    { id: 4, name: "Form IV:", description: "Acrobatic, aggressive form" },
    { id: 5, name: "Form V:", description: "Power counterattacks" },
    { id: 6, name: "Form VI:", description: "Balanced form with Force techniques" },
    { id: 7, name: "Form VII:", description: "Ferocious, unpredictable form" }
  ]);

  // Add listener for stance changes from player
  useEffect(() => {
    const handleStanceChange = (event) => {
      setCurrentStance(event.detail.stance.id);
    };
    
    document.addEventListener('stanceChanged', handleStanceChange);
    
    return () => {
      document.removeEventListener('stanceChanged', handleStanceChange);
    };
  }, []);

  // Add handler for stance selection from UI
  const handleSelectStance = useCallback((stanceId: number) => {
    console.log(`Attempting to select stance: ${stanceId}`);
    
    if (!gameSceneRef.current) {
      console.error("No game scene available");
      return;
    }
    
    // Direct access to player instance from our scene reference
    const player = gameSceneRef.current.player;
    if (player) {
      console.log("Player found, setting stance to:", stanceId);
      // Call the setStance method with the right context
      player.setStance(stanceId);
      
      // Also update local state for UI
      setCurrentStance(stanceId);
    } else {
      console.error("Player not found in gameScene");
    }
  }, [gameSceneRef]);

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
            if (gameSceneRef.current) {
              setGameState(prev => ({ ...prev, isLoading: false }));
              startGameWithScene(gameSceneRef.current);
            } else {
              console.error("Cannot start game: scene not initialized");
              toast.error("Game not fully loaded. Please wait or refresh the page.");
            }
          }}
          onSkip={() => {
            console.log("Skipping loading screen");
            setGameState(prev => ({ ...prev, isLoading: false }));
          }}
        />
      )}
      
      <div 
        ref={containerRef} 
        className="absolute inset-0 w-full h-full"
      />
      
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
            <h1 className="text-4xl font-bold text-blue-500 mb-6">Plasmablade Duel</h1>
            <p className="text-gray-300 mb-8">Prepare for battle!</p>
            <button 
              onClick={handleGameStart} 
              className="px-8 py-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              disabled={!gameState.sceneReady}
            >
              {gameState.sceneReady ? "Start Game" : "Loading Scene..."}
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
      
      {/* Game info overlay */}
      <div className="fixed top-6 right-6 bg-gray-800/80 text-white px-4 py-2 rounded-md z-40 text-sm">
        Scene: {gameState.sceneReady ? "Ready" : "Loading"}
      </div>
      
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
      
      {/* Scoreboard */}
      {gameState.isStarted && <Scoreboard playerScore={playerScore} enemyScore={enemyScore} />}
      
      {/* Stance Selector */}
      {gameState.isStarted && !gameState.victory && !gameState.gameOver && (
        <StanceSelector 
          stances={stances}
          currentStance={currentStance}
          onSelectStance={handleSelectStance}
        />
      )}
    </div>
  );
};

export default Game;
