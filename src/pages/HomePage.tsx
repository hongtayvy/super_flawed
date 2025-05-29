import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Users } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import PlayerSetup from '../components/game/PlayerSetup';
import { useGame } from '../contexts/GameContext';
import { socket } from '../socket'; // ✅ import the socket

const HomePage = () => {
  const navigate = useNavigate();
  const { setPlayerInfo } = useGame();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [gameCode, setGameCode] = useState('');

  const handleCreateGame = (playerName: string, playerAvatar: string) => {
    const id = crypto.randomUUID();
    const newGameCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const player = {
      id,
      name: playerName,
      avatar: playerAvatar,
      isHost: true,
      score: 0,
      isReady: true,
      isBot: false,
    };

    setPlayerInfo(player);
    socket.emit('join-room', { gameCode: newGameCode, player }); // ✅ join socket room
    setIsCreateModalOpen(false);
    navigate(`/lobby?code=${newGameCode}`);
  };

  const handleJoinGame = (playerName: string, playerAvatar: string) => {
    const id = crypto.randomUUID();

    const player = {
      id,
      name: playerName,
      avatar: playerAvatar,
      isHost: false,
      score: 0,
      isReady: true,
      isBot: false,
    };

    setPlayerInfo(player);
    socket.emit('join-room', { gameCode, player }); // ✅ join socket room
    setIsJoinModalOpen(false);
    navigate(`/lobby?code=${gameCode}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <div className="max-w-md w-full mx-auto text-center space-y-8">
        <div className="mb-12 space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-indigo-600 bg-clip-text text-transparent">
            Super Flawed
          </h1>
          <p className="text-gray-300 text-lg">
            The party card game for horrible people, now online!
          </p>
        </div>

        <div className="space-y-4">
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800"
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            Create New Game
          </Button>

          <Button 
            onClick={() => setIsJoinModalOpen(true)}
            className="w-full py-4 bg-gray-800 hover:bg-gray-700"
          >
            <Users className="mr-2 h-5 w-5" />
            Join Game
          </Button>
        </div>

        <p className="mt-8 text-gray-400 text-sm">
          Warning: This game contains content that may be offensive to some players.
          Play at your own risk!
        </p>
      </div>

      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Game"
      >
        <PlayerSetup onSubmit={handleCreateGame} buttonText="Create Game" />
      </Modal>

      <Modal 
        isOpen={isJoinModalOpen} 
        onClose={() => setIsJoinModalOpen(false)}
        title="Join Game"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="gameCode" className="block text-sm font-medium text-gray-300 mb-1">
              Game Code
            </label>
            <input
              type="text"
              id="gameCode"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-digit code"
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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