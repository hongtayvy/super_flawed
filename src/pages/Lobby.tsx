import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Play, Bot } from 'lucide-react';
import Button from '../components/ui/Button';
import PlayerList from '../components/game/PlayerList';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../hooks/useToast';
import { socket } from '../socket';

const Lobby = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameCode = searchParams.get('code') || '';
  const {
    playerInfo,
    setPlayerInfo,
    addPlayer,
    players,
    setPlayers,
    initializeGame,
    resetPlayers,
    resetGame,
  } = useGame();
  const { toast } = useToast();
  const [isReady, setIsReady] = useState(false);
  const alreadyJoined = useRef(false);
  const botsAdded = useRef(false);

  useEffect(() => {
    resetPlayers();
  }, []);

  useEffect(() => {
    if (!alreadyJoined.current && playerInfo.name && playerInfo.id) {
      socket.emit('join-lobby', {
        gameCode,
        player: {
          id: playerInfo.id,
          name: playerInfo.name,
          avatar: playerInfo.avatar,
          isHost: playerInfo.isHost,
          score: 0,
          isReady: true,
        },
      });
      alreadyJoined.current = true;
    }
  }, [playerInfo]);

  useEffect(() => {
    socket.on('lobby-players', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    return () => {
      socket.off('lobby-players');
    };
  }, []);

  useEffect(() => {
    const readyInterval = setInterval(() => {
      if (players.length >= 2) {
        setPlayers(prev =>
          prev.map(player =>
            !player.isHost && Math.random() > 0.5 && !player.isReady
              ? { ...player, isReady: true }
              : player
          )
        );
      }
    }, 2000);

    return () => clearInterval(readyInterval);
  }, [players, setPlayers]);

  const copyGameCode = () => {
    navigator.clipboard.writeText(gameCode);
    toast({
      title: 'Game code copied!',
      description: 'Share this with your friends so they can join.',
    });
  };

  const toggleReady = () => {
    setIsReady(prev => !prev);
    socket.emit('player-ready', {
      gameCode,
      playerId: playerInfo.id,
      isReady: !isReady,
    });
  };

  const startGame = () => {
    socket.emit('start-game', { gameCode });
    initializeGame(gameCode);
    navigate(`/game/${gameCode}`);
  };

  const toggleBots = () => {
    socket.emit('toggle-bots', { gameCode });
    botsAdded.current = !botsAdded.current;
  };

  const allPlayersReady = players.length >= 3 && players.every(p => p.isReady);
  const canStartGame = playerInfo.isHost && allPlayersReady;

  return (
    <div className="max-w-4xl mx-auto p-4 pt-8">
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold">Game Lobby</h1>
            <div className="flex items-center mt-2">
              <span className="text-gray-300 mr-2">Game Code:</span>
              <div className="bg-gray-700 px-3 py-1 rounded-md font-mono text-lg">{gameCode}</div>
              <button
                onClick={copyGameCode}
                className="ml-2 p-1 text-gray-400 hover:text-white transition-colors"
                aria-label="Copy game code"
              >
                <Copy size={18} />
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            {!playerInfo.isHost && (
              <Button
                onClick={toggleReady}
                className={`px-4 py-2 ${isReady ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'}`}
              >
                {isReady ? 'Ready!' : 'Mark as Ready'}
              </Button>
            )}

            {playerInfo.isHost && (
              <>
                <Button
                  onClick={toggleBots}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700"
                >
                  <Bot size={18} className="mr-2" />
                  {botsAdded.current ? 'Remove Bots' : 'Add Bots'}
                </Button>
                <Button
                  onClick={startGame}
                  disabled={!canStartGame}
                  className={`px-4 py-2 ${canStartGame ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-700 cursor-not-allowed'}`}
                >
                  <Play size={18} className="mr-2" />
                  Start Game
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4">Players</h2>
          <PlayerList />
        </div>

        <div className="flex justify-end mt-4">
          <Button
            onClick={() => {
              resetGame();
              navigate('/');
            }}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Leave Lobby
          </Button>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 mt-6">
          <h2 className="text-xl font-semibold mb-2">How to Play</h2>
          <div className="text-gray-300 space-y-3">
            <p>1. Each round, one player is the Card Czar who reads the black card.</p>
            <p>2. Everyone else plays a white card to complete the sentence or answer the question.</p>
            <p>3. The Card Czar picks their favorite combination, and that player gets a point.</p>
            <p>4. The role of Card Czar rotates each round.</p>
            <p>5. First player to reach 10 points wins!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;