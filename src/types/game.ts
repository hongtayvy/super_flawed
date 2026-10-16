// Wire types: keep in sync with server/src/types.ts
export interface Card {
  id: string;
  text: string;
}

export type PowerKind = 'power' | 'wildcard';

export interface PowerCard extends Card {
  kind: PowerKind;
}

export type Phase = 'lobby' | 'twist' | 'wildcard' | 'submitting' | 'judging' | 'target' | 'roundEnd' | 'gameOver';

// What a client is allowed to see. Never includes other players' hands or
// the authors of flaws before judging is over.
export interface PublicPlayer {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isBot: boolean;
  isReady: boolean;
  score: number;
  connected: boolean;
}

export interface RoomState {
  gameCode: string;
  phase: Phase;
  you: string;
  players: PublicPlayer[];
  settings: { timerSeconds: number; timerOptions: number[] };
  rules: { winScore: number; minPlayers: number; maxPlayers: number };
  hand: Card[];
  round: RoundView | null;
  gameWinnerId: string | null;
}

export interface RoundView {
  number: number;
  judgeId: string;
  // Null while a Plot Twist is on the table and the next power card has not been drawn yet.
  power: PowerCard | null;
  twist: { id: string; name: string; description: string; judgingPrompt?: string } | null;
  roundValue: number;
  submittedIds: string[];
  skippedIds: string[];
  deadline: number | null;
  // Anonymous during judging. Authors are only revealed once the round ends.
  entries: { id: string; text: string; mine: boolean; playerId?: string; playerName?: string }[];
  target: { prompt: string; eligibleIds: string[] } | null;
  result: { winnerId: string | null; winnerText: string | null; note: string } | null;
}
