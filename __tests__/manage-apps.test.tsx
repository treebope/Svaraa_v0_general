import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import AppsScreen from '@/features/apps/AppsScreen';
import { ManageApps } from '@/features/manage/ManageApps';
import { useManageApps } from '@/features/manage/store';
import { useMockBackend } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  usePathname: () => '/apps',
  useIsFocused: () => true,
  useFocusEffect: () => undefined,
}));
jest.mock('@/features/main/useWide', () => ({ useWide: () => false, WIDE_BREAKPOINT: 900 }));

beforeEach(async () => {
  await i18n.changeLanguage('en');
  await useMockBackend();
  useManageApps.setState({
    enabled: { reminders: true, news: true, riddles: true, music: true },
    quietStart: 22 * 60,
    quietEnd: 6 * 60,
    quietReminders: true,
  });
});

describe('Manage apps', () => {
  it('turns an app off and changes the quiet hours', async () => {
    await renderApp(<ManageApps back={() => undefined} />);
    expect(screen.getByText('10:00 PM to 6:00 AM')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Music'), 'valueChange', false);
    expect(useManageApps.getState().enabled.music).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    await fireEvent.press(screen.getByRole('button', { name: 'To: later' }));
    expect(useManageApps.getState().quietEnd).toBe(6 * 60 + 30);
    expect(screen.getByText('SOS always comes first')).toBeTruthy();
  });

  it('hides an app on Explore once it is off', async () => {
    useManageApps.getState().setEnabled('reminders', false); // saved, so the screen's own load keeps it
    await renderApp(<AppsScreen />);
    expect(screen.queryByRole('button', { name: 'Reminders' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Music' })).toBeTruthy();
  });
});
