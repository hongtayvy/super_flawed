import WhiteCard from '../cards/WhiteCard';
import Button from '../ui/Button';
import { CardType } from '../../types/game';
import { motion } from 'framer-motion';

interface PlayerHandProps {
  hand: CardType[];
  selectedCardIndex: number | null;
  isCardCzar: boolean;
  gameState: string;
  onSelectCard: (index: number) => void;
  onSubmitCard: () => void;
}

const PlayerHand = ({ 
  hand, 
  selectedCardIndex, 
  isCardCzar, 
  gameState,
  onSelectCard, 
  onSubmitCard 
}: PlayerHandProps) => {
  if (isCardCzar) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 bg-gray-800 rounded-lg">
        <p className="text-xl text-center text-gray-300">
          You are the Card Czar this round!
        </p>
      </div>
    );
  }

  const isSelectingPhase = gameState === 'selecting';
  const canSubmit = selectedCardIndex !== null && isSelectingPhase;

  return (
    <div className="h-full flex flex-col p-4 bg-gray-800 rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium">Your Hand</h3>
        {isSelectingPhase && (
          <Button
            onClick={onSubmitCard}
            disabled={!canSubmit}
            className={`px-4 py-1 text-sm ${canSubmit ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-700 cursor-not-allowed'}`}
          >
            Submit Card
          </Button>
        )}
      </div>
      
      <div className="flex-grow overflow-x-auto overflow-y-hidden">
        <div className="flex space-x-4 h-full py-2 px-1">
          {hand.map((card, index) => (
            <motion.div
              key={index}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
              className={`flex-shrink-0 ${
                isSelectingPhase ? 'cursor-pointer' : 'cursor-default'
              } ${selectedCardIndex === index ? 'transform -translate-y-4' : ''}`}
              style={{ width: '180px', height: '100%' }}
              onClick={() => isSelectingPhase && onSelectCard(index)}
            >
              <WhiteCard 
                text={card.text} 
                isSelected={selectedCardIndex === index}
                isSelectable={isSelectingPhase}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlayerHand;