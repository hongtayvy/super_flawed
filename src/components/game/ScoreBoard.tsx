import { Trophy, Crown } from 'lucide-react';
import { getAvatarColor } from '../../utils/avatar';
import type { RoomState } from '../../types/game';

const ScoreBoard = ({ state }: { state: RoomState }) => {
  const judgeId = state.round?.judgeId;
  const sorted = [...state.players].sort((a, b) => b.score - a.score);

  return (
    <div className="p-4 border-b-[3px] border-ink">
      <h3 className="display text-2xl mb-1 flex items-center gap-2">
        <Trophy size={20} className="text-ink fill-sun" />
        Scoreboard
      </h3>
      <p className="text-[10px] font-black uppercase tracking-wide text-muted mb-3">
        First to {state.rules.winScore} wins
      </p>
      <div className="space-y-2">
        {sorted.map((player, index) => (
          <div
            key={player.id}
            className={`flex items-center gap-2 p-2 rounded-xl border-2 ${
              index === 0 && player.score > 0 ? 'bg-sun border-ink' : 'bg-ice border-line'
            } ${player.connected ? '' : 'opacity-60'}`}
          >
            <div
              className={`w-8 h-8 shrink-0 rounded-full border-2 border-ink flex items-center justify-center text-sm font-black ${getAvatarColor(player.avatar)}`}
            >
              {player.name.charAt(0)}
            </div>
            <div className="flex-grow min-w-0 flex items-center gap-1">
              <span className="font-black truncate">{player.name}</span>
              {player.id === judgeId && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase bg-cobalt text-white px-2 py-0.5 rounded-full">
                  <Crown size={10} /> Judge
                </span>
              )}
              {player.id === state.you && <span className="text-[10px] font-black text-cobalt">YOU</span>}
            </div>
            <span className="display text-2xl">{player.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScoreBoard;
