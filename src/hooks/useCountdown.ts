import { useEffect, useState } from 'react';

// Seconds left until an epoch-ms deadline, or null when there is no deadline.
export const useCountdown = (deadline: number | null) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [deadline]);

  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
};
