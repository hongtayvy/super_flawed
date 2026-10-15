const AVATAR_COLORS = [
  'bg-coral text-ink',
  'bg-sun text-ink',
  'bg-mint text-ink',
  'bg-lilac text-ink',
  'bg-cobalt text-white',
  'bg-white text-ink',
  'bg-ink text-white',
  'bg-ice text-ink',
];

export const getAvatarColor = (avatarId: string) =>
  AVATAR_COLORS[(parseInt(avatarId) || 0) % AVATAR_COLORS.length];
