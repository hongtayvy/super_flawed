import React, { useState } from 'react';
import Button from '../ui/Button';
import { getAvatarColor } from '../../utils/avatar';

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
      onSubmit(name, selectedAvatar);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="playerName" className="field-label">
          Your Name
        </label>
        <input
          type="text"
          id="playerName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="field"
          required
        />
      </div>
      
      <div>
        <label className="field-label">
          Pick your hero color
        </label>
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((avatarId) => (
            <button
              key={avatarId}
              type="button"
              onClick={() => setSelectedAvatar(avatarId.toString())}
              className={`w-12 h-12 rounded-full border-[3px] border-ink flex items-center justify-center text-xl font-black transition-transform ${
                selectedAvatar === avatarId.toString() 
                  ? 'scale-110 shadow-pop-sm' 
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
        className="w-full mt-4"
        disabled={!name.trim()}
      >
        {buttonText}
      </Button>
    </form>
  );
};

export default PlayerSetup;