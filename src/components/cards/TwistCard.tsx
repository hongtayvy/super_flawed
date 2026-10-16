import { motion } from 'framer-motion';

interface TwistCardProps {
  name: string;
  description: string;
  large?: boolean;
}

// A Plot Twist is its own card: drawn and shown before the round's power card.
const TwistCard = ({ name, description, large = false }: TwistCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
      animate={{ opacity: 1, scale: 1, rotate: 4 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className={`${large ? 'w-72 h-96' : 'w-56 h-80'} bg-coral text-ink rounded-2xl border-4 border-ink shadow-pop-xl p-5 flex flex-col`}
    >
      <span className="text-[11px] font-black uppercase tracking-[0.15em]">🌀 Plot Twist</span>
      <div className="flex-grow flex flex-col items-center justify-center text-center gap-3">
        <p className={`display ${large ? 'text-4xl' : 'text-3xl'}`}>{name}</p>
        <p className="text-base font-bold leading-snug">{description}</p>
      </div>
      <div className="text-[10px] font-black uppercase tracking-wider">Super Flawed · The Catch</div>
    </motion.div>
  );
};

export default TwistCard;
