import { REPLY_GAP_MS, VOICE_RATE, openVoiceChannel, type VoiceChannel } from './voiceChannel';
import type { VoiceHandlers, VoiceSession, VoiceState } from './voiceScripted';

/**
 * A real voice conversation over WS /api/v1/voice/ws (browser only: Web Audio, getUserMedia). The socket itself is
 * voiceChannel.ts, shared with the pendant. Contract (frontend-api-contract, section 5.3):
 *  - the server first sends a text frame {"type":"session","session_id",...};
 *  - the app streams raw microphone audio: 16-bit PCM, 16 kHz, mono, small binary chunks (~100 ms);
 *  - the server decides when the person stopped talking (~1 s of silence) and answers with MP3 chunks;
 *  - there is no reply text and no "reply finished" marker: ~1 s with no new chunk = the reply is complete.
 * Speech recognition on the server is Hindi only for now. No sign-in is accepted on the socket yet.
 * The microphone is not sent while Svaraa speaks, so it does not hear itself and answer.
 */
const RATE = VOICE_RATE;
/** Microphone level (RMS, 0..1) above which the person counts as speaking. Only drives the orb, not the server. */
const SPEECH_LEVEL = 0.02;
/** Quiet after speech before we show "thinking" (the server waits about 1 s). */
const SILENCE_MS = 900;
/** No reply this long after the person spoke: go back to listening (the server may have heard nothing useful). */
const NO_REPLY_MS = 20_000;

export function startSocketVoice(handlers: VoiceHandlers): VoiceSession {
  let state: VoiceState = 'connecting';
  handlers.onState(state);
  const set = (next: VoiceState) => {
    if (next === state || stopped) return;
    state = next;
    handlers.onState(next);
  };

  let stopped = false;
  let muted = false;
  let channel: VoiceChannel | undefined;
  let stream: MediaStream | undefined;
  let ctx: AudioContext | undefined;
  let processor: ScriptProcessorNode | undefined;
  let playing: HTMLAudioElement | undefined;
  let replyTimer: ReturnType<typeof setTimeout> | undefined;
  let noReplyTimer: ReturnType<typeof setTimeout> | undefined;
  const chunks: ArrayBuffer[] = [];
  let lastVoiceAt = 0;
  let leftover = new Float32Array(0);

  const cleanup = () => {
    stopped = true;
    clearTimeout(replyTimer);
    clearTimeout(noReplyTimer);
    channel?.close();
    stream?.getTracks().forEach((track) => track.stop());
    processor?.disconnect();
    void ctx?.close().catch(() => {});
    playing?.pause();
  };
  const fail = (error: 'blocked' | 'failed') => {
    if (stopped) return;
    cleanup();
    handlers.onError?.(error);
  };

  /** Average the browser's 44.1/48 kHz samples down to 16 kHz and turn them into 16-bit integers. */
  const toPcm16 = (input: Float32Array): Int16Array => {
    const ratio = (ctx?.sampleRate ?? RATE) / RATE;
    const all = new Float32Array(leftover.length + input.length);
    all.set(leftover);
    all.set(input, leftover.length);
    const count = Math.floor(all.length / ratio);
    const out = new Int16Array(count);
    for (let i = 0; i < count; i++) {
      const from = Math.floor(i * ratio);
      const to = Math.max(from + 1, Math.floor((i + 1) * ratio));
      let sum = 0;
      for (let j = from; j < to; j++) sum += all[j];
      const s = Math.max(-1, Math.min(1, sum / (to - from)));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    leftover = all.slice(Math.floor(count * ratio));
    return out;
  };

  const startCapture = () => {
    if (!stream || stopped) return;
    ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    // ~85 ms per buffer at 48 kHz. ScriptProcessorNode is old but works everywhere without a separate worklet file.
    processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => {
      if (stopped || muted || state === 'speaking' || !channel?.isReady()) return;
      const input = e.inputBuffer.getChannelData(0);
      let energy = 0;
      for (let i = 0; i < input.length; i++) energy += input[i] * input[i];
      const level = Math.sqrt(energy / input.length);
      const now = Date.now();
      if (level > SPEECH_LEVEL) {
        lastVoiceAt = now;
        clearTimeout(noReplyTimer);
        set('hearing');
      } else if (state === 'hearing' && now - lastVoiceAt > SILENCE_MS) {
        set('thinking');
        noReplyTimer = setTimeout(() => state === 'thinking' && set('listening'), NO_REPLY_MS);
      }
      channel.send(toPcm16(input)); // the bytes of the 16-bit samples
    };
    source.connect(processor);
    processor.connect(ctx.destination); // needed for the processor to run; it outputs silence
    set('listening');
  };

  const playReply = () => {
    if (stopped || !chunks.length) return;
    if (playing) {
      replyTimer = setTimeout(playReply, 300); // a second reply waits for the first to finish
      return;
    }
    const url = URL.createObjectURL(new Blob(chunks.splice(0), { type: 'audio/mpeg' }));
    const audio = new Audio(url);
    playing = audio;
    set('speaking');
    const done = () => {
      URL.revokeObjectURL(url);
      if (playing === audio) playing = undefined;
      leftover = new Float32Array(0);
      set(muted ? 'muted' : 'listening');
    };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  };

  const openSocket = () => {
    channel = openVoiceChannel({
      onReady: () => {
        if (state === 'connecting') startCapture();
      },
      // A piece of the spoken reply (MP3).
      onReplyChunk: (chunk) => {
        chunks.push(chunk);
        clearTimeout(noReplyTimer);
        if (state !== 'speaking') set('thinking');
        clearTimeout(replyTimer);
        replyTimer = setTimeout(playReply, REPLY_GAP_MS);
      },
      onClose: () => fail('failed'),
    });
  };

  if (!navigator.mediaDevices?.getUserMedia) {
    setTimeout(() => fail('failed'), 0);
  } else {
    navigator.mediaDevices
      .getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((track) => track.stop());
        stream = s;
        openSocket();
      })
      .catch((e: { name?: string }) =>
        fail(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'blocked' : 'failed'),
      );
  }

  return {
    setMuted: (value) => {
      if (stopped || value === muted) return;
      muted = value;
      if (state === 'connecting') return;
      if (value) set(state === 'speaking' ? 'speaking' : 'muted');
      else if (state === 'muted') set('listening');
    },
    stop: cleanup,
  };
}
