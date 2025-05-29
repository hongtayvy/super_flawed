import React, { useState } from 'react';
import Button from '../ui/Button';

interface PlayerSetupProps {
  onSubmit: (name: string, avatar: string) => void;
  buttonText: string;
}

const PlayerSetup = ({ onSubmit, buttonText }: PlayerSetupProps) => {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      console.log('[PlayerSetup] Submitting:', name, selectedAvatar);
      onSubmit(name, selectedAvatar);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="playerName" className="block text-sm font-medium text-gray-300 mb-1">
          Your Name
        </label>
        <input
          type="text"
          id="playerName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Choose Avatar Color
        </label>
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((avatarId) => (
            <button
              key={avatarId}
              type="button"
              onClick={() => setSelectedAvatar(avatarId.toString())}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-transform ${
                selectedAvatar === avatarId.toString() 
                  ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-white scale-110' 
                  : ''
              } ${getAvatarColor(avatarId.toString())}`}
              aria-label={`Avatar ${avatarId + 1}`}
            >
              {name ? name.charAt(0).toUpperCase() : 'U'}
            </button>
          ))}
        </div>
      </div>
      
      <Button 
        type="submit" 
        className="w-full py-2 mt-4 bg-indigo-600 hover:bg-indigo-700"
        disabled={!name.trim()}
      >
        {buttonText}
      </Button>
    </form>
  );
};

// Helper function to get a color based on avatar ID
const getAvatarColor = (avatarId: string) => {
  const colors = [
    'bg-purple-700 text-white',
    'bg-indigo-700 text-white',
    'bg-blue-700 text-white',
    'bg-green-700 text-white',
    'bg-yellow-600 text-white',
    'bg-orange-700 text-white',
    'bg-red-700 text-white',
    'bg-pink-700 text-white',
  ];
  
  const index = parseInt(avatarId) % colors.length;
  return colors[index || 0];
};

export default PlayerSetup;