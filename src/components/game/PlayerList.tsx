import React from 'react';
import { Crown, Check } from 'lucide-react';
import { useGame } from '../../contexts/GameContext';
import { motion } from 'framer-motion';

const PlayerList = () => {
  const { players } = useGame();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {players.map((player, index) => (
        <motion.div
          key={player.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`bg-gray-800 p-3 rounded-lg flex items-center gap-3 border ${
            player.isReady ? 'border-green-600' : 'border-gray-700'
          }`}
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
            getAvatarColor(player.avatar)
          }`}>
            {player.name.charAt(0)}
          </div>
          <div className="flex-grow">
            <div className="flex items-center">
              <span className="font-medium">{player.name}</span>
              {player.isHost && (
                <Crown size={16} className="ml-1 text-yellow-400" />
              )}
            </div>
            <div className="text-xs text-gray-400">
              {player.isReady ? (
                <div className="flex items-center text-green-400">
                  <Check size={14} className="mr-1" />
                  Ready
                </div>
              ) : (
                'Not ready'
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// Helper function to get a color based on avatar ID
const getAvatarColor = (avatarId: string) => {
  const colors = [
    'bg-purple-700 text-white',
    'bg-indigo-700 text-white',
    'bg-blue-700 text-white',
    'bg-green-700 text-white',
    'bg-yellow-600 text-white',
    'bg-orange-700 text-white',
    'bg-red-700 text-white',
    'bg-pink-700 text-white',
  ];
  
  const index = parseInt(avatarId) % colors.length;
  return colors[index || 0];
};

export default PlayerList;