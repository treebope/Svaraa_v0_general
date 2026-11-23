import { api, call } from '@/services/api';
import { deviceTimeZone } from '@/services/reminders/remindersApi';
import { mockProfileChat } from '@/services/mocks/chatProfile';
import { mockYoutubeChat } from '@/services/mocks/chatYoutube';
import { applyChatEvents, type ChatEvent } from './applyChatEvents';

export type ChatReply = { conversationId: string; text: string; events?: ChatEvent[] };

const PROFILE_EVENT_TYPES = new Set(['settings', 'profile', 'contacts']);

function hasProfileSideEffect(events: ChatEvent[]): boolean {
  return events.some((e) => typeof e.type === 'string' && PROFILE_EVENT_TYPES.has(e.type));
}

function hasYoutubeSideEffect(events: ChatEvent[]): boolean {
  return events.some((e) => e.type === 'youtube');
}

/**
 * Ask Svaraa: POST /chat/ (one reply per message; it can use tools such as weather, time and news).
 * /chat/stream is not used: it does not run tools, and phones cannot read a streamed fetch body.
 * Needs sign-in: the server saves the chat in the person's history. Leave `conversationId` out for a new
 * conversation; pass the one from the last reply to continue it.
 * Svaraa can set reminders from chat: `x-timezone` is this phone's zone, so "7 PM" is read as the person's 7 PM.
 * Tool side-effects (music, settings, profile) arrive in `events` and are applied on this phone.
 * PENDING BACKEND: when the live LLM replies in text but emits no settings/profile/contacts/youtube
 * events (old server, or the model skipped the tool), apply the same local phrase match the mock uses.
 */
export async function askSvaraa(message: string, conversationId?: string): Promise<ChatReply> {
  const out = await call(
    api.POST('/api/v1/chat/', {
      params: { header: { 'x-timezone': deviceTimeZone() } },
      body: { message, ...(conversationId ? { conversation_id: conversationId } : {}) },
    }),
  );
  let events = (out.events ?? []) as ChatEvent[];
  await applyChatEvents(events);

  if (!hasYoutubeSideEffect(events)) {
    const localYt = mockYoutubeChat(message);
    if (localYt?.events?.length) {
      const fallback = localYt.events as ChatEvent[];
      await applyChatEvents(fallback);
      events = [...events, ...fallback];
      if (!hasProfileSideEffect(events) && localYt.response) {
        return { conversationId: out.conversation_id, text: localYt.response, events };
      }
    }
  }

  if (!hasProfileSideEffect(events)) {
    const local = mockProfileChat(message);
    if (local?.events?.length) {
      const fallback = local.events as ChatEvent[];
      await applyChatEvents(fallback);
      events = [...events, ...fallback];
    }
  }

  return { conversationId: out.conversation_id, text: out.response, events };
}
