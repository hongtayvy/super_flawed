import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { useGame } from '../../contexts/GameContext';

interface GameChatProps {
  gameId: string;
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

const GameChat = ({ gameId }: GameChatProps) => {
  const { players, playerInfo } = useGame();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate system messages for game events
  useEffect(() => {
    // Initial welcome message
    if (messages.length === 0) {
      addSystemMessage(`Welcome to game ${gameId}! Good luck and have fun!`);
      
      // Add some fake chat messages after a delay
      setTimeout(() => {
        const demoMessages = [
          { playerId: '2', text: 'Hey everyone!' },
          { playerId: '3', text: 'Good luck!' },
          { playerId: '4', text: 'This is going to be fun!' },
        ];
        
        demoMessages.forEach((msg, index) => {
          setTimeout(() => {
            const player = players.find(p => p.id === msg.playerId);
            if (player) {
              addPlayerMessage(player.id, player.name, msg.text);
            }
          }, index * 1000);
        });
      }, 1000);
    }
  }, [gameId, players, messages.length]);

  const addSystemMessage = (text: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        playerId: 'system',
        playerName: 'System',
        text,
        timestamp: Date.now()
      }
    ]);
  };

  const addPlayerMessage = (playerId: string, playerName: string, text: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random()}`,
        playerId,
        playerName,
        text,
        timestamp: Date.now()
      }
    ]);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && playerInfo.name) {
      addPlayerMessage('1', playerInfo.name, newMessage.trim());
      setNewMessage('');
      
      // Simulate a response from another player
      const randomPlayerId = ['2', '3', '4'][Math.floor(Math.random() * 3)];
      const randomResponses = [
        'lol',
        'Nice one!',
        'Haha!',
        'Good luck with that card!',
        'I\'m going to win this round!',
        'That\'s a tough black card',
        'This is fun!'
      ];
      const randomResponse = randomResponses[Math.floor(Math.random() * randomResponses.length)];
      
      setTimeout(() => {
        const player = players.find(p => p.id === randomPlayerId);
        if (player) {
          addPlayerMessage(player.id, player.name, randomResponse);
        }
      }, 2000 + Math.random() * 3000);
    }
  };

  return (
    <div className="flex-grow flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-lg font-medium">Game Chat</h3>
      </div>
      
      <div className="flex-grow overflow-y-auto p-3">
        <div className="space-y-3">
          {messages.map(message => (
            <div key={message.id} className={`flex ${message.playerId === '1' ? 'justify-end' : ''}`}>
              <div 
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.playerId === 'system' 
                    ? 'bg-gray-700 text-gray-300 italic' 
                    : message.playerId === '1'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-white'
                }`}
              >
                {message.playerId !== 'system' && message.playerId !== '1' && (
                  <div className="font-medium text-xs text-gray-300 mb-1">
                    {message.playerName}
                  </div>
                )}
                {message.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-700 flex">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-grow bg-gray-700 border-none rounded-l-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-r-md px-3 flex items-center justify-center"
          disabled={!newMessage.trim()}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default GameChat;