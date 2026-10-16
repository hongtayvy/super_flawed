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
  note?: string;
}

interface Entry {
  id: string; // opaque per-round ID so the judge never sees player IDs
  authorIds: string[]; // more than one on Team Up
  scorerIds: string[]; // normally the authors; differs on Alternate Timeline
  text: string;
  cards: Card[];
  note?: string;
}

interface Award {
  text: string;
  note?: string;
  authorIds: string[];
  scorerIds: string[];
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
  target: { prompt: string; eligibleIds: string[]; pick: 'player' | 'entry' } | null;
  carried: boolean; // power carried over by Sequel Bait: the wildcard step is already done
  result: { awards: Award[]; note: string } | null;
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

const BOT_NOTES = [
  'Cursed by a very petty wizard.',
  'Long story. Involves a raccoon.',
  'Blame the group chat.',
  'It was a dare. I lost.',
  'Mercury was in retrograde.',
];

// Team Up: join two flaws into one ("But A. And B.").
const combineFlaws = (a: string, b: string) => `${a} And ${b.replace(/^But /, '')}`;

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
  private carry: { power: PowerCard; entry: DeckEntry } | null = null;

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

    // Sequel Bait: replay last round's power. No draw, and no twist this time.
    // Otherwise a Plot Twist is its own card: if it comes up it is shown alone,
    // and only then is the next power card drawn.
    const carried = this.carry;
    this.carry = null;
    const first = carried ? carried.entry : this.powerDeck.draw()!;
    const twist = !carried && first.kind === 'twist' ? first.twist : null;

    this.roundCounter += 1;
    this.round = {
      number: this.roundCounter,
      judgeId,
      power: carried ? carried.power : first.kind === 'card' ? first.card : null,
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
      carried: Boolean(carried),
      result: null,
    };

    if (twist) this.beginTwistReveal();
    else this.beginPower();
  }

  private beginTwistReveal() {
    this.clearPhaseTimers();
    this.phase = 'twist';
    this.later(() => this.drawPowerAfterTwist(), config.twistRevealMs);
    this.broadcast();
  }

  // Draw the round's power after a Plot Twist. A twist is never drawn straight
  // after another one: reshuffle and redraw so a round never stacks two twists.
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
      this.powerDeck.putBackAndReshuffle(entry);
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

    if (round.power!.kind === 'wildcard' && !round.carried) this.beginWildcard();
    else this.beginSubmitting();
  }

  // Retcon: everyone gets fresh cards. Multiverse Mixup: hands are pooled and dealt back out.
  private redealHands(mode: 'fresh' | 'swap') {
    if (mode === 'fresh') {
      for (const id of this.players.keys()) {
        this.flawDeck.discard(this.hands.get(id) ?? []);
        this.hands.set(id, []);
        this.refillHand(id);
      }
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

  // Strict rotation: next in queue; once everyone has judged the queue resets.
  private nextJudge(): string {
    if (this.queue.length === 0) this.queue = [...this.players.keys()];
    return this.queue.shift()!;
  }

  submit(playerId: string, cardId: string, rawNote?: string): string | null {
    const round = this.round;
    if (this.phase !== 'submitting' || !round) return 'Not accepting flaws right now.';
    if (playerId === round.judgeId && !round.twist?.judgeSubmits) return 'The judge does not submit a flaw.';
    if (round.skipped.has(playerId)) return 'You were skipped this round.';
    if (round.submissions.has(playerId)) return 'You already submitted a flaw.';

    let note: string | undefined;
    if (round.twist?.needsNote) {
      note = String(rawNote ?? '').replace(/\s+/g, ' ').trim();
      if (note.length < 3 || note.length > 80) return 'Add a short backstory (3 to 80 characters).';
    }

    const hand = this.hands.get(playerId) ?? [];
    const idx = hand.findIndex((c) => c.id === cardId);
    if (idx === -1) return 'That card is not in your hand.';

    const [card] = hand.splice(idx, 1);
    round.submissions.set(playerId, { card, note });
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
    const judgePlays = Boolean(round.twist?.judgeSubmits);
    return [...this.players.keys()].filter(
      (id) =>
        (id !== round.judgeId || judgePlays) && !round.skipped.has(id) && !round.submissions.has(id),
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
    const twist = round.twist;
    const subs = [...round.submissions];
    let entries: Entry[];

    if (twist?.teamUp && subs.length >= 2) {
      // Team Up: pair flaws at random into one combined flaw. An odd one out plays solo.
      const ids = shuffle(subs.map(([id]) => id));
      entries = [];
      for (let i = 0; i < ids.length; i += 2) {
        const a = round.submissions.get(ids[i])!;
        const bId = ids[i + 1];
        const b = bId ? round.submissions.get(bId) : undefined;
        const authorIds = b ? [ids[i], bId] : [ids[i]];
        entries.push({
          id: randomUUID().slice(0, 8),
          authorIds,
          scorerIds: authorIds,
          text: b ? combineFlaws(a.card.text, b.card.text) : a.card.text,
          cards: b ? [a.card, b.card] : [a.card],
        });
      }
    } else {
      entries = subs.map(([id, s]) => ({
        id: randomUUID().slice(0, 8),
        authorIds: [id],
        scorerIds: [id],
        text: s.card.text,
        cards: [s.card],
        note: s.note,
      }));
    }

    if (twist?.shiftPoints && entries.length >= 2) {
      // Alternate Timeline: each flaw scores for the next player in a shuffled
      // circle, so nobody ever scores for their own flaw.
      const circle = shuffle(entries.map((e) => e.authorIds[0]));
      for (const e of entries) {
        const at = circle.indexOf(e.authorIds[0]);
        e.scorerIds = [circle[(at + 1) % circle.length]];
      }
    }
    return shuffle(entries);
  }

  private startJudging() {
    const round = this.round!;
    this.clearPhaseTimers();
    round.entries = this.buildEntries(round);
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

    for (const id of entry.scorerIds) this.players.get(id)!.score += round.roundValue;
    round.winningEntryId = entry.id;
    round.awards.push({ text: entry.text, note: entry.note, authorIds: entry.authorIds, scorerIds: entry.scorerIds });

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
      if (eligibleIds.length > 0) {
        this.clearPhaseTimers();
        round.target = { prompt: target.prompt, eligibleIds, pick: target.pick ?? 'player' };
        this.phase = 'target';
        this.checkBlockers();
        this.scheduleBots();
        this.broadcast();
        return null;
      }
    }
    const auto = round.twist?.afterWinner?.(ctx);
    if (auto) round.notes.push(auto);
    this.completePass();
    return null;
  }

  pickTarget(playerId: string, targetId: string): string | null {
    const round = this.round;
    if (this.phase !== 'target' || !round?.target || !round.twist?.target) return 'No target to pick.';
    if (playerId !== round.judgeId) return 'Only the judge picks the target.';
    if (!round.target.eligibleIds.includes(targetId)) return 'That one cannot be picked.';

    round.notes.push(round.twist.target.apply(this.twistContext(round), targetId));
    this.completePass();
    return null;
  }

  private twistContext(round: Round) {
    const entry = round.entries.find((e) => e.id === round.winningEntryId)!;
    return {
      winnerId: entry.scorerIds[0],
      scorerIds: entry.scorerIds,
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

  private names(ids: string[]) {
    return ids.map((id) => this.players.get(id)?.name ?? '?').join(' & ');
  }

  // `note` is set for rounds that end without a normal result (no flaws, judge left).
  private finishRound(note: string | null) {
    const round = this.round!;
    this.clearPhaseTimers();

    let headline = note;
    if (!headline) {
      headline =
        round.awards.length === 1
          ? `${this.names(round.awards[0].scorerIds)} win${round.awards[0].scorerIds.length > 1 ? '' : 's'} the round!`
          : round.awards.map((a, i) => `Pass ${i + 1}: ${this.names(a.scorerIds)}`).join('. ') + '.';
    }
    round.result = { awards: round.awards, note: [headline, ...round.notes].join(' ') };

    // Used cards go to the discard piles; hands are topped back up to full.
    this.flawDeck.discard([...round.submissions.values()].map((s) => s.card));

    if (round.twist?.replayPower && round.power) {
      // Sequel Bait: keep the power out of the discard so the next round can replay it.
      const entry = [...round.drawn].reverse().find((d) => d.kind === 'card')!;
      this.carry = { power: round.power, entry };
      this.powerDeck.discard(round.drawn.filter((d) => d !== entry));
    } else {
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
      this.finishRound(`${player.name} (the judge) disconnected. Round skipped.`);
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
        if (bot.id === round.judgeId && !round.twist?.judgeSubmits) continue;
        this.later(() => {
          const hand = this.hands.get(bot.id) ?? [];
          if (hand.length) this.submit(bot.id, pick(hand).id, pick(BOT_NOTES));
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
    const twist = round.twist;
    // Authors stay hidden until the round is over, unless the twist says otherwise.
    const reveal = this.phase === 'roundEnd' || this.phase === 'gameOver';
    const showAuthors = reveal || Boolean(twist?.revealAuthors);
    const showEntries =
      this.phase === 'judging' || this.phase === 'target' || reveal;

    const entries: EntryView[] = showEntries
      ? round.entries.map((e) => ({
          id: e.id,
          text: e.text,
          note: e.note,
          mine: e.authorIds.includes(viewerId),
          ...(showAuthors
            ? { authorIds: e.authorIds, authorNames: e.authorIds.map((id) => this.players.get(id)?.name ?? '?') }
            : {}),
          ...(reveal && twist?.shiftPoints ? { scorerIds: e.scorerIds } : {}),
        }))
      : [];

    // Breaking the Fourth Wall: flaws are face-up, with names, as they are played.
    const liveFlaws =
      twist?.liveFlaws && this.phase === 'submitting'
        ? [...round.submissions].map(([playerId, s]) => ({
            playerId,
            playerName: this.players.get(playerId)?.name ?? '?',
            text: s.card.text,
            note: s.note,
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
            needsNote: twist.needsNote ?? null,
            judgeSubmits: Boolean(twist.judgeSubmits),
          }
        : null,
      pass: round.pass,
      passes: round.passes,
      roundValue: round.roundValue,
      submittedIds: [...round.submissions.keys()],
      skippedIds: [...round.skipped],
      deadline: round.deadline,
      entries,
      liveFlaws,
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
