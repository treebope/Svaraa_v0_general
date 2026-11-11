import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import Home from '@/app/home';
import Apps from '@/app/(tabs)/apps';
import Chat from '@/app/(tabs)/chat';
import AllChats from '@/app/(tabs)/chats';
import Profile from '@/app/(tabs)/profile';
import { useChat } from '@/features/chat/store';
import { useHousehold } from '@/features/household/store';
import { usePendant } from '@/features/pendant/store';
import { useSettings } from '@/features/settings/store';
import { useWearer } from '@/features/wearer/store';
import { verifyOtpAndSignIn } from '@/services/auth/authApi';
import { useSession } from '@/services/auth/session';
import { DEMO_CODE } from '@/services/mocks/routes';
import { resetPendant, SIMULATED_PENDANT, simulatorTiming } from '@/services/pendant';
import { INDIA, useMockBackend } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

const mockPush = jest.fn();
let mockRedirect: string | undefined;
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect = href;
    return null;
  },
  useRouter: () => ({
    replace: jest.fn(),
    push: mockPush,
    navigate: mockPush,
    back: jest.fn(),
    canGoBack: () => true,
  }),
  usePathname: () => '/chat',
  useIsFocused: () => true,
  useFocusEffect: () => undefined,
}));

const flush = () => act(async () => await new Promise((r) => setTimeout(r, 0)));

beforeEach(async () => {
  mockPush.mockClear();
  mockRedirect = undefined;
  Object.assign(simulatorTiming, { found: 0, connect: 0, check: 0 });
  resetPendant();
  usePendant.setState({ connection: 'disconnected', battery: undefined });
  useChat.getState().reset();
  await i18n.changeLanguage('en');
  useSettings.setState({ themeMode: 'wearer', scheme: 'light' });
  await useMockBackend();
  await verifyOtpAndSignIn(INDIA, DEMO_CODE);
  const userId = useSession.getState().userId as string;
  await useHousehold.getState().load(userId);
  await useWearer.getState().load(userId);
  await useHousehold.getState().chooseRole('wearer', 'h1');
  await useWearer.getState().save({
    profile: {
      name: 'Asha Rao',
      date_of_birth: '1950-07-05',
      call_as: 'Amma',
      languages: ['ta'],
      pacemaker: false,
    },
    pendantId: SIMULATED_PENDANT.id,
    contacts: [
      { name: 'Meera', countryCode: '+91', mobile: '9812344410' },
      { name: 'Ravi', countryCode: '+91', mobile: '9912347821' },
    ],
  });
});

describe('Home → main app', () => {
  it('keeps the setup card until the pendant is Active', async () => {
    await renderApp(<Home />);
    expect(screen.getByText('Finish setting up Svaraa')).toBeTruthy();
    expect(mockRedirect).toBeUndefined();
  });

  it('once Active, Home opens the main app (Apps)', async () => {
    await useHousehold.getState().activate();
    await renderApp(<Home />);
    expect(mockRedirect).toBe('/apps');
  });
});

describe('Chat tab', () => {
  it('starts empty, Chat answers, and the chat appears in Recents', async () => {
    await renderApp(<Chat />);
    expect(screen.getByText('Working on 0 things')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Message'), 'What day is it?');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    // The question is the message bubble and, being the first message, the chat's title in the top bar.
    expect(screen.getAllByText('What day is it?')).toHaveLength(2);
    expect(screen.getByText(/sample reply/)).toBeTruthy();
    expect(useChat.getState().conversations[0].title).toBe('What day is it?');
  });

  it('Talk opens the call screen straight away', async () => {
    await renderApp(<Chat />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Talk' }));
    expect(useChat.getState().voiceOpen).toBe(true);
  });

  it('on the Apps tab the bell opens Alerts', async () => {
    await renderApp(<Apps />);
    await fireEvent.press(screen.getByRole('button', { name: 'Alerts' }));
    expect(mockPush).toHaveBeenCalledWith('/alerts');
  });
});

describe('All chats', () => {
  it('searches by title and opens a chat on the Chat tab', async () => {
    await renderApp(<AllChats />);
    expect(screen.getByText('Will it rain tomorrow?')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search your chats'), 'rain');
    expect(screen.queryByText('Evening medicine reminder')).toBeNull();
    await fireEvent.press(screen.getByText('Will it rain tomorrow?'));
    expect(useChat.getState().currentId).toBe('c2');
    expect(mockPush).toHaveBeenCalledWith('/chat');
  });
});

describe('Apps tab', () => {
  it('shows the apps, opens one with a back button, and lists the emergency contacts', async () => {
    await renderApp(<Apps />);
    for (const n of ['Music', 'Reminders', 'Responses', 'Pendant', 'Contacts'])
      expect(screen.getByRole('button', { name: n })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    // The My Profile tile, and the avatar in the top bar.
    expect(screen.getAllByRole('button', { name: 'My Profile' })).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Contacts' }));
    expect(screen.getByText('1 · Meera')).toBeTruthy();
    expect(screen.getByText('2 · Ravi')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to apps' }));
    expect(screen.getByRole('button', { name: 'Music' })).toBeTruthy();
  });

  it('Pendant app shows the status and runs the SOS drill', async () => {
    await renderApp(<Apps />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pendant' }));
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Run SOS drill' }));
    expect(mockPush).toHaveBeenCalledWith('/wearer/drill');
  });
});

describe('My Profile tab', () => {
  it('keeps the details, contacts, sign-in and Settings together', async () => {
    await renderApp(<Profile />);
    expect(screen.getByText('Asha Rao')).toBeTruthy();
    expect(screen.getByText('Amma')).toBeTruthy();
    expect(screen.getByText(/^05\/07\/1950 · \d+ years old$/)).toBeTruthy();
    expect(screen.getByText('Tamil')).toBeTruthy();
    expect(screen.getByText('1 · Meera')).toBeTruthy();
    expect(screen.getByText('+91 9812344410')).toBeTruthy();
    expect(screen.getByText('Signed in with')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Language')).toBeTruthy();
  });

  it('Display has Light, Dark and System, and choosing one changes the scheme', async () => {
    await renderApp(<Profile />);
    for (const n of ['Light', 'Dark', 'System']) expect(screen.getByRole('radio', { name: n })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
    expect(useSettings.getState().scheme).toBe('dark');
  });
});
