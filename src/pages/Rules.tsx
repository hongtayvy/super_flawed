import { Link } from 'react-router-dom';
import { TWISTS } from '../../server/src/twists';

// The twist list comes straight from the game server's data, so this page can never
// drift from what the game actually does. The other numbers mirror server/src/config.ts.
const WIN_SCORE = 5;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;
const HAND_SIZE = 5;

const STEPS = [
  {
    title: 'The judge flips a power',
    body: 'One player is the judge each round. They flip a Super Power card, like "You can fly."',
    bg: 'bg-cobalt text-white',
  },
  {
    title: 'Everyone plays a flaw',
    body: `Everyone else secretly plays one Flaw card from their hand of ${HAND_SIZE} to sabotage the power: "But a goose announces it to the whole neighborhood." The judge never plays a flaw.`,
    bg: 'bg-sun',
  },
  {
    title: 'The judge picks one winner',
    body: 'Flaws are shown without names. The judge picks the single funniest combo. There are no ties and no second place. The winner scores a point, and names are revealed.',
    bg: 'bg-lilac',
  },
  {
    title: 'The judge passes along',
    body: `The next player in the circle becomes the judge. After everyone has judged once, the order starts over. First to ${WIN_SCORE} points wins.`,
    bg: 'bg-mint',
  },
];

const Rules = () => (
  <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">
    <span className="pill bg-sun">📖 How to play</span>
    <h1 className="display text-[clamp(44px,6vw,80px)] mt-3 mb-2">
      The <span className="text-cobalt">rules.</span>
    </h1>
    <p className="max-w-2xl text-lg font-bold text-muted mb-8">
      A party game about ruining superpowers. {MIN_PLAYERS} to {MAX_PLAYERS} players in a private room. Share the room
      code or link and everyone joins from their own device.
    </p>

    <div className="grid sm:grid-cols-2 gap-5 mb-12">
      {STEPS.map((s, i) => (
        <div key={s.title} className={`${s.bg} border-[3px] border-ink rounded-3xl shadow-pop p-6`}>
          <span className="display text-4xl opacity-40">0{i + 1}</span>
          <h2 className="display text-3xl mt-2 mb-2">{s.title}</h2>
          <p className="font-bold leading-snug">{s.body}</p>
        </div>
      ))}
    </div>

    <h2 className="display text-4xl mb-4">Winning</h2>
    <div className="panel mb-12 space-y-3 font-bold leading-snug">
      <p>
        The first player to <b>{WIN_SCORE} points</b> wins. If two players are tied at the top once someone has{' '}
        {WIN_SCORE}, the game keeps going until one of them is ahead.
      </p>
      <p>Points never go below zero.</p>
    </div>

    <h2 className="display text-4xl mb-4">The cards</h2>
    <div className="grid md:grid-cols-3 gap-5 mb-12">
      <div className="panel bg-cobalt text-white">
        <h3 className="display text-2xl mb-2">⚡ Super Powers</h3>
        <p className="font-bold leading-snug">
          Generic powers with no licensed characters. The judge flips one each round. When the deck runs out it is
          reshuffled.
        </p>
      </div>
      <div className="panel bg-sun">
        <h3 className="display text-2xl mb-2">✳ Flaws</h3>
        <p className="font-bold leading-snug">
          Everyone holds {HAND_SIZE}. A good flaw reads naturally after any power. Used cards are replaced after every
          round, and the discards are reshuffled when the deck runs out.
        </p>
      </div>
      <div className="panel bg-lilac">
        <h3 className="display text-2xl mb-2">★ Wildcards</h3>
        <p className="font-bold leading-snug">
          Five Wildcards are shuffled into the Super Power deck. When one comes up, the judge types a power of their own,
          everyone sees it, and the round plays out normally.
        </p>
      </div>
    </div>

    <h2 className="display text-4xl mb-2">Plot Twists</h2>
    <p className="max-w-3xl font-bold text-muted mb-5">
      {TWISTS.length} Plot Twists are shuffled into the Super Power deck, so about 1 round in 6 has one. A twist is
      its own card: it is shown alone first, and then the round&apos;s power card is drawn after it. The twist stays
      on the table next to the power and changes that round for everyone. Only one twist applies per round. Some twists
      need a minimum number of players and are simply not drawn in smaller rooms.
    </p>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
      {TWISTS.map((t) => (
        <div
          key={t.id}
          className="bg-coral text-ink border-[3px] border-ink rounded-2xl shadow-pop-sm p-5 flex flex-col gap-2"
        >
          <span className="text-[11px] font-black uppercase tracking-[0.15em]">🌀 Plot Twist</span>
          <h3 className="display text-3xl">{t.name}</h3>
          <p className="font-bold leading-snug">{t.description}</p>
          {t.minPlayers && (
            <span className="mt-auto self-start rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase">
              {t.minPlayers}+ players
            </span>
          )}
        </div>
      ))}
    </div>

    <h2 className="display text-4xl mb-4">Timers and dropped connections</h2>
    <div className="panel mb-12 space-y-3 font-bold leading-snug">
      <p>
        The host can set a <b>flaw timer</b> in the lobby (off, 60 or 90 seconds). Anyone who has not played when time
        runs out is skipped for that round.
      </p>
      <p>
        If you refresh the page, switch tabs or lose your connection, you rejoin the same seat with your hand and score
        intact. If a round is waiting on you, it waits about a minute and then skips you for that round only. You are
        never removed from the game.
      </p>
    </div>

    <div className="rounded-2xl bg-ink px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-white">
      <b className="display text-3xl tracking-wide">Ready to ruin a hero?</b>
      <Link
        to="/"
        className="rounded-full border-[3px] border-ink bg-sun px-6 py-3 text-sm font-black uppercase text-ink shadow-pop-sm"
      >
        Play now ↗
      </Link>
    </div>
  </div>
);

export default Rules;
