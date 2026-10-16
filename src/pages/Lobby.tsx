import { useSearchParams, useNavigate } from 'react-router-dom';
import { Copy, Link as LinkIcon, Play, Bot } from 'lucide-react';
import Button from '../components/ui/Button';
import PlayerList from '../components/game/PlayerList';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../hooks/useToast';
import { useRoomSession } from '../hooks/useRoomSession';

const Lobby = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = (searchParams.get('code') || '').trim().toUpperCase();

  const { leaveRoom, setReady, toggleBots, setTimerSeconds, startGame } = useGame();
  const { toast } = useToast();
  const state = useRoomSession(code, 'lobby');

  if (!state) {
    return <div className="p-8 text-center font-black uppercase tracking-wide">Finding your hideout...</div>;
  }

  const me = state.players.find((p) => p.id === state.you);
  const isHost = me?.isHost === true;
  const { minPlayers, maxPlayers, winScore } = state.rules;
  const everyoneReady = state.players.every((p) => p.isReady || p.isHost);
  const enoughPlayers = state.players.length >= minPlayers;
  const hasBots = state.players.some((p) => p.isBot);

  const copy = (text: string, title: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title }),
      () => toast({ title: text }),
    );
  };

  const handleStart = async () => {
    const res = await startGame();
    if (!res.ok) toast({ title: res.error || 'Could not start.', variant: 'destructive' });
  };

  const leave = () => {
    leaveRoom();
    navigate('/');
  };

  const startHint = !enoughPlayers
    ? `Need at least ${minPlayers} players to start.`
    : !everyoneReady
      ? 'Waiting for everyone to get ready.'
      : '';

  return (
    <div className="max-w-5xl mx-auto p-4 pt-8">
      <span className="pill bg-coral">✳ Your secret hideout</span>
      <h1 className="display text-[clamp(44px,6vw,72px)] mt-3 mb-6">
        Assemble the <span className="text-cobalt">mess.</span>
      </h1>

      <div className="grid md:grid-cols-[1.14fr_.86fr] gap-6">
        <div className="panel">
          <h2 className="display text-3xl">Your room code</h2>
          <p className="text-sm font-bold text-muted">Send this code (or the link) to your future ex-friends.</p>
          <div className="flex items-center justify-between gap-4 bg-sun border-[3px] border-dashed border-ink rounded-2xl px-5 py-4 my-5">
            <span className="display text-5xl tracking-[0.15em]">{state.gameCode}</span>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => copy(state.gameCode, 'Room code copied!')}
                className="flex items-center gap-1 bg-white border-2 border-ink rounded-full px-3 py-1 text-xs font-black"
                aria-label="Copy room code"
              >
                <Copy size={14} /> Code
              </button>
              <button
                onClick={() => copy(`${window.location.origin}/?join=${state.gameCode}`, 'Invite link copied!')}
                className="flex items-center gap-1 bg-white border-2 border-ink rounded-full px-3 py-1 text-xs font-black"
                aria-label="Copy invite link"
              >
                <LinkIcon size={14} /> Link
              </button>
            </div>
          </div>

          <h2 className="display text-3xl mb-1">
            The gang{' '}
            <small className="font-body text-xs font-extrabold text-muted">
              {state.players.length} / {maxPlayers}
            </small>
          </h2>
          <div className="mb-5">
            <PlayerList players={state.players} />
          </div>

          <div className="mb-5">
            <label htmlFor="timer" className="field-label">
              Flaw timer
            </label>
            <select
              id="timer"
              className="field !py-2 max-w-[220px]"
              value={state.settings.timerSeconds}
              disabled={!isHost}
              onChange={(e) => setTimerSeconds(Number(e.target.value))}
            >
              {state.settings.timerOptions.map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? 'Off (wait for everyone)' : `${s} seconds`}
                </option>
              ))}
            </select>
            {!isHost && <p className="text-xs font-bold text-muted mt-1">The host picks this.</p>}
          </div>

          <div className="flex flex-wrap gap-3">
            {!isHost && (
              <Button size="sm" variant={me?.isReady ? 'primary' : 'outline'} onClick={() => setReady(!me?.isReady)}>
                {me?.isReady ? 'Ready ✓' : "I'm ready ✓"}
              </Button>
            )}
            {isHost && (
              <>
                <Button size="sm" variant="outline" onClick={toggleBots}>
                  <Bot size={16} />
                  {hasBots ? 'Remove bots' : 'Add bots'}
                </Button>
                <Button size="sm" onClick={handleStart} disabled={!enoughPlayers || !everyoneReady}>
                  <Play size={16} />
                  Start round ↗
                </Button>
              </>
            )}
            <Button size="sm" variant="danger" onClick={leave}>
              Leave
            </Button>
          </div>
          {isHost && startHint && <p className="text-xs font-bold text-muted mt-3">{startHint}</p>}
        </div>

        <div className="space-y-6">
          <div className="relative overflow-hidden bg-cobalt border-[3px] border-ink rounded-3xl min-h-[230px] flex items-center">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-56 w-56 rounded-full border-[25px] border-sun opacity-80" />
            <p className="display relative z-10 text-4xl text-white max-w-[200px] pl-6 [text-shadow:4px_4px_0_#17183E]">
              Same power. Different disasters.
            </p>
            <img src="/mascot/point.webp" alt="" className="absolute -bottom-6 -right-4 h-60 -rotate-6" />
          </div>

          <div className="panel bg-[#F0EEFF]">
            <h2 className="display text-3xl mb-3">Quick house rules</h2>
            <ol className="font-extrabold">
              {[
                'The judge flips a Super Power card.',
                'Everyone else plays a Flaw card to sabotage it.',
                'The judge picks the one funniest combo.',
                'The judge role rotates every round.',
                `First to ${winScore} points wins.`,
                'Watch for Plot Twists and Wildcards in the deck.',
              ].map((rule, i) => (
                <li key={rule} className="py-3 border-b border-line last:border-0">
                  <b className="text-cobalt mr-2">0{i + 1}</b>
                  {rule}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
