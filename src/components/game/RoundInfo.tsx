import React from 'react';
import { Trophy } from 'lucide-react';

interface RoundInfoProps {
  round: number;
  cardCzar: string;
  gameState: string;
  onShowScoreboard: () => void;
}

const RoundInfo = ({ round, cardCzar, gameState, onShowScoreboard }: RoundInfoProps) => {
  const getStateLabel = () => {
    switch (gameState) {
      case 'selecting': return 'Card Selection';
      case 'judging': return 'Judging';
      case 'roundEnd': return 'Round Complete';
      default: return 'Loading...';
    }
  };

  return (
    <div className="bg-gray-800 p-3 rounded-lg mb-3 flex flex-wrap justify-between items-center">
      <div className="flex items-center space-x-6">
        <div>
          <span className="text-gray-400 text-sm">Round</span>
          <div className="text-xl font-bold">{round}</div>
        </div>
        
        <div>
          <span className="text-gray-400 text-sm">Card Czar</span>
          <div className="text-xl font-bold">{cardCzar}</div>
        </div>
        
        <div>
          <span className="text-gray-400 text-sm">Phase</span>
          <div className="text-xl font-bold">{getStateLabel()}</div>
        </div>
      </div>
      
      <button
        onClick={onShowScoreboard}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
      >
        <Trophy size={18} className="text-yellow-400" />
        <span>Scoreboard</span>
      </button>
    </div>
  );
};

export default RoundInfo;