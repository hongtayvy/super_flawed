import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
  useEffect,
} from 'react';
import {
  PlayerInfoType,
  PlayerType,
  CardType,
  CurrentRoundType,
  WinnerType,
} from '../types/game';
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

// 🔁 Helper to deal 7 random white cards
const dealWhiteCards = (): CardType[] => {
  const hand: CardType[] = [];
  const used = new Set<number>();
  while (hand.length < 7) {
    const idx = Math.floor(Math.random() * whiteCards.length);
    if (!used.has(idx)) {
      used.add(idx);
      hand.push(whiteCards[idx]);
    }
  }
  return hand;
};

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [playerInfo, setPlayerInfo] = useState<PlayerInfoType>(() => {
    const id = crypto.randomUUID();
    return { id, name: '', avatar: '0', isHost: false };
  });

  const [players, setPlayers] = useState<PlayerType[]>([]);
  const [gameCode, setGameCode] = useState('');
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
    if (
      playerInfo.name &&
      playerInfo.id &&
      !players.some((p) => p.id === playerInfo.id)
    ) {
      const newPlayer: PlayerType = {
        id: playerInfo.id,
        name: playerInfo.name,
        avatar: playerInfo.avatar,
        isHost: playerInfo.isHost,
        score: 0,
        isReady: true,
        isBot: false,
      };
      setPlayers((prev) => [...prev, newPlayer]);
    }
  }, [playerInfo, players]);

  useEffect(() => {
    socket.on('update-submissions', (newSubmissions: CurrentRoundType['submissions']) => {
      setCurrentRound((prev) => ({ ...prev, submissions: newSubmissions }));
    });

    socket.on('update-winner', (winner: WinnerType) => {
      setCurrentRound((prev) => ({ ...prev, winner }));
      setGameState('roundEnd');
    });

    socket.on('start-round', ({ round, hands, scores }) => {
      const isCardCzar = round.cardCzarId === playerInfo.id;
      const myHand = hands[playerInfo.id] || [];

      setPlayers((prev) =>
        prev.map((p) => ({
          ...p,
          score: scores[p.id] ?? p.score,
        }))
      );

      setCurrentRound({
        ...round,
        isCardCzar,
        hand: myHand,
        selectedCardIndex: null,
        submissions: [],
        winner: null,
      });

      setGameState('selecting');
    });

    return () => {
      socket.off('update-submissions');
      socket.off('update-winner');
      socket.off('start-round');
    };
  }, [playerInfo.id]);

  const initializeGame = (code: string) => {
    setGameCode(code);

    const cardCzarId = players[0]?.id || '';
    const isCardCzar = cardCzarId === playerInfo.id;
    const blackCard = blackCards[Math.floor(Math.random() * blackCards.length)];

    const hands: Record<string, CardType[]> = {};
    const scores: Record<string, number> = {};

    players.forEach((p) => {
      hands[p.id] = dealWhiteCards();
      scores[p.id] = p.score;
    });

    const newRound = {
      roundNumber: 1,
      cardCzarId,
      isCardCzar,
      blackCard,
      hand: hands[playerInfo.id],
      selectedCardIndex: null,
      submissions: [],
      winner: null,
    };

    setCurrentRound(newRound);
    setGameState('selecting');

    if (playerInfo.isHost) {
      socket.emit('start-round', {
        gameCode: code,
        round: { ...newRound, hand: [] },
        hands,
        scores,
      });
    }
  };

  const selectCard = (index: number) => {
    if (currentRound.isCardCzar || gameState !== 'selecting') return;
    setCurrentRound((prev) => ({ ...prev, selectedCardIndex: index }));
  };

  const submitSelection = (playerId: string, cardIndex: number | null, cardOverride?: CardType) => {
    const card = cardOverride ?? (cardIndex !== null ? currentRound.hand[cardIndex] : null);
    if (!card) return;

    const player = players.find((p) => p.id === playerId);
    if (!player) return;

    const newSubmission = {
      playerId,
      playerName: player.name,
      card,
    };

    const existingIndex = currentRound.submissions.findIndex((s) => s.playerId === playerId);
    const newSubmissions = [...currentRound.submissions];

    if (existingIndex >= 0) {
      newSubmissions[existingIndex] = newSubmission;
    } else {
      newSubmissions.push(newSubmission);
    }

    setCurrentRound((prev) => ({ ...prev, submissions: newSubmissions }));
    socket.emit('update-submissions', newSubmissions);

    if (newSubmissions.length === players.length - 1) {
      setGameState('judging');
    }
  };

  const selectWinningSubmission = (playerId: string) => {
    if (!currentRound.isCardCzar || gameState !== 'judging') return;
    selectWinner(playerId);
  };

  const selectWinner = (playerId: string) => {
    const winningSubmission = currentRound.submissions.find((s) => s.playerId === playerId);
    if (!winningSubmission) return;

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId ? { ...player, score: player.score + 1 } : player
      )
    );

    const winner: WinnerType = {
      playerId,
      playerName: winningSubmission.playerName,
      card: winningSubmission.card,
    };

    setCurrentRound((prev) => ({
      ...prev,
      winner,
    }));

    setGameState('roundEnd');
    socket.emit('update-winner', winner);
  };

  const nextRound = () => {
    if (!gameCode) return;

    const currentCzarIndex = players.findIndex((p) => p.id === currentRound.cardCzarId);
    const nextCzarIndex = (currentCzarIndex + 1) % players.length;
    const nextCardCzarId = players[nextCzarIndex]?.id || '';
    const blackCard = blackCards[Math.floor(Math.random() * blackCards.length)];

    const hands: Record<string, CardType[]> = {};
    const scores: Record<string, number> = {};

    players.forEach((p) => {
      hands[p.id] = dealWhiteCards();
      scores[p.id] = p.score;
    });

    const newRound = {
      roundNumber: currentRound.roundNumber + 1,
      cardCzarId: nextCardCzarId,
      isCardCzar: nextCardCzarId === playerInfo.id,
      blackCard,
      hand: hands[playerInfo.id],
      selectedCardIndex: null,
      submissions: [],
      winner: null,
    };

    setCurrentRound(newRound);
    setGameState('selecting');

    if (playerInfo.isHost) {
      socket.emit('start-round', {
        gameCode,
        round: { ...newRound, hand: [] },
        hands,
        scores,
      });
    }
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
    setGameCode('');
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
    setPlayers((prev) => {
      if (prev.some((p) => p.id === player.id)) return prev;
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