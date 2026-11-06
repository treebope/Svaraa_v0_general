import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChatHistory } from '@/features/chat/ChatHistory';
import { useChat } from '@/features/chat/store';
import { Logo, useTheme } from '@/ui';
import { pageBackground, useMainPalette } from './palette';

/**
 * Phone: chat history as a drawer from the menu button (wireframe D, phone pins 1 and 5 to 8).
 * It is drawn over the Chat screen itself, not in a system `Modal`: a Modal opened from a tab that was left and
 * returned to can stop responding on the phone.
 */
export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = useMainPalette();
  if (!open) return null;
  const done = (then: () => void) => {
    onClose();
    then();
  };
  return (
    <View
      accessibilityViewIsModal
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', zIndex: 20 }}
    >
      <View
        style={{
          width: '84%',
          maxWidth: 360,
          ...pageBackground(p),
          paddingTop: insets.top + 16,
          paddingBottom: 12,
          paddingHorizontal: 12,
        }}
      >
        <View style={{ paddingHorizontal: 6, paddingBottom: 10 }}>
          <Logo height={30} />
        </View>
        <ChatHistory
          search
          onPick={(id) =>
            done(() => {
              useChat.getState().open(id);
              router.navigate('/chat');
            })
          }
          onNew={() =>
            done(() => {
              useChat.getState().newChat();
              router.navigate('/chat');
            })
          }
          onAll={() => done(() => router.navigate('/chats'))}
          onUser={() => done(() => router.navigate('/profile'))}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: theme.colors.scrim }}
      />
    </View>
  );
}
