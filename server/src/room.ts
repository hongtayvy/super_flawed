import { randomUUID } from 'crypto';
import type { Server } from 'socket.io';
import { config } from './config';
import { Deck, shuffle } from './deck';
import { FLAW_CARDS, POWER_CARDS, WILDCARD } from './cards';
import { TWISTS, TwistDef } from './twists';
import type { Card, EntryView, Phase, Player, PowerCard, PublicPlayer, RoomState, RoundView } from './types';

type DeckEntry = { kind: 'card'; card: PowerCard } | { kind: 'twist'; twist: TwistDef };

interface Submission {
  card: Card;
}

interface Entry {
  id: string; // opaque per-round ID so the judge never sees player IDs
  authorIds: string[]; // more than one on Team Up; they all score together
  text: string;
  cards: Card[];
}

interface Award {
  text: string;
  authorIds: string[];
  label?: string; // e.g. "Round 3" when one result lists several rounds
}

interface Round {
  number: number;
  judgeId: string;
  power: PowerCard | null; // null until drawn: a Plot Twist is revealed first, then the next power
  power2: PowerCard | null; // Crossover Event
  twist: TwistDef | null;
  drawn: DeckEntry[];
  roundValue: number;
  pass: number;
  passes: number;
  awards: Award[];
  notes: string[]; // twist effects to show in the round result
  submissions: Map<string, Submission>;
  skipped: Set<string>;
  entries: Entry[];
  deadline: number | null;
  winningEntryId: string | null;
  target: { prompt: string; eligibleIds: string[]; pick: 'player' | 'entry'; chooserId: string } | null;
  // Group vote (Judge-ivine Intervention)
  votes: Map<string, string>; // voter id -> entry id
  voteSkipped: Set<string>;
  voteCounts: Map<string, number> | null; // set once the vote is tallied
  tiebreak: string[] | null; // entries the judge must choose between after a tied vote
  replay: boolean; // Sequel Bait: this round replays last round's power and flaws
  // Sequel Bait: last round's winner, picked but not yet scored or revealed.
  carriedAwards: Award[];
  result: { awards: Award[]; note: string } | null;
}

const BOTS = [
  { id: 'bot-yeng', name: 'Yeng Chang', avatar: '2' },
  { id: 'bot-rinci', name: 'Rinci', avatar: '4' },
  { id: 'bot-tyoua', name: 'Tyoua', avatar: '3' },
  { id: 'bot-neek', name: 'Neek', avatar: '5' },
];

const BOT_WILDCARDS = [
  'You can turn any sandwich into a loyal pet.',
  'You can talk to the moon, and it talks back.',
  'You can make any song stuck in anyone\'s head.',
  'You can summon a very polite thunderstorm.',
  'You can make clouds do whatever you say.',
];

// Team Up: join flaws into one ("But A. And B.").
const combineFlaws = (texts: string[]) =>
  [texts[0], ...texts.slice(1).map((t) => `And ${t.replace(/^But /, '')}`)].join(' ');

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export class Room {
  readonly code: string;
  phase: Phase = 'lobby';
  players = new Map<string, Player>();
  settings = { timerSeconds: 0 };
  lastActivity = Date.now();

  private hands = new Map<string, Card[]>();
  private queue: string[] = []; // judge queue; refilled once everyone has judged
  private flawDeck = new Deck<Card>(FLAW_CARDS);
  private powerDeck = new Deck<DeckEntry>(Room.buildPowerDeck());
  private round: Round | null = null;
  private roundCounter = 0;
  private gameWinnerId: string | null = null;
  // Sequel Bait: the power (and its deck entry) the next round replays.
  private carry: { power: PowerCard; entry: DeckEntry; flaws: [string, Card][]; awards: Award[] } | null = null;

  private phaseTimers = new Set<NodeJS.Timeout>();
  private graceTimers = new Map<string, NodeJS.Timeout>();
  private lobbyTimers = new Map<string, NodeJS.Timeout>();
  private roundEndTimer: NodeJS.Timeout | null = null;
  private resumeNextRound = false;

  private hostTimer: NodeJS.Timeout | null = null;
  private closed = false;

  // `onEmpty` is called once the last human has left, so the room can be closed.
  constructor(code: string, private io: Server, private onEmpty: () => void = () => {}) {
    this.code = code;
  }

  // Plot Twists and the Wildcards are shuffled into the one Super Power deck.
  private static buildPowerDeck(): DeckEntry[] {
    return [
      ...POWER_CARDS.map((card): DeckEntry => ({ kind: 'card', card })),
      ...Array.from({ length: config.wildcardCopies }, (): DeckEntry => ({ kind: 'card', card: WILDCARD })),
      ...TWISTS.flatMap((twist): DeckEntry[] =>
        Array.from({ length: twist.weight ?? 1 }, () => ({ kind: 'twist', twist })),
      ),
    ];
  }

  // ---------- players & connections ----------

  addPlayer(name: string, avatar: string, isHost: boolean): Player {
    const player: Player = {
      id: randomUUID(),
      name,
      avatar,
      isHost,
      isBot: false,
      isReady: isHost,
      score: 0,
      socketId: null,
      connected: false,
      disconnectedAt: null,
      left: false,
    };
    this.players.set(player.id, player);
    return player;
  }

  get humans() {
    return [...this.players.values()].filter((p) => !p.isBot);
  }

  get hasConnectedHumans() {
    return this.humans.some((p) => p.connected);
  }

  attach(playerId: string, socketId: string) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = null;
    player.left = false;
    this.lastActivity = Date.now();

    this.clearTimer(this.graceTimers, playerId);
    this.clearTimer(this.lobbyTimers, playerId);
    if (player.isHost && this.hostTimer) {
      clearTimeout(this.hostTimer);
      this.hostTimer = null;
    }

    if (this.resumeNextRound) {
      this.resumeNextRound = false;
      this.scheduleNextRound();
    }
    this.broadcast();
  }

  detach(socketId: string) {
    const player = [...this.players.values()].find((p) => p.socketId === socketId);
    if (!player) return;
    player.socketId = null;
    player.connected = false;
    player.disconnectedAt = Date.now();
    this.lastActivity = Date.now();

    if (player.isHost) this.scheduleHostHandover(player.id);
    if (this.phase === 'lobby') {
      this.scheduleLobbyRemoval(player.id);
    } else {
      this.checkBlockers();
    }
    this.broadcast();
  }

  // Explicit "Leave" button. In the lobby the player is removed; in a game they
  // stay in the player list and are skipped each round.
  leave(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;
    if (this.phase === 'lobby') {
      this.removePlayer(playerId);
    } else {
      player.socketId = null;
      player.connected = false;
      player.left = true;
      player.disconnectedAt = Date.now() - config.reconnectGraceMs;
      this.checkBlockers();
    }
    this.afterDeparture();
    if (this.present.length) this.broadcast();
  }

  // Humans still in the room: not removed and not having pressed Leave.
  private get present() {
    return this.humans.filter((p) => !p.left);
  }

  // Hand the host role to the next human in join order when the host is gone (or has
  // been disconnected for good), and close the room once the last human has left.
  private afterDeparture(forceFrom?: string) {
    if (!this.present.length) {
      if (!this.closed) {
        this.closed = true;
        this.dispose();
        this.onEmpty();
      }
      return;
    }
    const host = this.humans.find((p) => p.isHost);
    const gone = !host || host.left || host.id === forceFrom;
    if (!gone) return;
    const next = this.present.find((p) => p.id !== host?.id && p.connected) ?? this.present.find((p) => p.id !== host?.id);
    if (!next) return;
    if (host) host.isHost = false;
    next.isHost = true;
    next.isReady = true;
  }

  // A host who stays disconnected through the grace period passes the role on.
  private scheduleHostHandover(hostId: string) {
    if (this.hostTimer) clearTimeout(this.hostTimer);
    this.hostTimer = setTimeout(() => {
      this.hostTimer = null;
      const p = this.players.get(hostId);
      if (!p || p.connected || !p.isHost) return;
      this.afterDeparture(hostId);
      this.broadcast();
    }, config.reconnectGraceMs);
  }

  private scheduleLobbyRemoval(playerId: string) {
    this.clearTimer(this.lobbyTimers, playerId);
    const timer = setTimeout(() => {
      this.lobbyTimers.delete(playerId);
      const p = this.players.get(playerId);
      if (p && !p.connected && this.phase === 'lobby') {
        this.removePlayer(playerId);
        if (this.present.length) this.broadcast();
      }
    }, config.reconnectGraceMs);
    this.lobbyTimers.set(playerId, timer);
  }

  private removePlayer(playerId: string) {
    this.players.delete(playerId);
    this.hands.delete(playerId);
    this.afterDeparture();
  }

  // ---------- lobby ----------

  setReady(playerId: string, isReady: boolean) {
    const p = this.players.get(playerId);
    if (!p || this.phase !== 'lobby') return;
    p.isReady = isReady;
    this.broadcast();
  }

  toggleBots(playerId: string) {
    if (!this.isHost(playerId) || this.phase !== 'lobby') return;
    const hasBots = [...this.players.values()].some((p) => p.isBot);
    if (hasBots) {
      for (const p of [...this.players.values()]) if (p.isBot) this.players.delete(p.id);
    } else {
      for (const b of BOTS) {
        if (this.players.size >= config.maxPlayers) break;
        this.players.set(b.id, {
          id: b.id,
          name: b.name,
          avatar: b.avatar,
          isHost: false,
          isBot: true,
          isReady: true,
          score: 0,
          socketId: null,
          connected: true,
          disconnectedAt: null,
          left: false,
        });
      }
    }
    this.broadcast();
  }

  setTimerSeconds(playerId: string, seconds: number) {
    if (!this.isHost(playerId) || this.phase !== 'lobby') return;
    if (!config.timerOptions.includes(seconds)) return;
    this.settings.timerSeconds = seconds;
    this.broadcast();
  }

  start(playerId: string): string | null {
    if (!this.isHost(playerId)) return 'Only the host can start the game.';
    if (this.phase !== 'lobby') return 'The game has already started.';
    if (this.players.size < config.minPlayers) return `Need at least ${config.minPlayers} players.`;
    if (this.players.size > config.maxPlayers) return `At most ${config.maxPlayers} players.`;
    if (![...this.players.values()].every((p) => p.isReady || p.isHost)) return 'Everyone needs to be ready.';
    this.beginGame();
    return null;
  }

  playAgain(playerId: string) {
    if (!this.isHost(playerId) || this.phase !== 'gameOver') return;
    this.clearAllTimers();
    this.flawDeck = new Deck<Card>(FLAW_CARDS);
    this.powerDeck = new Deck<DeckEntry>(Room.buildPowerDeck());
    this.hands.clear();
    this.queue = [];
    this.round = null;
    this.roundCounter = 0;
    this.gameWinnerId = null;
    this.carry = null;
    this.phase = 'lobby';
    for (const p of this.players.values()) {
      p.score = 0;
      p.isReady = p.isHost || p.isBot;
    }
    this.broadcast();
  }

  private beginGame() {
    for (const p of this.players.values()) {
      p.score = 0;
      this.hands.set(p.id, []);
      this.refillHand(p.id);
    }
    this.queue = [];
    this.roundCounter = 0;
    this.startRound();
  }

  // ---------- round flow ----------

  private startRound() {
    this.clearPhaseTimers();
    const judgeId = this.nextJudge();

    // Sequel Bait: replay last round's power and flaws. No draw, and no twist this time.
    // Otherwise a Plot Twist is its own card: if it comes up it is shown alone,
    // and only then is the next power card drawn. A twist that needs more players
    // than are in the room is put back and redrawn.
    const replay = this.carry;
    this.carry = null;
    const size = this.players.size;
    const first = replay
      ? replay.entry
      : this.drawUntil((e) => e.kind === 'card' || (e.twist.minPlayers ?? 0) <= size);
    const twist = !replay && first.kind === 'twist' ? first.twist : null;

    this.roundCounter += 1;
    this.round = {
      number: this.roundCounter,
      judgeId,
      power: replay ? replay.power : first.kind === 'card' ? first.card : null,
      power2: null,
      twist,
      drawn: [first],
      roundValue: twist?.roundValue ?? 1,
      pass: 1,
      passes: twist?.passes ?? 1,
      awards: [],
      notes: [],
      submissions: new Map(),
      skipped: new Set(),
      entries: [],
      deadline: null,
      winningEntryId: null,
      target: null,
      votes: new Map(),
      voteSkipped: new Set(),
      voteCounts: null,
      tiebreak: null,
      replay: Boolean(replay),
      carriedAwards: replay ? replay.awards : [],
      result: null,
    };

    if (replay) this.beginReplay(replay.flaws);
    else if (twist) this.beginTwistReveal();
    else this.beginPower();
  }

  // The same flaws are judged again, by the new judge. Their own flaw sits this one out.
  private beginReplay(flaws: [string, Card][]) {
    const round = this.round!;
    for (const [playerId, card] of flaws) {
      if (playerId === round.judgeId) this.flawDeck.discard([card]);
      else round.submissions.set(playerId, { card });
    }
    if (round.submissions.size === 0) {
      // Nothing to replay: reveal and score last round's hidden winner now.
      const applied = this.applyCarriedAwards(round);
      if (applied.length) round.notes.push(`Last round's winner was ${this.names(applied[0].authorIds)}.`);
      this.beginSubmitting();
    } else {
      this.startJudging();
      this.broadcast();
    }
  }

  private beginTwistReveal() {
    this.clearPhaseTimers();
    this.phase = 'twist';
    this.broadcast();
    this.scheduleBots(); // a bot judge flips the next power card itself
  }

  // The judge flips the next card once everyone has read the twist. A twist is never
  // drawn straight after another one: reshuffle and redraw so a round never stacks two.
  revealPower(playerId: string): string | null {
    const round = this.round;
    if (this.phase !== 'twist' || !round) return 'There is no Plot Twist to move past.';
    if (playerId !== round.judgeId) return 'Only the judge flips the next power card.';
    this.drawPowerAfterTwist();
    return null;
  }

  private drawPowerAfterTwist() {
    const round = this.round;
    if (this.phase !== 'twist' || !round) return;
    const entry = this.drawUntil((e) => e.kind === 'card');
    round.drawn.push(entry);
    round.power = (entry as { kind: 'card'; card: PowerCard }).card;
    this.beginPower();
  }

  // Draw until a card matches, putting back (and reshuffling) any that do not.
  private drawUntil(ok: (e: DeckEntry) => boolean): DeckEntry {
    let entry = this.powerDeck.draw()!;
    for (let guard = 0; !ok(entry) && guard < 100; guard++) {
      this.powerDeck.putBack(entry);
      entry = this.powerDeck.draw()!;
    }
    return entry;
  }

  // Everything a twist changes before flaws are played, then on to the wildcard
  // step or straight to playing flaws.
  private beginPower() {
    const round = this.round!;
    const twist = round.twist;

    if (twist?.extraPower) {
      // Crossover Event: a second, normal power (never a twist or wildcard).
      const entry = this.drawUntil((e) => e.kind === 'card' && e.card.kind === 'power');
      round.drawn.push(entry);
      round.power2 = (entry as { kind: 'card'; card: PowerCard }).card;
    }
    if (twist?.redeal) this.redealHands(twist.redeal);

    if (round.power!.kind === 'wildcard') this.beginWildcard();
    else this.beginSubmitting();
  }

  // Reboot: every deck resets and everyone gets new cards.
  // Multiverse Mixup: hands are pooled and dealt back out.
  private redealHands(mode: 'reset' | 'swap') {
    if (mode === 'reset') {
      for (const id of this.players.keys()) {
        this.flawDeck.discard(this.hands.get(id) ?? []);
        this.hands.set(id, []);
      }
      this.flawDeck.resetAll();
      this.powerDeck.resetAll();
      for (const id of this.players.keys()) this.refillHand(id);
      return;
    }
    const sizes = new Map([...this.players.keys()].map((id) => [id, (this.hands.get(id) ?? []).length]));
    const pool = shuffle([...this.hands.values()].flat());
    for (const [id, size] of sizes) this.hands.set(id, pool.splice(0, size));
  }

  // Wildcard: the judge types the power before anyone plays a flaw.
  private beginWildcard() {
    const round = this.round!;
    this.clearPhaseTimers();
    this.phase = 'wildcard';

    const seconds = this.settings.timerSeconds;
    if (seconds > 0) {
      round.deadline = Date.now() + seconds * 1000;
      // Out of time: the table gets a random power instead of stalling.
      this.later(() => this.applyWildcard(pick(POWER_CARDS).text), seconds * 1000);
    }

    this.checkBlockers();
    this.scheduleBots();
    this.broadcast();
  }

  setWildcard(playerId: string, rawText: string): string | null {
    const round = this.round;
    if (this.phase !== 'wildcard' || !round) return 'No wildcard to fill in.';
    if (playerId !== round.judgeId) return 'Only the judge makes up the power.';
    const text = String(rawText ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < 3 || text.length > 100) return 'Make up a power (3 to 100 characters).';
    this.applyWildcard(text);
    return null;
  }

  private applyWildcard(text: string) {
    const round = this.round;
    if (this.phase !== 'wildcard' || !round?.power) return;
    round.power = { ...round.power, text };
    this.beginSubmitting();
  }

  private beginSubmitting() {
    const round = this.round!;
    if (round.twist?.judgePicksCards) return this.beginChoosing();
    this.clearPhaseTimers();
    this.phase = 'submitting';
    round.deadline = null;

    // Public Service Announcement forces a short limit; otherwise the room's timer applies.
    const seconds = round.twist?.submitSeconds ?? this.settings.timerSeconds;
    if (seconds > 0) {
      round.deadline = Date.now() + seconds * 1000;
      this.later(() => this.onSubmitDeadline(), seconds * 1000);
    }

    this.checkBlockers();
    this.scheduleBots();
    this.broadcast();
  }

  // ---------- Judge-ivine Intervention: the judge picks everyone's flaw ----------

  // Everyone but the judge plays; the judge decides which card from each hand.
  private choosablePlayers(): string[] {
    const round = this.round!;
    return [...this.players.values()]
      .filter((p) => p.id !== round.judgeId && !p.left)
      .map((p) => p.id);
  }

  private beginChoosing() {
    const round = this.round!;
    this.clearPhaseTimers();
    this.phase = 'choosing';
    round.deadline = null;

    const seconds = this.settings.timerSeconds;
    if (seconds > 0) {
      round.deadline = Date.now() + seconds * 1000;
      // Out of time: a random card from each hand is played instead.
      this.later(() => this.finishChoosing(this.randomPicks()), seconds * 1000);
    }
    this.checkBlockers();
    this.scheduleBots();
    this.broadcast();
  }

  private randomPicks(): [string, string][] {
    return this.choosablePlayers().map((id): [string, string] => [id, pick(this.hands.get(id) ?? []).id]);
  }

  // `picks` is one [playerId, cardId] per player the judge is choosing for.
  chooseCards(playerId: string, picks: unknown): string | null {
    const round = this.round;
    if (this.phase !== 'choosing' || !round) return 'Not choosing cards right now.';
    if (playerId !== round.judgeId) return 'Only the judge chooses the cards.';
    if (!Array.isArray(picks)) return 'Pick a card for every player.';

    const wanted = new Set(this.choosablePlayers());
    const chosen = new Map<string, string>();
    for (const p of picks) {
      const target = String(p?.playerId);
      const cardId = String(p?.cardId);
      if (!wanted.has(target)) return 'You cannot choose a card for that player.';
      if (chosen.has(target)) return 'Pick one card per player.';
      if (!(this.hands.get(target) ?? []).some((c) => c.id === cardId)) return 'That card is not in their hand.';
      chosen.set(target, cardId);
    }
    if (chosen.size !== wanted.size) return 'Pick a card for every player.';

    this.finishChoosing([...chosen]);
    return null;
  }

  private finishChoosing(picks: [string, string][]) {
    const round = this.round;
    if (this.phase !== 'choosing' || !round) return;
    for (const [id, cardId] of picks) {
      const hand = this.hands.get(id) ?? [];
      const idx = hand.findIndex((c) => c.id === cardId);
      if (idx === -1) continue;
      const [card] = hand.splice(idx, 1);
      round.submissions.set(id, { card });
    }
    if (round.submissions.size === 0) this.finishRound('Nobody had a flaw to play. Round skipped.');
    else this.startJudging();
    this.broadcast();
  }

  // Strict rotation: next in queue; once everyone has judged the queue resets.
  private nextJudge(): string {
    if (this.queue.length === 0) this.queue = [...this.players.keys()];
    return this.queue.shift()!;
  }

  submit(playerId: string, cardId: string): string | null {
    const round = this.round;
    if (this.phase !== 'submitting' || !round) return 'Not accepting flaws right now.';
    if (playerId === round.judgeId) return 'The judge does not submit a flaw.';
    if (round.twist?.judgePicksCards) return 'The judge chooses your flaw this round.';
    if (round.skipped.has(playerId)) return 'You were skipped this round.';
    if (round.submissions.has(playerId)) return 'You already submitted a flaw.';

    const hand = this.hands.get(playerId) ?? [];
    const idx = hand.findIndex((c) => c.id === cardId);
    if (idx === -1) return 'That card is not in your hand.';

    const [card] = hand.splice(idx, 1);
    round.submissions.set(playerId, { card });
    this.advanceFromSubmitting();
    this.broadcast();
    return null;
  }

  private onSubmitDeadline() {
    const round = this.round;
    if (this.phase !== 'submitting' || !round) return;
    for (const id of this.pendingSubmitters()) round.skipped.add(id);
    this.advanceFromSubmitting();
    this.broadcast();
  }

  private pendingSubmitters(): string[] {
    const round = this.round;
    if (!round) return [];
    return [...this.players.keys()].filter(
      (id) => id !== round.judgeId && !round.skipped.has(id) && !round.submissions.has(id),
    );
  }

  private advanceFromSubmitting() {
    const round = this.round;
    if (this.phase !== 'submitting' || !round) return;
    if (this.pendingSubmitters().length > 0) return;
    if (round.submissions.size === 0) {
      this.finishRound('Nobody submitted a flaw. Round skipped.');
    } else {
      this.startJudging();
    }
  }

  // Turn the submitted flaws into the anonymous entries the judge picks from.
  private buildEntries(round: Round): Entry[] {
    const subs = [...round.submissions];
    const entry = (authorIds: string[]): Entry => {
      const cards = authorIds.map((id) => round.submissions.get(id)!.card);
      return { id: randomUUID().slice(0, 8), authorIds, text: combineFlaws(cards.map((c) => c.text)), cards };
    };

    // Team Up: players are paired at random and each team's flaws combine into one.
    // With an odd number, the last team has three. It needs 4+ flaws to leave a real choice.
    if (round.twist?.teamUp && subs.length >= 4) {
      const ids = shuffle(subs.map(([id]) => id));
      const teams: string[][] = [];
      for (let i = 0; i < ids.length; i += 2) teams.push(ids.slice(i, i + 2));
      if (teams[teams.length - 1].length === 1) teams[teams.length - 2].push(...teams.pop()!);
      return shuffle(teams.map(entry));
    }
    return shuffle(subs.map(([id]) => entry([id])));
  }

  private startJudging() {
    const round = this.round!;
    this.clearPhaseTimers();
    round.entries = this.buildEntries(round);
    round.deadline = null;

    if (round.twist?.groupVote) {
      if (round.entries.length > 1) return this.beginVoting();
      // Only one flaw was played: nothing to vote on.
      return this.resolveWinner(round.entries[0]);
    }
    this.phase = 'judging';
    this.checkBlockers();
    this.scheduleBots();
  }

  // ---------- group vote (Judge-ivine Intervention) ----------

  private beginVoting() {
    const round = this.round!;
    this.phase = 'voting';
    round.votes = new Map();
    round.voteSkipped = new Set();
    round.tiebreak = null;

    const seconds = this.settings.timerSeconds;
    if (seconds > 0) {
      round.deadline = Date.now() + seconds * 1000;
      this.later(() => this.onVoteDeadline(), seconds * 1000);
    }
    this.checkBlockers();
    this.scheduleBots();
    this.broadcast();
  }

  // The players vote (the judge only decides ties). You cannot vote for your own flaw.
  vote(playerId: string, entryId: string): string | null {
    const round = this.round;
    if (this.phase !== 'voting' || !round) return 'Not voting right now.';
    if (!this.players.has(playerId) || playerId === round.judgeId || round.voteSkipped.has(playerId)) {
      return 'You are not voting this round.';
    }
    const entry = round.entries.find((e) => e.id === entryId);
    if (!entry) return 'Unknown flaw.';
    if (entry.authorIds.includes(playerId)) return 'You cannot vote for your own flaw.';

    round.votes.set(playerId, entryId);
    this.checkVoteDone();
    this.broadcast();
    return null;
  }

  private pendingVoters(): string[] {
    const round = this.round;
    if (!round) return [];
    return [...this.players.keys()].filter(
      (id) => id !== round.judgeId && !round.voteSkipped.has(id) && !round.votes.has(id),
    );
  }

  private checkVoteDone() {
    if (this.phase === 'voting' && this.pendingVoters().length === 0) this.tallyVotes();
  }

  private onVoteDeadline() {
    const round = this.round;
    if (this.phase !== 'voting' || !round) return;
    for (const id of this.pendingVoters()) round.voteSkipped.add(id);
    this.tallyVotes();
    this.broadcast();
  }

  // Most votes wins. If there is a tie, the judge picks between the tied flaws.
  private tallyVotes() {
    const round = this.round!;
    const counts = new Map(round.entries.map((e) => [e.id, 0]));
    for (const [voter, entryId] of round.votes) {
      if (!round.voteSkipped.has(voter)) counts.set(entryId, (counts.get(entryId) ?? 0) + 1);
    }
    round.voteCounts = counts;
    const top = Math.max(...counts.values());
    const tied = round.entries.filter((e) => counts.get(e.id) === top);

    const summary = `Votes: ${[...counts.values()].sort((a, b) => b - a).join(' - ')}.`;
    if (tied.length === 1) {
      round.notes.push(summary);
      return this.resolveWinner(tied[0]);
    }

    if (this.players.get(round.judgeId)?.connected) {
      round.notes.push(`${summary} Tie! The judge picks the winner.`);
      round.tiebreak = tied.map((e) => e.id);
      this.clearPhaseTimers();
      this.phase = 'judging';
      round.deadline = null;
      this.checkBlockers();
      this.scheduleBots();
      this.broadcast();
      return;
    }
    round.notes.push(`${summary} Tie, and the judge is away, so one was picked at random.`);
    this.resolveWinner(pick(tied));
  }

  // The judge picks exactly one winner. No ties.
  pickWinner(playerId: string, entryId: string): string | null {
    const round = this.round;
    if (this.phase !== 'judging' || !round) return 'Not judging right now.';
    if (playerId !== round.judgeId) return 'Only the judge picks the winner.';
    const entry = round.entries.find((e) => e.id === entryId);
    if (!entry) return 'Unknown flaw.';
    if (round.tiebreak && !round.tiebreak.includes(entryId)) return 'Pick one of the tied flaws.';
    this.resolveWinner(entry);
    return null;
  }

  // Score the winning flaw, then run the twist's follow-up (a pick, or an automatic effect).
  private resolveWinner(entry: Entry) {
    const round = this.round!;
    // Sequel Bait keeps the winner secret (and unscored) until the sequel is over.
    if (!round.twist?.replayFlaws) {
      for (const id of entry.authorIds) this.players.get(id)!.score += round.roundValue;
    }
    round.winningEntryId = entry.id;
    round.awards.push({ text: entry.text, authorIds: entry.authorIds });

    // One line per played flaw, so weak cards can be spotted later (win rate per card).
    for (const [authorId, sub] of round.submissions) {
      console.log(
        JSON.stringify({
          evt: 'flaw_result',
          flaw: sub.card.id,
          power: round.power?.id,
          won: entry.authorIds.includes(authorId),
        }),
      );
    }

    const ctx = this.twistContext(round);
    const target = round.twist?.target;
    if (target) {
      const eligibleIds = target.eligible(ctx);
      if (eligibleIds.length === 1) {
        // Only one possible pick: no need to ask anyone.
        round.notes.push(target.apply(ctx, eligibleIds[0]));
      } else if (eligibleIds.length > 1) {
        this.clearPhaseTimers();
        round.target = {
          prompt: target.prompt,
          eligibleIds,
          pick: target.pick ?? 'player',
          chooserId: target.chooser === 'winner' ? entry.authorIds[0] : round.judgeId,
        };
        this.phase = 'target';
        this.checkBlockers();
        this.scheduleBots();
        this.broadcast();
        return;
      }
    }
    const auto = round.twist?.afterWinner?.(ctx);
    if (auto) round.notes.push(auto);
    this.completePass();
  }

  pickTarget(playerId: string, targetId: string): string | null {
    const round = this.round;
    if (this.phase !== 'target' || !round?.target || !round.twist?.target) return 'No target to pick.';
    if (playerId !== round.target.chooserId) {
      return round.twist.target.chooser === 'winner' ? 'Only the winner picks.' : 'Only the judge picks.';
    }
    if (!round.target.eligibleIds.includes(targetId)) return 'That one cannot be picked.';

    round.notes.push(round.twist.target.apply(this.twistContext(round), targetId));
    this.completePass();
    return null;
  }

  private twistContext(round: Round) {
    const entry = round.entries.find((e) => e.id === round.winningEntryId)!;
    return {
      winnerId: entry.authorIds[0],
      scorerIds: entry.authorIds,
      winningEntryId: entry.id,
      judgeId: round.judgeId,
      roundValue: round.roundValue,
      // Player objects are passed directly so a twist can change scores.
      players: [...this.players.values()],
      entries: round.entries.map((e) => ({ id: e.id, authorIds: e.authorIds })),
    };
  }

  // Time Loop plays the same power again; otherwise the round is over.
  private completePass() {
    const round = this.round!;
    if (round.pass < round.passes) this.startNextPass();
    else this.finishRound(null);
  }

  private startNextPass() {
    const round = this.round!;
    this.clearPhaseTimers();
    this.flawDeck.discard([...round.submissions.values()].map((s) => s.card));
    for (const id of this.players.keys()) this.refillHand(id);
    round.pass += 1;
    round.submissions = new Map();
    round.skipped = new Set();
    round.entries = [];
    round.winningEntryId = null;
    round.target = null;
    this.beginSubmitting();
  }

  // Score and hand over last round's hidden Sequel Bait winners (once).
  private applyCarriedAwards(round: Round): Award[] {
    const awards = round.carriedAwards;
    round.carriedAwards = [];
    for (const a of awards) for (const id of a.authorIds) this.players.get(id)!.score += 1;
    return awards;
  }

  private names(ids: string[]) {
    return ids.map((id) => this.players.get(id)?.name ?? '?').join(' & ');
  }

  // `note` is set for rounds that end without a normal result (no flaws, judge left).
  private finishRound(note: string | null) {
    const round = this.round!;
    this.clearPhaseTimers();

    // The sequel finishes last round's deferred score too, and reveals both winners.
    const carried = this.applyCarriedAwards(round);
    const deferred = Boolean(round.twist?.replayFlaws && round.awards.length > 0);

    let headline = note;
    let awards: Award[] = round.awards;
    if (deferred) {
      // Sequel Bait round: authors stay secret until the sequel is over.
      awards = [{ text: round.awards[0].text, authorIds: [] }];
      headline = 'A winning flaw was picked! Who wrote it stays secret until the sequel.';
    } else if (carried.length) {
      awards = [
        ...carried.map((a) => ({ ...a, label: `Round ${round.number - 1}` })),
        ...round.awards.map((a) => ({ ...a, label: `Round ${round.number}` })),
      ];
      headline = awards.map((a) => `${a.label}: ${this.names(a.authorIds)}`).join('. ') + '.';
    } else if (!headline) {
      headline =
        round.awards.length === 1
          ? `${this.names(round.awards[0].authorIds)} win${round.awards[0].authorIds.length > 1 ? '' : 's'} the round!`
          : round.awards.map((a, i) => `Pass ${i + 1}: ${this.names(a.authorIds)}`).join('. ') + '.';
    }
    round.result = { awards, note: [headline, ...round.notes].join(' ') };

    const played = [...round.submissions.values()].map((s) => s.card);
    if (round.twist?.replayFlaws && round.power && round.awards.length > 0) {
      // Sequel Bait: keep the power and this round's flaws out of the discard so the
      // next round can replay them.
      const entry = [...round.drawn].reverse().find((d) => d.kind === 'card')!;
      this.carry = {
        power: round.power,
        entry,
        flaws: [...round.submissions].map(([id, s]): [string, Card] => [id, s.card]),
        awards: round.awards,
      };
      this.powerDeck.discard(round.drawn.filter((d) => d !== entry));
    } else {
      this.flawDeck.discard(played);
      this.powerDeck.discard(round.drawn);
    }
    for (const id of this.players.keys()) this.refillHand(id);

    const winners = this.gameLeaders();
    if (winners) {
      this.gameWinnerId = winners;
      this.phase = 'gameOver';
      this.broadcast();
      return;
    }
    this.phase = 'roundEnd';
    this.scheduleNextRound();
    this.broadcast();
  }

  // Game ends once someone has reached the win score with a clear lead.
  // If the top spot is tied the game keeps going until it is broken.
  private gameLeaders(): string | null {
    const sorted = [...this.players.values()].sort((a, b) => b.score - a.score);
    const [first, second] = sorted;
    if (first && first.score >= config.winScore && (!second || second.score < first.score)) {
      return first.id;
    }
    return null;
  }

  private scheduleNextRound() {
    this.clearRoundEndTimer();
    this.roundEndTimer = setTimeout(() => {
      this.roundEndTimer = null;
      if (this.phase !== 'roundEnd') return;
      if (!this.hasConnectedHumans) {
        // Everyone dropped: pause here instead of burning through skipped rounds.
        this.resumeNextRound = true;
        return;
      }
      this.startRound();
    }, config.roundEndMs);
  }

  private refillHand(playerId: string) {
    const hand = this.hands.get(playerId) ?? [];
    while (hand.length < config.handSize) {
      const card = this.flawDeck.draw();
      if (!card) break;
      hand.push(card);
    }
    this.hands.set(playerId, hand);
  }

  // ---------- disconnect handling ----------

  // Players the current phase is waiting on who are not connected.
  private blockers(): Player[] {
    const round = this.round;
    if (!round) return [];
    const get = (ids: string[]) => ids.map((id) => this.players.get(id)!).filter((p) => p && !p.connected);
    switch (this.phase) {
      case 'submitting':
        return get(this.pendingSubmitters());
      case 'voting':
        return get(this.pendingVoters());
      case 'target':
        return get(round.target ? [round.target.chooserId] : []);
      case 'twist':
      case 'wildcard':
      case 'choosing':
      case 'judging':
        return get([round.judgeId]);
      default:
        return [];
    }
  }

  // Wait out the grace period for each missing player, then skip them for this
  // round only. They are never removed from the game.
  private checkBlockers() {
    const round = this.round;
    if (!round) return;
    const token = `${round.number}:${this.phase}`;
    for (const p of this.blockers()) {
      if (this.graceTimers.has(p.id)) continue;
      const elapsed = p.disconnectedAt ? Date.now() - p.disconnectedAt : 0;
      const remaining = Math.max(0, config.reconnectGraceMs - elapsed);
      const timer = setTimeout(() => {
        this.graceTimers.delete(p.id);
        this.onGraceExpired(p.id, token);
      }, remaining);
      this.graceTimers.set(p.id, timer);
    }
  }

  private onGraceExpired(playerId: string, token: string) {
    const round = this.round;
    const player = this.players.get(playerId);
    if (!round || !player || player.connected) return;
    if (token !== `${round.number}:${this.phase}`) return;

    if (this.phase === 'submitting') {
      round.skipped.add(playerId);
      this.advanceFromSubmitting();
    } else if (this.phase === 'voting') {
      round.voteSkipped.add(playerId);
      this.checkVoteDone();
    } else if (this.phase === 'target') {
      // The person who had to pick is gone: the twist's effect simply does not happen.
      round.notes.push(`${player.name} was away, so the Plot Twist did nothing.`);
      this.completePass();
    } else if (this.phase === 'twist' || this.phase === 'wildcard' || this.phase === 'choosing' || this.phase === 'judging') {
      this.finishRound(`${player.name} (the judge) disconnected. Round skipped.`);
    }
    this.broadcast();
  }

  // ---------- bots (for testing a lobby solo) ----------

  private scheduleBots() {
    const round = this.round;
    if (!round) return;
    const bots = [...this.players.values()].filter((p) => p.isBot);
    const judgeIsBot = Boolean(this.players.get(round.judgeId)?.isBot);

    if (this.phase === 'twist' && judgeIsBot) {
      this.later(() => this.drawPowerAfterTwist(), rand(2500, 4000));
    } else if (this.phase === 'wildcard' && judgeIsBot) {
      this.later(() => this.applyWildcard(pick(BOT_WILDCARDS)), rand(1500, 3000));
    } else if (this.phase === 'submitting') {
      for (const bot of bots) {
        if (bot.id === round.judgeId) continue;
        this.later(() => {
          const hand = this.hands.get(bot.id) ?? [];
          if (hand.length) this.submit(bot.id, pick(hand).id);
        }, rand(1000, 3500));
      }
    } else if (this.phase === 'choosing' && judgeIsBot) {
      this.later(() => this.finishChoosing(this.randomPicks()), rand(2000, 3500));
    } else if (this.phase === 'voting') {
      for (const bot of bots) {
        if (bot.id === round.judgeId) continue;
        this.later(() => {
          const options = round.entries.filter((e) => !e.authorIds.includes(bot.id));
          if (options.length) this.vote(bot.id, pick(options).id);
        }, rand(1500, 3500));
      }
    } else if (this.phase === 'judging' && judgeIsBot) {
      const options = round.tiebreak
        ? round.entries.filter((e) => round.tiebreak!.includes(e.id))
        : round.entries;
      this.later(() => this.pickWinner(round.judgeId, pick(options).id), rand(2500, 4500));
    } else if (this.phase === 'target' && round.target && this.players.get(round.target.chooserId)?.isBot) {
      const { chooserId, eligibleIds } = round.target;
      this.later(() => this.pickTarget(chooserId, pick(eligibleIds)), rand(1500, 3000));
    }
  }

  // ---------- state out ----------

  private isHost(playerId: string) {
    return this.players.get(playerId)?.isHost === true;
  }

  broadcast() {
    for (const p of this.players.values()) {
      if (p.socketId) this.io.to(p.socketId).emit('update-state', this.viewFor(p.id));
    }
  }

  viewFor(playerId: string): RoomState {
    const players: PublicPlayer[] = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      isBot: p.isBot,
      isReady: p.isReady,
      score: p.score,
      connected: p.connected,
    }));

    return {
      gameCode: this.code,
      phase: this.phase,
      you: playerId,
      players,
      settings: { timerSeconds: this.settings.timerSeconds, timerOptions: config.timerOptions },
      rules: { winScore: config.winScore, minPlayers: config.minPlayers, maxPlayers: config.maxPlayers },
      // Only ever your own hand.
      hand: this.hands.get(playerId) ?? [],
      round: this.round ? this.roundView(this.round, playerId) : null,
      gameWinnerId: this.gameWinnerId,
    };
  }

  private roundView(round: Round, viewerId: string): RoundView {
    const twist = round.twist;
    // Authors stay hidden until the round is over, unless the twist says otherwise.
    // Sequel Bait keeps authors secret through the round that sets up the sequel too.
    const secret = Boolean(this.carry && twist?.replayFlaws);
    const reveal = (this.phase === 'roundEnd' || this.phase === 'gameOver') && !secret;
    const showAuthors = reveal || Boolean(twist?.revealAuthors);
    const showEntries =
      this.phase === 'voting' || this.phase === 'judging' || this.phase === 'target' || reveal;

    const entries: EntryView[] = showEntries
      ? round.entries.map((e) => ({
          id: e.id,
          text: e.text,
          mine: e.authorIds.includes(viewerId),
          ...(showAuthors
            ? { authorIds: e.authorIds, authorNames: e.authorIds.map((id) => this.players.get(id)?.name ?? '?') }
            : {}),
          // Vote totals are only shown once the vote is over.
          ...(this.phase !== 'voting' && round.voteCounts ? { votes: round.voteCounts.get(e.id) ?? 0 } : {}),
        }))
      : [];

    // Power Outage: the power is hidden from players (not the judge) until judging.
    const hidden =
      twist?.hidePower &&
      viewerId !== round.judgeId &&
      (this.phase === 'wildcard' || this.phase === 'submitting');
    const mask = (p: PowerCard | null): PowerCard | null =>
      p && hidden ? { id: 'hidden', kind: 'power', text: '???' } : p;

    return {
      number: round.number,
      judgeId: round.judgeId,
      power: mask(round.power),
      power2: mask(round.power2),
      twist: twist
        ? {
            id: twist.id,
            name: twist.name,
            description: twist.description,
            judgingPrompt: twist.judgingPrompt,
            judgePicksCards: Boolean(twist.judgePicksCards),
            groupVote: Boolean(twist.groupVote),
          }
        : null,
      pass: round.pass,
      passes: round.passes,
      roundValue: round.roundValue,
      submittedIds: [...round.submissions.keys()],
      skippedIds: [...round.skipped],
      deadline: round.deadline,
      entries,
      // Only the judge gets to see everyone's hand, and only while choosing.
      choosing:
        this.phase === 'choosing' && viewerId === round.judgeId
          ? this.choosablePlayers().map((id) => ({
              playerId: id,
              name: this.players.get(id)?.name ?? '?',
              cards: this.hands.get(id) ?? [],
            }))
          : null,
      votedIds: [...round.votes.keys()].filter((id) => !round.voteSkipped.has(id)),
      myVote: round.votes.get(viewerId) ?? null,
      tiebreak: round.tiebreak,
      target: round.target,
      result: round.result,
    };
  }

  // ---------- timers ----------

  private later(fn: () => void, ms: number) {
    const timer = setTimeout(() => {
      this.phaseTimers.delete(timer);
      fn();
    }, ms);
    this.phaseTimers.add(timer);
  }

  private clearTimer(map: Map<string, NodeJS.Timeout>, key: string) {
    const t = map.get(key);
    if (t) clearTimeout(t);
    map.delete(key);
  }

  private clearRoundEndTimer() {
    if (this.roundEndTimer) clearTimeout(this.roundEndTimer);
    this.roundEndTimer = null;
  }

  private clearPhaseTimers() {
    for (const t of this.phaseTimers) clearTimeout(t);
    this.phaseTimers.clear();
    for (const t of this.graceTimers.values()) clearTimeout(t);
    this.graceTimers.clear();
  }

  private clearAllTimers() {
    this.clearPhaseTimers();
    this.clearRoundEndTimer();
    for (const t of this.lobbyTimers.values()) clearTimeout(t);
    this.lobbyTimers.clear();
    if (this.hostTimer) clearTimeout(this.hostTimer);
    this.hostTimer = null;
  }

  dispose() {
    this.clearAllTimers();
  }
}
