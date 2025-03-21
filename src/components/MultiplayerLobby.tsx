import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NetworkManager } from '@/utils/network/NetworkManager';

interface Props {
  onStartGame: () => void;
  onCancelMultiplayer: () => void;
}

const MultiplayerLobby: React.FC<Props> = ({ onStartGame, onCancelMultiplayer }) => {
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [players, setPlayers] = useState<string[]>([]);
  const [canStart, setCanStart] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const networkManager = NetworkManager.getInstance();
    setIsHost(networkManager.isGameHost());
    
    // Set up event listeners
    const handleJoinLink = (event: CustomEvent) => {
      setJoinUrl(event.detail.url);
    };
    
    const handleEnableStart = () => {
      setCanStart(true);
    };
    
    const handlePlayerJoined = (event: CustomEvent) => {
      setPlayers((prev) => [...new Set([...prev, event.detail.playerId])]);
    };
    
    // Add event listeners
    window.addEventListener('showJoinLink', handleJoinLink as EventListener);
    window.addEventListener('enableStartButton', handleEnableStart as EventListener);
    window.addEventListener('playerJoined', handlePlayerJoined as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('showJoinLink', handleJoinLink as EventListener);
      window.removeEventListener('enableStartButton', handleEnableStart as EventListener);
      window.removeEventListener('playerJoined', handlePlayerJoined as EventListener);
    };
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(joinUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
      });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 flex items-center justify-center bg-black/80 z-50"
    >
      <div className="bg-gray-900 p-8 rounded-lg max-w-md w-full">
        <h2 className="text-3xl font-bold text-blue-500 mb-6 text-center">
          {isHost ? 'Multiplayer Lobby' : 'Joining Game'}
        </h2>
        
        {isHost ? (
          <>
            <div className="mb-6">
              <p className="text-white mb-2">Share this link with a friend:</p>
              <div className="flex items-center">
                <input
                  type="text"
                  value={joinUrl}
                  readOnly
                  className="bg-gray-800 text-white py-2 px-3 rounded-l flex-1 outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-r"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-white mb-2">Players ({players.length + 1}):</p>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-green-400 mb-1">You (Host)</div>
                {players.map(player => (
                  <div key={player} className="text-blue-400">
                    Player {player.substring(0, 5)}...
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={onCancelMultiplayer}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded"
              >
                Cancel
              </button>
              
              <button
                onClick={onStartGame}
                disabled={!canStart}
                className={`flex-1 py-3 px-6 rounded text-white ${
                  canStart 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-600 cursor-not-allowed'
                }`}
              >
                {canStart ? 'Start Game' : 'Waiting...'}
              </button>
            </div>
            
            {!canStart && (
              <p className="text-yellow-400 text-sm mt-3 text-center">
                Waiting for players to join...
              </p>
            )}
          </>
        ) : (
          <>
            <div className="mb-6 text-center">
              <p className="text-white mb-2">Connecting to game...</p>
              <div className="bg-gray-800 p-3 rounded">
                <div className="animate-pulse w-16 h-16 mx-auto">
                  <div className="w-full h-full border-4 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              </div>
            </div>
            
            <button
              onClick={onCancelMultiplayer}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default MultiplayerLobby; 