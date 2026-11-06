import { create } from 'zustand';

export type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; kind: 'text'; text: string }
  | {
      role: 'assistant';
      kind: 'proposal';
      title: string;
      detail: string;
      status: 'waiting' | 'done' | 'cancelled';
    };

export type Conversation = { id: string; title: string; updatedAt: number; messages: ChatMessage[] };
export type ChatMode = 'ask' | 'do';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (ms: number) => Date.now() - ms;

/**
 * PENDING BACKEND: chats, replies and proposed actions have no API yet, so they live in memory and Svaraa answers
 * with a fixed reply. The sample chats come from the wireframes (D · Main app).
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
  setDraft: (d: string) => void;
  setMode: (m: ChatMode) => void;
  newChat: () => void;
  open: (id: string) => void;
  /** `reply` and `proposal` are the already-translated texts Svaraa answers with. */
  send: (text: string, copy: { reply: string; proposalTitle: string }) => void;
  decide: (chatId: string, index: number, status: 'done' | 'cancelled') => void;
  reset: () => void;
};

const fresh = (): Pick<ChatState, 'conversations' | 'currentId' | 'draft' | 'mode'> => ({
  conversations: SEED.map((c) => ({ ...c, messages: [...c.messages] })),
  currentId: undefined,
  draft: '',
  mode: 'ask',
});

export const useChat = create<ChatState>((set, get) => ({
  ...fresh(),
  setDraft: (draft) => set({ draft }),
  setMode: (mode) => set({ mode }),
  newChat: () => set({ currentId: undefined, draft: '' }),
  open: (id) => set({ currentId: id }),
  send: (text, copy) => {
    const body = text.trim();
    if (!body) return;
    const { mode, conversations, currentId } = get();
    const reply: ChatMessage =
      mode === 'do'
        ? { role: 'assistant', kind: 'proposal', title: copy.proposalTitle, detail: body, status: 'waiting' }
        : { role: 'assistant', kind: 'text', text: copy.reply };
    const added: ChatMessage[] = [{ role: 'user', text: body }, reply];
    const existing = conversations.find((c) => c.id === currentId);
    if (existing) {
      set({
        draft: '',
        conversations: conversations.map((c) =>
          c.id === existing.id ? { ...c, updatedAt: Date.now(), messages: [...c.messages, ...added] } : c,
        ),
      });
      return;
    }
    const id = `c${Date.now()}`;
    set({
      draft: '',
      currentId: id,
      conversations: [
        { id, title: body.slice(0, 48), updatedAt: Date.now(), messages: added },
        ...conversations,
      ],
    });
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
