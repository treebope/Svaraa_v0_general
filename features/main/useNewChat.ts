import { usePathname, useRouter } from 'expo-router';
import { useChat } from '@/features/chat/store';
import { useWide } from './useWide';

/**
 * "New chat" (wireframe D, pin 2): starts an empty chat in whatever is showing chat.
 * - Phone: opens the Chat tab.
 * - Wide web: stays where you are (the side panel on Apps, the full view on Chat). From the All chats page it goes
 *   back to Chat.
 */
export function useNewChat() {
  const router = useRouter();
  const wide = useWide();
  const path = usePathname();
  return () => {
    useChat.getState().newChat();
    if (!wide) router.navigate('/chat');
    else if (path.startsWith('/chats')) router.navigate('/chat');
  };
}
