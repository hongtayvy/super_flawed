// app/src/pages/Lobby.tsx
import React, { useEffect, useState, useRef } from 'react';
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
    if (!alreadyJoined.current && playerInfo.id && gameCode) {
      socket.emit('join-lobby', {
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
    <div className="max-w-4xl mx-auto p-4 pt-8">
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Lobby: {gameCode}</h1>
          <button onClick={copyGameCode} className="text-gray-400 hover:text-white">
            <Copy size={20} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-6">
          {!playerInfo.isHost && (
            <Button onClick={toggleReady} className={isReady ? 'bg-green-600' : ''}>
              {isReady ? 'Ready!' : 'Mark Ready'}
            </Button>
          )}
          {playerInfo.isHost && (
            <>
              <Button onClick={toggleBots} className="bg-yellow-600">
                <Bot size={16} className="mr-1" />
                {botsAdded.current ? 'Remove Bots' : 'Add Bots'}
              </Button>
              <Button onClick={startGame} disabled={!canStart} className="bg-indigo-600">
                <Play size={16} className="mr-1" />
                Start
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              resetGame();
              navigate('/');
            }}
            className="bg-red-600"
          >
            Leave
          </Button>
        </div>

        {/* Player List */}
        <div className="bg-gray-900 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4">Players</h2>
          <PlayerList/>
        </div>

        {/* How to Play */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">How to Play</h2>
          <ol className="list-decimal pl-5 space-y-1 text-gray-300">
            <li>Card Czar reads the black card.</li>
            <li>Others submit a white card.</li>
            <li>Czar picks the winner.</li>
            <li>Czar role rotates.</li>
            <li>First to 10 points wins.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Lobby;