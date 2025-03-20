
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import LoadingScreen from './LoadingScreen';
import { GameScene } from '@/utils/three/scene';
import gameAudio from '@/utils/three/audio';

interface GameState {
  isLoading: boolean;
  loadingProgress: number;
  playerHealth: number;
  playerMaxHealth: number;
  enemyHealth: number;
  enemyMaxHealth: number;
  gameOver: boolean;
  victory: boolean;
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
  });
  
  const initializeGame = async () => {
    if (containerRef.current) {
      const onLoadProgress = (progress: number) => {
        setGameState(prev => ({ ...prev, loadingProgress: progress }));
      };
      
      const onLoadComplete = () => {
        setTimeout(() => {
          setGameState(prev => ({ ...prev, isLoading: false }));
          // Don't start music until user interaction
          // gameSceneRef.current?.startBackgroundMusic();
        }, 1000);
      };
      
      const gameScene = new GameScene(
        containerRef.current,
        onLoadProgress,
        onLoadComplete
      );
      
      await gameScene.initialize();
      gameSceneRef.current = gameScene;
    }
  };
  
  // Start the game on mount
  useEffect(() => {
    initializeGame();
    
    return () => {
      // Cleanup
      if (gameSceneRef.current) {
        gameSceneRef.current.cleanup();
      }
    };
  }, []);
  
  // Update health and game state
  useEffect(() => {
    if (gameSceneRef.current && !gameState.isLoading) {
      const updateInterval = setInterval(() => {
        const player = gameSceneRef.current?.getPlayer();
        const combatSystem = gameSceneRef.current?.getCombatSystem();
        
        if (player && combatSystem) {
          // Get player health
          const playerHealth = player.getHealth();
          const playerMaxHealth = player.getMaxHealth();
          
          // Get enemy health (first enemy for simplicity)
          const enemies = combatSystem.getEnemies();
          const enemy = enemies[0];
          const enemyHealth = enemy ? enemy.getHealth() : 0;
          const enemyMaxHealth = enemy ? enemy.getMaxHealth() : 100;
          
          // Check game state
          const playerDefeated = playerHealth <= 0;
          const enemyDefeated = enemies.length > 0 && enemies.every(e => !e.isAlive());
          
          // Update state
          setGameState(prev => ({
            ...prev,
            playerHealth,
            playerMaxHealth,
            enemyHealth,
            enemyMaxHealth,
            gameOver: playerDefeated,
            victory: enemyDefeated
          }));
          
          // Handle game over
          if (playerDefeated || enemyDefeated) {
            clearInterval(updateInterval);
            gameSceneRef.current?.unlockControls();
            
            // Slow background music volume
            // gameSceneRef.current?.stopBackgroundMusic();
          }
        }
      }, 100);
      
      return () => clearInterval(updateInterval);
    }
  }, [gameState.isLoading]);
  
  // Handle restart
  const handleRestart = () => {
    window.location.reload();
  };
  
  // Handle user interaction to resume audio context
  const handleUserInteraction = () => {
    // Resume the audio context to fix browser autoplay policy issues
    gameAudio.resumeAudio();
    
    // Start background music after user interaction
    if (gameSceneRef.current) {
      gameSceneRef.current.startBackgroundMusic();
      gameSceneRef.current.lockControls();
    }
  };
  
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Loading screen */}
      <LoadingScreen 
        progress={gameState.loadingProgress} 
        isLoaded={!gameState.isLoading} 
      />
      
      {/* Game container */}
      <div 
        ref={containerRef} 
        className="w-full h-full" 
        onClick={handleUserInteraction}
      />
      
      {/* Game UI */}
      {!gameState.isLoading && (
        <div className="game-ui">
          {/* Instructions overlay - shown briefly */}
          {!gameState.gameOver && !gameState.victory && (
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
          
          {/* Health bars */}
          <div className="fixed top-6 left-0 w-full px-6 flex justify-between items-center pointer-events-none">
            {/* Player health */}
            <div className="player-health w-2/5">
              <div className="text-sm text-saber-blue font-medium mb-1">Player</div>
              <div className="health-bar">
                <div 
                  className="health-bar-fill" 
                  style={{ width: `${(gameState.playerHealth / gameState.playerMaxHealth) * 100}%` }}
                />
              </div>
            </div>
            
            {/* Enemy health */}
            <div className="enemy-health w-2/5">
              <div className="text-sm text-saber-red font-medium mb-1 text-right">Enemy</div>
              <div className="health-bar">
                <div 
                  className="health-bar-fill"
                  style={{ width: `${(gameState.enemyHealth / gameState.enemyMaxHealth) * 100}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Game over screen */}
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
                  className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/80 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </motion.div>
          )}
          
          {/* Victory screen */}
          {gameState.victory && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-black/80"
            >
              <div className="text-center p-8 bg-gray-900/80 rounded-lg">
                <h2 className="text-4xl font-bold text-saber-blue mb-4">Victory!</h2>
                <p className="text-gray-300 mb-6">You have defeated the enemy!</p>
                <button 
                  onClick={handleRestart} 
                  className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/80 transition-colors"
                >
                  Play Again
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default Game;
