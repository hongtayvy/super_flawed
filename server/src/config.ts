// Tunable game rules. Override the grace period with RECONNECT_GRACE_MS.
export const config = {
  winScore: 5,
  handSize: 5,
  minPlayers: 3,
  maxPlayers: 8,
  // Copies of the Wildcard shuffled into the Super Power deck.
  wildcardCopies: 5,
  // How long a round waits on a disconnected player before skipping them (this round only).
  reconnectGraceMs: Number(process.env.RECONNECT_GRACE_MS) || 60_000,
  // Pause on the round result before the next round starts.
  roundEndMs: Number(process.env.ROUND_END_MS) || 6_000,
  // Host-selectable submit timers in seconds. 0 = wait for everyone.
  timerOptions: [0, 60, 90],
  // Empty rooms are swept after this long with no connected humans.
  roomIdleMs: 60 * 60 * 1000,
};
