import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import SosDrill from '@/app/wearer/drill';
import { useHousehold } from '@/features/household/store';
import { useSettings } from '@/features/settings/store';
import { useWearer } from '@/features/wearer/store';
import { verifyOtpAndSignIn } from '@/services/auth/authApi';
import { useSession } from '@/services/auth/session';
import { saveContacts } from '@/services/household/wearerApi';
import { mockDrillTiming } from '@/services/mocks/db';
import { DEMO_CODE } from '@/services/mocks/routes';
import { pendant, resetPendant, SimulatorTransport } from '@/services/pendant';
import { createWearerHousehold, INDIA, useMockBackend, verifyTestPendant } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: mockBack, canGoBack: () => true }),
}));

let householdId = '';
const flush = () => act(async () => await new Promise((r) => setTimeout(r, 0)));

beforeEach(async () => {
  mockReplace.mockClear();
  mockBack.mockClear();
  Object.assign(mockDrillTiming, { ackMs: 0, timeoutMs: 5 * 60_000 });
  resetPendant();
  await i18n.changeLanguage('en');
  useSettings.setState({ themeMode: 'wearer', scheme: 'light' });
  await useMockBackend();
  await verifyOtpAndSignIn(INDIA, DEMO_CODE);
  const userId = useSession.getState().userId as string;
  await useHousehold.getState().load(userId);
  await useWearer.getState().load(userId);
  householdId = await createWearerHousehold();
  await verifyTestPendant(householdId);
  await useHousehold.getState().chooseRole('wearer', householdId);
  await useHousehold.getState().reachStep(6);
  await saveContacts(householdId, [{ name: 'Meera', country_code: '+91', mobile_number: '9812344410' }]);
});

describe('C8 · Test your SOS', () => {
  it('passes when a contact answers, then finishing makes the device Active', async () => {
    await renderApp(<SosDrill />);
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeDisabled();
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Run SOS drill' })));
    await flush();
    expect(await screen.findByText('Your SOS works', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText('Meera answered the drill.')).toBeTruthy();
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Finish setup' })));
    expect(useHousehold.getState()).toMatchObject({ hasActiveDevice: true, setupStep: 7 });
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });

  it('shows the countdown while waiting, and offers a retry when nobody answers', async () => {
    Object.assign(mockDrillTiming, { ackMs: 60 * 60_000, timeoutMs: 0 });
    await renderApp(<SosDrill />);
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Run SOS drill' })));
    expect(screen.getByText(/Waiting for someone to answer… 0:00/)).toBeTruthy();
    expect(await screen.findByText('No one answered in time', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Run the drill again' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeDisabled();
  });

  it('starts when the wearer holds the gold dot', async () => {
    const sim = new SimulatorTransport();
    resetPendant(sim);
    await renderApp(<SosDrill />);
    expect(pendant()).toBe(sim);
    await act(async () => sim.simulateSosPress());
    await flush();
    expect(await screen.findByText('Your SOS works', {}, { timeout: 4000 })).toBeTruthy();
  });

  it('after setup it is a practice run that ends with Done', async () => {
    await useHousehold.getState().activate();
    await renderApp(<SosDrill />);
    expect(screen.queryByText(/Step 5 of 5/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('call them yourself', () => {
  it('opens the dialer for each contact in turn and never dials 112 in a drill', async () => {
    const { Linking } = jest.requireActual('react-native');
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    useWearer.setState({
      contacts: [
        { name: 'Meera', countryCode: '+91', mobile: '9812344410', relationship: '' },
        { name: 'Ravi', countryCode: '+91', mobile: '9812344411', relationship: '' },
      ],
    });
    await renderApp(<SosDrill />);
    await act(
      async () =>
        await fireEvent.press(screen.getByRole('button', { name: 'Call them yourself, one by one' })),
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0][0])).toMatch(/^tel:\+?\d+$/);
    await act(
      async () => await fireEvent.press(screen.getByRole('button', { name: 'No, call the next one' })),
    );
    // keep pressing No until the contacts run out
    for (let i = 0; i < 6 && screen.queryByText('No contact answered') === null; i++) {
      await act(
        async () => await fireEvent.press(screen.getByRole('button', { name: 'No, call the next one' })),
      );
    }
    expect(screen.getByText('No contact answered')).toBeTruthy();
    expect(open.mock.calls.some((c) => c[0] === 'tel:112')).toBe(false);
    open.mockRestore();
  });
});

describe('History', () => {
  it('is not shown during setup, only after it', async () => {
    await renderApp(<SosDrill />);
    expect(screen.queryByRole('radio', { name: 'History' })).toBeNull();
  });

  it('keeps the last drill and shows how it ended', async () => {
    await useHousehold.getState().activate();
    await renderApp(<SosDrill />);
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Run SOS drill' })));
    await flush();
    expect(await screen.findByText('Your SOS works', {}, { timeout: 4000 })).toBeTruthy();
    await act(async () => await fireEvent.press(screen.getByRole('radio', { name: 'History' })));
    expect(screen.getByText('Last drill')).toBeTruthy();
    expect(screen.getByText('Passed')).toBeTruthy();
  });
});
