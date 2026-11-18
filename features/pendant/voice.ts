import { useEffect } from 'react';
import { create } from 'zustand';
import { env } from '@/config/env';
import { flags } from '@/config/flags';
import type { AudioFormat } from '@/services/audio/codecs';
import { pendant } from '@/services/pendant';
import {
  startPendantVoice,
  type PendantVoiceState,
  type PendantVoiceStats,
  type ReplyTarget,
} from '@/services/voice/pendantVoice';
import { voiceSocketUrl } from '@/services/voice/voiceChannel';

const MAX_LOG = 40;

type PendantVoiceInfo = {
  enabled: boolean;
  url: string;
  replyTo: ReplyTarget;
  state: PendantVoiceState;
  format?: AudioFormat;
  stats: PendantVoiceStats;
  error?: string;
  log: string[];
};

/** What the pendant voice is doing, for screens (the dev screen now, the Listening row later). */
export const usePendantVoiceInfo = create<PendantVoiceInfo>(() => ({
  enabled: flags.pendantVoice === 'svaraa',
  url: voiceSocketUrl(env.wsUrl, undefined),
  replyTo: flags.pendantReply,
  state: 'waiting',
  stats: { framesIn: 0, chunksSent: 0, dropped: 0, replies: 0, framesOut: 0 },
  log: [],
}));

const addLog = (line: string) => {
  const time = new Date().toTimeString().slice(0, 8);
  usePendantVoiceInfo.setState((s) => ({ log: [`${time} ${line}`, ...s.log].slice(0, MAX_LOG) }));
};

/**
 * Runs the pendant voice for the whole app while `flags.pendantVoice` is 'svaraa': what the pendant hears goes to
 * Svaraa's voice socket and the reply plays on the phone or the pendant (`flags.pendantReply`). Mount once, near
 * the root.
 */
export function usePendantVoice() {
  useEffect(() => {
    if (flags.pendantVoice !== 'svaraa') return;
    const voice = startPendantVoice({ transport: pendant(), replyTo: flags.pendantReply });
    const off = voice.subscribe({
      onState: (state) => usePendantVoiceInfo.setState({ state, format: voice.getFormat() }),
      onStats: (stats) => usePendantVoiceInfo.setState({ stats }),
      onError: (error) => usePendantVoiceInfo.setState({ error }),
      onLog: addLog,
    });
    return () => {
      off();
      voice.stop();
    };
  }, []);
}
