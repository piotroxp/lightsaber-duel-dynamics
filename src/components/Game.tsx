import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import LoadingScreen from './LoadingScreen';
import { GameScene } from '@/utils/three/scene';
import gameAudio from '@/utils/three/audio';
import { toast } from 'sonner';
import { NetworkManager } from '@/utils/network/NetworkManager';
import MultiplayerLobby from './MultiplayerLobby';

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
  // Multiplayer states
  isMultiplayer: boolean;
  showMultiplayerLobby: boolean;
  networkError: string | null;
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
    isMultiplayer: false,
    showMultiplayerLobby: false,
    networkError: null
  });
  
  const initializeGame = async (multiplayer: boolean = false) => {
    if (containerRef.current) {
      console.log(`Initializing ${multiplayer ? 'multiplayer' : 'single-player'} game scene...`);
      
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
        
        if (multiplayer) {
          // Initialize multiplayer
          gameScene.initializeMultiplayer();
          setGameState(prev => ({
            ...prev,
            isMultiplayer: true,
            showMultiplayerLobby: true
          }));
        }
        
        // Set up event listeners for network events
        setupNetworkEventListeners();
        
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
  
  const setupNetworkEventListeners = () => {
    // Player damage event
    window.addEventListener('playerDamage', ((event: CustomEvent) => {
      const { health } = event.detail;
      setGameState(prev => ({
        ...prev,
        playerHealth: health
      }));
    }) as EventListener);
    
    // Player defeated event
    window.addEventListener('playerDefeated', (() => {
      setGameState(prev => ({
        ...prev,
        gameOver: true
      }));
    }) as EventListener);
    
    // Player victory event
    window.addEventListener('playerVictory', (() => {
      setGameState(prev => ({
        ...prev,
        victory: true
      }));
    }) as EventListener);
    
    // Host disconnected event
    window.addEventListener('hostDisconnected', (() => {
      toast.error("Host disconnected from the game");
      handleReturnToMenu();
    }) as EventListener);
    
    // Network error event
    window.addEventListener('networkError', ((event: CustomEvent) => {
      const { message } = event.detail;
      toast.error(`Network error: ${message}`);
      setGameState(prev => ({
        ...prev,
        networkError: message
      }));
    }) as EventListener);
    
    // Hide multiplayer UI
    window.addEventListener('hideMultiplayerUI', (() => {
      setGameState(prev => ({
        ...prev,
        showMultiplayerLobby: false,
        isStarted: true
      }));
    }) as EventListener);
  };
  
  useEffect(() => {
    return () => {
      // Clean up event listeners
      window.removeEventListener('playerDamage', (() => {}) as EventListener);
      window.removeEventListener('playerDefeated', (() => {}) as EventListener);
      window.removeEventListener('playerVictory', (() => {}) as EventListener);
      window.removeEventListener('hostDisconnected', (() => {}) as EventListener);
      window.removeEventListener('networkError', (() => {}) as EventListener);
      window.removeEventListener('hideMultiplayerUI', (() => {}) as EventListener);
    };
  }, []);
  
  const startSinglePlayerGame = () => {
    initializeGame(false);
  };
  
  const startMultiplayerGame = () => {
    initializeGame(true);
  };
  
  const handleStartMultiplayerGame = () => {
    if (gameSceneRef.current) {
      gameSceneRef.current.startMultiplayerGame();
      setGameState(prev => ({
        ...prev,
        showMultiplayerLobby: false,
        isStarted: true
      }));
    }
  };
  
  const handleCancelMultiplayer = () => {
    // Clean up network connections
    const networkManager = NetworkManager.getInstance();
    networkManager.disconnect();
    
    // Return to start screen
    handleReturnToMenu();
  };
  
  const handleReturnToMenu = () => {
    // Clean up the current game scene
    if (gameSceneRef.current) {
      gameSceneRef.current.cleanup();
      gameSceneRef.current = null;
    }
    
    // Reset game state
    setGameState({
      isLoading: false,
      loadingProgress: 0,
      playerHealth: 100,
      playerMaxHealth: 100,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      gameOver: false,
      victory: false,
      isStarted: false,
      hasError: false,
      debugMode: true,
      isMultiplayer: false,
      showMultiplayerLobby: false,
      networkError: null
    });
  };
  
  const handleRestart = () => {
    // Clean up the current game scene
    if (gameSceneRef.current) {
      gameSceneRef.current.cleanup();
      gameSceneRef.current = null;
    }
    
    // Reset game state and reinitialize
    setGameState(prev => ({
      ...prev,
      isLoading: true,
      loadingProgress: 0,
      playerHealth: 100,
      enemyHealth: 100,
      gameOver: false,
      victory: false
    }));
    
    // Re-initialize the game (either as single or multiplayer)
    initializeGame(gameState.isMultiplayer);
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
  
  // Check if game is in a lobby/UI state (not actively playing)
  const isInMenuState = !gameState.isStarted && !gameState.isLoading;
  
  // Render start screen with game mode options
  const renderStartScreen = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/80"
    >
      <div className="text-center p-8 bg-gray-900/80 rounded-lg">
        <h1 className="text-5xl font-bold text-blue-500 mb-6">Lightsaber Duel</h1>
        <p className="text-gray-300 mb-8">Choose your game mode:</p>
        
        <div className="flex flex-col space-y-4">
          <button 
            onClick={startSinglePlayerGame} 
            className="px-8 py-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Single Player
          </button>
          
          <button 
            onClick={startMultiplayerGame} 
            className="px-8 py-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Multiplayer
          </button>
        </div>
      </div>
    </motion.div>
  );
  
  return (
    <div className="w-full h-screen overflow-hidden">
      {gameState.isLoading ? (
        <LoadingScreen progress={gameState.loadingProgress} />
      ) : (
        <div className="w-full h-full relative" ref={containerRef}>
          {/* Game UI overlay */}
          {gameState.isStarted && (
            <div className="absolute top-4 left-0 right-0 flex justify-center items-center mx-auto z-10 pointer-events-none">
              <div className="flex items-center justify-between w-4/5 max-w-3xl bg-gray-900/70 p-3 rounded-lg">
                <div className="player-health w-2/5">
                  <div className="text-sm text-saber-blue font-medium mb-1">Player</div>
                  <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(gameState.playerHealth / gameState.playerMaxHealth) * 100}%` }}
                    />
                  </div>
                </div>
                
                <div className="vs-text text-white font-bold">VS</div>
                
                <div className="enemy-health w-2/5">
                  <div className="text-sm text-saber-red font-medium mb-1 text-right">Enemy</div>
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
          
          {/* Start screen */}
          {isInMenuState && renderStartScreen()}
          
          {/* Multiplayer lobby */}
          {gameState.showMultiplayerLobby && (
            <MultiplayerLobby
              onStartGame={handleStartMultiplayerGame}
              onCancelMultiplayer={handleCancelMultiplayer}
            />
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
                <div className="flex gap-4 justify-center">
                  <button 
                    onClick={handleRestart} 
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                  <button 
                    onClick={handleReturnToMenu} 
                    className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Main Menu
                  </button>
                </div>
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
                <div className="flex gap-4 justify-center">
                  <button 
                    onClick={handleRestart} 
                    className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Play Again
                  </button>
                  <button 
                    onClick={handleReturnToMenu} 
                    className="px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Main Menu
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default Game;
