// Eight clearly different hero colors, one per avatar choice.
const AVATAR_COLORS = [
  'bg-coral text-ink',
  'bg-sun text-ink',
  'bg-mint text-ink',
  'bg-lilac text-ink',
  'bg-cobalt text-white',
  'bg-pink text-ink',
  'bg-sky text-ink',
  'bg-ink text-white',
];

export const getAvatarColor = (avatarId: string) =>
  AVATAR_COLORS[(parseInt(avatarId) || 0) % AVATAR_COLORS.length];
