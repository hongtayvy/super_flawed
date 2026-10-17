import { useEffect, useState } from 'react';
import { SERVER_URL } from '../../socket';

// A small build stamp so a deploy can be confirmed at a glance: the site's own version and,
// once it answers, the game server's. A mismatch means one side has not finished deploying.
const VersionTag = () => {
  const [server, setServer] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${SERVER_URL}/version`)
      .then((r) => r.json())
      .then((v: { version: string; commit: string }) => setServer(`v${v.version} (${v.commit})`))
      .catch(() => setServer('offline'));
  }, []);

  return (
    <p className="py-4 text-center text-[11px] font-bold tracking-wide text-muted">
      Site v{__APP_VERSION__} ({__APP_COMMIT__}) · Server {server ?? '...'}
    </p>
  );
};

export default VersionTag;
