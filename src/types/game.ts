export interface PlayerType {
  isBot: boolean;
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  score: number;
  isReady: boolean;
}

export interface CardType {
  id: string;
  text: string;
}

export interface SubmissionType {
  playerId: string;
  playerName: string;
  card: CardType;
}

export interface WinnerType {
  playerId: string;
  playerName: string;
  card: CardType;
}

export interface CurrentRoundType {
  roundNumber: number;
  cardCzarId: string;
  isCardCzar: boolean;
  blackCard: CardType;
  hand: CardType[];
  selectedCardIndex: number | null;
  submissions: SubmissionType[];
  winner: WinnerType | null;
}

export interface PlayerInfoType {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
}

export interface GameChatProps {
  gameId: string;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}