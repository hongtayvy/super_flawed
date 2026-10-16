import { useState } from 'react';
import { motion } from 'framer-motion';
import BlackCard from '../cards/BlackCard';
import WhiteCard from '../cards/WhiteCard';
import TwistCard from '../cards/TwistCard';
import Button from '../ui/Button';
import { useGame } from '../../contexts/GameContext';
import { useToast } from '../../hooks/useToast';
import type { EntryView, RoomState } from '../../types/game';

type Picks = Record<string, string>; // playerId -> chosen cardId

const WILDCARD_EXAMPLES = ['You can sneeze lightning.', 'You can talk to sandwiches.', 'You can pause any song forever.'];

const GameBoard = ({ state }: { state: RoomState }) => {
  const { pickWinner, pickTarget, playAgain, setWildcard, vote, chooseCards } = useGame();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [wildcardText, setWildcardText] = useState('');
  const [picks, setPicks] = useState<Picks>({});

  const round = state.round!;
  const me = state.players.find((p) => p.id === state.you);
  const isJudge = round.judgeId === state.you;
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? '?';
  const namesOf = (ids: string[]) => ids.map(nameOf).join(' & ');
  const submitters = state.players.filter((p) => p.id !== round.judgeId && !round.skippedIds.includes(p.id));

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
  const entryCard = (entry: EntryView, onClick?: () => void, chosen = false) => (
    <motion.div
      key={entry.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`relative ${onClick ? 'cursor-pointer' : ''}`}
    >
      <WhiteCard text={entry.text} isSelectable={Boolean(onClick)} isSelected={entry.mine || chosen} />
      {entry.authorNames && (
        <p className="mt-1 text-center text-xs font-black uppercase tracking-wide text-muted">
          by {entry.authorNames.join(' & ')}
        </p>
      )}
      {entry.votes !== undefined && (
        <p className="mt-1 text-center text-sm font-black">
          {entry.votes} vote{entry.votes === 1 ? '' : 's'}
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

      case 'choosing': {
        const rows = round.choosing;
        return (
          <>
            {cards}
            {isJudge && rows ? (
              <div className="w-full max-w-5xl space-y-4">
                <p className="text-2xl font-black text-center">
                  Breaking the Fourth Wall! You can see everyone's hand. Choose the flaw each player plays.
                </p>
                {rows.map((row) => (
                  <div key={row.playerId} className="rounded-3xl border-[3px] border-ink bg-white p-3 shadow-pop-sm">
                    <p className="mb-2 flex items-center justify-between text-sm font-black uppercase tracking-wide">
                      <span>{row.name}</span>
                      <span className={picks[row.playerId] ? 'text-cobalt' : 'text-muted'}>
                        {picks[row.playerId] ? 'Chosen ✓' : 'Pick one'}
                      </span>
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {row.cards.map((card) => (
                        <div
                          key={card.id}
                          className="w-44 shrink-0 cursor-pointer"
                          onClick={() => setPicks((prev) => ({ ...prev, [row.playerId]: card.id }))}
                        >
                          <WhiteCard text={card.text} isSelectable isSelected={picks[row.playerId] === card.id} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="text-center">
                  <Button
                    size="lg"
                    disabled={busy || rows.some((r) => !picks[r.playerId])}
                    onClick={() =>
                      act(async () => {
                        const res = await chooseCards(rows.map((r) => ({ playerId: r.playerId, cardId: picks[r.playerId] })));
                        if (res.ok) setPicks({});
                        return res;
                      })
                    }
                  >
                    Lock in these flaws ⚡
                  </Button>
                </div>
              </div>
            ) : (
              <p className="max-w-xl text-center text-2xl font-black">
                Breaking the Fourth Wall! {nameOf(round.judgeId)} is looking through everyone's hands and choosing the
                flaw each player plays...
              </p>
            )}
          </>
        );
      }

      case 'submitting': {
        const iSubmitted = round.submittedIds.includes(state.you);
        const iWasSkipped = round.skippedIds.includes(state.you);
        return (
          <>
            {passBadge}
            {cards}
            {wildcardNote}
            <div className="text-center font-black text-xl">
              {isJudge ? (
                <p>You're the judge! Waiting for flaws... ({round.submittedIds.length}/{submitters.length})</p>
              ) : iWasSkipped ? (
                <p>You were skipped this round. See you next one!</p>
              ) : iSubmitted ? (
                <p>Flaw locked in! Waiting for the others... ({round.submittedIds.length}/{submitters.length})</p>
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
          </>
        );
      }

      case 'voting':
        return (
          <>
            {cards}
            <p className="text-2xl font-black text-center max-w-xl">
              {isJudge ? 'The group is voting...' : 'Vote for the funniest flaw!'} ({round.votedIds.length}/
              {state.players.length - 1} voted)
            </p>
            <p className="text-sm font-bold text-muted">
              {isJudge
                ? "You picked these flaws. If the vote is tied, you decide."
                : round.myVote
                  ? 'Vote cast. Tap another flaw to change it.'
                  : "You can't vote for your own flaw."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-4xl">
              {round.entries.map((entry) =>
                entryCard(
                  entry,
                  isJudge || entry.mine ? undefined : () => act(() => vote(entry.id)),
                  entry.id === round.myVote,
                ),
              )}
            </div>
          </>
        );

      case 'judging': {
        // After a tied group vote the judge chooses between the tied flaws only.
        const options = round.tiebreak ? round.entries.filter((e) => round.tiebreak!.includes(e.id)) : round.entries;
        return (
          <>
            {passBadge}
            {cards}
            <p className="text-2xl font-black text-center max-w-xl">
              {round.tiebreak
                ? isJudge
                  ? 'It is a tie! You break it: pick the winner.'
                  : 'It is a tie! The judge breaks it...'
                : isJudge
                  ? (round.twist?.judgingPrompt ?? 'Which flaw ruins it best?')
                  : 'The judge is deciding who ruined it best...'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-4xl">
              {options.map((entry) => entryCard(entry, isJudge ? () => act(() => pickWinner(entry.id)) : undefined))}
            </div>
          </>
        );
      }

      case 'target':
        return (
          <>
            {cards}
            {round.target && round.target.chooserId === state.you ? (
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
              <p className="text-2xl font-black text-center">
                {round.target ? nameOf(round.target.chooserId) : 'Someone'} is resolving the Plot Twist...
              </p>
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
                    {award.label ? `${award.label}: ` : result.awards.length > 1 ? `Pass ${i + 1}: ` : ''}
                    {award.authorIds.length ? `Power ruined by ${namesOf(award.authorIds)}!` : 'A winning flaw was picked!'}
                  </h3>
                  <div className="inline-block">
                    <WhiteCard text={award.text} isWinner />
                  </div>
                </div>
              ))}
              {result?.note && <p className="text-lg font-black">{result.note}</p>}
              {round.entries.some((e) => e.votes !== undefined) && (
                <div className="mx-auto max-w-md rounded-2xl border-[3px] border-ink bg-white p-3 text-left shadow-pop-sm">
                  <p className="mb-1 text-xs font-black uppercase tracking-widest text-muted">Vote results</p>
                  {[...round.entries]
                    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
                    .map((e) => (
                      <p key={e.id} className="flex justify-between gap-3 text-sm font-bold">
                        <span className="truncate">{e.text}</span>
                        <span className="shrink-0 font-black">{e.votes}</span>
                      </p>
                    ))}
                </div>
              )}
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
