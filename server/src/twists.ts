// Plot Twists are data. Add a new object to TWISTS to add a twist; the room engine
// only reads the generic fields below and has no per-twist logic of its own.

export interface TwistContext {
  winnerId: string; // first author of the winning flaw
  scorerIds: string[]; // everyone who scored for the winning flaw
  winningEntryId: string;
  judgeId: string;
  roundValue: number;
  // Player objects are passed directly so a twist can change scores.
  players: { id: string; name: string; score: number }[];
  entries: { id: string; authorIds: string[] }[];
}

export interface TwistTarget {
  // Who makes the follow-up pick: the judge (default) or the round's winner.
  chooser?: 'judge' | 'winner';
  // What is picked: a player by name, or an (anonymous) flaw.
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
  // Fewest players in the room for this twist to be drawn. It is reshuffled back otherwise.
  minPlayers?: number;

  // --- scoring ---
  roundValue?: number; // points per win (default 1)
  passes?: number; // the round is played this many times in a row, each with its own winner
  target?: TwistTarget; // a follow-up pick after the winner
  afterWinner?: (ctx: TwistContext) => string | null; // automatic effect once the winner is scored

  // --- what players see and play ---
  judgingPrompt?: string; // replaces the judge's default prompt
  hidePower?: boolean; // the power stays hidden from players until judging
  extraPower?: boolean; // a second power is drawn and flaws must ruin both
  revealAuthors?: boolean; // authors are shown by name while judging
  teamUp?: boolean; // flaws are grouped into combined entries of 2 (one of 3 when odd)
  judgeSubmits?: boolean; // the judge also plays a flaw, mixed in anonymously
  groupVote?: boolean; // the whole table votes for the winner (judge breaks ties)

  // --- setup ---
  redeal?: 'reset' | 'swap'; // reset every deck and deal new hands, or shuffle all hands and deal them back out
  submitSeconds?: number; // forced time limit for playing a flaw, whatever the room timer says
  replayFlaws?: boolean; // the next round replays this power with these same flaws
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
    id: 'opposite_day',
    name: 'Opposite Day',
    description: 'The judge picks the LEAST funny flaw. The worst one wins!',
    judgingPrompt: 'Opposite Day: pick the LEAST funny flaw. It wins the round!',
  },
  {
    id: 'sidekick',
    name: 'Sidekick',
    description: "The winner's point is also given to another player, chosen by the winner.",
    target: {
      chooser: 'winner',
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
    description: 'Players are paired up and their flaws combine into one. A winning team all score.',
    teamUp: true,
    minPlayers: 5,
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
    description: "There will be a sequel: this round's flaws come back next round, judged again by the next judge.",
    replayFlaws: true,
    minPlayers: 4,
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
    id: 'reboot',
    name: 'Reboot',
    description: 'Reboot! Every deck is reshuffled from scratch and everyone gets a brand-new hand.',
    redeal: 'reset',
  },
  {
    id: 'alternate_timeline',
    name: 'Alternate Timeline',
    description: 'After the winner scores, first place and last place swap points.',
    afterWinner: (ctx) => {
      const scores = ctx.players.map((p) => p.score);
      const hi = Math.max(...scores);
      const lo = Math.min(...scores);
      if (hi === lo) return 'Alternate Timeline: everyone is tied, so nothing changes.';
      // Ties for first or last are broken at random.
      const pickOf = (value: number) => {
        const tied = ctx.players.filter((p) => p.score === value);
        return tied[Math.floor(Math.random() * tied.length)];
      };
      const first = pickOf(hi);
      const last = pickOf(lo);
      first.score = lo;
      last.score = hi;
      return `Alternate Timeline: ${first.name} (first, ${hi}) and ${last.name} (last, ${lo}) swapped points!`;
    },
  },
  {
    id: 'power_outage',
    name: 'Power Outage',
    description: 'The power is hidden while you play your flaw. It is revealed at judging.',
    hidePower: true,
  },
  {
    id: 'arch_nemesis',
    name: 'Arch Nemesis',
    description: 'The winner scores, and the highest-scoring other player loses a point.',
    afterWinner: (ctx) => {
      const others = ctx.players.filter((p) => !ctx.scorerIds.includes(p.id));
      const top = Math.max(0, ...others.map((p) => p.score));
      if (top <= 0) return 'The arch nemesis has no points to lose yet.';
      const rivals = others.filter((p) => p.score === top);
      for (const r of rivals) r.score -= 1;
      return `Arch Nemesis: ${rivals.map((r) => r.name).join(' & ')} lost a point.`;
    },
  },
  {
    id: 'multiverse_mixup',
    name: 'Multiverse Mixup',
    description: "All hands are shuffled together and dealt back out. You play someone else's cards.",
    redeal: 'swap',
  },
  {
    id: 'psa',
    name: 'Public Service Announcement',
    description: 'Emergency broadcast! You only have 20 seconds to play a flaw.',
    submitSeconds: 20,
  },
  {
    id: 'fourth_wall',
    name: 'Breaking the Fourth Wall',
    description:
      'The judge plays a flaw too, and the whole group votes. Most votes wins. If there is a tie, the judge picks.',
    judgeSubmits: true,
    groupVote: true,
    minPlayers: 4,
  },
];
