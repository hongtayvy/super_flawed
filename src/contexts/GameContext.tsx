// ✅ Updated GameContext.tsx
import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction, useEffect } from 'react';
import { PlayerInfoType, PlayerType, CardType, CurrentRoundType, WinnerType } from '../types/game';
import { blackCards, whiteCards } from '../utils/cardDecks';
import { socket } from '../socket';

interface GameContextType {
  playerInfo: PlayerInfoType;
  setPlayerInfo: Dispatch<SetStateAction<PlayerInfoType>>;
  players: PlayerType[];
  addPlayer: (player: PlayerType) => void;
  setPlayers: Dispatch<SetStateAction<PlayerType[]>>;
  resetPlayers: () => void;
  resetGame: () => void;
  gameState: string;
  currentRound: CurrentRoundType;
  initializeGame: (gameCode: string) => void;
  selectCard: (index: number) => void;
  submitSelection: (playerId: string, cardIndex: number | null, cardOverride?: CardType) => void;
  selectWinningSubmission: (playerId: string) => void;
  selectWinner: (playerId: string) => void;
  nextRound: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [playerInfo, setPlayerInfo] = useState<PlayerInfoType>(() => {
    const id = crypto.randomUUID();
    return { id, name: '', avatar: '0', isHost: false };
  });

  const [players, setPlayers] = useState<PlayerType[]>([]);
  const [gameState, setGameState] = useState<string>('idle');
  const [activeGameCode, setActiveGameCode] = useState<string | null>(null);

  const [currentRound, setCurrentRound] = useState<CurrentRoundType>({
    roundNumber: 1,
    cardCzarId: '',
    isCardCzar: false,
    blackCard: { id: '', text: '' },
    hand: [],
    selectedCardIndex: null,
    submissions: [],
    winner: null,
  });

  useEffect(() => {
    if (playerInfo.name && playerInfo.id && !players.some(p => p.id === playerInfo.id)) {
      const newPlayer: PlayerType = {
        id: playerInfo.id,
        name: playerInfo.name,
        avatar: playerInfo.avatar,
        isHost: playerInfo.isHost,
        score: 0,
        isReady: true,
        isBot: false
      };
      setPlayers(prev => [...prev, newPlayer]);
    }
  }, [playerInfo, players]);

  useEffect(() => {
    socket.on('update-submissions', ({ gameCode, submissions }) => {
      if (gameCode !== activeGameCode) return;
      setCurrentRound(prev => ({ ...prev, submissions }));
    });

    socket.on('update-winner', ({ gameCode, winner }) => {
      if (gameCode !== activeGameCode) return;
      setCurrentRound(prev => ({ ...prev, winner }));
      setGameState('roundEnd');
    });

    return () => {
      socket.off('update-submissions');
      socket.off('update-winner');
    };
  }, [activeGameCode]);

  const initializeGame = (gameCode: string) => {
    setActiveGameCode(gameCode);

    const cardCzarId = players[0]?.id || '';
    const isCardCzar = cardCzarId === playerInfo.id;
    const blackCard = blackCards[Math.floor(Math.random() * blackCards.length)];

    const dealtCards: CardType[] = [];
    const usedIndices = new Set<number>();

    while (dealtCards.length < 7) {
      const randomIndex = Math.floor(Math.random() * whiteCards.length);
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex);
        dealtCards.push(whiteCards[randomIndex]);
      }
    }

    setGameState('selecting');
    setCurrentRound({
      roundNumber: 1,
      cardCzarId,
      isCardCzar,
      blackCard,
      hand: dealtCards,
      selectedCardIndex: null,
      submissions: [],
      winner: null,
    });
  };

  const selectCard = (index: number) => {
    if (currentRound.isCardCzar || gameState !== 'selecting') return;
    setCurrentRound(prev => ({ ...prev, selectedCardIndex: index }));
  };

  const submitSelection = (playerId: string, cardIndex: number | null, cardOverride?: CardType) => {
    if (!activeGameCode) return;

    const card = cardOverride ?? (cardIndex !== null ? currentRound.hand[cardIndex] : null);
    if (!card) return;

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const newSubmission = { playerId, playerName: player.name, card };

    const existingIndex = currentRound.submissions.findIndex(s => s.playerId === playerId);
    const newSubmissions = [...currentRound.submissions];

    if (existingIndex >= 0) newSubmissions[existingIndex] = newSubmission;
    else newSubmissions.push(newSubmission);

    setCurrentRound(prev => ({ ...prev, submissions: newSubmissions }));
    socket.emit('update-submissions', { gameCode: activeGameCode, submissions: newSubmissions });

    if (newSubmissions.length === players.length - 1) {
      setGameState('judging');
    }
  };

  const selectWinner = (playerId: string) => {
    if (!activeGameCode) return;

    const winning = currentRound.submissions.find(s => s.playerId === playerId);
    if (!winning) return;

    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, score: p.score + 1 } : p));

    const winner: WinnerType = {
      playerId,
      playerName: winning.playerName,
      card: winning.card,
    };

    setCurrentRound(prev => ({ ...prev, winner }));
    setGameState('roundEnd');
    socket.emit('update-winner', { gameCode: activeGameCode, winner });
  };

  const selectWinningSubmission = (playerId: string) => {
    if (!currentRound.isCardCzar || gameState !== 'judging') return;
    selectWinner(playerId);
  };

  const nextRound = () => {
    const currentIndex = players.findIndex(p => p.id === currentRound.cardCzarId);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextCzarId = players[nextIndex]?.id || '';
    const isCardCzar = nextCzarId === playerInfo.id;
    const blackCard = blackCards[Math.floor(Math.random() * blackCards.length)];

    let newHand = [...currentRound.hand];

    if (currentRound.selectedCardIndex !== null && !currentRound.isCardCzar) {
      let attempts = 0;
      while (attempts < 20) {
        const newCard = whiteCards[Math.floor(Math.random() * whiteCards.length)];
        if (!newHand.some(card => card.id === newCard.id)) {
          newHand[currentRound.selectedCardIndex] = newCard;
          break;
        }
        attempts++;
      }
    }

    setGameState('selecting');
    setCurrentRound({
      roundNumber: currentRound.roundNumber + 1,
      cardCzarId: nextCzarId,
      isCardCzar,
      blackCard,
      hand: newHand,
      selectedCardIndex: null,
      submissions: [],
      winner: null,
    });
  };

  const resetPlayers = () => setPlayers([]);

  const resetGame = () => {
    setPlayerInfo(() => ({ id: crypto.randomUUID(), name: '', avatar: '0', isHost: false }));
    setPlayers([]);
    setGameState('idle');
    setActiveGameCode(null);
    setCurrentRound({
      roundNumber: 1,
      cardCzarId: '',
      isCardCzar: false,
      blackCard: { id: '', text: '' },
      hand: [],
      selectedCardIndex: null,
      submissions: [],
      winner: null,
    });
  };

  const addPlayer = (player: PlayerType) => {
    setPlayers(prev => prev.some(p => p.id === player.id) ? prev : [...prev, player]);
  };

  return (
    <GameContext.Provider
      value={{
        playerInfo,
        setPlayerInfo,
        players,
        addPlayer,
        setPlayers,
        resetPlayers,
        resetGame,
        gameState,
        currentRound,
        initializeGame,
        selectCard,
        submitSelection,
        selectWinningSubmission,
        selectWinner,
        nextRound,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within a GameProvider');
  return context;
};