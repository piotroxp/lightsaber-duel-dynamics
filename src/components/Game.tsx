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
      
      const gameScene = new GameScene(
        containerRef.current,
        onLoadProgress,
        onLoadComplete
      );
      
      try {
        await gameScene.initialize();
        gameSceneRef.current = gameScene;
        console.log("Game scene initialized");
      } catch (error) {
        console.error("Failed to initialize game:", error);
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
    if (gameSceneRef.current && !gameState.isLoading) {
      const updateInterval = setInterval(() => {
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
      }, 100);
      
      return () => clearInterval(updateInterval);
    }
  }, [gameState.isLoading]);
  
  const handleRestart = () => {
    window.location.reload();
  };
  
  const handleUserInteraction = () => {
    console.log("User interaction detected, resuming audio");
    gameAudio.resumeAudio();
    
    if (gameSceneRef.current) {
      gameSceneRef.current.startBackgroundMusic();
      gameSceneRef.current.lockControls();
    }
  };
  
  return (
    <div className="relative w-full h-screen overflow-hidden">
      <LoadingScreen 
        progress={gameState.loadingProgress} 
        isLoaded={!gameState.isLoading} 
      />
      
      <div 
        ref={containerRef} 
        className="w-full h-full" 
        onClick={handleUserInteraction}
      />
      
      {!gameState.isLoading && (
        <div className="game-ui">
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
          
          <div className="fixed top-6 left-0 w-full px-6 flex justify-between items-center pointer-events-none">
            <div className="player-health w-2/5">
              <div className="text-sm text-saber-blue font-medium mb-1">Player</div>
              <div className="health-bar">
                <div 
                  className="health-bar-fill" 
                  style={{ width: `${(gameState.playerHealth / gameState.playerMaxHealth) * 100}%` }}
                />
              </div>
            </div>
            
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
