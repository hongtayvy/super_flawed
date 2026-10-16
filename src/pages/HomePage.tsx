import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PlusCircle, Users } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import PlayerSetup from '../components/game/PlayerSetup';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../hooks/useToast';
import { TWISTS } from '../../server/src/twists';

const HomePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createRoom, joinRoom } = useGame();
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [gameCode, setGameCode] = useState('');

  // Shared invite links look like /?join=ABC123
  useEffect(() => {
    const code = (searchParams.get('join') || '').trim().toUpperCase();
    if (code) {
      setGameCode(code.slice(0, 6));
      setIsJoinModalOpen(true);
    }
  }, [searchParams]);

  const handleCreateGame = async (playerName: string, playerAvatar: string) => {
    const res = await createRoom(playerName.trim(), playerAvatar);
    if (res.ok && res.gameCode) {
      setIsCreateModalOpen(false);
      navigate(`/lobby?code=${res.gameCode}`);
    } else {
      toast({ title: res.error || 'Could not create a room.', variant: 'destructive' });
    }
  };

  const handleJoinGame = async (playerName: string, playerAvatar: string) => {
    if (gameCode.trim().length !== 6) {
      toast({ title: 'Enter the 6-character room code.', variant: 'destructive' });
      return;
    }
    const res = await joinRoom(gameCode, playerName.trim(), playerAvatar);
    if (res.ok && res.gameCode) {
      setIsJoinModalOpen(false);
      navigate(`/lobby?code=${res.gameCode}`);
    } else {
      toast({ title: res.error || 'Could not join that room.', variant: 'destructive' });
    }
  };

  return (
    <div>
      <section className="relative bg-[#F3F5FF] border-b-[3px] border-ink overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid md:grid-cols-[1.05fr_.95fr] items-center gap-6 min-h-[600px]">
          <div className="py-12 relative z-10">
            <span className="pill bg-sun">✳ A party game about very bad heroes</span>
            <h1 className="display text-[clamp(60px,9vw,112px)] mt-5 mb-5 tracking-tight">
              <span className="block text-cobalt">Great</span>
              <span className="block text-cobalt">Powers.</span>
              <span className="block text-coral">Terrible</span>
              <span className="block text-coral">Friends.</span>
            </h1>
            <p className="text-2xl font-extrabold leading-snug max-w-lg tracking-tight mb-3">
              What if every superpower came with a ridiculously bad catch?
            </p>
            <p className="text-muted font-bold leading-relaxed max-w-md mb-7">
              Give your friends an amazing ability. They invent the worst possible flaw. One
              judge picks the funniest disaster.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={() => setIsCreateModalOpen(true)}>
                <PlusCircle className="h-5 w-5" />
                Start a game
              </Button>
              <Button size="lg" variant="outline" onClick={() => setIsJoinModalOpen(true)}>
                <Users className="h-5 w-5" />
                Join with code
              </Button>
            </div>
            <p className="mt-8 text-xs font-extrabold uppercase tracking-wide text-muted">
              Best with friends · Worst with powers ·{' '}
              <Link to="/rules" className="underline underline-offset-4 hover:text-cobalt">
                How to play
              </Link>
            </p>
          </div>

          <div className="relative h-[460px] md:h-[600px]" aria-hidden="true">
            <div className="absolute inset-x-4 top-10 bottom-8 rounded-full bg-sun border-4 border-ink -rotate-[11deg] shadow-[10px_12px_0_#B8B5FF]" />
            <div className="absolute z-10 top-8 left-6 display text-2xl -rotate-[10deg] bg-white border-[3px] border-ink rounded-2xl px-5 py-2 shadow-pop-sm">
              This is fine!
            </div>
            <img
              src="/mascot/hero.webp"
              alt=""
              className="absolute z-[5] bottom-0 left-1/2 -translate-x-1/2 h-full max-h-[560px] object-contain drop-shadow-[7px_8px_0_rgba(23,24,62,0.14)]"
            />
            <div className="absolute z-10 right-2 top-24 w-44 -rotate-[8deg] bg-cobalt text-white border-[3px] border-ink rounded-2xl shadow-pop-lg p-4 hidden sm:block">
              <span className="text-[10px] font-black uppercase tracking-[0.15em]">⚡ The superpower</span>
              <p className="font-black text-lg leading-tight mt-2">You can teleport anywhere.</p>
            </div>
            <div className="absolute z-10 right-0 bottom-16 w-48 rotate-[6deg] bg-sun border-[3px] border-ink rounded-2xl shadow-pop-lg p-4 hidden sm:block">
              <span className="text-[10px] font-black uppercase tracking-[0.15em]">✳ The flaw</span>
              <p className="font-black text-lg leading-tight mt-2">
                But your clothes arrive 10 minutes later.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <h2 className="display text-[clamp(40px,5vw,64px)]">How to ruin a hero.</h2>
          <p className="max-w-xs text-sm font-bold text-muted">
            One amazing superpower. Unlimited terrible ideas. A laugh-out-loud showdown every
            round.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { n: '01', icon: '⚡', title: 'Flip a power', body: 'The judge flips a superpower card. Watch out: a Plot Twist or a Wildcard can come first.', bg: 'bg-cobalt text-white' },
            { n: '02', icon: '✎', title: 'Add a catch', body: 'Everyone else secretly plays a flaw from their hand to make the power wonderfully awful.', bg: 'bg-sun' },
            { n: '03', icon: '★', title: 'Judge the chaos', body: 'The judge picks the funniest flaw, no names shown. Winner scores. First to 5 wins.', bg: 'bg-lilac' },
          ].map((step) => (
            <article
              key={step.n}
              className={`${step.bg} relative border-[3px] border-ink rounded-3xl shadow-pop p-6 min-h-[220px]`}
            >
              <span className="display text-5xl opacity-40">{step.n}</span>
              <span className="absolute top-5 right-6 text-4xl rotate-12">{step.icon}</span>
              <h3 className="display text-3xl mt-5 mb-2">{step.title}</h3>
              <p className="font-bold leading-snug max-w-[280px]">{step.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
            <h2 className="display text-[clamp(36px,4.5vw,56px)]">
              {TWISTS.length} <span className="text-coral">plot twists.</span>
            </h2>
            <p className="max-w-sm text-sm font-bold text-muted">
              Every so often the deck throws a curveball that changes the round for everyone: swapped points, hidden powers, a
              group vote and more.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TWISTS.map((t) => (
              <span
                key={t.id}
                className="rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-black shadow-pop-sm"
              >
                🌀 {t.name}
              </span>
            ))}
          </div>
          <Link
            to="/rules"
            className="mt-5 inline-block text-sm font-black uppercase tracking-wide underline decoration-[3px] underline-offset-4 hover:text-cobalt"
          >
            Read the full rules ↗
          </Link>
        </div>

        <div className="mt-12 bg-ink text-white rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <b className="display text-3xl tracking-wide">Be the hero. Ruin the hero.</b>
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
            Start a game ↗
          </Button>
        </div>
      </section>

      <footer className="border-t-[3px] border-ink bg-white py-6 text-xs font-black uppercase tracking-wide">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-wrap justify-between gap-3">
          <span>© 2026 Super Flawed · All rights wronged.</span>
          <span>Warning: may contain questionable flaws. Play at your own risk!</span>
        </div>
      </footer>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Start a game"
      >
        <PlayerSetup onSubmit={handleCreateGame} buttonText="Create Game" />
      </Modal>

      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        title="Join a room"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="gameCode" className="field-label">
              Room code
            </label>
            <input
              type="text"
              id="gameCode"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-digit code"
              className="field tracking-[0.2em]"
              maxLength={6}
            />
          </div>
          <PlayerSetup onSubmit={handleJoinGame} buttonText="Join Game" />
        </div>
      </Modal>
    </div>
  );
};

export default HomePage;
