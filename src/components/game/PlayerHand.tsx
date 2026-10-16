import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import WhiteCard from '../cards/WhiteCard';
import Button from '../ui/Button';
import { useGame } from '../../contexts/GameContext';
import { useToast } from '../../hooks/useToast';
import type { RoomState } from '../../types/game';

const PlayerHand = ({ state }: { state: RoomState }) => {
  const { submitCard } = useGame();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const round = state.round!;
  const isJudge = round.judgeId === state.you;
  const hasSubmitted = round.submittedIds.includes(state.you);
  const wasSkipped = round.skippedIds.includes(state.you);
  const canPlay = state.phase === 'submitting' && !isJudge && !hasSubmitted && !wasSkipped;

  // Start each round with nothing selected.
  useEffect(() => {
    setSelectedId(null);
  }, [round.number]);

  if (isJudge) {
    return (
      <div className="h-full min-h-[200px] flex flex-col items-center justify-center p-4 bg-lilac border-[3px] border-ink rounded-3xl">
        <p className="display text-3xl text-center">You're the judge this round!</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!selectedId || sending) return;
    setSending(true);
    const res = await submitCard(selectedId);
    setSending(false);
    if (!res.ok) toast({ title: res.error || 'Could not submit that flaw.', variant: 'destructive' });
  };

  return (
    <div className="h-full flex flex-col p-4 bg-white border-[3px] border-ink rounded-3xl">
      <div className="flex justify-between items-center mb-3">
        <h3 className="display text-2xl">Your flaws</h3>
        {state.phase === 'submitting' && !wasSkipped && (
          <Button onClick={handleSubmit} disabled={!canPlay || !selectedId || sending} size="sm">
            {hasSubmitted ? 'Submitted ✓' : 'Submit flaw ⚡'}
          </Button>
        )}
      </div>

      <div className="flex-grow overflow-x-auto overflow-y-hidden">
        <div className="flex space-x-4 py-3 px-1 h-full">
          {state.hand.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
              className={`flex-shrink-0 ${canPlay ? 'cursor-pointer' : 'cursor-default opacity-80'} ${
                selectedId === card.id ? '-translate-y-3' : ''
              }`}
              style={{ width: '180px', minHeight: '200px' }}
              onClick={() => canPlay && setSelectedId(card.id)}
            >
              <WhiteCard text={card.text} isSelected={selectedId === card.id} isSelectable={canPlay} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlayerHand;
