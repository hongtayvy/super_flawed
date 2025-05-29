import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { useGame } from '../../contexts/GameContext';
import type { GameChatProps } from '../../types/game';

const GameChat = ({ messages, onSendMessage }: GameChatProps) => {
  const { playerInfo } = useGame();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && playerInfo.name) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
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
            <div key={message.id} className={`flex ${message.playerId === playerInfo.id ? 'justify-end' : ''}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.playerId === 'system'
                    ? 'bg-gray-700 text-gray-300 italic'
                    : message.playerId === playerInfo.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-white'
                }`}
              >
                {message.playerId !== 'system' && message.playerId !== playerInfo.id && (
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