import BlackCard from '../cards/BlackCard';
import WhiteCard from '../cards/WhiteCard';
import { useGame } from '../../contexts/GameContext';
import { motion, AnimatePresence } from 'framer-motion';

const GameBoard = () => {
  const { gameState, currentRound, selectWinningSubmission } = useGame();
  const { blackCard, submissions, isCardCzar, winner } = currentRound;

  const renderGameStateContent = () => {
    switch (gameState) {
      case 'selecting':
        return (
          <div className="flex flex-col items-center">
            <BlackCard text={blackCard.text} />
            <div className="mt-8 text-center text-gray-300">
              {isCardCzar ? (
                <p className="text-xl">You are the Card Czar this round! Wait for others to submit their cards.</p>
              ) : (
                <p className="text-xl">Select a white card from your hand to submit.</p>
              )}
            </div>
          </div>
        );
        
      case 'judging':
        return (
          <div className="flex flex-col items-center">
            <BlackCard text={blackCard.text} />
            <div className="mt-8">
              {isCardCzar ? (
                <p className="text-xl text-center mb-6">Select your favorite card!</p>
              ) : (
                <p className="text-xl text-center mb-6">The Card Czar is selecting the winner...</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <AnimatePresence>
                  {submissions.map((submission, index) => (
                    <motion.div
                      key={submission.playerId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => isCardCzar && selectWinningSubmission(submission.playerId)}
                      className={`${isCardCzar ? 'cursor-pointer transform hover:scale-105 transition-transform' : ''}`}
                    >
                      <WhiteCard 
                        text={submission.card.text}
                        isSelectable={isCardCzar}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        );
        
      case 'roundEnd':
        const winningPlayer = winner ? winner.playerName : 'Unknown';
        const winningCard = winner ? winner.card.text : '';
        
        return (
          <div className="flex flex-col items-center">
            <BlackCard text={blackCard.text} />
            <div className="mt-8 text-center">
              <h3 className="text-2xl font-bold mb-4">Round Winner: {winningPlayer}!</h3>
              <div className="inline-block mb-4">
                <WhiteCard 
                  text={winningCard}
                  isWinner={true}
                />
              </div>
              <p className="text-xl text-gray-300">Next round starting soon...</p>
            </div>
          </div>
        );
        
      default:
        return <div>Loading game...</div>;
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-4">
      {renderGameStateContent()}
    </div>
  );
};

export default GameBoard;