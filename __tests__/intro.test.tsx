import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import Intro from '@/app/intro';
import { FlatList } from 'react-native';
import { AUTO_ADVANCE_MS, SLIDE_SETTLE_MS, STORIES } from '@/features/intro/stories';
import { useSession } from '@/services/auth/session';
import { renderApp } from '@/test-utils/render';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, navigate: mockPush }),
}));

beforeEach(async () => {
  mockReplace.mockClear();
  mockPush.mockClear();
  await i18n.changeLanguage('en');
  useSession.setState({ showIntro: true });
});

describe('Intro (A3): how setup works', () => {
  it('only moves forward, every 2.5 seconds, and wraps from the last step to the first without scrolling back', async () => {
    jest.useFakeTimers();
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    await renderApp(<Intro />);
    expect(screen.getByLabelText('Page 1 of 4')).toBeTruthy();
    for (let i = 2; i <= 4; i++) {
      await act(async () => jest.advanceTimersByTime(AUTO_ADVANCE_MS));
      expect(screen.getByLabelText(`Page ${i} of 4`)).toBeTruthy();
    }
    // last to first: slides forward onto a copy of the first step, then jumps to the real one.
    await act(async () => jest.advanceTimersByTime(AUTO_ADVANCE_MS));
    expect(screen.getByLabelText('Page 1 of 4')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(SLIDE_SETTLE_MS));
    expect(scroll.mock.calls.map(([o]) => [o.index, o.animated])).toEqual([
      [1, true],
      [2, true],
      [3, true],
      [4, true],
      [0, false],
    ]);
    // and it carries on forward from the first
    await act(async () => jest.advanceTimersByTime(AUTO_ADVANCE_MS));
    expect(screen.getByLabelText('Page 2 of 4')).toBeTruthy();
    scroll.mockRestore();
    jest.useRealTimers();
  });

  it('has the four setup steps, in order', () => {
    expect(STORIES.map((s) => s.id)).toEqual(['claim', 'pair', 'contacts', 'drill']);
  });

  it('shows each step with its number, name and headline', async () => {
    await renderApp(<Intro />);
    expect(screen.getByText('01 · Claim')).toBeTruthy();
    expect(screen.getByText('Scan the code in the box')).toBeTruthy();
    expect(screen.getByText('Each pendant has a one-time code on the card inside its box.')).toBeTruthy();
    expect(screen.getByText('04 · Test')).toBeTruthy();
  });

  it('is in Hindi when the language is Hindi', async () => {
    await i18n.changeLanguage('hi');
    await renderApp(<Intro />);
    expect(screen.getByText('बॉक्स का कोड स्कैन करें')).toBeTruthy();
  });

  it('I have a Svaraa ends the intro and opens Home, where the setup card is', async () => {
    await renderApp(<Intro />);
    await fireEvent.press(screen.getByRole('button', { name: 'I have a Svaraa' }));
    expect(useSession.getState().showIntro).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/home');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('Skip for now goes to Home', async () => {
    await renderApp(<Intro />);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
    expect(useSession.getState().showIntro).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/home');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
