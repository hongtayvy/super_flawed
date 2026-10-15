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
      case 'selecting': return 'Writing phase';
      case 'judging': return 'Judging';
      case 'roundEnd': return 'Round Complete';
      default: return 'Loading...';
    }
  };

  return (
    <div className="bg-white border-[3px] border-ink shadow-pop-sm p-3 rounded-2xl mb-3 flex flex-wrap justify-between items-center">
      <div className="flex items-center space-x-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Round</span>
          <div className="display text-2xl">{round}</div>
        </div>
        
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Judge</span>
          <div className="display text-2xl">{cardCzar}</div>
        </div>
        
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Phase</span>
          <div className="display text-2xl">{getStateLabel()}</div>
        </div>
      </div>
      
      <button
        onClick={onShowScoreboard}
        className="flex items-center gap-2 px-4 py-2 bg-sun border-2 border-ink rounded-full shadow-pop-sm text-xs font-black uppercase hover:-translate-y-0.5 transition-transform"
      >
        <Trophy size={18} className="text-ink" />
        <span>Scoreboard</span>
      </button>
    </div>
  );
};

export default RoundInfo;