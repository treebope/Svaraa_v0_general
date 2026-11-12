import { Share } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import AddContact from '@/app/wearer/contact';
import EmergencyContacts from '@/app/wearer/contacts';
import InviteCaregiver from '@/app/wearer/invite';
import { useHousehold } from '@/features/household/store';
import { useSettings } from '@/features/settings/store';
import { useWearer } from '@/features/wearer/store';
import { verifyOtpAndSignIn } from '@/services/auth/authApi';
import { useSession } from '@/services/auth/session';
import { mockSetupOf } from '@/services/mocks/db';
import { DEMO_CODE } from '@/services/mocks/routes';
import { createWearerHousehold, INDIA, useMockBackend } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: mockPush, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

let householdId = '';
const MEERA = { name: 'Meera', relationship: 'Daughter', countryCode: '+91', mobile: '9812344410' };

beforeEach(async () => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockParams = {};
  await i18n.changeLanguage('en');
  useSettings.setState({ themeMode: 'wearer', scheme: 'light' });
  await useMockBackend();
  await verifyOtpAndSignIn(INDIA, DEMO_CODE);
  const userId = useSession.getState().userId as string;
  await useHousehold.getState().load(userId);
  await useWearer.getState().load(userId);
  householdId = await createWearerHousehold();
  await useHousehold.getState().chooseRole('wearer', householdId);
});

describe('C6 · Add a contact', () => {
  const fill = async (name: string, mobile: string) => {
    await fireEvent.changeText(screen.getByLabelText('Name'), name);
    await fireEvent.changeText(screen.getByLabelText('Mobile number'), mobile);
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Save contact' })));
  };

  it('adds a contact with a valid number and goes back', async () => {
    await renderApp(<AddContact />);
    await fireEvent.changeText(screen.getByLabelText('Relationship (optional)'), 'Son');
    await fill('Ravi', '99123 47821');
    expect(useWearer.getState().contacts).toEqual([
      { name: 'Ravi', relationship: 'Son', countryCode: '+91', mobile: '9912347821' },
    ]);
    expect(mockBack).toHaveBeenCalled();
  });

  it('checks the number for the country, and refuses the wearer’s own number', async () => {
    await renderApp(<AddContact />);
    await fill('Ravi', '12345');
    expect(screen.getByText('Enter a 10-digit Indian mobile number.')).toBeTruthy();
    await fill('Ravi', INDIA.mobile);
    expect(screen.getByText(/your own number/)).toBeTruthy();
    expect(useWearer.getState().contacts).toEqual([]);
  });

  it('edits and removes an existing contact', async () => {
    await useWearer.getState().save({ contacts: [MEERA] });
    mockParams = { index: '0' };
    await renderApp(<AddContact />);
    expect(screen.getByDisplayValue('Meera')).toBeTruthy();
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Remove contact' })));
    expect(useWearer.getState().contacts).toEqual([]);
  });
});

describe('C5 · Emergency contacts', () => {
  it('needs one contact, saves them in order and moves on to the invite', async () => {
    await renderApp(<EmergencyContacts />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await act(async () => await useWearer.getState().save({ contacts: [MEERA] }));
    expect(screen.getByText('1 · Meera')).toBeTruthy();
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(mockSetupOf(householdId)?.contacts).toEqual([
      { name: 'Meera', relationship: 'Daughter', country_code: '+91', mobile_number: '9812344410' },
    ]);
    expect(useHousehold.getState().setupStep).toBe(6);
    expect(mockPush).toHaveBeenCalledWith('/wearer/invite');
  });

  it('hides "Add contact" once two are added', async () => {
    await useWearer.getState().save({ contacts: [MEERA, { ...MEERA, name: 'Ravi', mobile: '9912347821' }] });
    await renderApp(<EmergencyContacts />);
    expect(screen.queryByRole('button', { name: 'Add contact' })).toBeNull();
  });
});

describe('C7 · Invite someone to help', () => {
  it('creates an invite for the chosen role and shares it', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    await act(async () => void (await renderApp(<InviteCaregiver />)));
    expect(screen.getByText(/^SVR-/)).toBeTruthy();
    expect(mockSetupOf(householdId)?.invites[0]?.role).toBe('admin');
    await act(async () => await fireEvent.press(screen.getByRole('radio', { name: /Viewer/ })));
    expect(mockSetupOf(householdId)?.invites.at(-1)?.role).toBe('viewer');
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Share invite link' })));
    expect(share.mock.calls[0]?.[0].message).toContain('https://svaraa.ai/i/SVR-');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockPush).toHaveBeenCalledWith('/wearer/drill');
  });

  it('can be skipped', async () => {
    await act(async () => void (await renderApp(<InviteCaregiver />)));
    await fireEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
    expect(mockPush).toHaveBeenCalledWith('/wearer/drill');
  });
});
