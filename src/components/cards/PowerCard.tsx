import { motion } from 'framer-motion';

interface PowerCardProps {
  text: string;
  isWildcard?: boolean;
}

// The "power" card: the awesome ability everyone is about to ruin.
const PowerCard = ({ text, isWildcard = false }: PowerCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
      animate={{ opacity: 1, scale: 1, rotate: -4 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className={`w-64 h-80 ${isWildcard ? 'bg-lilac text-ink' : 'bg-cobalt text-white'} rounded-2xl border-4 border-ink shadow-pop-xl p-6 flex flex-col relative overflow-hidden`}
    >
      <span className="text-[11px] font-black uppercase tracking-[0.15em]">{isWildcard ? '★ Wildcard' : '⚡ The Superpower'}</span>
      <div className="flex-grow flex items-center justify-center">
        <p className="text-2xl font-black leading-tight text-center tracking-tight">{text}</p>
      </div>
      <div className="text-[10px] font-black uppercase tracking-wider">
        Super Flawed · The Good Part
      </div>
    </motion.div>
  );
};

export default PowerCard;
