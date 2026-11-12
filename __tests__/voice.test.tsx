import { act, fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { ChatView } from '@/features/chat/ChatView';
import { useChat } from '@/features/chat/store';
import { VoiceOverlay } from '@/features/chat/VoiceView';
import { HEAR_MS, LISTEN_MS, THINK_MS } from '@/services/voice/voiceSession';
import { renderApp } from '@/test-utils/render';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useIsFocused: () => true,
}));

const ui = (
  <>
    <ChatView compact />
    <VoiceOverlay where="screen" />
  </>
);
const advance = (ms: number) => act(async () => void jest.advanceTimersByTime(ms));

beforeEach(async () => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  useChat.getState().reset();
  await i18n.changeLanguage('en');
});
afterEach(() => jest.useRealTimers());

describe('Voice view (call button beside the mic)', () => {
  it('opens from the call button, listens, then shows what was said', async () => {
    await renderApp(ui);
    expect(screen.queryByText('Voice with Svaraa')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Talk' }));
    expect(screen.getByText('Voice with Svaraa')).toBeTruthy();
    expect(screen.getByText('Listening…')).toBeTruthy();
    await advance(LISTEN_MS);
    expect(screen.getByText('Hearing you…')).toBeTruthy();
    await advance(HEAR_MS);
    expect(screen.getByText('Will it rain tomorrow?')).toBeTruthy();
    expect(screen.getByText('Thinking…')).toBeTruthy();
    await advance(THINK_MS);
    expect(screen.getByText('Svaraa is speaking')).toBeTruthy();
  });

  it('mutes and unmutes', async () => {
    await renderApp(ui);
    await fireEvent.press(screen.getByRole('radio', { name: 'Talk' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Mute' }));
    expect(screen.getByText(/Muted/)).toBeTruthy();
    await advance(10_000);
    expect(screen.queryByText('Will it rain tomorrow?')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Unmute' }));
    expect(screen.getByText('Listening…')).toBeTruthy();
  });

  it('End closes it and leaves the transcript in the chat history', async () => {
    await renderApp(ui);
    await fireEvent.press(screen.getByRole('radio', { name: 'Talk' }));
    await advance(LISTEN_MS + HEAR_MS + THINK_MS);
    await fireEvent.press(screen.getByRole('button', { name: 'End' }));
    expect(screen.queryByText('Voice with Svaraa')).toBeNull();
    const { conversations, currentId } = useChat.getState();
    const saved = conversations.find((c) => c.id === currentId);
    expect(saved?.title).toBe('Will it rain tomorrow?');
    expect(saved?.messages).toHaveLength(2);
    expect(saved?.messages[0]).toEqual({ role: 'user', text: 'Will it rain tomorrow?' });
  });

  it('Switch to chat keeps the transcript and opens the Chat tab', async () => {
    await renderApp(ui);
    await fireEvent.press(screen.getByRole('radio', { name: 'Talk' }));
    await advance(LISTEN_MS + HEAR_MS + THINK_MS);
    await fireEvent.press(screen.getByRole('button', { name: 'Switch to chat' }));
    expect(mockNavigate).toHaveBeenCalledWith('/chat');
    expect(screen.queryByText('Voice with Svaraa')).toBeNull();
    expect(useChat.getState().conversations[0]?.messages).toHaveLength(2);
  });

  it('ending before anything was said adds no empty chat', async () => {
    await renderApp(ui);
    const before = useChat.getState().conversations.length;
    await fireEvent.press(screen.getByRole('radio', { name: 'Talk' }));
    await fireEvent.press(screen.getByRole('button', { name: 'End' }));
    expect(useChat.getState().conversations).toHaveLength(before);
  });
});
