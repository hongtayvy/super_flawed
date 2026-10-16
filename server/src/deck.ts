export const shuffle = <T>(items: T[]): T[] => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// A draw pile that reshuffles its discards back in when it runs out.
export class Deck<T> {
  private pile: T[];
  private discards: T[] = [];

  constructor(items: T[]) {
    this.pile = shuffle(items);
  }

  draw(): T | undefined {
    if (this.pile.length === 0) this.reshuffle();
    return this.pile.pop();
  }

  discard(items: T[]) {
    this.discards.push(...items);
  }

  // Put a card back and mix everything not currently in play.
  putBackAndReshuffle(item: T) {
    this.pile.push(item);
    this.reshuffle();
  }

  // Put every discarded card back and reshuffle (Reboot).
  resetAll() {
    this.reshuffle();
  }

  private reshuffle() {
    this.pile = shuffle([...this.pile, ...this.discards]);
    this.discards = [];
  }
}
