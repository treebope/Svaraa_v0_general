import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import Profile from '@/app/(tabs)/profile';
import AddContact from '@/app/wearer/contact';
import EditProfile from '@/app/edit-profile';
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
  useRouter: () => ({ replace: jest.fn(), push: mockPush, navigate: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
  usePathname: () => '/profile',
}));

let householdId = '';
const MEERA = { name: 'Meera', relationship: 'Daughter', countryCode: '+91', mobile: '9812344410' };
const RAVI = { name: 'Ravi', countryCode: '+91', mobile: '9912347821' };
const PROFILE = {
  name: 'Asha Rao',
  date_of_birth: '1950-07-05',
  call_as: 'Amma',
  languages: ['en'],
  pacemaker: false,
};

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
  await useWearer.getState().save({ profile: PROFILE, contacts: [MEERA, RAVI] });
});

describe('My Profile · edit', () => {
  it('has Edit for the details and a Change button for each contact', async () => {
    await renderApp(<Profile />);
    await fireEvent.press(screen.getByRole('button', { name: 'Edit' }));
    expect(mockPush).toHaveBeenCalledWith('/edit-profile');
    await fireEvent.press(screen.getAllByRole('button', { name: /^Change/ })[1]!);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/wearer/contact',
      params: { index: '1', from: 'profile' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Add a contact' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/wearer/contact', params: { from: 'profile' } });
  });

  it('Edit profile starts from what is saved, and saving updates it', async () => {
    await renderApp(<EditProfile />);
    expect(screen.getByDisplayValue('Asha Rao')).toBeTruthy();
    expect(screen.getByDisplayValue('05/07/1950')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /I agree/ })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Your name'), 'Asha R. Rao');
    await fireEvent.changeText(screen.getByLabelText('Date of birth'), '06071950');
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Save' })));
    expect(mockSetupOf(householdId)?.wearer).toMatchObject({
      name: 'Asha R. Rao',
      date_of_birth: '1950-07-06',
    });
    expect(useWearer.getState().profile).toMatchObject({ name: 'Asha R. Rao', date_of_birth: '1950-07-06' });
    expect(mockBack).toHaveBeenCalled();
  });

  it('Edit profile will not save without a valid date of birth', async () => {
    await renderApp(<EditProfile />);
    await fireEvent.changeText(screen.getByLabelText('Date of birth'), '31022000');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(useWearer.getState().profile?.date_of_birth).toBe('1950-07-05');
  });
});

describe('My Profile · contacts', () => {
  it('a change from My Profile is saved to the household', async () => {
    mockParams = { index: '1', from: 'profile' };
    await renderApp(<AddContact />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Ravi Rao');
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Save contact' })));
    expect(mockSetupOf(householdId)?.contacts).toEqual([
      { name: 'Meera', relationship: 'Daughter', country_code: '+91', mobile_number: '9812344410' },
      { name: 'Ravi Rao', relationship: null, country_code: '+91', mobile_number: '9912347821' },
    ]);
    expect(useWearer.getState().contacts[1]?.name).toBe('Ravi Rao');
    expect(mockBack).toHaveBeenCalled();
  });

  it('adds a third contact and removes one', async () => {
    mockParams = { from: 'profile' };
    await renderApp(<AddContact />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Sunita');
    await fireEvent.changeText(screen.getByLabelText('Mobile number'), '98123 45678');
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Save contact' })));
    expect(useWearer.getState().contacts).toHaveLength(3);
    expect(mockSetupOf(householdId)?.contacts).toHaveLength(3);
  });

  it('does not offer Remove on the last contact', async () => {
    await useWearer.getState().save({ contacts: [MEERA] });
    mockParams = { index: '0', from: 'profile' };
    await renderApp(<AddContact />);
    expect(screen.queryByRole('button', { name: 'Remove contact' })).toBeNull();
    expect(screen.getByText('Keep at least one emergency contact.')).toBeTruthy();
  });

  it('in setup (no from), a change stays on the phone until Continue', async () => {
    mockParams = { index: '1' };
    await renderApp(<AddContact />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Ravi Rao');
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Save contact' })));
    expect(mockSetupOf(householdId)?.contacts).toEqual([]);
    expect(useWearer.getState().contacts[1]?.name).toBe('Ravi Rao');
  });
});
