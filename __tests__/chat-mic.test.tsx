import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { ChatView } from '@/features/chat/ChatView';
import { useChat } from '@/features/chat/store';
import type { DictationHandlers } from '@/services/voice/dictation';
import { renderApp } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useIsFocused: () => true,
}));

// A fake speech recogniser: the test says what was "heard".
let mockHandlers: DictationHandlers | undefined;
const mockStop = jest.fn();
let mockLanguage = '';
jest.mock('@/services/voice/dictation', () => ({
  isDictationAvailable: () => true,
  startDictation: (language: string, handlers: DictationHandlers) => {
    mockLanguage = language;
    mockHandlers = handlers;
    return { stop: mockStop };
  },
}));

const heard = (text: string) => act(async () => mockHandlers?.onText(text));
const ended = () => act(async () => mockHandlers?.onEnd());

beforeEach(async () => {
  mockHandlers = undefined;
  mockStop.mockClear();
  useChat.getState().reset();
  await i18n.changeLanguage('en');
});

describe('Chat mic (speech to text)', () => {
  it('fills the message box with what was said, then Send sends it', async () => {
    await renderApp(<ChatView compact />);
    await fireEvent.press(screen.getByRole('button', { name: 'Speak' }));
    expect(mockLanguage).toBe('en');
    expect(screen.getByText(/Listening… speak now/)).toBeTruthy();
    await heard('What is the');
    await heard('What is the time');
    expect(screen.getByLabelText('Message').props.value).toBe('What is the time');
    await ended();
    expect(screen.queryByText(/Listening…/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('adds the spoken words after text already typed', async () => {
    await renderApp(<ChatView compact />);
    await fireEvent.changeText(screen.getByLabelText('Message'), 'Please');
    await fireEvent.press(screen.getByRole('button', { name: 'Speak' }));
    await heard('remind me at 7');
    expect(screen.getByLabelText('Message').props.value).toBe('Please remind me at 7');
  });

  it('stops listening when the mic is tapped again', async () => {
    await renderApp(<ChatView compact />);
    await fireEvent.press(screen.getByRole('button', { name: 'Speak' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Stop listening' }));
    expect(mockStop).toHaveBeenCalled();
  });

  it('says how to allow the microphone when the browser blocks it', async () => {
    await renderApp(<ChatView compact />);
    await fireEvent.press(screen.getByRole('button', { name: 'Speak' }));
    await act(async () => mockHandlers?.onError('blocked'));
    await ended();
    expect(screen.getByText(/microphone is blocked/)).toBeTruthy();
  });
});
