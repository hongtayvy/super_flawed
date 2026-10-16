import { useState } from 'react';
import { motion } from 'framer-motion';
import BlackCard from '../cards/BlackCard';
import WhiteCard from '../cards/WhiteCard';
import TwistCard from '../cards/TwistCard';
import Button from '../ui/Button';
import { useGame } from '../../contexts/GameContext';
import { useToast } from '../../hooks/useToast';
import type { EntryView, RoomState } from '../../types/game';

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
  const namesOf = (ids: string[]) => ids.map(nameOf).join(' & ');
  const judgePlays = Boolean(round.twist?.judgeSubmits);
  const submitters = state.players.filter(
    (p) => (p.id !== round.judgeId || judgePlays) && !round.skippedIds.includes(p.id),
  );

  const act = async (run: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return;
    setBusy(true);
    const res = await run();
    setBusy(false);
    if (!res.ok) toast({ title: res.error || 'That did not work.', variant: 'destructive' });
  };

  // The twist (if any) sits beside the power as a separate card; it is never printed on it.
  const cards = (
    <div className="flex flex-wrap items-center justify-center gap-8">
      {round.twist && <TwistCard name={round.twist.name} description={round.twist.description} />}
      {round.power && <BlackCard text={round.power.text} isWildcard={round.power.kind === 'wildcard'} />}
      {round.power2 && <BlackCard text={round.power2.text} isWildcard={false} />}
    </div>
  );

  const passBadge = round.passes > 1 && (
    <span className="pill bg-lilac">
      🔁 Pass {round.pass} of {round.passes}
    </span>
  );

  const wildcardNote = round.power?.kind === 'wildcard' && state.phase !== 'wildcard' && (
    <p className="max-w-md text-center text-sm font-bold text-muted">
      {nameOf(round.judgeId)} made up this power. Play the flaw that ruins it.
    </p>
  );

  // One flaw card, with its backstory, author line and "yours" badge.
  const entryCard = (entry: EntryView, onClick?: () => void) => (
    <motion.div
      key={entry.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`relative ${onClick ? 'cursor-pointer' : ''}`}
    >
      <WhiteCard text={entry.text} isSelectable={Boolean(onClick)} isSelected={entry.mine} />
      {entry.note && (
        <p className="mt-2 rounded-xl border-2 border-ink bg-lilac px-3 py-2 text-sm font-bold">
          📖 {entry.note}
        </p>
      )}
      {entry.authorNames && (
        <p className="mt-1 text-center text-xs font-black uppercase tracking-wide text-muted">
          by {entry.authorNames.join(' & ')}
        </p>
      )}
      {entry.mine && (
        <span className="absolute -top-2 -right-2 bg-cobalt text-white text-[10px] font-black uppercase px-2 py-1 rounded-full border-2 border-ink">
          Yours
        </span>
      )}
    </motion.div>
  );

  const renderContent = () => {
    switch (state.phase) {
      case 'twist':
        return (
          <>
            {round.twist && <TwistCard name={round.twist.name} description={round.twist.description} large />}
            <p className="text-2xl font-black text-center">Plot Twist! Drawing the next power card...</p>
          </>
        );

      case 'wildcard':
        return (
          <>
            {cards}
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
              <p className="text-2xl font-black text-center">{nameOf(round.judgeId)} is inventing a power...</p>
            )}
          </>
        );

      case 'submitting': {
        const iSubmitted = round.submittedIds.includes(state.you);
        const iWasSkipped = round.skippedIds.includes(state.you);
        const iPlay = !isJudge || judgePlays;
        return (
          <>
            {passBadge}
            {cards}
            {wildcardNote}
            <div className="text-center font-black text-xl">
              {!iPlay ? (
                <p>You're the judge! Waiting for flaws... ({round.submittedIds.length}/{submitters.length})</p>
              ) : iWasSkipped ? (
                <p>You were skipped this round. See you next one!</p>
              ) : iSubmitted ? (
                <p>Flaw locked in! Waiting for the others... ({round.submittedIds.length}/{submitters.length})</p>
              ) : isJudge ? (
                <p>The Narrator interrupts! Play a flaw of your own. It gets mixed in anonymously.</p>
              ) : (
                <p>
                  {round.power2
                    ? 'Pick a flaw that ruins BOTH powers.'
                    : 'Pick the flaw from your hand that ruins this power best.'}
                </p>
              )}
              {round.skippedIds.length > 0 && (
                <p className="text-sm text-muted mt-1">
                  Skipped (disconnected or out of time): {round.skippedIds.map(nameOf).join(', ')}
                </p>
              )}
            </div>
            {round.liveFlaws.length > 0 && (
              <div className="w-full max-w-3xl">
                <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-muted">
                  Played so far (face-up)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {round.liveFlaws.map((f) => (
                    <div key={f.playerId} className="rounded-2xl border-[3px] border-ink bg-white p-3 shadow-pop-sm">
                      <p className="text-xs font-black uppercase tracking-wide text-muted">{f.playerName}</p>
                      <p className="font-black">{f.text}</p>
                      {f.note && <p className="text-sm font-bold">📖 {f.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      }

      case 'judging':
        return (
          <>
            {passBadge}
            {cards}
            <p className="text-2xl font-black text-center max-w-xl">
              {isJudge
                ? (round.twist?.judgingPrompt ?? 'Which flaw ruins it best?')
                : 'The judge is deciding who ruined it best...'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-4xl">
              {round.entries.map((entry) => entryCard(entry, isJudge ? () => act(() => pickWinner(entry.id)) : undefined))}
            </div>
          </>
        );

      case 'target':
        return (
          <>
            {cards}
            {isJudge && round.target ? (
              <div className="w-full max-w-4xl text-center">
                <p className="text-2xl font-black mb-4">{round.target.prompt}</p>
                {round.target.pick === 'entry' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {round.entries
                      .filter((e) => round.target!.eligibleIds.includes(e.id))
                      .map((e) => entryCard(e, () => act(() => pickTarget(e.id))))}
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-3">
                    {round.target.eligibleIds.map((id) => (
                      <Button key={id} variant="secondary" disabled={busy} onClick={() => act(() => pickTarget(id))}>
                        {nameOf(id)}
                      </Button>
                    ))}
                  </div>
                )}
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
            {cards}
            <div className="text-center space-y-4">
              {result && result.awards.length === 0 && <h3 className="display text-4xl">No winner this round</h3>}
              {result?.awards.map((award, i) => (
                <div key={i} className="space-y-2">
                  <h3 className="display text-4xl">
                    {result.awards.length > 1 ? `Pass ${i + 1}: ` : ''}Power ruined by {namesOf(award.scorerIds)}!
                  </h3>
                  <div className="inline-block">
                    <WhiteCard text={award.text} isWinner />
                  </div>
                  {award.note && <p className="font-bold">📖 {award.note}</p>}
                  {award.authorIds.join() !== award.scorerIds.join() && (
                    <p className="text-sm font-black uppercase tracking-wide text-muted">
                      Written by {namesOf(award.authorIds)}
                    </p>
                  )}
                </div>
              ))}
              {result?.note && <p className="text-lg font-black">{result.note}</p>}
              <p className="text-lg font-black text-muted">Next superpower incoming...</p>
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

  return <div className="h-full flex flex-col items-center justify-center gap-5 p-4">{renderContent()}</div>;
};

export default GameBoard;
