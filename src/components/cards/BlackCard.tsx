import { motion } from 'framer-motion';

interface BlackCardProps {
  text: string;
}

const BlackCard = ({ text }: BlackCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="w-64 h-80 bg-black text-white rounded-xl p-6 shadow-lg flex flex-col relative overflow-hidden"
    >
      <div className="absolute top-3 left-3 text-xl font-bold text-gray-600">CAO</div>
      <div className="flex-grow flex items-center justify-center">
        <p className="text-xl font-medium text-center">{text}</p>
      </div>
      <div className="absolute bottom-3 right-3 text-sm font-light text-gray-600">
        Super Flawed
      </div>
    </motion.div>
  );
};

export default BlackCard;