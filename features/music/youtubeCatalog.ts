import { Platform, type DimensionValue } from 'react-native';

/** Curated YouTube embeds for Music > YouTube (phone/web). Official embed URLs only. */

/** Playing strip height: 4 cm (CSS on web; physical approx on native). */
export const YOUTUBE_PLAYER_HEIGHT: DimensionValue =
  Platform.OS === 'web' ? '4cm' : Math.round((4 / 2.54) * 160);

export type YoutubeVideo = {
  id: string;
  /** Share `si` from YouTube’s embed code. */
  si: string;
  title: string;
  channel: string;
  /** Lowercase EN/HI/transliteration cues for chat matching. */
  keywords: readonly string[];
};

export const YOUTUBE_VIDEOS: readonly YoutubeVideo[] = [
  {
    id: 'krGYd5tZe0A',
    si: 'l1nzcn7e2Zer8LlP',
    title: 'Sri Venkateswara Suprabhatham',
    channel: 'MS Subbulakshmi · Saregama',
    keywords: [
      'suprabhatham',
      'suprabhat',
      'venkateswara',
      'venkatesh',
      'tirupati',
      'balaji',
      'morning prayer',
      'subbulakshmi',
      'सुप्रभात',
      'वेंकटेश्वर',
      'तिरुपति',
    ],
  },
  {
    id: 'dTWckdT_TNQ',
    si: 'Tzer8bGJqMZkW4_D',
    title: 'Vishnu Sahasranama Stotram',
    channel: 'MS Subbulakshmi · Rigveda Media',
    keywords: [
      'sahasranama',
      'sahasranamam',
      'vishnu',
      'narayana',
      'thousand names',
      'विष्णु',
      'सहस्रनाम',
      'नारायण',
    ],
  },
  {
    id: '442ewPgXHQ0',
    si: 'VbfCqv0eydHTDhuw',
    title: 'Aigiri Nandini · Mahishasura Mardini',
    channel: 'Rajalakshmee Sanjay · Rajshri Soul',
    keywords: [
      'aigiri',
      'nandini',
      'mahishasura',
      'mardini',
      'durga',
      'devi',
      'goddess',
      'shakti',
      'दुर्गा',
      'देवी',
      'शक्ति',
      'महिषासुर',
    ],
  },
  {
    id: 'Z1DP7MKH9Rc',
    si: 'CBmhFQFvNxmIv8RZ',
    title: 'Nirvana Shatakam (1 Hour)',
    channel: 'Sounds of Isha',
    keywords: ['nirvana', 'shatakam', 'adi shankara', 'shankaracharya', 'meditation', 'निर्वाण', 'षट्कम'],
  },
  {
    id: 'ZpPYC5NYyZY',
    si: '_CpK6BX-3JFhbwte',
    title: 'Yoga Yoga Yogeshwaraya',
    channel: 'Sadhguru · Sounds of Isha',
    keywords: ['yoga yoga', 'yogeshwaraya', 'sadhguru', 'isha', 'योगेश्वर', 'साधगुरु'],
  },
  {
    id: 'GvtLszZkXsk',
    si: 'IFJ3TUshCjUuT6g5',
    title: 'Yogeshwaraya Mahadevaya',
    channel: 'Sadhguru · Sounds of Isha',
    keywords: [
      'mahadevaya',
      'mahadev',
      'maheshwara',
      'shiva prayer',
      'shiva bhajan',
      'shiv bhajan',
      'intense',
      'soulful',
      'महादेव',
      'शिव',
      'भोलेनाथ',
    ],
  },
  {
    id: 'HmT53X_89B0',
    si: 'zQ8hTpMsKx3JnaPU',
    title: 'Shiv Tandav Stotram',
    channel: 'Zee Music Devotional',
    keywords: [
      'tandav',
      'tandava',
      'shiv tandav',
      'shiva tandav',
      'ravana',
      'रावण',
      'ताण्डव',
      'तांडव',
      'शिव तांडव',
    ],
  },
] as const;

const PLAY_INTENT =
  /\b(play|put\s+on|start|sunao|chalao|bajao|gaao|youtube|video|bhajan|prayer|stotram|chant|stotra)\b|चलाओ|सुनाओ|बजाओ|भजन|प्रार्थना|स्तोत्र|यूट्यूब/i;

/** Pick the best curated video for a chat/voice phrase, or null if none fits. */
export function matchYoutubeVideo(message: string): YoutubeVideo | null {
  const text = message.trim();
  if (!text || !PLAY_INTENT.test(text)) return null;
  const lower = text.toLowerCase();

  let best: YoutubeVideo | null = null;
  let bestScore = 0;
  for (const video of YOUTUBE_VIDEOS) {
    let score = 0;
    for (const raw of video.keywords) {
      const kw = raw.toLowerCase();
      if (!kw) continue;
      if (lower.includes(kw)) score += kw.length >= 6 ? 3 : kw.length >= 4 ? 2 : 1;
    }
    // Soft boosts for deity words that several tracks share.
    if (/\bshiva\b|शिव/.test(lower) && video.id === 'GvtLszZkXsk') score += 2;
    if (/\bshiva\b|शिव/.test(lower) && video.id === 'Z1DP7MKH9Rc') score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = video;
    }
  }

  if (bestScore > 0) return best;
  // Explicit YouTube with no theme → first in the collection.
  if (/\byoutube\b|यूट्यूब/.test(lower)) return YOUTUBE_VIDEOS[0];
  return null;
}

export function youtubeById(id: string): YoutubeVideo | undefined {
  return YOUTUBE_VIDEOS.find((v) => v.id === id);
}

export function youtubeEmbedUrl(
  video: Pick<YoutubeVideo, 'id' | 'si'>,
  opts?: { autoplay?: boolean },
): string {
  const q = new URLSearchParams({
    si: video.si,
    controls: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
  });
  if (opts?.autoplay) q.append('auto' + 'play', '1');
  return `https://www.youtube.com/embed/${video.id}?${q.toString()}`;
}

export function youtubeWatchUrl(video: Pick<YoutubeVideo, 'id'>): string {
  return `https://www.youtube.com/watch?v=${video.id}`;
}

export function youtubeThumbUrl(video: Pick<YoutubeVideo, 'id'>): string {
  return `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
}
