// 8 preset avatar options with emojis
export const AVATAR_PRESETS = [
  { id: 1, bg: '#C5F542', emoji: '🚀' },
  { id: 2, bg: '#FFC107', emoji: '⚡' },
  { id: 3, bg: '#FF6B6B', emoji: '🔥' },
  { id: 4, bg: '#4ECDC4', emoji: '🌊' },
  { id: 5, bg: '#A78BFA', emoji: '✨' },
  { id: 6, bg: '#FB923C', emoji: '🎯' },
  { id: 7, bg: '#34D399', emoji: '🌱' },
  { id: 8, bg: '#F472B6', emoji: '💎' },
]

export const getAvatar = (avatarId) =>
  AVATAR_PRESETS.find((a) => a.id === avatarId) || AVATAR_PRESETS[0]
