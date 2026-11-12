import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { PhoneVerify } from '@/features/auth/PhoneVerify';
import { ApiError } from '@/services/api';
import { renderApp } from '@/test-utils/render';

async function setup(overrides: Partial<React.ComponentProps<typeof PhoneVerify>> = {}) {
  const onRequest = jest.fn(async () => undefined);
  const onVerify = jest.fn(async () => undefined);
  const onVerified = jest.fn();
  await renderApp(
    <PhoneVerify onRequest={onRequest} onVerify={onVerify} onVerified={onVerified} {...overrides} />,
  );
  return { onRequest, onVerify, onVerified };
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const typeNumber = () => fireEvent.changeText(screen.getByLabelText('Mobile number'), '98765 43210');

beforeEach(() => {
  jest.useFakeTimers();
  return i18n.changeLanguage('en');
});
afterEach(() => jest.useRealTimers());

describe('phone and code form (A2)', () => {
  it('keeps Send OTP off until there is a number', async () => {
    const { onRequest } = await setup();
    await press('Send OTP');
    expect(onRequest).not.toHaveBeenCalled();
  });

  it('sends the country code and the number separately', async () => {
    const { onRequest } = await setup();
    await typeNumber();
    await press('Send OTP');
    expect(onRequest).toHaveBeenCalledWith({ countryCode: '+91', mobile: '9876543210' });
    expect(await screen.findByText('Resend in 1:00')).toBeTruthy();
  });

  it('counts down 60 seconds, then offers a resend', async () => {
    const { onRequest } = await setup();
    await typeNumber();
    await press('Send OTP');
    await act(async () => jest.advanceTimersByTime(30_000));
    expect(screen.getByText('Resend in 0:30')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resend code' })).toBeNull();
    await act(async () => jest.advanceTimersByTime(30_500));
    await press('Resend code');
    expect(onRequest).toHaveBeenCalledTimes(2);
  });

  it('locks the country once a code is sent, until the number is changed', async () => {
    await setup();
    await typeNumber();
    await press('Send OTP');
    expect(screen.getByRole('button', { name: /Country: India/ }).props.accessibilityState.disabled).toBe(
      true,
    );
    await press('Change number');
    expect(
      screen.getByRole('button', { name: /Country: India/ }).props.accessibilityState.disabled,
    ).toBeFalsy();
  });

  it('verifies the 6-digit code and reports success', async () => {
    const { onVerify, onVerified } = await setup();
    await typeNumber();
    await press('Send OTP');
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '0000');
    await press('Verify');
    expect(onVerify).toHaveBeenCalledWith({ countryCode: '+91', mobile: '9876543210' }, '0000');
    expect(onVerified).toHaveBeenCalled();
  });

  it('says "Wrong or expired code" for invalid_otp, and in Hindi when the language is Hindi', async () => {
    const reject = jest.fn(async () => {
      throw new ApiError('invalid_otp', 'Incorrect or expired code', 401);
    });
    const { onVerified } = await setup({ onVerify: reject });
    await typeNumber();
    await press('Send OTP');
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '111111');
    await press('Verify');
    expect(await screen.findByText('Wrong or expired code')).toBeTruthy();
    expect(onVerified).not.toHaveBeenCalled();
    // Server text is never shown, only our own message for the code.
    expect(screen.queryByText('Incorrect or expired code')).toBeNull();
  });

  it('starts the timer when the server says to wait (otp_cooldown)', async () => {
    const cooling = jest.fn(async () => {
      throw new ApiError('otp_cooldown', 'wait', 429);
    });
    await setup({ onRequest: cooling });
    await typeNumber();
    await press('Send OTP');
    expect(await screen.findByText('Resend in 1:00')).toBeTruthy();
    expect(screen.getByText('Please wait a minute before asking for another code.')).toBeTruthy();
  });

  it('shows a network problem as a message, not a crash', async () => {
    const offline = jest.fn(async () => {
      throw new ApiError('network_error');
    });
    await setup({ onRequest: offline });
    await typeNumber();
    await press('Send OTP');
    expect(await screen.findByText('No connection. Check your internet and try again.')).toBeTruthy();
  });
});
