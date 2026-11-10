import { api, call } from '@/services/api';

export type ChatReply = { sessionId: string; text: string };

/**
 * Ask Svaraa: POST /chat/ (one reply per message; it can use tools such as weather, time and news).
 * /chat/stream is not used: it does not run tools, and phones cannot read a streamed fetch body.
 * Pass the session id from the last reply to continue the same conversation.
 * The server does not require sign-in yet; the bearer token is sent anyway so nothing changes when it does.
 */
export async function askSvaraa(message: string, sessionId?: string): Promise<ChatReply> {
  const out = await call(
    api.POST('/api/v1/chat/', { body: { message, ...(sessionId ? { session_id: sessionId } : {}) } }),
  );
  return { sessionId: out.session_id, text: out.response };
}
