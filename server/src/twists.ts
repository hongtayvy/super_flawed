// Plot Twists are data. Add a new object to TWISTS to add a twist; the room engine
// only reads the generic fields below and has no per-twist logic of its own.

export interface TwistContext {
  winnerId: string; // first scorer of the winning flaw
  scorerIds: string[];
  winningEntryId: string;
  judgeId: string;
  roundValue: number;
  // Player objects are passed directly so a twist can change scores.
  players: { id: string; name: string; score: number }[];
  entries: { id: string; authorIds: string[] }[];
}

export interface TwistTarget {
  // Who the judge picks: a player by name, or an (anonymous) flaw.
  pick?: 'player' | 'entry';
  prompt: string;
  eligible: (ctx: TwistContext) => string[];
  // Mutates scores through ctx.players and returns a note for the round result.
  apply: (ctx: TwistContext, targetId: string) => string;
}

export interface TwistDef {
  id: string;
  name: string;
  description: string;
  // Copies in the Super Power deck: higher means it shows up more often. Defaults to 1.
  weight?: number;

  // --- scoring ---
  roundValue?: number; // points per win (default 1)
  passes?: number; // the round is played this many times in a row, each with its own winner
  target?: TwistTarget; // judge picks a follow-up target after the winner
  afterWinner?: (ctx: TwistContext) => string | null; // automatic effect once the winner is scored
  shiftPoints?: boolean; // the point goes to a different player than the flaw's author

  // --- what players see and play ---
  judgingPrompt?: string; // replaces the judge's default prompt
  hidePower?: boolean; // the power stays hidden from players until judging
  extraPower?: boolean; // a second power is drawn and flaws must ruin both
  revealAuthors?: boolean; // authors are shown by name while judging
  liveFlaws?: boolean; // flaws are shown face-up, with names, as they are played
  needsNote?: string; // each flaw needs a short written note (this is the prompt)
  teamUp?: boolean; // flaws are paired into combined entries
  judgeSubmits?: boolean; // the judge also plays a flaw, mixed in anonymously

  // --- setup ---
  redeal?: 'fresh' | 'swap'; // fresh cards for everyone, or all hands shuffled and dealt back out
  submitSeconds?: number; // forced time limit for playing a flaw, whatever the room timer says
  replayPower?: boolean; // the next round replays this same power
}

const find = (ctx: TwistContext, id: string) => ctx.players.find((p) => p.id === id)!;

export const TWISTS: TwistDef[] = [
  {
    id: 'super_strength',
    name: 'Super Strength',
    description: 'This round is worth 2 points.',
    roundValue: 2,
  },
  {
    id: 'mirror_universe',
    name: 'Mirror Universe',
    description: 'The judge picks the LEAST funny flaw. The worst one wins!',
    judgingPrompt: 'Mirror Universe: pick the LEAST funny flaw. It wins the round!',
  },
  {
    id: 'sidekick',
    name: 'Sidekick',
    description: "The winner's point is also given to another player, chosen by the judge.",
    target: {
      prompt: 'Sidekick: who also gets the point?',
      eligible: (ctx) =>
        ctx.players.filter((p) => !ctx.scorerIds.includes(p.id) && p.id !== ctx.judgeId).map((p) => p.id),
      apply: (ctx, targetId) => {
        const sidekick = find(ctx, targetId);
        sidekick.score += ctx.roundValue;
        return `${sidekick.name} tags along as the sidekick and also earns ${ctx.roundValue} point${ctx.roundValue === 1 ? '' : 's'}.`;
      },
    },
  },
  {
    id: 'villain',
    name: 'Villain',
    description: 'The winner also steals an already-earned point from another player.',
    target: {
      prompt: 'Villain: whose point gets stolen?',
      eligible: (ctx) => ctx.players.filter((p) => !ctx.scorerIds.includes(p.id) && p.score > 0).map((p) => p.id),
      apply: (ctx, targetId) => {
        const victim = find(ctx, targetId);
        const winner = find(ctx, ctx.winnerId);
        victim.score -= 1;
        winner.score += 1;
        return `${winner.name} steals a point from ${victim.name}!`;
      },
    },
  },
  {
    id: 'team_up',
    name: 'Team Up',
    description: 'Flaws are paired up into one combined flaw. A winning pair both score.',
    teamUp: true,
  },
  {
    id: 'origin_story',
    name: 'Origin Story',
    description: 'Add a one-line backstory to your flaw. The judge reads both.',
    needsNote: 'How did you get this flaw? (one line)',
  },
  {
    id: 'time_loop',
    name: 'Time Loop',
    description: 'This power is played twice. Each pass has its own winner.',
    passes: 2,
  },
  {
    id: 'sequel_bait',
    name: 'Sequel Bait',
    description: 'There will be a sequel: the next round replays this same power.',
    replayPower: true,
  },
  {
    id: 'civilian_casualty',
    name: 'Civilian Casualty',
    description: 'After picking a winner, the judge picks a flaw that costs its player a point.',
    target: {
      pick: 'entry',
      prompt: 'Civilian Casualty: which flaw costs its player a point?',
      eligible: (ctx) => ctx.entries.filter((e) => e.id !== ctx.winningEntryId).map((e) => e.id),
      apply: (ctx, targetId) => {
        const entry = ctx.entries.find((e) => e.id === targetId)!;
        const victims = entry.authorIds.map((id) => find(ctx, id));
        const hit = victims.filter((v) => v.score > 0);
        for (const v of hit) v.score -= 1;
        const names = victims.map((v) => v.name).join(' & ');
        return hit.length
          ? `${names} ${victims.length > 1 ? 'were' : 'was'} the casualty and lost a point.`
          : `${names} had no points to lose. Lucky!`;
      },
    },
  },
  {
    id: 'unmasked',
    name: 'Unmasked',
    description: 'Flaws are shown with their authors while judging. No anonymity!',
    revealAuthors: true,
  },
  {
    id: 'crossover_event',
    name: 'Crossover Event',
    description: 'Two powers collide! Flaws must ruin both.',
    extraPower: true,
    judgingPrompt: 'Crossover Event: which flaw ruins BOTH powers best?',
  },
  {
    id: 'retcon',
    name: 'Retcon',
    description: 'Everyone\'s hand never happened. All hands are replaced with fresh cards.',
    redeal: 'fresh',
  },
  {
    id: 'alternate_timeline',
    name: 'Alternate Timeline',
    description: 'Points are swapped. The winning flaw scores for a different player than its author.',
    shiftPoints: true,
  },
  {
    id: 'power_outage',
    name: 'Power Outage',
    description: 'The power is hidden while you play your flaw. It is revealed at judging.',
    hidePower: true,
  },
  {
    id: 'nemesis',
    name: 'Nemesis',
    description: 'The winner scores, and the highest-scoring other player loses a point.',
    afterWinner: (ctx) => {
      const others = ctx.players.filter((p) => !ctx.scorerIds.includes(p.id));
      const top = Math.max(0, ...others.map((p) => p.score));
      if (top <= 0) return 'The nemesis has no points to lose yet.';
      const rivals = others.filter((p) => p.score === top);
      for (const r of rivals) r.score -= 1;
      return `Nemesis: ${rivals.map((r) => r.name).join(' & ')} lost a point.`;
    },
  },
  {
    id: 'multiverse_mixup',
    name: 'Multiverse Mixup',
    description: 'All hands are shuffled together and dealt back out. You play someone else\'s cards.',
    redeal: 'swap',
  },
  {
    id: 'fourth_wall',
    name: 'Breaking the Fourth Wall',
    description: 'Flaws are played face-up with names. Everyone watches them roll in live.',
    liveFlaws: true,
    revealAuthors: true,
  },
  {
    id: 'psa',
    name: 'Public Service Announcement',
    description: 'Emergency broadcast! You only have 20 seconds to play a flaw.',
    submitSeconds: 20,
  },
  {
    id: 'narrator_interrupts',
    name: 'Narrator Interrupts',
    description: 'The judge plays a flaw too, mixed in anonymously. The judge can win!',
    judgeSubmits: true,
  },
];
