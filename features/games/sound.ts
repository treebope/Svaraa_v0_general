import type { GameSound } from '@/features/games/soundTypes';

// PENDING MOBILE: phone sound (expo-audio) comes with the mobile pass. Until then the phone and the tests are silent.
const none = () => undefined;
export const sound: GameSound = {
  unlock: none,
  jump: none,
  collect: none,
  over: none,
  startMusic: none,
  stopMusic: none,
  setSpeed: none,
  setMuted: none,
};
