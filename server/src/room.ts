import { randomUUID } from 'crypto';
import type { Server } from 'socket.io';
import { config } from './config';
import { Deck, shuffle } from './deck';
import { FLAW_CARDS, POWER_CARDS, WILDCARD } from './cards';
import { TWISTS, TwistDef } from './twists';
import type { Card, Phase, Player, PowerCard, PublicPlayer, RoomState, RoundView } from './types';

type DeckEntry = { kind: 'card'; card: PowerCard } | { kind: 'twist'; twist: TwistDef };

interface Entry {
  id: string; // opaque per-round ID so the judge never sees player IDs
  playerId: string;
  card: Card;
}

interface Round {
  number: number;
  judgeId: string;
  power: PowerCard;
  twist: TwistDef | null;
  drawn: DeckEntry[];
  roundValue: number;
  submissions: Map<string, Card>;
  skipped: Set<string>;
  entries: Entry[];
  deadline: number | null;
  winnerId: string | null;
  target: { prompt: string; eligibleIds: string[] } | null;
  result: { winnerId: string | null; winnerText: string | null; note: string } | null;
}

const BOTS = [
  { id: 'bot-sean', name: 'Sean Jerubin', avatar: '2' },
  { id: 'bot-rengo', name: 'Rengo Yang', avatar: '4' },
  { id: 'bot-yeng', name: 'Yeng Chang', avatar: '3' },
  { id: 'bot-tdawg', name: 'Tdawg Thao', avatar: '5' },
];

const BOT_WILDCARDS = [
  'You can turn any sandwich into a loyal pet.',
  'You can talk to the moon, and it talks back.',
  'You can make any song stuck in anyone\'s head.',
  'You can summon a very polite thunderstorm.',
  'You can make clouds do whatever you say.',
];

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

  private phaseTimers = new Set<NodeJS.Timeout>();
  private graceTimers = new Map<string, NodeJS.Timeout>();
  private lobbyTimers = new Map<string, NodeJS.Timeout>();
  private roundEndTimer: NodeJS.Timeout | null = null;
  private resumeNextRound = false;

  constructor(code: string, private io: Server) {
    this.code = code;
  }

  // Plot Twists and the Wildcard are shuffled into the one Super Power deck.
  private static buildPowerDeck(): DeckEntry[] {
    return [
      ...POWER_CARDS.map((card): DeckEntry => ({ kind: 'card', card })),
      { kind: 'card', card: WILDCARD },
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
    this.broadcast();
  }

  private scheduleLobbyRemoval(playerId: string) {
    this.clearTimer(this.lobbyTimers, playerId);
    const timer = setTimeout(() => {
      this.lobbyTimers.delete(playerId);
      const p = this.players.get(playerId);
      if (p && !p.connected && this.phase === 'lobby') {
        this.removePlayer(playerId);
        this.broadcast();
      }
    }, config.reconnectGraceMs);
    this.lobbyTimers.set(playerId, timer);
  }

  private removePlayer(playerId: string) {
    const removed = this.players.get(playerId);
    this.players.delete(playerId);
    this.hands.delete(playerId);
    if (removed?.isHost) {
      const next = this.humans[0];
      if (next) {
        next.isHost = true;
        next.isReady = true;
      }
    }
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
    const { power, twist, drawn } = this.drawRoundCards();

    this.roundCounter += 1;
    this.round = {
      number: this.roundCounter,
      judgeId,
      power,
      twist,
      drawn,
      roundValue: twist?.roundValue ?? 1,
      submissions: new Map(),
      skipped: new Set(),
      entries: [],
      deadline: null,
      winnerId: null,
      target: null,
      result: null,
    };

    if (power.kind === 'wildcard') this.beginWildcard();
    else this.beginSubmitting();
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
    if (this.phase !== 'wildcard' || !round) return;
    round.power = { ...round.power, text };
    this.beginSubmitting();
  }

  private beginSubmitting() {
    const round = this.round!;
    this.clearPhaseTimers();
    this.phase = 'submitting';
    round.deadline = null;

    const seconds = this.settings.timerSeconds;
    if (seconds > 0) {
      round.deadline = Date.now() + seconds * 1000;
      this.later(() => this.onSubmitDeadline(), seconds * 1000);
    }

    this.checkBlockers();
    this.scheduleBots();
    this.broadcast();
  }

  // Strict rotation: next in queue; once everyone has judged the queue resets.
  private nextJudge(): string {
    if (this.queue.length === 0) this.queue = [...this.players.keys()];
    return this.queue.shift()!;
  }

  // The draw covers Plot Twists: a twist modifies the round but the round still
  // gets a normal power, and a twist is never drawn straight after another one.
  private drawRoundCards() {
    const drawn: DeckEntry[] = [];
    let twist: TwistDef | null = null;
    let entry = this.powerDeck.draw()!;
    drawn.push(entry);

    if (entry.kind === 'twist') {
      twist = entry.twist;
      entry = this.powerDeck.draw()!;
      for (let guard = 0; entry.kind === 'twist' && guard < 50; guard++) {
        this.powerDeck.putBackAndReshuffle(entry);
        entry = this.powerDeck.draw()!;
      }
      drawn.push(entry);
    }

    const power = (entry as { kind: 'card'; card: PowerCard }).card;
    return { power, twist, drawn };
  }

  submit(playerId: string, cardId: string): string | null {
    const round = this.round;
    if (this.phase !== 'submitting' || !round) return 'Not accepting flaws right now.';
    if (playerId === round.judgeId) return 'The judge does not submit a flaw.';
    if (round.skipped.has(playerId)) return 'You were skipped this round.';
    if (round.submissions.has(playerId)) return 'You already submitted a flaw.';

    const hand = this.hands.get(playerId) ?? [];
    const idx = hand.findIndex((c) => c.id === cardId);
    if (idx === -1) return 'That card is not in your hand.';

    const [card] = hand.splice(idx, 1);
    round.submissions.set(playerId, card);
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
      this.finishRound(null, 'Nobody submitted a flaw. Round skipped.');
    } else {
      this.startJudging();
    }
  }

  private startJudging() {
    const round = this.round!;
    this.clearPhaseTimers();
    round.entries = shuffle(
      [...round.submissions].map(([playerId, card]) => ({
        id: randomUUID().slice(0, 8),
        playerId,
        card,
      })),
    );
    round.deadline = null;
    this.phase = 'judging';
    this.checkBlockers();
    this.scheduleBots();
  }

  // The judge picks exactly one winner. No ties.
  pickWinner(playerId: string, entryId: string): string | null {
    const round = this.round;
    if (this.phase !== 'judging' || !round) return 'Not judging right now.';
    if (playerId !== round.judgeId) return 'Only the judge picks the winner.';
    const entry = round.entries.find((e) => e.id === entryId);
    if (!entry) return 'Unknown flaw.';

    const winner = this.players.get(entry.playerId)!;
    winner.score += round.roundValue;
    round.winnerId = winner.id;

    const target = round.twist?.target;
    if (target) {
      const eligibleIds = target.eligible(this.twistContext(round));
      if (eligibleIds.length > 0) {
        this.clearPhaseTimers();
        round.target = { prompt: target.prompt, eligibleIds };
        this.phase = 'target';
        this.checkBlockers();
        this.scheduleBots();
        this.broadcast();
        return null;
      }
    }
    this.finishRound(winner.id, `${winner.name} wins the round!`);
    return null;
  }

  pickTarget(playerId: string, targetId: string): string | null {
    const round = this.round;
    if (this.phase !== 'target' || !round?.target || !round.twist?.target) return 'No target to pick.';
    if (playerId !== round.judgeId) return 'Only the judge picks the target.';
    if (!round.target.eligibleIds.includes(targetId)) return 'That player cannot be picked.';

    const winner = this.players.get(round.winnerId!)!;
    const note = round.twist.target.apply(this.twistContext(round), targetId);
    this.finishRound(winner.id, `${winner.name} wins the round! ${note}`);
    return null;
  }

  private twistContext(round: Round) {
    return {
      winnerId: round.winnerId!,
      judgeId: round.judgeId,
      roundValue: round.roundValue,
      // Player objects are passed directly so a twist can mutate scores.
      players: [...this.players.values()],
    };
  }

  private finishRound(winnerId: string | null, note: string) {
    const round = this.round!;
    this.clearPhaseTimers();

    const winningEntry = round.entries.find((e) => e.playerId === winnerId);
    round.result = { winnerId, winnerText: winningEntry?.card.text ?? null, note };

    // One line per played flaw, so weak cards can be spotted later (win rate per card).
    for (const [playerId, card] of round.submissions) {
      console.log(
        JSON.stringify({ evt: 'flaw_result', flaw: card.id, power: round.power.id, won: playerId === winnerId }),
      );
    }

    // Used cards go to the discard piles; hands are topped back up to full.
    this.flawDeck.discard([...round.submissions.values()]);
    this.powerDeck.discard(round.drawn);
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
    if (this.phase === 'submitting') {
      return this.pendingSubmitters()
        .map((id) => this.players.get(id)!)
        .filter((p) => !p.connected);
    }
    if (this.phase === 'wildcard' || this.phase === 'judging' || this.phase === 'target') {
      const judge = this.players.get(round.judgeId);
      return judge && !judge.connected ? [judge] : [];
    }
    return [];
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
    } else if (this.phase === 'wildcard' || this.phase === 'judging' || this.phase === 'target') {
      this.finishRound(round.winnerId, `${player.name} (the judge) disconnected. Round skipped.`);
    }
    this.broadcast();
  }

  // ---------- bots (for testing a lobby solo) ----------

  private scheduleBots() {
    const round = this.round;
    if (!round) return;
    const bots = [...this.players.values()].filter((p) => p.isBot);

    if (this.phase === 'wildcard' && this.players.get(round.judgeId)?.isBot) {
      this.later(() => this.applyWildcard(pick(BOT_WILDCARDS)), rand(1500, 3000));
    } else if (this.phase === 'submitting') {
      for (const bot of bots) {
        if (bot.id === round.judgeId) continue;
        this.later(() => {
          const hand = this.hands.get(bot.id) ?? [];
          if (hand.length) this.submit(bot.id, pick(hand).id);
        }, rand(1000, 3500));
      }
    } else if (this.phase === 'judging' && this.players.get(round.judgeId)?.isBot) {
      this.later(() => this.pickWinner(round.judgeId, pick(round.entries).id), rand(2500, 4500));
    } else if (this.phase === 'target' && this.players.get(round.judgeId)?.isBot && round.target) {
      const ids = round.target.eligibleIds;
      this.later(() => this.pickTarget(round.judgeId, pick(ids)), rand(1500, 3000));
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
    // Authors stay hidden until the round is over.
    const reveal = this.phase === 'roundEnd' || this.phase === 'gameOver';
    const entries =
      this.phase === 'judging' || this.phase === 'target' || reveal
        ? round.entries.map((e) => ({
            id: e.id,
            text: e.card.text,
            mine: e.playerId === viewerId,
            ...(reveal
              ? { playerId: e.playerId, playerName: this.players.get(e.playerId)?.name }
              : {}),
          }))
        : [];

    return {
      number: round.number,
      judgeId: round.judgeId,
      power: round.power,
      twist: round.twist
        ? {
            id: round.twist.id,
            name: round.twist.name,
            description: round.twist.description,
            judgingPrompt: round.twist.judgingPrompt,
          }
        : null,
      roundValue: round.roundValue,
      submittedIds: [...round.submissions.keys()],
      skippedIds: [...round.skipped],
      deadline: round.deadline,
      entries,
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
  }

  dispose() {
    this.clearAllTimers();
  }
}
