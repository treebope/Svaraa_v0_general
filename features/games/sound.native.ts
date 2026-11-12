import type { GameSound } from '@/features/games/soundTypes';

/** The little of expo-audio that is used here. It is loaded on first use, so a phone without it (and the tests) stay silent. */
interface Player {
  play: () => void;
  pause: () => void;
  seekTo(seconds: number): Promise<void>;
  loop: boolean;
  volume: number;
}
interface AudioApi {
  createAudioPlayer: (source: number) => Player;
  setAudioModeAsync(mode: { playsInSilentMode: boolean }): Promise<void>;
}

// The sounds are made by scripts/make-game-sounds.py. The files are named here so Metro can bundle them.
const FILES = {
  collect: () => require('../../assets/sounds/collect.wav') as number,
  jump: () => require('../../assets/sounds/jump.wav') as number,
  over: () => require('../../assets/sounds/over.wav') as number,
  music: () => require('../../assets/sounds/music.wav') as number,
};
type Name = keyof typeof FILES;

let api: AudioApi | undefined | null;
const players: Partial<Record<Name, Player>> = {};
let muted = false;
let musicOn = false;

const audio = (): AudioApi | undefined => {
  if (api !== undefined) return api ?? undefined;
  try {
    api = require('expo-audio') as AudioApi;
    // Games are played on purpose: let them be heard even when the phone's silent switch is on (there is a mute button).
    void api.setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  } catch {
    api = null;
  }
  return api ?? undefined;
};

const player = (name: Name): Player | undefined => {
  const a = audio();
  if (!a) return undefined;
  try {
    let p = players[name];
    if (!p) {
      p = a.createAudioPlayer(FILES[name]());
      if (name === 'music') {
        p.loop = true;
        p.volume = 0.45;
      }
      players[name] = p;
    }
    return p;
  } catch {
    return undefined;
  }
};

/** Play a short sound from the start. */
const blip = (name: Name) => {
  if (muted) return;
  const p = player(name);
  if (!p) return;
  void p
    .seekTo(0)
    .catch(() => undefined)
    .then(() => p.play());
};

export const sound: GameSound = {
  unlock: () => {
    audio();
  },
  jump: () => blip('jump'),
  collect: () => blip('collect'),
  over: () => blip('over'),
  startMusic: () => {
    musicOn = true;
    if (muted) return;
    const p = player('music');
    if (!p) return;
    void p
      .seekTo(0)
      .catch(() => undefined)
      .then(() => p.play());
  },
  stopMusic: () => {
    musicOn = false;
    players.music?.pause();
  },
  setSpeed: () => undefined,
  setMuted: (m) => {
    muted = m;
    if (m) players.music?.pause();
    else if (musicOn) players.music?.play();
  },
};
