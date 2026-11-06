import { Linking } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import i18n from '@/i18n';
import { flags } from '@/config/flags';
import { isMocked } from '@/config/env';
import Home from '@/app/home';
import CaregiverPermissions from '@/app/caregiver-permissions';
import RoleChoice from '@/app/role';
import { nextSetupRoute, useHousehold } from '@/features/household/store';
import { useSettings } from '@/features/settings/store';
import { verifyOtpAndSignIn } from '@/services/auth/authApi';
import { useSession } from '@/services/auth/session';
import { createHousehold } from '@/services/household/householdApi';
import { mockHouseholdOf, mockPushTokensOf } from '@/services/mocks/db';
import { DEMO_CODE } from '@/services/mocks/routes';
import { calls, INDIA, useMockBackend } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, navigate: mockPush, back: jest.fn() }),
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

const perms = Notifications as unknown as {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
};
const ASK = { granted: false, canAskAgain: true };
const GRANTED = { granted: true, canAskAgain: true };
const DENIED = { granted: false, canAskAgain: false };

const userId = () => useSession.getState().userId as string;

beforeEach(async () => {
  mockReplace.mockClear();
  mockPush.mockClear();
  perms.getPermissionsAsync.mockReset().mockResolvedValue(ASK);
  perms.requestPermissionsAsync.mockReset();
  await i18n.changeLanguage('en');
  useSettings.setState({ themeMode: 'caregiver', scheme: 'light' });
  await useMockBackend();
  await verifyOtpAndSignIn(INDIA, DEMO_CODE);
  await useHousehold.getState().load(userId());
});

describe('area switches (config/flags.ts)', () => {
  afterEach(() => {
    flags.household = 'mock';
  });
  it('are all mock by default', () => {
    expect([flags.auth, flags.household, flags.notifications]).toEqual(['mock', 'mock', 'mock']);
    expect(isMocked('POST', '/api/v1/households')).toBe(true);
  });
  it('switch one area to the real backend and leave the others mocked', () => {
    flags.household = 'real';
    expect(isMocked('POST', '/api/v1/households')).toBe(false);
    expect(isMocked('POST', '/api/v1/devices/push-token')).toBe(true);
    expect(isMocked('POST', '/api/v1/auth/otp/request')).toBe(true);
  });
});

describe('household service (mock, pending backend)', () => {
  it('creates a household with the role, and returns the same one when asked again', async () => {
    const first = await createHousehold('caregiver');
    expect(first.role).toBe('caregiver');
    expect(mockHouseholdOf(userId())).toEqual(first);
    expect(await createHousehold('caregiver')).toEqual(first);
  });
  it('needs a signed-in person', async () => {
    await useSession.getState().clear();
    await expect(createHousehold('wearer')).rejects.toMatchObject({ code: 'missing_token' });
  });
});

describe('B1 · Who are you?', () => {
  it('cannot continue until something is picked', async () => {
    await renderApp(<RoleChoice />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(calls('/api/v1/households')).toBe(0);
  });

  it('has no caregiver option: only wearer and not sure', async () => {
    await renderApp(<RoleChoice />);
    expect(screen.queryByRole('radio', { name: /caregiver/i })).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('wearer: creates the household and hands off to the wearer placeholder (B2)', async () => {
    await renderApp(<RoleChoice />);
    await fireEvent.press(screen.getByRole('radio', { name: /I'll wear Svaraa/ }));
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(mockHouseholdOf(userId())?.role).toBe('wearer');
    expect(mockReplace).toHaveBeenCalledWith('/wearer/permissions');
  });

  it('not sure: creates nothing and the setup card stays "not started"', async () => {
    await renderApp(<RoleChoice />);
    await fireEvent.press(screen.getByRole('radio', { name: /Not sure yet/ }));
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(calls('/api/v1/households')).toBe(0);
    expect(useHousehold.getState()).toMatchObject({ role: undefined, setupStep: 0 });
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });

  it('shows our own message when saving fails, and does not save the role', async () => {
    await useSession.getState().clear(); // no token: the mock answers missing_token
    await renderApp(<RoleChoice />);
    await fireEvent.press(screen.getByRole('radio', { name: /I'll wear Svaraa/ }));
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(useHousehold.getState().role).toBeUndefined();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('works in Hindi and in the wearer theme', async () => {
    await i18n.changeLanguage('hi');
    useSettings.setState({ themeMode: 'wearer' });
    await renderApp(<RoleChoice />);
    expect(screen.getByText('आप कौन हैं?')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });
});

describe('B3 · caregiver notifications', () => {
  it('explains first, then asks; on allow it saves the push token and moves on', async () => {
    perms.requestPermissionsAsync.mockResolvedValue(GRANTED);
    await renderApp(<CaregiverPermissions />);
    expect(await screen.findByText('Stay informed')).toBeTruthy();
    expect(perms.requestPermissionsAsync).not.toHaveBeenCalled();
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Allow notifications' })));
    expect(perms.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockPushTokensOf(userId())).toHaveLength(1);
    expect(useHousehold.getState()).toMatchObject({ notificationsDone: true, setupStep: 2 });
    expect(mockReplace).toHaveBeenCalledWith('/setup');
  });

  it('denied: shows "Open settings", does not save a token, and opens Settings on tap', async () => {
    perms.requestPermissionsAsync.mockResolvedValue({ granted: false });
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderApp(<CaregiverPermissions />);
    await act(
      async () => await fireEvent.press(await screen.findByRole('button', { name: 'Allow notifications' })),
    );
    expect(screen.getByText('Notifications are off')).toBeTruthy();
    expect(mockPushTokensOf(userId())).toHaveLength(0);
    expect(useHousehold.getState().notificationsDone).toBe(false);
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Open settings' })));
    expect(open).toHaveBeenCalled();
  });

  it('already denied earlier: goes straight to "Open settings"', async () => {
    perms.getPermissionsAsync.mockResolvedValue(DENIED);
    await renderApp(<CaregiverPermissions />);
    expect(await screen.findByRole('button', { name: 'Open settings' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Allow notifications' })).toBeNull();
  });

  it('already allowed (for example after Settings): Continue saves the token without asking again', async () => {
    perms.getPermissionsAsync.mockResolvedValue(GRANTED);
    await renderApp(<CaregiverPermissions />);
    await act(async () => await fireEvent.press(await screen.findByRole('button', { name: 'Continue' })));
    expect(perms.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockPushTokensOf(userId())).toHaveLength(1);
    expect(mockReplace).toHaveBeenCalledWith('/setup');
  });

  it('works in Hindi and in the wearer theme', async () => {
    await i18n.changeLanguage('hi');
    useSettings.setState({ themeMode: 'wearer' });
    await renderApp(<CaregiverPermissions />);
    expect(await screen.findByText('जानकारी में रहें')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'सूचनाएँ चालू करें' })).toBeTruthy();
  });
});

describe('resume from the saved role (A4)', () => {
  it('picks the next step from what was saved', () => {
    expect(nextSetupRoute({ role: undefined, notificationsDone: false })).toBe('/role');
    expect(nextSetupRoute({ role: 'wearer', notificationsDone: false })).toBe('/wearer/permissions');
    expect(nextSetupRoute({ role: 'caregiver', notificationsDone: false })).toBe('/caregiver-permissions');
    expect(nextSetupRoute({ role: 'caregiver', notificationsDone: true })).toBe('/setup');
  });

  it('the Home card continues from the saved role', async () => {
    await act(async () => useHousehold.getState().chooseRole('caregiver', 'h1'));
    await renderApp(<Home />);
    expect(screen.getByText('Saved at step 1 of 7')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockPush).toHaveBeenCalledWith('/caregiver-permissions');
  });

  it('keeps the role after a restart', async () => {
    await act(async () => useHousehold.getState().chooseRole('wearer', 'h1'));
    await act(async () => useHousehold.getState().finishNotifications());
    useHousehold.getState().unload();
    await act(async () => useHousehold.getState().load(userId()));
    expect(useHousehold.getState()).toMatchObject({
      role: 'wearer',
      householdId: 'h1',
      notificationsDone: true,
      setupStep: 2,
    });
  });
});
