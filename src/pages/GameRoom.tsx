import { useNavigate, useParams } from 'react-router-dom';
import GameBoard from '../components/game/GameBoard';
import PlayerHand from '../components/game/PlayerHand';
import ScoreBoard from '../components/game/ScoreBoard';
import RoundInfo from '../components/game/RoundInfo';
import { useGame } from '../contexts/GameContext';
import { useRoomSession } from '../hooks/useRoomSession';

const GameRoom = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const code = (gameId || '').toUpperCase();
  const navigate = useNavigate();
  const { leaveRoom, connected } = useGame();
  const state = useRoomSession(code, 'game');

  if (!state || !state.round) {
    return <div className="p-8 text-center font-black uppercase tracking-wide">Loading the chaos...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-2 md:p-4 min-h-[calc(100vh-72px)] flex flex-col">
      {!connected && (
        <div className="mb-3 rounded-2xl border-[3px] border-ink bg-coral px-4 py-2 text-sm font-black text-center">
          Connection lost. Reconnecting, your seat is saved...
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-grow">
        <div className="lg:col-span-3 flex flex-col gap-3">
          <RoundInfo state={state} />
          <div className="flex-grow">
            <GameBoard state={state} />
          </div>
          {/* The judge doesn't hold flaws, so there is no hand to show. */}
          {state.round.judgeId !== state.you && (
            <div className="min-h-[260px]">
              <PlayerHand state={state} />
            </div>
          )}
        </div>

        <div className="lg:col-span-1 bg-white border-[3px] border-ink rounded-3xl shadow-pop overflow-hidden flex flex-col self-start">
          <ScoreBoard state={state} />
          <div className="p-4">
            <button
              onClick={() => {
                leaveRoom();
                navigate('/');
              }}
              className="w-full bg-coral border-[3px] border-ink rounded-full py-2 text-sm font-black uppercase shadow-pop-sm hover:-translate-y-0.5 transition-transform"
            >
              Leave Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameRoom;
