import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import AboutYou from '@/app/wearer/about';
import ClaimPendant from '@/app/wearer/claim';
import WearerPermissions from '@/app/wearer/permissions';
import { nextSetupRoute, useHousehold } from '@/features/household/store';
import { useSettings } from '@/features/settings/store';
import { parseClaimCode } from '@/features/wearer/claimCode';
import { useWearer } from '@/features/wearer/store';
import { verifyOtpAndSignIn } from '@/services/auth/authApi';
import { useSession } from '@/services/auth/session';
import { createHousehold } from '@/services/household/householdApi';
import { CONSENT_VERSION } from '@/services/household/wearerApi';
import { mockDevicesOf, mockSetupOf } from '@/services/mocks/db';
import { DEMO_CLAIM_CODE, DEMO_CODE } from '@/services/mocks/routes';
import * as perms from '@/services/permissions/wearerPermissions';
import { calls, INDIA, useMockBackend } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
let mockCanGrant = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    navigate: mockPush,
    back: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(),
}));
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
}));
jest.mock('@/services/permissions/wearerPermissions', () => ({
  WEARER_PERMISSIONS: ['bluetooth', 'location', 'notifications'],
  getWearerPermission: jest.fn(),
  requestWearerPermission: jest.fn(),
  openAppSettings: jest.fn(),
  canAskBatteryExemption: false,
  get canGrantPermissions() {
    return mockCanGrant;
  },
  openBatterySettings: jest.fn(),
}));
const permissions = perms as unknown as {
  getWearerPermission: jest.Mock;
  requestWearerPermission: jest.Mock;
  openAppSettings: jest.Mock;
};

let householdId = '';

beforeEach(async () => {
  mockReplace.mockClear();
  mockPush.mockClear();
  mockParams = {};
  mockCanGrant = true;
  permissions.getWearerPermission.mockReset().mockResolvedValue('undetermined');
  permissions.requestWearerPermission.mockReset().mockResolvedValue('granted');
  await i18n.changeLanguage('en');
  useSettings.setState({ themeMode: 'wearer', scheme: 'light' });
  await useMockBackend();
  await verifyOtpAndSignIn(INDIA, DEMO_CODE);
  const userId = useSession.getState().userId as string;
  await useHousehold.getState().load(userId);
  await useWearer.getState().load(userId);
  const household = await createHousehold('wearer');
  householdId = household.id;
  await useHousehold.getState().chooseRole('wearer', household.id);
});

describe('resume route for wearers', () => {
  it('follows the last finished step', () => {
    const route = (setupStep: number, paired = false) =>
      nextSetupRoute({ role: 'wearer', notificationsDone: false, setupStep, paired });
    expect(route(1)).toBe('/wearer/permissions');
    expect(route(2)).toBe('/wearer/about');
    expect(route(3)).toBe('/wearer/claim');
    expect(route(4)).toBe('/wearer/pair');
    expect(route(4, true)).toBe('/wearer/check');
    expect(route(5)).toBe('/wearer/contacts');
    expect(route(6)).toBe('/wearer/drill');
  });
});

describe('B2 · Permissions for wearers', () => {
  it('asks for each permission in turn, saves the push token and moves to C1', async () => {
    await renderApp(<WearerPermissions />);
    expect(await screen.findAllByText('Required')).toHaveLength(3);
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Allow and continue' })));
    expect(permissions.requestWearerPermission.mock.calls.map((c) => c[0])).toEqual([
      'bluetooth',
      'location',
      'notifications',
    ]);
    expect(calls('/api/v1/devices/push-token')).toBe(1);
    expect(useHousehold.getState().setupStep).toBe(2);
    expect(mockReplace).toHaveBeenCalledWith('/wearer/about');
  });

  it('on the web: nothing is asked, Continue goes on and the phone asks later', async () => {
    mockCanGrant = false;
    permissions.getWearerPermission.mockResolvedValue('denied');
    await renderApp(<WearerPermissions />);
    expect(await screen.findAllByText('Later, on your phone')).toHaveLength(3);
    expect(screen.queryByText('Something is turned off')).toBeNull();
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(permissions.requestWearerPermission).not.toHaveBeenCalled();
    expect(useHousehold.getState().setupStep).toBe(2);
    expect(mockReplace).toHaveBeenCalledWith('/wearer/about');
  });

  it('stops at a refusal and points to Settings', async () => {
    permissions.requestWearerPermission.mockImplementation(async (p: string) =>
      p === 'location' ? 'denied' : 'granted',
    );
    await renderApp(<WearerPermissions />);
    await screen.findAllByText('Required');
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Allow and continue' })));
    expect(permissions.requestWearerPermission).not.toHaveBeenCalledWith('notifications');
    expect(screen.getByText('Something is turned off')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
    expect(permissions.openAppSettings).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('C1 · About you + consent', () => {
  it('keeps Continue off until the name, date of birth and consent are given', async () => {
    await renderApp(<AboutYou />);
    const go = () => screen.getByRole('button', { name: 'Continue' });
    expect(go()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Your name'), 'Asha Rao');
    await fireEvent.press(screen.getByRole('checkbox', { name: /I agree/ }));
    expect(go()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Date of birth'), '05071950');
    expect(go()).toBeEnabled();
  });

  it('formats the date of birth and rejects dates that cannot be right', async () => {
    await renderApp(<AboutYou />);
    const field = () => screen.getByLabelText('Date of birth');
    await fireEvent.changeText(field(), '05071950');
    expect(field().props.value).toBe('05/07/1950');
    await fireEvent.changeText(field(), '31022000');
    expect(screen.getByText(/does not exist/)).toBeTruthy();
    await fireEvent.changeText(field(), '01012999');
    expect(screen.getByText(/in the future/)).toBeTruthy();
    await fireEvent.changeText(field(), '01011850');
    expect(screen.getByText(/more than 120 years/)).toBeTruthy();
  });

  it('saves the profile and a versioned consent record, then goes to C2', async () => {
    await renderApp(<AboutYou />);
    await fireEvent.changeText(screen.getByLabelText('Your name'), 'Asha Rao');
    await fireEvent.changeText(screen.getByLabelText('Date of birth'), '05071950');
    await fireEvent.changeText(screen.getByLabelText(/What should Svaraa call you/), 'Amma');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Tamil' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /pacemaker/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /I agree/ }));
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    const saved = mockSetupOf(householdId);
    expect(saved?.wearer).toMatchObject({
      name: 'Asha Rao',
      date_of_birth: '1950-07-05',
      call_as: 'Amma',
      languages: ['en', 'ta'],
      pacemaker: true,
    });
    expect(saved?.consents).toEqual([expect.objectContaining({ version: CONSENT_VERSION, via: 'app' })]);
    expect(useWearer.getState().profile?.name).toBe('Asha Rao');
    expect(useHousehold.getState().setupStep).toBe(3);
    expect(mockPush).toHaveBeenCalledWith('/wearer/claim');
  });

  it('opens the consent details', async () => {
    await renderApp(<AboutYou />);
    await fireEvent.press(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('How Svaraa hears and records')).toBeTruthy();
  });
});

describe('claim code', () => {
  it('reads codes from the QR link or typed in any shape', () => {
    expect(parseClaimCode('https://svaraa.ai/c/SVRA-2041-7K3P')).toBe(DEMO_CLAIM_CODE);
    expect(parseClaimCode('svaraa://wearer/claim?code=svra20417k3p')).toBe(DEMO_CLAIM_CODE);
    expect(parseClaimCode(' svra 2041 7k3p ')).toBe(DEMO_CLAIM_CODE);
    expect(parseClaimCode('hello')).toBeNull();
  });
});

describe('C2 · Claim your pendant', () => {
  const typeCode = async (code: string) => {
    await fireEvent.press(screen.getByRole('button', { name: 'Enter code instead' }));
    await fireEvent.changeText(screen.getByLabelText('Code from the card'), code);
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Claim pendant' })));
  };

  it('claims with a typed code, becomes owner (unverified) and goes to pairing', async () => {
    await renderApp(<ClaimPendant />);
    await typeCode('svra-2041-7k3p');
    expect(mockDevicesOf(householdId)).toEqual([
      expect.objectContaining({ serial: '2041', claim_state: 'unverified', is_owner: true }),
    ]);
    expect(useWearer.getState().device?.serial).toBe('2041');
    expect(useHousehold.getState().setupStep).toBe(4);
    expect(mockReplace).toHaveBeenCalledWith('/wearer/pair');
  });

  it('claims straight away when opened from the box QR link', async () => {
    mockParams = { code: DEMO_CLAIM_CODE };
    await act(async () => void (await renderApp(<ClaimPendant />)));
    expect(mockReplace).toHaveBeenCalledWith('/wearer/pair');
  });

  it('shows a masked owner for a pendant claimed by someone else', async () => {
    await renderApp(<ClaimPendant />);
    await typeCode('SVRA-2041-0000');
    expect(screen.getByText('This pendant is already claimed')).toBeTruthy();
    expect(screen.getByText(/owned by M•••/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('refuses a malformed code without calling the server', async () => {
    await renderApp(<ClaimPendant />);
    await typeCode('1234');
    expect(screen.getByText(/That code is not right/)).toBeTruthy();
    expect(calls(`/api/v1/households/${householdId}/claim`)).toBe(0);
  });
});
