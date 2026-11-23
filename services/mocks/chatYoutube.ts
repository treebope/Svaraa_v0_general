/**
 * PENDING BACKEND: phrase → youtube events for the curated Music > YouTube collection.
 * Mirrors backend play_youtube_collection / control_youtube when those tools are not available.
 */
import i18n from '@/i18n';
import { matchYoutubeVideo } from '@/features/music/youtubeCatalog';
import type { components } from '@/services/api/schema';

type ChatResponse = components['schemas']['ChatResponse'];
type Parsed = { response: string; events: ChatResponse['events'] };

/**
 * If the message looks like a YouTube / curated bhajan ask, return a reply + events.
 */
export function mockYoutubeChat(message: string): Parsed | null {
  const text = message.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (
    /\b(pause|stop)\b.*\b(youtube|video)\b|\b(youtube|video)\b.*\b(pause|stop)\b|यूट्यूब.*(रोको|बंद)/i.test(
      lower,
    )
  ) {
    const action = /\bpause\b|रोको/.test(lower) ? 'pause' : 'stop';
    return {
      response: i18n.t(`chat.mock.youtube.${action}`),
      events: [{ type: 'youtube', action }],
    };
  }
  if (
    /\b(next|skip)\b.*\b(youtube|video)\b|\b(youtube|video)\b.*\b(next|skip)\b|अगला.*(यूट्यूब|वीडियो)/i.test(
      lower,
    )
  ) {
    return {
      response: i18n.t('chat.mock.youtube.next'),
      events: [{ type: 'youtube', action: 'next' }],
    };
  }

  const video = matchYoutubeVideo(text);
  if (!video) return null;

  return {
    response: i18n.t('chat.mock.youtube.playing', { title: video.title }),
    events: [
      {
        type: 'youtube',
        action: 'play',
        video_id: video.id,
        title: video.title,
        channel: video.channel,
      },
    ],
  };
}
