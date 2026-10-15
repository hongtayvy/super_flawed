import { Crown, Check } from 'lucide-react';
import { useGame } from '../../contexts/GameContext';
import { getAvatarColor } from '../../utils/avatar';
import { motion } from 'framer-motion';

const PlayerList = () => {
  const { players } = useGame();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {players.map((player, index) => (
        <motion.div
          key={player.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`p-3 rounded-2xl flex items-center gap-3 border-2 border-ink ${
            player.isReady ? 'bg-mint' : 'bg-white'
          }`}
        >
          <div className={`w-11 h-11 shrink-0 rounded-full border-2 border-ink flex items-center justify-center text-xl font-black ${
            getAvatarColor(player.avatar)
          }`}>
            {player.name.charAt(0)}
          </div>
          <div className="flex-grow">
            <div className="flex items-center">
              <span className="font-black">{player.name}</span>
              {player.isHost && (
                <Crown size={16} className="ml-1 text-ink fill-sun" />
              )}
            </div>
            <div className="text-[10px] font-black uppercase tracking-wide text-muted">
              {player.isReady ? (
                <div className="flex items-center text-ink">
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

export default PlayerList;