import { X, Trophy, Crown } from 'lucide-react';
import { PlayerType } from '../../types/game';
import { motion, AnimatePresence } from 'framer-motion';

interface ScoreBoardProps {
  players: PlayerType[];
  cardCzarId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ScoreBoard = ({ players, cardCzarId, isOpen, onClose }: ScoreBoardProps) => {
  // Sort players by score in descending order
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  if (!isOpen) {
    return (
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-medium mb-2">Scoreboard</h3>
        <div className="space-y-2">
          {sortedPlayers.slice(0, 3).map((player, index) => (
            <div key={player.id} className="flex items-center justify-between">
              <div className="flex items-center">
                {index === 0 && <Trophy size={16} className="mr-1 text-yellow-400" />}
                <span>{player.name}</span>
                {player.id === cardCzarId && (
                  <Crown size={14} className="ml-1 text-purple-400" />
                )}
              </div>
              <span className="font-bold">{player.score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-10 bg-gray-900 bg-opacity-90 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-gray-800 rounded-lg p-6 w-full max-w-md"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center">
              <Trophy size={24} className="mr-2 text-yellow-400" />
              Scoreboard
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
              aria-label="Close scoreboard"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="space-y-4">
            {sortedPlayers.map((player, index) => (
              <div 
                key={player.id}
                className={`flex items-center p-3 rounded-lg ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-900 to-yellow-800 border border-yellow-700' : 
                  index === 1 ? 'bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600' : 
                  index === 2 ? 'bg-gradient-to-r from-amber-900 to-amber-800 border border-amber-700' : 
                  'bg-gray-700'
                }`}
              >
                <div className="w-8 text-center font-bold">
                  {index + 1}
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold mx-3 ${
                  getAvatarColor(player.avatar)
                }`}>
                  {player.name.charAt(0)}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center">
                    <span className="font-medium">{player.name}</span>
                    {player.isHost && (
                      <Crown size={14} className="ml-1 text-yellow-400" />
                    )}
                    {player.id === cardCzarId && (
                      <span className="ml-2 text-xs bg-purple-700 px-1.5 py-0.5 rounded text-white">
                        Card Czar
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-2xl font-bold">
                  {player.score}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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

export default ScoreBoard;