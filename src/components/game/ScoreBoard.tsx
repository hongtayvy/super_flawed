import { X, Trophy, Crown } from 'lucide-react';
import { PlayerType } from '../../types/game';
import { getAvatarColor } from '../../utils/avatar';
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
      <div className="p-4 border-b-[3px] border-ink">
        <h3 className="display text-2xl mb-2">Scoreboard</h3>
        <div className="space-y-2">
          {sortedPlayers.slice(0, 3).map((player, index) => (
            <div key={player.id} className="flex items-center justify-between">
              <div className="flex items-center">
                {index === 0 && <Trophy size={16} className="mr-1 text-ink fill-sun" />}
                <span>{player.name}</span>
                {player.id === cardCzarId && (
                  <Crown size={14} className="ml-1 text-cobalt" />
                )}
              </div>
              <span className="font-black">{player.score} ★</span>
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
        className="absolute inset-0 z-10 bg-ink/70 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white border-4 border-ink rounded-3xl shadow-[8px_9px_0_#FFE56A] p-6 w-full max-w-md"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="display text-3xl flex items-center">
              <Trophy size={24} className="mr-2 text-ink fill-sun" />
              Scoreboard
            </h2>
            <button
              onClick={onClose}
              className="text-ink hover:text-coral"
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
                  index === 0 ? 'bg-sun border-2 border-ink shadow-pop-sm' : 
                  index === 1 ? 'bg-lilac border-2 border-ink' : 
                  index === 2 ? 'bg-mint border-2 border-ink' : 
                  'bg-ice border-2 border-line'
                }`}
              >
                <div className="w-8 text-center font-bold">
                  {index + 1}
                </div>
                <div className={`w-10 h-10 rounded-full border-2 border-ink flex items-center justify-center text-lg font-black mx-3 ${
                  getAvatarColor(player.avatar)
                }`}>
                  {player.name.charAt(0)}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center">
                    <span className="font-black">{player.name}</span>
                    {player.isHost && (
                      <Crown size={14} className="ml-1 text-ink fill-sun" />
                    )}
                    {player.id === cardCzarId && (
                      <span className="ml-2 text-[10px] font-black uppercase bg-cobalt px-2 py-0.5 rounded-full text-white">
                        Judge
                      </span>
                    )}
                  </div>
                </div>
                <div className="display text-3xl">
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

export default ScoreBoard;