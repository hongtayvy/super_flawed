import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { socket } from '../socket';
import type { RoomState } from '../types/game';

type Ack = { ok: boolean; error?: string; gameCode?: string; playerId?: string };

interface GameContextType {
  state: RoomState | null;
  connected: boolean;
  createRoom: (name: string, avatar: string) => Promise<Ack>;
  joinRoom: (code: string, name: string, avatar: string) => Promise<Ack>;
  // Rejoin a room using the player ID kept in localStorage. False if there is none.
  resume: (code: string) => Promise<boolean>;
  leaveRoom: () => void;
  setReady: (isReady: boolean) => void;
  toggleBots: () => void;
  setTimerSeconds: (seconds: number) => void;
  startGame: () => Promise<Ack>;
  setWildcard: (text: string) => Promise<Ack>;
  submitCard: (cardId: string) => Promise<Ack>;
  vote: (entryId: string) => Promise<Ack>;
  chooseCards: (picks: { playerId: string; cardId: string }[]) => Promise<Ack>;
  pickWinner: (entryId: string) => Promise<Ack>;
  pickTarget: (targetId: string) => Promise<Ack>;
  playAgain: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// The server issues a persistent player ID on first join. It is kept per room so a
// refresh, a new tab or a dropped connection re-attaches to the same player.
const storageKey = (code: string) => `sf:player:${code.toUpperCase()}`;
const readPlayerId = (code: string) => {
  try {
    return localStorage.getItem(storageKey(code));
  } catch {
    return null;
  }
};
const savePlayerId = (code: string, id: string) => {
  try {
    localStorage.setItem(storageKey(code), id);
  } catch {
    /* storage unavailable: reconnect just won't survive a refresh */
  }
};
const forgetPlayerId = (code: string) => {
  try {
    localStorage.removeItem(storageKey(code));
  } catch {
    /* ignore */
  }
};

const emitWithAck = (event: string, payload: object = {}) =>
  new Promise<Ack>((resolve) => {
    socket.timeout(8000).emit(event, payload, (err: Error | null, res?: Ack) => {
      resolve(err || !res ? { ok: false, error: 'Could not reach the server. Try again.' } : res);
    });
  });

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const activeCode = useRef<string | null>(null);

  const rejoin = useCallback((code: string) => {
    const playerId = readPlayerId(code);
    if (!playerId) return Promise.resolve<Ack>({ ok: false });
    return emitWithAck('join-room', { gameCode: code, playerId });
  }, []);

  useEffect(() => {
    const onState = (next: RoomState) => setState(next);
    const onConnect = () => {
      setConnected(true);
      // A dropped connection comes back as a brand new socket: re-attach.
      if (activeCode.current) void rejoin(activeCode.current);
    };
    const onDisconnect = () => setConnected(false);

    socket.on('update-state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('update-state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [rejoin]);

  const createRoom = useCallback(async (name: string, avatar: string) => {
    const res = await emitWithAck('create-room', { player: { name, avatar } });
    if (res.ok && res.gameCode && res.playerId) {
      savePlayerId(res.gameCode, res.playerId);
      activeCode.current = res.gameCode;
    }
    return res;
  }, []);

  const joinRoom = useCallback(async (code: string, name: string, avatar: string) => {
    const gameCode = code.trim().toUpperCase();
    const res = await emitWithAck('join-room', {
      gameCode,
      playerId: readPlayerId(gameCode) ?? undefined,
      player: { name, avatar },
    });
    if (res.ok && res.gameCode && res.playerId) {
      savePlayerId(res.gameCode, res.playerId);
      activeCode.current = res.gameCode;
    }
    return res;
  }, []);

  const resume = useCallback(
    async (code: string) => {
      const gameCode = code.toUpperCase();
      const res = await rejoin(gameCode);
      if (res.ok) {
        activeCode.current = gameCode;
        return true;
      }
      // The room is gone or the stored ID is stale.
      if (res.error) forgetPlayerId(gameCode);
      return false;
    },
    [rejoin],
  );

  const leaveRoom = useCallback(() => {
    if (activeCode.current) forgetPlayerId(activeCode.current);
    socket.emit('leave-room');
    activeCode.current = null;
    setState(null);
  }, []);

  const value: GameContextType = {
    state,
    connected,
    createRoom,
    joinRoom,
    resume,
    leaveRoom,
    setReady: (isReady) => socket.emit('player-ready', { isReady }),
    toggleBots: () => socket.emit('toggle-bots'),
    setTimerSeconds: (seconds) => socket.emit('set-timer', { seconds }),
    startGame: () => emitWithAck('start-game'),
    setWildcard: (text) => emitWithAck('set-wildcard', { text }),
    submitCard: (cardId) => emitWithAck('submit-card', { cardId }),
    vote: (entryId) => emitWithAck('vote', { entryId }),
    chooseCards: (picks) => emitWithAck('choose-cards', { picks }),
    pickWinner: (entryId) => emitWithAck('pick-winner', { entryId }),
    pickTarget: (targetId) => emitWithAck('pick-target', { targetId }),
    playAgain: () => socket.emit('play-again'),
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
