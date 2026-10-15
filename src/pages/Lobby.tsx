// app/src/pages/Lobby.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Play, Bot } from 'lucide-react';
import Button from '../components/ui/Button';
import PlayerList from '../components/game/PlayerList';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../hooks/useToast';
import { socket } from '../socket';

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameCode: string = (searchParams.get('code') || '').trim().toLowerCase();

  const {
    playerInfo,
    setPlayers,
    initializeGame,
    resetPlayers,
    resetGame,
    players,
  } = useGame();
  const { toast } = useToast();
  const [isReady, setIsReady] = useState(false);
  const alreadyJoined = useRef(false);
  const botsAdded = useRef(false);

  // clear old players when mounting
  useEffect(() => {
    resetPlayers();
  }, []);

  // auto-join once we have a code + playerInfo

  useEffect(() => {

    console.log('[useEffect] playerInfo:', playerInfo, 'alreadyJoined:', alreadyJoined.current, 'gameCode:', gameCode);
    if (!alreadyJoined.current && playerInfo.id && gameCode) {

      console.log('[Client] Emitting join-room:', gameCode, playerInfo);

      socket.emit('join-room', {
        gameCode,
        player: {
          id: playerInfo.id,
          name: playerInfo.name,
          avatar: playerInfo.avatar,
          isHost: playerInfo.isHost,
          score: 0,
          isReady: false,
        },
      });
      alreadyJoined.current = true;
    }
  }, [playerInfo, gameCode]);

  // listen for lobby updates & game start / errors
  useEffect(() => {
    socket.on('lobby-players', (updated: any[]) => {
      setPlayers(updated);
    });
    socket.on('lobby-error', ({ message }: { message: string }) => {
      toast({ title: message, variant: 'destructive' });
      navigate('/');
    });
    socket.on('game-started', ({ gameCode: code }: { gameCode: string }) => {
      initializeGame(code);
      navigate(`/game/${code}`);
    });

    return () => {
      socket.off('lobby-players');
      socket.off('lobby-error');
      socket.off('game-started');
    };
  }, [setPlayers, initializeGame, toast, navigate]);

  // simulate bots/other players ready randomly
  useEffect(() => {
    const id = setInterval(() => {
      setPlayers(prev =>
        prev.map(p =>
          !p.isHost && Math.random() > 0.5 && !p.isReady
            ? { ...p, isReady: true }
            : p
        )
      );
    }, 2000);
    return () => clearInterval(id);
  }, [setPlayers]);

  const copyGameCode = () => {
    navigator.clipboard.writeText(gameCode);
    toast({ title: 'Copied!', description: 'Share this code.' });
  };

  const toggleReady = () => {
    const val = !isReady;
    setIsReady(val);
    socket.emit('player-ready', {
      gameCode,
      playerId: playerInfo.id,
      isReady: val,
    });
  };

  const startGame = () => {
    if (playerInfo.isHost) socket.emit('start-game', { gameCode });
  };

  const toggleBots = () => {
    socket.emit('toggle-bots', { gameCode });
    botsAdded.current = !botsAdded.current;
  };

  const allReady =
    players.length >= 2 && players.every(p => p.isReady || p.isHost);
  const canStart = playerInfo.isHost && allReady;

  return (
    <div className="max-w-5xl mx-auto p-4 pt-8">
      <span className="pill bg-coral">✳ Your secret hideout</span>
      <h1 className="display text-[clamp(44px,6vw,72px)] mt-3 mb-6">
        Assemble the <span className="text-cobalt">mess.</span>
      </h1>

      <div className="grid md:grid-cols-[1.14fr_.86fr] gap-6">
        <div className="panel">
          <h2 className="display text-3xl">Your room code</h2>
          <p className="text-sm font-bold text-muted">Send this code to your future ex-friends.</p>
          <div className="flex items-center justify-between gap-4 bg-sun border-[3px] border-dashed border-ink rounded-2xl px-5 py-4 my-5">
            <span className="display text-5xl tracking-[0.15em]">{gameCode.toUpperCase()}</span>
            <button
              onClick={copyGameCode}
              className="flex items-center gap-1 bg-white border-2 border-ink rounded-full px-3 py-2 text-xs font-black"
              aria-label="Copy room code"
            >
              <Copy size={16} /> Copy
            </button>
          </div>

          <h2 className="display text-3xl mb-3">The gang</h2>
          <div className="mb-6">
            <PlayerList />
          </div>

          <div className="flex flex-wrap gap-3">
            {!playerInfo.isHost && (
              <Button size="sm" variant={isReady ? 'primary' : 'outline'} onClick={toggleReady}>
                {isReady ? 'Ready ✓' : "I'm ready ✓"}
              </Button>
            )}
            {playerInfo.isHost && (
              <>
                <Button size="sm" variant="outline" onClick={toggleBots}>
                  <Bot size={16} />
                  {botsAdded.current ? 'Remove bots' : 'Add bots'}
                </Button>
                <Button size="sm" onClick={startGame} disabled={!canStart}>
                  <Play size={16} />
                  Start round ↗
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                resetGame();
                navigate('/');
              }}
            >
              Leave
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="relative overflow-hidden bg-cobalt border-[3px] border-ink rounded-3xl min-h-[230px] flex items-center">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-56 w-56 rounded-full border-[25px] border-sun" />
            <p className="display relative z-10 text-4xl text-white max-w-[200px] pl-6 [text-shadow:4px_4px_0_#17183E]">
              Same power. Different disasters.
            </p>
            <img
              src="/mascot/point.webp"
              alt=""
              className="absolute -bottom-6 -right-4 h-60 -rotate-6"
            />
          </div>

          <div className="panel bg-[#F0EEFF]">
            <h2 className="display text-3xl mb-3">Quick house rules</h2>
            <ol className="font-extrabold">
              {[
                'The judge reveals a superpower card.',
                'Everyone else plays their funniest flaw.',
                'The judge picks the worst catch.',
                'The judge role rotates.',
                'First to 10 points wins.',
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
