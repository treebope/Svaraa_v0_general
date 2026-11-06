import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { useHousehold } from '@/features/household/store';
import Home from '@/app/home';
import Index from '@/app/index';
import {
  getGoogleCredential,
  signInWithGoogleToken,
  updateProfile,
  verifyMobile,
  verifyOtpAndSignIn,
} from '@/services/auth/authApi';
import { useSession } from '@/services/auth/session';
import { DEMO_CODE } from '@/services/mocks/routes';
import { INDIA, useMockBackend } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockRedirect: string | undefined;
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect = href;
    return null;
  },
  useRouter: () => ({ replace: mockReplace, push: mockPush, navigate: mockPush }),
}));

beforeEach(async () => {
  mockRedirect = undefined;
  mockPush.mockClear();
  await i18n.changeLanguage('en');
  await useMockBackend();
});

const googleSignIn = async () => {
  const { idToken, name } = await getGoogleCredential();
  await signInWithGoogleToken(idToken, name);
};

describe('where sign-in sends you (the auth guard rules)', () => {
  it('signed out: the welcome screen', async () => {
    await renderApp(<Index />);
    expect(mockRedirect).toBe('/welcome');
  });

  it('new phone account: the intro (A3)', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    await renderApp(<Index />);
    expect(mockRedirect).toBe('/intro');
  });

  it('existing phone account: Home', async () => {
    await verifyOtpAndSignIn({ countryCode: '+91', mobile: '9876543200' }, DEMO_CODE);
    await renderApp(<Index />);
    expect(mockRedirect).toBe('/home');
  });

  it('Google account with no phone: "Add your phone" comes first, then the intro', async () => {
    await googleSignIn();
    const view = await renderApp(<Index />);
    expect(mockRedirect).toBe('/add-phone');
    await act(async () => verifyMobile(INDIA, DEMO_CODE));
    await view.unmount();
    await renderApp(<Index />);
    expect(mockRedirect).toBe('/intro');
  });

  it('finishing the intro leads to Home', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    await act(async () => useSession.getState().finishIntro());
    await renderApp(<Index />);
    expect(mockRedirect).toBe('/home');
  });
});

describe('Home (A4)', () => {
  beforeEach(async () => {
    await verifyOtpAndSignIn({ countryCode: '+91', mobile: '9876543200' }, DEMO_CODE);
    await useHousehold.getState().load(useSession.getState().userId as string);
  });

  it('greets with just "Hello" when there is no name', async () => {
    await renderApp(<Home />);
    expect(await screen.findByText('Hello')).toBeTruthy();
  });

  it('greets with the name from the profile', async () => {
    await updateProfile({ display_name: 'Asha Rao' });
    await renderApp(<Home />);
    expect(await screen.findByText('Hello, Asha')).toBeTruthy();
  });

  it('uses the Google name when the profile has none', async () => {
    await useMockBackend();
    await signInWithGoogleToken('some-token', 'Meera Rao');
    await renderApp(<Home />);
    expect(await screen.findByText('Hello, Meera')).toBeTruthy();
  });

  it('says just Hello after the mock Google sign-in, which has no name', async () => {
    await useMockBackend();
    await googleSignIn();
    await renderApp(<Home />);
    expect(await screen.findByText('Hello')).toBeTruthy();
  });

  it('shows the setup card as not started, with a Start action', async () => {
    await renderApp(<Home />);
    expect(screen.getByText('Finish setting up Svaraa')).toBeTruthy();
    expect(screen.getByText('Not started')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(mockPush).toHaveBeenCalledWith('/role'); // no role yet: setup begins at B1
  });

  it('resumes: shows the saved step and Continue', async () => {
    await act(async () => {
      await useHousehold.getState().advance();
      await useHousehold.getState().advance();
      await useHousehold.getState().advance();
    });
    await renderApp(<Home />);
    expect(screen.getByText('Saved at step 3 of 7')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('keeps progress after a restart', async () => {
    await act(async () => useHousehold.getState().advance());
    const { userId } = useSession.getState();
    useHousehold.getState().unload();
    await act(async () => useHousehold.getState().load(userId as string));
    expect(useHousehold.getState().setupStep).toBe(1);
  });

  it('drops the card once a device is Active', async () => {
    useHousehold.setState({ setupStep: 7, hasActiveDevice: true });
    await renderApp(<Home />);
    expect(screen.queryByText('Finish setting up Svaraa')).toBeNull();
  });

  it('shows the product (the pendant) and opens Explore', async () => {
    await renderApp(<Home />);
    expect(screen.getByText('Svaraa Fold')).toBeTruthy();
    expect(screen.getByLabelText('Svaraa Fold pendant worn on its braided cord')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Svaraa Fold\./ }));
    expect(mockPush).toHaveBeenCalledWith('/explore');
  });

  it('is in Hindi when the language is Hindi', async () => {
    await i18n.changeLanguage('hi');
    await renderApp(<Home />);
    expect(screen.getByText('स्वरा का सेटअप पूरा करें')).toBeTruthy();
  });
});
