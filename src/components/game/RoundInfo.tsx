import { useCountdown } from '../../hooks/useCountdown';
import type { RoomState } from '../../types/game';

const PHASE_LABELS: Record<string, string> = {
  twist: 'Plot Twist',
  wildcard: 'Wildcard',
  choosing: 'Judge picks',
  submitting: 'Flaw phase',
  voting: 'Group vote',
  judging: 'Judging',
  target: 'Twist effect',
  roundEnd: 'Round over',
  gameOver: 'Game over',
};

const RoundInfo = ({ state }: { state: RoomState }) => {
  const round = state.round!;
  const isJudge = round.judgeId === state.you;
  const judge = state.players.find((p) => p.id === round.judgeId);
  const secondsLeft = useCountdown(state.phase === 'submitting' || state.phase === 'wildcard' ? round.deadline : null);

  const label = 'text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted leading-none';
  const value = 'display text-base sm:text-2xl truncate leading-tight';

  // Sticky so the clock stays in view while players scroll through their hand.
  // On a phone everything stays on one line, so the judge's name and phase may truncate.
  return (
    <div className="sticky top-1 z-30 bg-white border-[3px] border-ink shadow-pop-sm px-2.5 py-2 sm:p-3 rounded-2xl flex flex-nowrap justify-between items-center gap-2 sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
        <div className="shrink-0">
          <span className={label}>Round</span>
          <div className={value}>
            {round.number}
            {round.passes > 1 && (
              <span className="text-xs sm:text-base text-muted"> · {round.pass}/{round.passes}</span>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <span className={label}>Judge</span>
          <div className={`${value} ${isJudge ? 'text-cobalt' : ''}`}>{isJudge ? 'You' : (judge?.name ?? '?')}</div>
        </div>
        <div className="min-w-0">
          <span className={label}>Phase</span>
          <div className={value}>{PHASE_LABELS[state.phase] ?? '...'}</div>
        </div>
      </div>
      {secondsLeft !== null && (
        <div
          className={`display shrink-0 text-xl sm:text-3xl px-3 sm:px-4 py-0.5 sm:py-1 rounded-full border-[3px] border-ink ${
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
