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
      <div className="p-3 border-b-[3px] border-ink">
        <h3 className="display text-2xl">Trash talk</h3>
      </div>

      <div className="flex-grow overflow-y-auto p-3">
        <div className="space-y-3">
          {messages.map(message => (
            <div key={message.id} className={`flex ${message.playerId === playerInfo.id ? 'justify-end' : ''}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm font-bold ${
                  message.playerId === 'system'
                    ? 'bg-ice text-muted italic border-2 border-line'
                    : message.playerId === playerInfo.id
                    ? 'bg-cobalt text-white border-2 border-ink'
                    : 'bg-white text-ink border-2 border-ink'
                }`}
              >
                {message.playerId !== 'system' && message.playerId !== playerInfo.id && (
                  <div className="font-black text-xs text-muted mb-1">
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

      <form onSubmit={handleSendMessage} className="p-3 border-t-[3px] border-ink flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Say something awful..."
          className="field flex-grow !py-2"
        />
        <button
          type="submit"
          className="bg-sun border-[3px] border-ink rounded-full px-3 flex items-center justify-center disabled:opacity-50"
          disabled={!newMessage.trim()}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default GameChat;