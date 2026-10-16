# 🦸 Super Flawed

**Super Flawed** is a real-time multiplayer party game with a superhero skin. Every round a great superpower gets flipped, and everyone else races to sabotage it with the funniest possible flaw.

**Play it:** https://super-flawed.victor-yang.workers.dev (the first connection after a quiet spell can take about a minute while the free backend wakes up).

## 🎮 How to play

The same rules are on the site's **/rules** page. That page and the landing page's twist list read straight from `server/src/twists.ts`, so the list stays in step with the game; the other numbers (win score, hand size, player limits) mirror `server/src/config.ts`.

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

There are 17 twists (about 1 round in 6 has one). Some need a minimum number of players and are simply not drawn in smaller rooms.

| Twist | What it does |
|-------|--------------|
| **Super Strength** | The round is worth 2 points. |
| **Opposite Day** | The judge picks the **least** funny flaw, and it wins. |
| **Sidekick** | The winner's point is also given to a second player, **chosen by the winner** (not the judge or themselves). If only one player qualifies, they get it automatically. |
| **Villain** | The winner also steals 1 point from a player who has one (judge picks; automatic if only one player has points). Does nothing if nobody has points. |
| **Team Up** *(5+ players)* | Players are randomly paired (one team of 3 when odd) and each team's flaws combine into one flaw. Every member of the winning team scores. |
| **Time Loop** | The same power is played twice in a row. Each pass has its own winner and scores. |
| **Sequel Bait** *(4+ players)* | The winner is picked but **kept secret and unscored**. Next round replays the same power with the **same flaws** (the new judge's own flaw sits out), judged by the next judge. Both winners are revealed and scored after the sequel, so nobody learns whose flaw is whose in either round. |
| **Civilian Casualty** | After the winner, the judge picks one other flaw (anonymously). Its author loses a point if they have one. Automatic if only one other flaw. |
| **Unmasked** | Authors are shown by name while judging. |
| **Crossover Event** | A second power is drawn. Flaws must ruin both. |
| **Reboot** | Every deck is reshuffled from scratch (all discards go back in) and everyone is dealt a brand-new hand. |
| **Alternate Timeline** | After the winner scores, **first place and last place swap points**. Ties for first or last are broken at random. |
| **Power Outage** | The power is hidden from players while they play. It is revealed at judging (the judge still sees it). |
| **Arch Nemesis** | The winner scores, and the highest-scoring *other* player loses a point (all tied leaders lose one). |
| **Multiverse Mixup** | All hands are shuffled together and dealt back out, so you play someone else's cards. |
| **Public Service Announcement** | Emergency broadcast: only **20 seconds** to play a flaw, whatever the room timer says. |
| **Breaking the Fourth Wall** *(4+ players)* | The judge looks into everyone's hand and **chooses the flaw each player plays** (players don't pick their own). The players then vote on the flaws, and you can't vote for your own. Most votes wins. **If there is a tie, the judge votes** between the tied flaws. The judge doesn't play a flaw or vote otherwise. |

Points never go below 0. Only one twist per round.

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
| Hosting  | Cloudflare Pages (client), Render (server)   |

## 📁 Project structure

```
super-flawed/
├── src/                   # React client
│   ├── components/        # cards/, game/, layout/, ui/
│   ├── contexts/          # GameContext: socket + room state
│   ├── hooks/             # useRoomSession, useCountdown, useToast
│   ├── pages/             # HomePage, Rules, Lobby, GameRoom
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
| `submit-card` | Client → Server | Play a flaw from your hand |
| `choose-cards` | Judge → Server | Choose a card from each player's hand (Breaking the Fourth Wall) |
| `vote` | Client → Server | Vote for a flaw (Breaking the Fourth Wall) |
| `pick-winner` | Judge → Server | Pick the winning flaw |
| `pick-target` | Judge or winner → Server | Make a twist's follow-up pick (Sidekick: the winner; Villain, Civilian Casualty: the judge) |
| `play-again` | Host → Server | Return to the lobby after a game |
| `leave-room` | Client → Server | Leave the room |
| `update-state` | Server → Client | Your personalised view of the room |

## 🚀 Deploying

- **Server:** Render web service from `server/` (see `render.yaml`). Build `npm install --include=dev && npm run build`, start `node dist/index.js`.
- **Client:** Cloudflare Pages is connected to this repo and deploys automatically when `main` changes (build command `npm run build`, output directory `dist`). `superflawed.com` and `www.superflawed.com` are Pages custom domains. Any new client origin must be added to `allowedOrigins` in `server/src/index.ts`.

## 🧱 Roadmap

- [ ] More Plot Twists (ideas welcome; Origin Story was cut and could be reworked)
- [ ] Public matchmaking
- [ ] Leaderboards and match history
- [ ] Card pack editor (custom powers and flaws)

---

## 👨‍💻 Author

Made with ☕ and 😄 by [Victor Yang](https://github.com/hongtayvy). Inspired by group chats that got a little out of hand.

---

## 📜 License
