import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { MusicView } from '@/features/music/MusicView';
import { YOUTUBE_VIDEOS } from '@/features/music/youtubeCatalog';
import { verifyOtpAndSignIn } from '@/services/auth/authApi';
import { DEMO_CODE } from '@/services/mocks/routes';
import { INDIA, useMockBackend } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

beforeEach(async () => {
  await i18n.changeLanguage('en');
  await useMockBackend();
  await verifyOtpAndSignIn(INDIA, DEMO_CODE);
});

describe('YouTube tab', () => {
  it('sits next to Spotify and plays a curated video from the collection', async () => {
    await renderApp(<MusicView />);
    expect(screen.getByRole('tab', { name: 'Spotify' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'YouTube (beta)' }));
    expect(await screen.findByText('Collection')).toBeTruthy();
    expect(screen.queryByText('Playing')).toBeNull();
    expect(screen.getByText(YOUTUBE_VIDEOS[0].title)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: YOUTUBE_VIDEOS[2].title }));
    expect(await screen.findByText('Playing')).toBeTruthy();
    expect(screen.getByText(YOUTUBE_VIDEOS[2].title)).toBeTruthy();
  });
});
