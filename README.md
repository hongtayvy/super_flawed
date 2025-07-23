# 🃏 Super Flawed

**Super Flawed** is a real-time multiplayer party game where players create ridiculous superheroes—only to have their powers hilariously ruined by other players. Inspired by *Cards Against Humanity*, the game thrives on creativity, chaos, and quick wit.

## 🚀 Live Demo

Coming soon!  
To play locally, follow the steps in [Running Locally](#-running-locally).

## 🎮 Game Overview

- One player becomes the **Super Hero** each round.
- A random **Superpower** is drawn.
- Everyone else submits a **Flaw Card** to sabotage it.
- The Super Hero picks the funniest or most devastating combo.
- First player to 5 points wins!

## 🛠️ Tech Stack

| Layer      | Tech                          |
|------------|-------------------------------|
| Frontend   | React + TypeScript + Vite     |
| Backend    | Node.js + Express             |
| Realtime   | Socket.IO                     |
| Styling    | CSS Modules                   |

## 📁 Project Structure

```
super_flawed/
├── client/                # React frontend
│   ├── components/        # Reusable UI elements
│   ├── pages/             # Lobby, Game, Results pages
│   ├── types/             # Shared TypeScript types
│   └── utils/             # Card shuffling, game helpers
│
├── server/                # Node.js + Socket.IO backend
│   ├── game/              # Game state, card logic, socket handlers
│   └── index.js           # Server entry point
│
└── README.md              # You’re reading it!
```

---

## 🧪 Running Locally

### 1. Clone the repo

```bash
git clone https://github.com/hongtayvy/super_flawed.git
cd super_flawed
```

### 2. Start the backend server

```bash
cd server
npm install
node index.js
```

### 3. Start the frontend client

Open a new terminal window:

```bash
cd client
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser to start playing.

---

## 📡 Socket.IO Events

| Event           | Direction       | Description                         |
|------------------|------------------|-------------------------------------|
| `join-room`      | Client → Server  | Player joins the game room          |
| `start-round`    | Host → Server    | Begin a new round                   |
| `submit-card`    | Client → Server  | Submit a flaw for judging           |
| `choose-winner`  | Czar → Server    | Czar selects the round winner       |
| `update-state`   | Server → Clients | Broadcast updated game state        |
| `chat-message`   | Bidirectional    | In-game chat messages               |

---

## 🧱 Roadmap

- [ ] Player avatars and nicknames
- [ ] Leaderboards and match history
- [ ] Custom game settings
- [ ] Mobile layout and responsiveness
- [ ] Card pack editor (custom powers & flaws)

---

## 👨‍💻 Author

Made with ☕ and 😄 by [Victor Yang](https://github.com/hongtayvy)  Inspired by group chats that got a little out of hand.

---

## 📜 License
