import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GameRoom from './pages/GameRoom';
import Lobby from './pages/Lobby';
import { GameProvider } from './contexts/GameContext';
import Header from './components/layout/Header';
import { Toaster } from './components/ui/Toaster';

function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
          <Header />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/lobby" element={<Lobby />} />
              <Route path="/game/:gameId" element={<GameRoom />} />
            </Routes>
          </main>
          <Toaster />
        </div>
      </GameProvider>
    </BrowserRouter>
  );
}

export default App;