import { create } from 'zustand';
import { getTrack, type Track } from '@/services/music/musicApi';

/** The little of expo-audio used here. Loaded on first use, so the tests (and a build without it) stay silent. */
interface Player {
  play(): void;
  pause(): void;
  replace(source: string): void;
  remove(): void;
  currentTime: number;
  duration: number;
  seekTo(seconds: number): Promise<void>;
  addListener(
    event: 'playbackStatusUpdate',
    listener: (status: {
      didJustFinish?: boolean;
      currentTime?: number;
      duration?: number;
      playing?: boolean;
    }) => void,
  ): {
    remove(): void;
  };
}
interface AudioApi {
  createAudioPlayer(source: string, options?: { updateInterval?: number }): Player;
  setAudioModeAsync(mode: { playsInSilentMode: boolean; shouldPlayInBackground?: boolean }): Promise<void>;
}

let api: AudioApi | null | undefined;
let player: Player | undefined;
let statusSub: { remove(): void } | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;

function audio(): AudioApi | null {
  if (api !== undefined) return api;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    api = require('expo-audio') as AudioApi;
    // Music is played on purpose: let it be heard when the phone's silent switch is on.
    void api
      .setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true })
      .catch(() => undefined);
  } catch {
    api = null;
  }
  return api;
}

function clearPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

function syncTimeFromPlayer() {
  if (!player) return;
  const position = Number.isFinite(player.currentTime) ? Math.max(0, player.currentTime) : 0;
  const duration = Number.isFinite(player.duration) ? Math.max(0, player.duration) : 0;
  const prev = useMusicPlayer.getState();
  if (prev.position === position && prev.duration === duration) return;
  useMusicPlayer.setState({ position, duration });
}

function startPoll() {
  clearPoll();
  pollTimer = setInterval(syncTimeFromPlayer, 250);
}

function attachPlayer(p: Player) {
  statusSub?.remove();
  statusSub = p.addListener('playbackStatusUpdate', (s) => {
    if (s.didJustFinish) {
      clearPoll();
      useMusicPlayer.setState({ status: 'idle', position: 0 });
      return;
    }
    const patch: Partial<State> = {};
    if (typeof s.currentTime === 'number' && Number.isFinite(s.currentTime)) {
      patch.position = Math.max(0, s.currentTime);
    }
    if (typeof s.duration === 'number' && Number.isFinite(s.duration)) {
      patch.duration = Math.max(0, s.duration);
    }
    if (Object.keys(patch).length) useMusicPlayer.setState(patch);
  });
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused';

type State = {
  track?: Track;
  status: PlayerStatus;
  /** Seconds into the current song. */
  position: number;
  /** Total length in seconds (0 until known). */
  duration: number;
  /** 'unplayable' = the song has no audio yet; otherwise an error from the server or the player. */
  error: unknown;
  play(track: Track): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  seek(seconds: number): Promise<void>;
};

/** Error for a song the server has no audio for yet. */
export class NotPlayable extends Error {
  constructor() {
    super('This song is not playable yet');
    this.name = 'NotPlayable';
  }
}

/**
 * The Music app's player, on this phone (or browser). Before each song it asks the server for a fresh link
 * (GET /music/tracks/{id}), because the links expire after a few hours.
 * PENDING PENDANT: the wireframes play music on the pendant; for now it plays on the phone.
 */
export const useMusicPlayer = create<State>((set, get) => ({
  status: 'idle',
  position: 0,
  duration: 0,
  error: null,
  play: async (track) => {
    set({ track, status: 'loading', error: null, position: 0, duration: 0 });
    try {
      const fresh = await getTrack(track.id);
      if (get().track?.id !== track.id) return; // another song was picked meanwhile
      if (!fresh.stream_url) throw new NotPlayable();
      const a = audio();
      if (!a) throw new Error('Audio is not available in this build');
      if (player) player.replace(fresh.stream_url);
      else {
        player = a.createAudioPlayer(fresh.stream_url, { updateInterval: 250 });
        attachPlayer(player);
      }
      player.play();
      set({ track: fresh, status: 'playing' });
      startPoll();
      syncTimeFromPlayer();
    } catch (error) {
      clearPoll();
      if (get().track?.id === track.id) set({ status: 'idle', error, position: 0, duration: 0 });
    }
  },
  pause: () => {
    player?.pause();
    clearPoll();
    syncTimeFromPlayer();
    if (get().status === 'playing') set({ status: 'paused' });
  },
  resume: () => {
    if (!player || get().status !== 'paused') return;
    player.play();
    set({ status: 'playing' });
    startPoll();
  },
  stop: () => {
    player?.pause();
    clearPoll();
    set({ track: undefined, status: 'idle', error: null, position: 0, duration: 0 });
  },
  seek: async (seconds) => {
    if (!player) return;
    const duration = get().duration || player.duration || 0;
    const next = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds);
    set({ position: next });
    try {
      await player.seekTo(next);
      syncTimeFromPlayer();
    } catch {
      /* seek unsupported in some test / silent builds */
    }
  },
}));
