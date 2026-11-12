import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import CheckPendant from '@/app/wearer/check';
import PairPendant from '@/app/wearer/pair';
import { useHousehold } from '@/features/household/store';
import { usePendant } from '@/features/pendant/store';
import { useSettings } from '@/features/settings/store';
import { useWearer } from '@/features/wearer/store';
import { verifyOtpAndSignIn } from '@/services/auth/authApi';
import { useSession } from '@/services/auth/session';
import { claimPendant } from '@/services/household/wearerApi';
import { mockDevicesOf } from '@/services/mocks/db';
import { DEMO_CLAIM_CODE, DEMO_CODE } from '@/services/mocks/routes';
import {
  pendant,
  resetPendant,
  SIMULATED_PENDANT,
  SimulatorTransport,
  simulatorTiming,
} from '@/services/pendant';
import { createWearerHousehold, INDIA, useMockBackend } from '@/test-utils/backend';
import { renderApp } from '@/test-utils/render';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));

let householdId = '';

beforeEach(async () => {
  mockReplace.mockClear();
  Object.assign(simulatorTiming, { found: 0, connect: 0, check: 0 });
  resetPendant();
  usePendant.setState({ connection: 'disconnected', battery: undefined });
  await i18n.changeLanguage('en');
  useSettings.setState({ themeMode: 'wearer', scheme: 'light' });
  await useMockBackend();
  await verifyOtpAndSignIn(INDIA, DEMO_CODE);
  const userId = useSession.getState().userId as string;
  await useHousehold.getState().load(userId);
  await useWearer.getState().load(userId);
  householdId = await createWearerHousehold();
  await useHousehold.getState().chooseRole('wearer', householdId);
  await useWearer.getState().save({ device: await claimPendant(householdId, DEMO_CLAIM_CODE) });
});

const flush = () => act(async () => await new Promise((r) => setTimeout(r, 0)));

describe('C3 · Pair your pendant', () => {
  it('scans, pairs, verifies the claim with a signed challenge and goes to the checks', async () => {
    await renderApp(<PairPendant />);
    await fireEvent.press(screen.getByRole('button', { name: 'I pressed the dot' }));
    await flush();
    expect(screen.getByText('Svaraa Fold Over')).toBeTruthy();
    expect(screen.getByText('#2041 · nearby')).toBeTruthy();
    await act(
      async () => await fireEvent.press(screen.getByRole('button', { name: 'Pair: Svaraa Fold Over' })),
    );
    await flush();
    expect(mockDevicesOf(householdId)[0]?.claim_state).toBe('verified');
    expect(useWearer.getState()).toMatchObject({
      pendantId: SIMULATED_PENDANT.id,
      device: { claim_state: 'verified' },
    });
    expect(pendant().getStatus().connection).toBe('connected');
    expect(mockReplace).toHaveBeenCalledWith('/wearer/check');
  });

  it('says so when no pendant is found, and lets the wearer try again', async () => {
    jest.useFakeTimers();
    simulatorTiming.found = 60_000;
    await renderApp(<PairPendant />);
    await fireEvent.press(screen.getByRole('button', { name: 'I pressed the dot' }));
    await act(async () => void jest.advanceTimersByTime(20_000));
    expect(screen.getByText(/We could not find your pendant/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Press the dot again and retry' })).toBeTruthy();
    jest.useRealTimers();
  });

  it('refuses a pendant that is not genuine', async () => {
    resetPendant(Object.assign(new SimulatorTransport(), { signChallenge: async () => 'forged-signature' }));
    await renderApp(<PairPendant />);
    await fireEvent.press(screen.getByRole('button', { name: 'I pressed the dot' }));
    await flush();
    await act(
      async () => await fireEvent.press(screen.getByRole('button', { name: 'Pair: Svaraa Fold Over' })),
    );
    await flush();
    expect(screen.getByText(/genuine Svaraa pendant/)).toBeTruthy();
    expect(mockDevicesOf(householdId)[0]?.claim_state).toBe('unverified');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('C4 · Check your pendant', () => {
  beforeEach(async () => {
    await pendant().connect(SIMULATED_PENDANT.id);
    await useWearer.getState().save({ pendantId: SIMULATED_PENDANT.id });
  });

  it('unlocks Finish only when all three checks are ticked', async () => {
    await renderApp(<CheckPendant />);
    const finish = () => screen.getByRole('button', { name: 'Finish pairing' });
    await fireEvent.press(screen.getByRole('checkbox', { name: /felt the tick/ }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /status announcement/ }));
    expect(finish()).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox', { name: /Hello/ }));
    expect(finish()).toBeEnabled();
    await act(async () => await fireEvent.press(finish()));
    expect(useHousehold.getState().setupStep).toBe(5);
    expect(mockReplace).toHaveBeenCalledWith('/wearer/contacts');
  });

  it('asks the pendant to repeat a check', async () => {
    const run = jest.spyOn(pendant(), 'runCheck');
    await renderApp(<CheckPendant />);
    await flush();
    await act(
      async () => await fireEvent.press(screen.getByRole('button', { name: /Again: I heard the status/ })),
    );
    expect(run).toHaveBeenCalledWith('announce');
  });

  it('reconnects to the paired pendant when it is not connected', async () => {
    await pendant().disconnect();
    await renderApp(<CheckPendant />);
    await flush();
    expect(pendant().getStatus().connection).toBe('connected');
    expect(screen.getByText('Pendant connected')).toBeTruthy();
  });
});
