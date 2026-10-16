export interface Card {
  id: string;
  text: string;
}

export type PowerKind = 'power' | 'wildcard';

export interface PowerCard extends Card {
  kind: PowerKind;
}

export type Phase = 'lobby' | 'twist' | 'wildcard' | 'choosing' | 'submitting' | 'voting' | 'judging' | 'target' | 'roundEnd' | 'gameOver';

export interface Player {
  id: string; // persistent player ID, separate from the socket ID
  name: string;
  avatar: string;
  isHost: boolean;
  isBot: boolean;
  isReady: boolean;
  score: number;
  socketId: string | null;
  connected: boolean;
  disconnectedAt: number | null;
  left: boolean; // explicitly left mid-game: skipped every round, never removed
}

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

export interface EntryView {
  id: string;
  text: string;
  mine: boolean;
  // Present only once authors may be seen (after judging, or on Unmasked rounds).
  authorIds?: string[];
  authorNames?: string[];
  votes?: number; // shown once a group vote is over
}

export interface RoundView {
  number: number;
  judgeId: string;
  // Null while a Plot Twist is on the table and the next power card has not been drawn yet.
  power: PowerCard | null;
  power2: PowerCard | null; // Crossover Event
  twist: {
    id: string;
    name: string;
    description: string;
    judgingPrompt?: string;
    judgePicksCards: boolean;
    groupVote: boolean;
  } | null;
  pass: number; // Time Loop plays the same power more than once
  passes: number;
  roundValue: number;
  submittedIds: string[];
  skippedIds: string[];
  deadline: number | null;
  // Anonymous during judging. Authors are only revealed once the round ends.
  entries: EntryView[];
  // Breaking the Fourth Wall: only the judge sees this. Every other player's hand, to pick from.
  choosing: { playerId: string; name: string; cards: Card[] }[] | null;
  // Group vote (Breaking the Fourth Wall).
  votedIds: string[];
  myVote: string | null;
  tiebreak: string[] | null; // entry ids the judge must choose between after a tied vote
  target: { prompt: string; eligibleIds: string[]; pick: 'player' | 'entry'; chooserId: string } | null;
  // authorIds is empty while a winner is kept secret (Sequel Bait, until the sequel is over).
  result: { awards: { text: string; authorIds: string[]; label?: string }[]; note: string } | null;
}
