import React, { createContext, useContext, useState, ReactNode, Dispatch, SetStateAction, useEffect } from 'react';
import { PlayerType, CardType, CurrentRoundType } from '../types/game';
import { blackCards, whiteCards } from '../utils/cardDecks';

interface PlayerInfoType {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
}

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
      };
      setPlayers(prev => [...prev, newPlayer]);
    }
  }, [playerInfo, players]);

  const initializeGame = (gameCode: string) => {
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
    const card = cardOverride ?? (cardIndex !== null ? currentRound.hand[cardIndex] : null);
    if (!card) return;

    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const newSubmission = {
      playerId,
      playerName: player.name,
      card,
    };

    const existingSubmissionIndex = currentRound.submissions.findIndex(s => s.playerId === playerId);
    const newSubmissions = [...currentRound.submissions];

    if (existingSubmissionIndex >= 0) {
      newSubmissions[existingSubmissionIndex] = newSubmission;
    } else {
      newSubmissions.push(newSubmission);
    }

    setCurrentRound(prev => ({ ...prev, submissions: newSubmissions }));

    if (newSubmissions.length === players.length - 1) {
      setGameState('judging');
    }
  };

  const selectWinningSubmission = (playerId: string) => {
    if (!currentRound.isCardCzar || gameState !== 'judging') return;
    selectWinner(playerId);
  };

  const selectWinner = (playerId: string) => {
    const winningSubmission = currentRound.submissions.find(s => s.playerId === playerId);
    if (!winningSubmission) return;

    setPlayers(prev =>
      prev.map(player =>
        player.id === playerId ? { ...player, score: player.score + 1 } : player
      )
    );

    setCurrentRound(prev => ({
      ...prev,
      winner: {
        playerId,
        playerName: winningSubmission.playerName,
        card: winningSubmission.card,
      },
    }));

    setGameState('roundEnd');
  };

  const nextRound = () => {
    const currentCzarIndex = players.findIndex(p => p.id === currentRound.cardCzarId);
    const nextCzarIndex = (currentCzarIndex + 1) % players.length;
    const nextCardCzarId = players[nextCzarIndex]?.id || '';
    const isCardCzar = nextCardCzarId === playerInfo.id;
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
      cardCzarId: nextCardCzarId,
      isCardCzar,
      blackCard,
      hand: newHand,
      selectedCardIndex: null,
      submissions: [],
      winner: null,
    });
  };

  const resetPlayers = () => {
    setPlayers([]);
  };

  const resetGame = () => {
    setPlayerInfo(() => {
      const id = crypto.randomUUID();
      return { id, name: '', avatar: '0', isHost: false };
    });
    setPlayers([]);
    setGameState('idle');
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
    setPlayers(prev => {
      if (prev.some(p => p.id === player.id)) return prev;
      return [...prev, player];
    });
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
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
