import { useEffect, useState } from 'react';
import type { ChatMessage } from '../types/game';
import crypto from 'crypto';
import { useNavigate, useParams } from 'react-router-dom';
import GameBoard from '../components/game/GameBoard';
import PlayerHand from '../components/game/PlayerHand';
import ScoreBoard from '../components/game/ScoreBoard';
import GameChat from '../components/game/GameChat';
import RoundInfo from '../components/game/RoundInfo';
import { useGame } from '../contexts/GameContext';
import { socket } from '../socket';

const GameRoom = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const {
    playerInfo,
    gameState,
    currentRound,
    nextRound,
    players,
    selectCard,
    submitSelection,
    selectWinner,
    resetGame,
  } = useGame();

  // Chat state & handlers
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    socket.on('chat-message', (message: ChatMessage) => {
      setChatMessages(prev => [...prev, message]);
    });
    return () => {
      socket.off('chat-message');
    };
  }, []);

  // Join lobby for game events and chat
  useEffect(() => {
    if (gameId && playerInfo.name) {
      socket.emit('join-room', { gameCode: gameId, player: playerInfo });
    }
    return () => {
      if (gameId) {
        socket.emit('leave-lobby', { gameCode: gameId, playerId: playerInfo.id });
      }
    };
  }, [gameId, playerInfo]);

  const [showScoreboard, setShowScoreboard] = useState(false);

  // ✅ Join the actual game lobby instead of an untracked "room"
  useEffect(() => {
    if (gameId && playerInfo.name) {
      socket.emit('join-lobby', { gameCode: gameId, player: playerInfo });
    }

    return () => {
      if (gameId) {
        socket.emit('leave-lobby', { gameCode: gameId, playerId: playerInfo.id });
      }
    };
  }, [gameId, playerInfo]);

  useEffect(() => {
    if (gameState === 'roundEnd' && currentRound.winner) {
      const timer = setTimeout(() => {
        nextRound();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [gameState, currentRound.winner, nextRound]);

  useEffect(() => {
    if (gameState === 'selecting') {
      const otherPlayers = players.filter(p => p.id !== playerInfo.id && p.isBot);

      const submissionTimer = setTimeout(() => {
        otherPlayers.forEach(player => {
          if (!currentRound.submissions.some(s => s.playerId === player.id)) {
            const randomCard = {
              ...currentRound.hand[Math.floor(Math.random() * currentRound.hand.length)],
            };
            submitSelection(player.id, null, randomCard);
          }
        });
      }, 3000);

      return () => clearTimeout(submissionTimer);
    }
  }, [gameState, currentRound, players, submitSelection, playerInfo.id]);

  useEffect(() => {
    if (gameState === 'judging') {
      const submissions = currentRound.submissions;
      const czar = players.find(p => p.id === currentRound.cardCzarId);
      const isCzarBot = czar?.isBot;

      if (isCzarBot && submissions.length === players.length - 1) {
        const timer = setTimeout(() => {
          const randomWinner = submissions[Math.floor(Math.random() * submissions.length)];
          selectWinner(randomWinner.playerId);
        }, 4000);

        return () => clearTimeout(timer);
      }
    }
  }, [gameState, currentRound, players, selectWinner]);

  return (
    <div className="max-w-7xl mx-auto p-2 md:p-4 h-[calc(100vh-64px)] flex flex-col">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
        <div className="lg:col-span-3 flex flex-col h-full">
          <RoundInfo 
            round={currentRound.roundNumber}
            cardCzar={players.find(p => p.id === currentRound.cardCzarId)?.name || ''}
            gameState={gameState}
            onShowScoreboard={() => setShowScoreboard(true)}
          />

          <div className="flex-grow overflow-hidden">
            <GameBoard />
          </div>

          <div className="h-1/3 min-h-[200px]">
            <PlayerHand 
              hand={currentRound.hand}
              selectedCardIndex={currentRound.selectedCardIndex}
              isCardCzar={currentRound.isCardCzar}
              gameState={gameState}
              onSelectCard={selectCard}
              onSubmitCard={() => {
                const idx = currentRound.selectedCardIndex;
                if (idx === null) return;
                const card = currentRound.hand[idx];
                const submission = { playerId: playerInfo.id, playerName: playerInfo.name, card };
                socket.emit('submit-card', { gameCode: gameId || '', submission });
                submitSelection(playerInfo.id, idx);
              }}
            />
          </div>
        </div>

        <div className="lg:col-span-1 bg-gray-800 rounded-lg overflow-hidden flex flex-col h-full">
          <ScoreBoard 
            players={players}
            cardCzarId={currentRound.cardCzarId}
            isOpen={showScoreboard}
            onClose={() => setShowScoreboard(false)}
          />

          <GameChat
            gameId={gameId || ''}
            messages={chatMessages}
            onSendMessage={(text: string) => {
              const msg: ChatMessage = {
                id: crypto.randomUUID(),
                playerId: playerInfo.id,
                playerName: playerInfo.name,
                text,
                timestamp: Date.now(),
              };
              socket.emit('chat-message', { gameCode: gameId, message: msg });
              setChatMessages(prev => [...prev, msg]);
            }}
          />

          <div className="p-4">
            <button
              onClick={() => {
                resetGame();
                navigate('/');
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded"
            >
              Leave Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameRoom;