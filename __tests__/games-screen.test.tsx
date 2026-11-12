import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import AppsScreen from '@/features/apps/AppsScreen';
import { useOpenGame } from '@/features/games/kit';
import { useMockBackend } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

let mockWide = false;
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  usePathname: () => '/apps',
  useIsFocused: () => true,
  useFocusEffect: () => undefined,
}));
jest.mock('@/features/main/useWide', () => ({ useWide: () => mockWide, WIDE_BREAKPOINT: 900 }));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  useOpenGame.setState({ open: undefined });
  await useMockBackend();
});

describe.each([false, true])('Games app (wide web: %s)', (wide) => {
  it('opens a game and keeps it open, then returns to the list', async () => {
    mockWide = wide;
    await renderApp(<AppsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Games' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Memory Match' }));
    expect(await screen.findByText('How to play')).toBeTruthy();
    expect(useOpenGame.getState().open).toBe('match');
    await fireEvent.press(screen.getByRole('button', { name: 'All games' }));
    expect(useOpenGame.getState().open).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Petal Sequence' })).toBeTruthy();
  });

  it('starts Lotus Pulse', async () => {
    mockWide = wide;
    // The animation loop is switched off: this checks the screen, not the physics (those are in games.test.ts).
    const raf = jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(0);
    await renderApp(<AppsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Games' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Heartbeat Run' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(screen.getByText('Tap to jump')).toBeTruthy();
    raf.mockRestore();
  });
});
