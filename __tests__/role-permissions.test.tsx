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
import { createHousehold, DRAFT_HOUSEHOLD_ID } from '@/services/household/householdApi';
import { mockHouseholdOf, mockPushTokensOf } from '@/services/mocks/db';
import { DEMO_CODE } from '@/services/mocks/routes';
import { calls, createWearerHousehold, INDIA, useMockBackend } from '@/test-utils/backend';
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
    expect(isMocked('POST', '/api/v1/circles')).toBe(false);
    expect(isMocked('POST', '/api/v1/devices/claim')).toBe(false);
    expect(isMocked('GET', '/api/v1/me/home')).toBe(false);
    expect(isMocked('POST', '/api/v1/me/installations')).toBe(true);
    expect(isMocked('POST', '/api/v1/auth/otp/request')).toBe(true);
  });
});

describe('household service', () => {
  it('B1 starts with a placeholder: the server creates the household at C1', async () => {
    expect(await createHousehold('wearer')).toEqual({ id: DRAFT_HOUSEHOLD_ID, role: 'wearer' });
    expect(mockHouseholdOf(userId())).toBeUndefined();
  });
  it('continues with the household the server already has for this person', async () => {
    const id = await createWearerHousehold();
    expect(await createHousehold('wearer')).toEqual({ id, role: 'wearer' });
  });
  it('B1 goes on even when the server cannot say whether a household exists', async () => {
    await useSession.getState().clear();
    expect(await createHousehold('wearer')).toEqual({ id: DRAFT_HOUSEHOLD_ID, role: 'wearer' });
  });
});

describe('B1 · Who are you?', () => {
  it('cannot continue until something is picked', async () => {
    await renderApp(<RoleChoice />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(calls('/api/v1/circles')).toBe(0);
  });

  it('has no caregiver option: only wearer and not sure', async () => {
    await renderApp(<RoleChoice />);
    expect(screen.queryByRole('radio', { name: /caregiver/i })).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('wearer: starts setup (the household is created at C1) and goes on to B2', async () => {
    await renderApp(<RoleChoice />);
    await fireEvent.press(screen.getByRole('radio', { name: /I'll wear Svaraa/ }));
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(useHousehold.getState()).toMatchObject({ role: 'wearer', householdId: DRAFT_HOUSEHOLD_ID });
    expect(calls('/api/v1/circles')).toBe(0);
    expect(mockReplace).toHaveBeenCalledWith('/wearer/permissions');
  });

  it('not sure: creates nothing and the setup card stays "not started"', async () => {
    await renderApp(<RoleChoice />);
    await fireEvent.press(screen.getByRole('radio', { name: /Not sure yet/ }));
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(calls('/api/v1/circles')).toBe(0);
    expect(useHousehold.getState()).toMatchObject({ role: undefined, setupStep: 0 });
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });

  it('saves nothing on the server, so it goes on even when the server cannot be reached', async () => {
    await useSession.getState().clear(); // no token: GET /me/home answers missing_token
    await renderApp(<RoleChoice />);
    await fireEvent.press(screen.getByRole('radio', { name: /I'll wear Svaraa/ }));
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/wearer/permissions');
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
