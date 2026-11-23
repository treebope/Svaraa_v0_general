import i18n from '@/i18n';
import { useYouTubePlayer } from '@/features/music/youtubePlayer';
import { matchYoutubeVideo } from '@/features/music/youtubeCatalog';
import { askSvaraa } from '@/services/chat/chatApi';
import { verifyOtpAndSignIn } from '@/services/auth/authApi';
import { DEMO_CODE } from '@/services/mocks/routes';
import { INDIA, useMockBackend } from '@/test-utils/backend';

beforeEach(async () => {
  await i18n.changeLanguage('en');
  await useMockBackend();
  await verifyOtpAndSignIn(INDIA, DEMO_CODE);
  useYouTubePlayer.setState({ activeId: null, source: 'songs' });
});

describe('YouTube chat keywords', () => {
  it('maps shiva prayer to Mahadevaya', () => {
    expect(matchYoutubeVideo('play a shiva prayer bhajan')?.id).toBe('GvtLszZkXsk');
  });

  it('maps durga / aigiri to Mahishasura Mardini', () => {
    expect(matchYoutubeVideo('play durga aigiri')?.id).toBe('442ewPgXHQ0');
  });

  it('askSvaraa plays the matched video and opens the YouTube tab', async () => {
    const out = await askSvaraa('Play a shiva prayer bhajan');
    expect(out.events?.some((e) => e.type === 'youtube' && e.action === 'play')).toBe(true);
    expect(useYouTubePlayer.getState().activeId).toBe('GvtLszZkXsk');
    expect(useYouTubePlayer.getState().source).toBe('youtube');
    expect(out.text).toMatch(/Mahadevaya/i);
  });
});
