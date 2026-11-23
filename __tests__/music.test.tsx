import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { MusicView } from '@/features/music/MusicView';
import { NotPlayable, useMusicPlayer } from '@/features/music/player';
import { verifyOtpAndSignIn } from '@/services/auth/authApi';
import { DEMO_CODE } from '@/services/mocks/routes';
import { listTracks } from '@/services/music/musicApi';
import { INDIA, requests, useMockBackend } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

beforeEach(async () => {
  await i18n.changeLanguage('en');
  await useMockBackend();
  // Like the server, the catalog needs sign-in.
  await verifyOtpAndSignIn(INDIA, DEMO_CODE);
  useMusicPlayer.setState({ track: undefined, status: 'idle', error: null, position: 0, duration: 0 });
});

describe('Music', () => {
  it('lists songs by category and searches by singer, film or title', async () => {
    expect((await listTracks()).length).toBe(4);
    expect((await listTracks({ category: 'bhajan' })).every((t) => t.category === 'bhajan')).toBe(true);
    expect((await listTracks({ q: 'वैष्णव' })).map((t) => t.title)).toEqual(['Vaishnav Jan To']);
  });

  it('shows the catalog, filters to bhajans, and asks for a fresh link before playing', async () => {
    await renderApp(<MusicView />);
    expect(await screen.findByText('Raghupati Raghav Raja Ram')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Bhajans' }));
    expect(await screen.findByText('2 songs')).toBeTruthy();
    expect(screen.queryByText(/Sample old song/)).toBeNull();
    await act(async () => await fireEvent.press(screen.getByText('Vaishnav Jan To')));
    // The mock has no audio: the fresh link is empty, so the player says the song is not ready.
    expect(requests.some((r) => /\/music\/tracks\/[^/]+$/.test(r.path))).toBe(true);
    expect(useMusicPlayer.getState().error).toBeInstanceOf(NotPlayable);
    expect(await screen.findByText('This song is not ready to play yet. Try another one.')).toBeTruthy();
  });

  it('shows Hindi titles in Hindi', async () => {
    await i18n.changeLanguage('hi');
    await renderApp(<MusicView />);
    expect(await screen.findByText('रघुपति राघव राजा राम')).toBeTruthy();
  });
});
