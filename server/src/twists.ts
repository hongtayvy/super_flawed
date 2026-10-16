// Plot Twists are data. Add a new object here to add a twist; the room engine
// reads these fields and has no per-twist logic of its own.

export interface TwistTargetContext {
  winnerId: string;
  judgeId: string;
  roundValue: number;
  players: { id: string; name: string; score: number }[];
}

export interface TwistDef {
  id: string;
  name: string;
  description: string;
  // Copies in the Super Power deck: higher means it shows up more often. Defaults to 1.
  weight?: number;
  // Points the round winner earns. Defaults to 1.
  roundValue?: number;
  // Replaces the judge's default prompt, e.g. for Mirror Universe.
  judgingPrompt?: string;
  // Optional follow-up step: after picking a winner the judge picks a target.
  target?: {
    prompt: string;
    eligible: (ctx: TwistTargetContext) => string[];
    // Mutates scores through ctx.players and returns a note for the round result.
    apply: (ctx: TwistTargetContext, targetId: string) => string;
  };
}

const find = (ctx: TwistTargetContext, id: string) => ctx.players.find((p) => p.id === id)!;

export const TWISTS: TwistDef[] = [
  {
    id: 'double_jeopardy',
    name: 'Double Jeopardy',
    description: 'This round is worth 2 points.',
    weight: 2,
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
        ctx.players.filter((p) => p.id !== ctx.winnerId && p.id !== ctx.judgeId).map((p) => p.id),
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
      eligible: (ctx) =>
        ctx.players.filter((p) => p.id !== ctx.winnerId && p.score > 0).map((p) => p.id),
      apply: (ctx, targetId) => {
        const victim = find(ctx, targetId);
        const winner = find(ctx, ctx.winnerId);
        victim.score -= 1;
        winner.score += 1;
        return `${winner.name} steals a point from ${victim.name}!`;
      },
    },
  },
];
