import { create } from 'zustand';
import { askSvaraa } from '@/services/chat/chatApi';

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; kind: 'text'; text: string }
  /** The reply did not arrive (no connection, server error). `text` is our own message, never server text. */
  | { role: 'assistant'; kind: 'error'; text: string }
  | {
      role: 'assistant';
      kind: 'proposal';
      title: string;
      detail: string;
      status: 'waiting' | 'done' | 'cancelled';
    };

export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
  /** The server's chat session, so Svaraa remembers the earlier messages of this chat. */
  sessionId?: string;
};
export type ChatMode = 'ask' | 'do';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (ms: number) => Date.now() - ms;

/**
 * Ask replies come from POST /chat/ (services/chat). PENDING BACKEND: the chat list, its history and Do's
 * proposed actions have no API yet, so they live in memory. The sample chats come from the wireframes (D · Main app).
 */
const SEED: Conversation[] = [
  {
    id: 'c1',
    title: 'Evening medicine reminder',
    updatedAt: ago(2 * HOUR),
    messages: [
      { role: 'user', text: 'Remind me to take my BP tablet every evening' },
      {
        role: 'assistant',
        kind: 'proposal',
        title: 'Set a daily reminder',
        detail: 'Take BP tablet · 8:00 PM, every day',
        status: 'done',
      },
    ],
  },
  {
    id: 'c2',
    title: 'Will it rain tomorrow?',
    updatedAt: ago(5 * HOUR),
    messages: [
      { role: 'user', text: 'Will it rain tomorrow?' },
      {
        role: 'assistant',
        kind: 'text',
        text: 'Light showers are likely after 3 PM. Take an umbrella if you go to the temple in the evening.',
      },
    ],
  },
  {
    id: 'c3',
    title: 'Call Ravi about Sunday',
    updatedAt: ago(DAY + 2 * HOUR),
    messages: [
      { role: 'user', text: 'Call Ravi on Sunday about lunch' },
      {
        role: 'assistant',
        kind: 'proposal',
        title: 'Remind you to call Ravi',
        detail: 'Sunday · 6:00 PM',
        status: 'done',
      },
    ],
  },
  {
    id: 'c4',
    title: 'Morning bhajan playlist',
    updatedAt: ago(3 * DAY),
    messages: [
      { role: 'user', text: 'Play some bhajans in the morning' },
      {
        role: 'assistant',
        kind: 'text',
        text: 'I’ve made “Morning bhajans” with 24 songs. Say “Svaraa, play my morning bhajans” any time.',
      },
    ],
  },
];

type ChatState = {
  conversations: Conversation[];
  /** The open chat. undefined = a new, empty chat. */
  currentId: string | undefined;
  draft: string;
  mode: ChatMode;
  /** The chat whose Ask reply is on its way ("Svaraa is typing"). */
  waitingId: string | undefined;
  /** The voice view (call button) is open. */
  voiceOpen: boolean;
  setVoiceOpen: (open: boolean) => void;
  /** Put what was said in a voice session into the open chat, or a new chat, so it stays in the history. */
  addTranscript: (turns: { role: 'user' | 'assistant'; text: string }[]) => void;
  setDraft: (d: string) => void;
  setMode: (m: ChatMode) => void;
  newChat: () => void;
  open: (id: string) => void;
  /**
   * Ask: sends the message to Svaraa and adds the reply when it arrives. Do: proposes the action at once.
   * `proposalTitle` and `failed` are already-translated texts.
   */
  send(text: string, copy: { proposalTitle: string; failed: string }): Promise<void>;
  decide: (chatId: string, index: number, status: 'done' | 'cancelled') => void;
  reset: () => void;
};

const fresh = (): Pick<
  ChatState,
  'conversations' | 'currentId' | 'draft' | 'mode' | 'voiceOpen' | 'waitingId'
> => ({
  conversations: SEED.map((c) => ({ ...c, messages: [...c.messages] })),
  currentId: undefined,
  draft: '',
  mode: 'ask',
  voiceOpen: false,
  waitingId: undefined,
});

export const useChat = create<ChatState>((set, get) => ({
  ...fresh(),
  setDraft: (draft) => set({ draft }),
  setVoiceOpen: (voiceOpen) => set({ voiceOpen }),
  addTranscript: (turns) => {
    if (!turns.length) return;
    const added: ChatMessage[] = turns.map((t) =>
      t.role === 'user' ? { role: 'user', text: t.text } : { role: 'assistant', kind: 'text', text: t.text },
    );
    const { conversations, currentId } = get();
    if (conversations.some((c) => c.id === currentId)) {
      set({
        conversations: conversations.map((c) =>
          c.id === currentId ? { ...c, updatedAt: Date.now(), messages: [...c.messages, ...added] } : c,
        ),
      });
      return;
    }
    const id = `c${Date.now()}`;
    const first = turns.find((t) => t.role === 'user')?.text ?? turns[0]?.text ?? '';
    set({
      currentId: id,
      conversations: [
        { id, title: first.slice(0, 48), updatedAt: Date.now(), messages: added },
        ...conversations,
      ],
    });
  },
  setMode: (mode) => set({ mode }),
  newChat: () => set({ currentId: undefined, draft: '' }),
  open: (id) => set({ currentId: id }),
  send: async (text, copy) => {
    const body = text.trim();
    if (!body || get().waitingId) return;
    const { mode, conversations, currentId } = get();
    const added: ChatMessage[] = [{ role: 'user', text: body }];
    // PENDING BACKEND: Do has no API (no confirm step on the server), so the proposal is made here.
    if (mode === 'do')
      added.push({
        role: 'assistant',
        kind: 'proposal',
        title: copy.proposalTitle,
        detail: body,
        status: 'waiting',
      });

    const existing = conversations.find((c) => c.id === currentId);
    const id = existing?.id ?? `c${Date.now()}`;
    set({
      draft: '',
      currentId: id,
      waitingId: mode === 'ask' ? id : undefined,
      conversations: existing
        ? conversations.map((c) =>
            c.id === id ? { ...c, updatedAt: Date.now(), messages: [...c.messages, ...added] } : c,
          )
        : [{ id, title: body.slice(0, 48), updatedAt: Date.now(), messages: added }, ...conversations],
    });
    if (mode === 'do') return;

    let reply: ChatMessage;
    let sessionId = existing?.sessionId;
    try {
      const out = await askSvaraa(body, sessionId);
      sessionId = out.sessionId;
      reply = { role: 'assistant', kind: 'text', text: out.text };
    } catch {
      reply = { role: 'assistant', kind: 'error', text: copy.failed };
    }
    set((s) => ({
      waitingId: undefined,
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, sessionId, updatedAt: Date.now(), messages: [...c.messages, reply] } : c,
      ),
    }));
  },
  decide: (chatId, index, status) =>
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id !== chatId
          ? c
          : {
              ...c,
              messages: c.messages.map((m, i) =>
                i === index && m.role === 'assistant' && m.kind === 'proposal' ? { ...m, status } : m,
              ),
            },
      ),
    })),
  reset: () => set(fresh()),
}));

/** How many proposed actions are waiting for a decision ("Working on N things"). */
export const usePendingCount = () =>
  useChat((s) =>
    s.conversations.reduce(
      (n, c) =>
        n +
        c.messages.filter((m) => m.role === 'assistant' && m.kind === 'proposal' && m.status === 'waiting')
          .length,
      0,
    ),
  );

export type TimeAgo = { unit: 'justNow' | 'minutes' | 'hours' | 'days'; count: number };
export function timeAgo(at: number, now = Date.now()): TimeAgo {
  const d = Math.max(0, now - at);
  if (d < MIN) return { unit: 'justNow', count: 0 };
  if (d < HOUR) return { unit: 'minutes', count: Math.floor(d / MIN) };
  if (d < DAY) return { unit: 'hours', count: Math.floor(d / HOUR) };
  return { unit: 'days', count: Math.floor(d / DAY) };
}

export type Group = 'today' | 'yesterday' | 'week' | 'older';
export function groupOf(at: number, now = Date.now()): Group {
  const d = now - at;
  if (d < DAY) return 'today';
  if (d < 2 * DAY) return 'yesterday';
  if (d < 8 * DAY) return 'week';
  return 'older';
}
