import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';

// Re-attaches to a room on refresh/new tab using the stored player ID, and keeps
// the URL in step with the room's phase. Returns true once the room is ready.
export const useRoomSession = (code: string, view: 'lobby' | 'game') => {
  const navigate = useNavigate();
  const { state, resume } = useGame();
  const [checked, setChecked] = useState(state?.gameCode === code);

  useEffect(() => {
    if (state?.gameCode === code) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    resume(code).then((ok) => {
      if (cancelled) return;
      // No stored player for this room: send them to the join form with the code filled in.
      if (!ok) navigate(`/?join=${code}`, { replace: true });
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const phase = state?.gameCode === code ? state.phase : null;
  useEffect(() => {
    if (!phase) return;
    if (view === 'lobby' && phase !== 'lobby') navigate(`/game/${code}`, { replace: true });
    if (view === 'game' && phase === 'lobby') navigate(`/lobby?code=${code}`, { replace: true });
  }, [phase, view, code, navigate]);

  return checked && state?.gameCode === code ? state : null;
};
