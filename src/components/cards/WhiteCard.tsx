import { motion } from 'framer-motion';

interface WhiteCardProps {
  text: string;
  isSelected?: boolean;
  isSelectable?: boolean;
  isWinner?: boolean;
}

const WhiteCard = ({ 
  text, 
  isSelected = false,
  isSelectable = false,
  isWinner = false
}: WhiteCardProps) => {
  return (
    <motion.div
      whileHover={isSelectable ? { scale: 1.05 } : {}}
      animate={isWinner ? { 
        scale: [1, 1.05, 1],
        boxShadow: ['0px 0px 0px rgba(129, 140, 248, 0)', '0px 0px 20px rgba(129, 140, 248, 0.7)', '0px 0px 10px rgba(129, 140, 248, 0.3)'],
      } : {}}
      transition={{ duration: 0.5, repeat: isWinner ? Infinity : 0, repeatType: 'reverse' }}
      className={`w-full h-full bg-white text-black rounded-xl p-6 shadow-lg flex flex-col relative ${
        isSelected ? 'ring-4 ring-indigo-500' : ''
      } ${isSelectable ? 'cursor-pointer' : ''}`}
      style={{ minWidth: '160px', minHeight: '200px' }}
    >
      <div className="absolute top-3 left-3 text-xl font-bold text-gray-300">CAO</div>
      <div className="flex-grow flex items-center justify-center">
        <p className="text-lg font-medium text-center">{text}</p>
      </div>
      <div className="absolute bottom-3 right-3 text-sm font-light text-gray-300">
        Super Flawed
      </div>
    </motion.div>
  );
};

export default WhiteCard;