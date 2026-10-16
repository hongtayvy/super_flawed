import { useState } from 'react';
import { motion } from 'framer-motion';
import BlackCard from '../cards/BlackCard';
import WhiteCard from '../cards/WhiteCard';
import Button from '../ui/Button';
import { useGame } from '../../contexts/GameContext';
import { useToast } from '../../hooks/useToast';
import type { RoomState } from '../../types/game';

const WILDCARD_EXAMPLES = ['You can sneeze lightning.', 'You can talk to sandwiches.', 'You can pause any song forever.'];

const GameBoard = ({ state }: { state: RoomState }) => {
  const { pickWinner, pickTarget, playAgain, setWildcard } = useGame();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [wildcardText, setWildcardText] = useState('');

  const round = state.round!;
  const me = state.players.find((p) => p.id === state.you);
  const isJudge = round.judgeId === state.you;
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? '?';
  const submitters = state.players.filter((p) => p.id !== round.judgeId && !round.skippedIds.includes(p.id));

  const act = async (run: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return;
    setBusy(true);
    const res = await run();
    setBusy(false);
    if (!res.ok) toast({ title: res.error || 'That did not work.', variant: 'destructive' });
  };

  const powerCard = <BlackCard text={round.power.text} isWildcard={round.power.kind === 'wildcard'} />;

  const twistBanner = round.twist && (
    <div className="max-w-md w-full bg-sun border-[3px] border-ink rounded-2xl shadow-pop-sm px-4 py-3 text-center">
      <span className="text-[11px] font-black uppercase tracking-[0.15em]">🌀 Plot Twist</span>
      <div className="display text-2xl">{round.twist.name}</div>
      <p className="text-sm font-bold">{round.twist.description}</p>
    </div>
  );

  const wildcardNote = round.power.kind === 'wildcard' && state.phase !== 'wildcard' && (
    <p className="max-w-md text-center text-sm font-bold text-muted">
      {nameOf(round.judgeId)} made up this power. Play the flaw that ruins it.
    </p>
  );

  const renderContent = () => {
    switch (state.phase) {
      case 'wildcard':
        return (
          <>
            {powerCard}
            {isJudge ? (
              <form
                className="w-full max-w-md space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    const res = await setWildcard(wildcardText);
                    if (res.ok) setWildcardText('');
                    return res;
                  });
                }}
              >
                <p className="text-2xl font-black text-center">Wildcard! Make up a superpower.</p>
                <input
                  className="field"
                  value={wildcardText}
                  maxLength={100}
                  onChange={(e) => setWildcardText(e.target.value)}
                  placeholder={WILDCARD_EXAMPLES[round.number % WILDCARD_EXAMPLES.length]}
                  aria-label="Your made-up superpower"
                  autoFocus
                />
                <Button type="submit" className="w-full" disabled={busy || wildcardText.trim().length < 3}>
                  Set the power ⚡
                </Button>
              </form>
            ) : (
              <p className="text-2xl font-black text-center">
                {nameOf(round.judgeId)} is inventing a power...
              </p>
            )}
          </>
        );

      case 'submitting': {
        const iSubmitted = round.submittedIds.includes(state.you);
        const iWasSkipped = round.skippedIds.includes(state.you);
        return (
          <>
            {powerCard}
            {wildcardNote}
            <div className="text-center font-black text-xl">
              {isJudge ? (
                <p>You're the judge! Waiting for flaws... ({round.submittedIds.length}/{submitters.length})</p>
              ) : iWasSkipped ? (
                <p>You were skipped this round. See you next one!</p>
              ) : iSubmitted ? (
                <p>Flaw locked in! Waiting for the others... ({round.submittedIds.length}/{submitters.length})</p>
              ) : (
                <p>Pick the flaw from your hand that ruins this power best.</p>
              )}
              {round.skippedIds.length > 0 && (
                <p className="text-sm text-muted mt-1">
                  Skipped (disconnected or out of time): {round.skippedIds.map(nameOf).join(', ')}
                </p>
              )}
            </div>
          </>
        );
      }

      case 'judging':
        return (
          <>
            {powerCard}
            <p className="text-2xl font-black text-center max-w-xl">
              {isJudge
                ? (round.twist?.judgingPrompt ?? 'Which flaw ruins it best?')
                : 'The judge is deciding who ruined it best...'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-4xl">
              {round.entries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => isJudge && act(() => pickWinner(entry.id))}
                  className={`relative ${isJudge ? 'cursor-pointer' : ''}`}
                >
                  <WhiteCard text={entry.text} isSelectable={isJudge} isSelected={entry.mine} />
                  {entry.mine && (
                    <span className="absolute -top-2 -right-2 bg-cobalt text-white text-[10px] font-black uppercase px-2 py-1 rounded-full border-2 border-ink">
                      Yours
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </>
        );

      case 'target':
        return (
          <>
            {powerCard}
            {twistBanner}
            {isJudge && round.target ? (
              <div className="text-center">
                <p className="text-2xl font-black mb-4">{round.target.prompt}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {round.target.eligibleIds.map((id) => (
                    <Button key={id} variant="secondary" disabled={busy} onClick={() => act(() => pickTarget(id))}>
                      {nameOf(id)}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-2xl font-black text-center">The judge is resolving the Plot Twist...</p>
            )}
          </>
        );

      case 'roundEnd': {
        const result = round.result;
        return (
          <>
            {powerCard}
            <div className="text-center">
              <h3 className="display text-4xl mb-3">
                {result?.winnerId ? `Power ruined by ${nameOf(result.winnerId)}!` : 'No winner this round'}
              </h3>
              {result?.winnerText && (
                <div className="inline-block mb-3">
                  <WhiteCard text={result.winnerText} isWinner />
                </div>
              )}
              {result?.note && <p className="text-lg font-black">{result.note}</p>}
              <p className="text-lg font-black text-muted mt-2">Next superpower incoming...</p>
            </div>
          </>
        );
      }

      case 'gameOver': {
        const winner = state.players.find((p) => p.id === state.gameWinnerId);
        return (
          <div className="text-center">
            <h3 className="display text-5xl mb-2">{winner ? `${winner.name} wins!` : 'Game over'}</h3>
            <p className="text-lg font-black mb-4">
              {winner?.id === state.you ? 'You ruined every hero. Legendary.' : 'Great power. Terrible friends.'}
            </p>
            {me?.isHost ? (
              <Button size="lg" onClick={playAgain}>
                Play again ↗
              </Button>
            ) : (
              <p className="font-bold text-muted">Waiting for the host to start another game.</p>
            )}
          </div>
        );
      }

      default:
        return <div>Loading game...</div>;
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center gap-5 p-4">
      {state.phase !== 'target' && state.phase !== 'gameOver' && twistBanner}
      {renderContent()}
    </div>
  );
};

export default GameBoard;
