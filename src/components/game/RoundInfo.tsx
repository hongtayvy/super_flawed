import { useCountdown } from '../../hooks/useCountdown';
import type { RoomState } from '../../types/game';

const PHASE_LABELS: Record<string, string> = {
  submitting: 'Writing phase',
  judging: 'Judging',
  target: 'Plot Twist',
  roundEnd: 'Round complete',
  gameOver: 'Game over',
};

const RoundInfo = ({ state }: { state: RoomState }) => {
  const round = state.round!;
  const judge = state.players.find((p) => p.id === round.judgeId);
  const secondsLeft = useCountdown(state.phase === 'submitting' ? round.deadline : null);

  return (
    <div className="bg-white border-[3px] border-ink shadow-pop-sm p-3 rounded-2xl flex flex-wrap justify-between items-center gap-3">
      <div className="flex items-center gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Round</span>
          <div className="display text-2xl">{round.number}</div>
        </div>
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Judge</span>
          <div className="display text-2xl">{judge?.name ?? '?'}</div>
        </div>
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted">Phase</span>
          <div className="display text-2xl">{PHASE_LABELS[state.phase] ?? '...'}</div>
        </div>
      </div>
      {secondsLeft !== null && (
        <div
          className={`display text-3xl px-4 py-1 rounded-full border-[3px] border-ink ${
            secondsLeft <= 10 ? 'bg-coral' : 'bg-sun'
          }`}
          aria-label="Time left to submit"
        >
          {secondsLeft}s
        </div>
      )}
    </div>
  );
};

export default RoundInfo;
