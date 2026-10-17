import { motion } from 'framer-motion';

interface FlawCardProps {
  text: string;
  isSelected?: boolean;
  isSelectable?: boolean;
  isWinner?: boolean;
}

// The "flaw" card: the catch that ruins the power.
const FlawCard = ({
  text,
  isSelected = false,
  isSelectable = false,
  isWinner = false,
}: FlawCardProps) => {
  return (
    <motion.div
      whileHover={isSelectable ? { scale: 1.05, y: -4 } : {}}
      animate={isWinner ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.5, repeat: isWinner ? Infinity : 0, repeatType: 'reverse' }}
      className={`w-full h-full rounded-2xl border-[3px] border-ink p-5 flex flex-col relative ${
        isSelected || isWinner ? 'bg-sun shadow-pop-lg' : 'bg-white shadow-pop-sm'
      } ${isSelectable ? 'cursor-pointer' : ''}`}
      style={{ minWidth: '160px', minHeight: '200px' }}
    >
      <span className="text-[11px] font-black uppercase tracking-[0.15em]">✳ The Flaw</span>
      <div className="flex-grow flex items-center justify-center">
        <p className="text-lg font-black leading-snug text-center tracking-tight">{text}</p>
      </div>
      <div className="text-[10px] font-black uppercase tracking-wider text-muted">
        Super Flawed
      </div>
    </motion.div>
  );
};

export default FlawCard;
