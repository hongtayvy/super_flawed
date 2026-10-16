# 🦸 Super Flawed

**Super Flawed** is a real-time multiplayer party game with a superhero skin. Every round a great superpower gets flipped, and everyone else races to sabotage it with the funniest possible flaw.

**Play it:** https://super-flawed.victor-yang.workers.dev (the first connection after a quiet spell can take about a minute while the free backend wakes up).

## 🎮 How to play

Private rooms for **3 to 8 players**. Create a room, share the code or invite link, and everyone joins from the lobby.

1. **The judge flips a card** from the Super Power deck.
2. **Everyone except the judge** plays a **Flaw** card from their hand to sabotage that power. The judge never plays a flaw in a normal round.
3. **The judge picks exactly one winner** (no ties). Flaws are anonymous to the judge, and nobody sees anyone else's flaw until judging starts. Authors are revealed after the pick.
4. **The winner scores a point.** The judge role then passes to the next player.
5. **First to 5 points wins.** If the lead is tied at 5 or more, play continues until someone is ahead.

### Judge rotation

Strict and automatic. The next player in the queue judges each round. After everyone has judged, the queue resets and cycles again. It is not choosable.

### Decks

- **Super Power deck** holds powers, **Plot Twists** and one **Wildcard**, all shuffled together. There is no separate twist deck or flip.
- **Flaw deck** reshuffles its discards back in when it runs out. Hands are 7 cards and refill after every round.
- Powers are generic descriptions only. No licensed characters.

### Card guidelines

Cards live in [`server/src/cards.ts`](server/src/cards.ts). A good flaw starts with "But", reads naturally after **any** power, is specific and absurd rather than generic, and fits on one card. Cut anything that is only funny with one particular power.

After editing, run `npm run check-cards` in `server/` (checks duplicates, length, wording, licensed names and deck size). The server also logs one `flaw_result` JSON line per played flaw (`flaw`, `power`, `won`), so you can tally win rates from the logs and drop cards that never win.

### Plot Twists and the Wildcard

Most draws are a normal power. Occasionally the card drawn is a **Plot Twist**. A twist is its own card: it is revealed on its own (about 5 seconds, `TWIST_REVEAL_MS`), and only then is the **next card drawn** to be the round's power. The twist stays on the table beside the power, never printed on it, and modifies that round for everyone. A round never stacks two twists: if a twist is drawn straight after another, the deck reshuffles and redraws.

There are 19 twists (about 1 round in 6 has one). Where the judge or players make a choice, it is listed.

| Twist | What it does |
|-------|--------------|
| **Super Strength** | The round is worth 2 points. |
| **Mirror Universe** | The judge picks the **least** funny flaw, and it wins. |
| **Sidekick** | The winner's point is also given to a second player (judge picks; not the winner or judge). |
| **Villain** | The winner also steals 1 point from a player who has one (judge picks). Does nothing if nobody has points. |
| **Team Up** | Flaws are randomly paired into one combined flaw ("…And …"). A winning pair both score; an odd one out plays solo. |
| **Origin Story** | Every flaw needs a one-line backstory (3 to 80 characters). The judge reads both. |
| **Time Loop** | The same power is played twice in a row. Each pass has its own winner and scores. |
| **Sequel Bait** | The next round replays this same power (no twist), with the next judge. |
| **Civilian Casualty** | After the winner, the judge picks one other flaw (anonymously). Its author loses a point if they have one. |
| **Unmasked** | Authors are shown by name while judging. |
| **Crossover Event** | A second power is drawn. Flaws must ruin both. |
| **Retcon** | Everyone's hand is replaced with fresh cards. |
| **Alternate Timeline** | The winning flaw scores for a *different* player than its author. Nobody scores for their own flaw. |
| **Power Outage** | The power is hidden from players while they play. It is revealed at judging (the judge still sees it). |
| **Nemesis** | The winner scores, and the highest-scoring *other* player loses a point (all tied leaders lose one). |
| **Multiverse Mixup** | All hands are shuffled together and dealt back out, so you play someone else's cards. |
| **Breaking the Fourth Wall** | Flaws are played face-up with names, live, and names stay visible while judging. |
| **Public Service Announcement** | Emergency broadcast: only 20 seconds to play a flaw, whatever the room timer says. |
| **Narrator Interrupts** | The judge plays a flaw too, mixed in anonymously. The judge can win with it. |

Points never go below 0. Twists never stack: only one per round.

**Wildcard:** one card in the Super Power deck. The judge **types a power of their own** (up to 100 characters), it is shown to everyone, and then play continues normally. If a flaw timer is set and it runs out, the table gets a random power instead.

Twists are plain data in [`server/src/twists.ts`](server/src/twists.ts): an id, name, description and a few generic flags/hooks the engine understands (`passes`, `teamUp`, `hidePower`, `target`, `afterWinner` and so on), so adding one means adding an object.

### Disconnects and reconnecting

- On first join the server issues a persistent **player ID**, separate from the socket ID. The client keeps it in `localStorage`.
- Hand, score and judge-queue position belong to the player ID. On refresh, a new tab or a dropped connection the client sends its ID and the server re-attaches the existing state.
- If a round is waiting on a disconnected player, it waits a grace period (60 seconds by default), then **skips them for that round only**. They are never removed from the game.
- The host can set an optional **flaw timer** (off, 60s or 90s) in the lobby.

## 🛠️ Tech stack

| Layer    | Tech                                        |
|----------|---------------------------------------------|
| Frontend | React + TypeScript + Vite                   |
| Styling  | Tailwind CSS 4                              |
| Backend  | Node.js + Express                           |
| Realtime | Socket.IO                                   |
| Hosting  | Cloudflare Workers (client), Render (server) |

## 📁 Project structure

```
super-flawed/
├── src/                   # React client
│   ├── components/        # cards/, game/, layout/, ui/
│   ├── contexts/          # GameContext: socket + room state
│   ├── hooks/             # useRoomSession, useCountdown, useToast
│   ├── pages/             # HomePage, Lobby, GameRoom
│   ├── types/             # Wire types shared with the server
│   └── utils/
├── public/                # Static assets (mascot art, favicon)
├── server/                # Node + Socket.IO game server
│   └── src/
│       ├── index.ts       # Socket handlers
│       ├── room.ts        # Game engine: rounds, judging, reconnect
│       ├── cards.ts       # Power and Flaw card data
│       ├── twists.ts      # Plot Twists (data)
│       ├── deck.ts        # Shuffle and reshuffle-on-empty deck
│       └── config.ts      # Rules and timing
├── render.yaml            # Render blueprint for the server
├── wrangler.jsonc         # Cloudflare deploy config for the client
└── README.md
```

The server is authoritative: it deals hands, scores rounds and decides who may see what. Each client only ever receives its own view of the room.

## 🧪 Running locally

```bash
git clone https://github.com/hongtayvy/super-flawed.git
cd super-flawed
```

Backend (port 4000):

```bash
cd server
npm install
npm run dev
```

Frontend (new terminal, from the repo root):

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. In development the client talks to `http://localhost:4000`.

Server settings can be overridden with environment variables: `PORT`, `RECONNECT_GRACE_MS` (default 60000) and `ROUND_END_MS` (default 6000). Other rules (win score, hand size, player limits, timer options) live in `server/src/config.ts`.

## 📡 Socket.IO events

All game state flows through the server. Actions are acknowledged with `{ ok, error? }`.

| Event | Direction | Description |
|-------|-----------|-------------|
| `create-room` | Client → Server | Create a private room; returns the code and your player ID |
| `join-room` | Client → Server | Join by code, or re-attach with a stored player ID |
| `player-ready` | Client → Server | Toggle ready in the lobby |
| `toggle-bots` | Host → Server | Add or remove practice bots |
| `set-timer` | Host → Server | Set the flaw timer (0, 60 or 90 seconds) |
| `start-game` | Host → Server | Start once 3 to 8 players are ready |
| `set-wildcard` | Judge → Server | Type the made-up power on a Wildcard round |
| `submit-card` | Client → Server | Play a flaw from your hand (with a `note` on Origin Story rounds) |
| `pick-winner` | Judge → Server | Pick the winning flaw |
| `pick-target` | Judge → Server | Resolve a Sidekick or Villain twist |
| `play-again` | Host → Server | Return to the lobby after a game |
| `leave-room` | Client → Server | Leave the room |
| `update-state` | Server → Client | Your personalised view of the room |

## 🚀 Deploying

- **Server:** Render web service from `server/` (see `render.yaml`). Build `npm install --include=dev && npm run build`, start `node dist/index.js`.
- **Client:** `npm run build && npx wrangler deploy` from the repo root. Add the deployed origin to `allowedOrigins` in `server/src/index.ts`.

## 🧱 Roadmap

- [ ] More Plot Twists (Time Loop, Origin Story, Narrator Interrupts and others)
- [ ] Public matchmaking
- [ ] Leaderboards and match history
- [ ] Card pack editor (custom powers and flaws)

---

## 👨‍💻 Author

Made with ☕ and 😄 by [Victor Yang](https://github.com/hongtayvy). Inspired by group chats that got a little out of hand.

---

## 📜 License
