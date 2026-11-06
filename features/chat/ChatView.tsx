import { useEffect, useRef, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DotPill, RoundButton, Segmented, useMainPalette } from '@/features/main/palette';
import { Logo, LogoMark, Text, fontFamily, useTheme } from '@/ui';
import { useChat, usePendingCount, type ChatMessage, type ChatMode } from './store';

/**
 * The conversation and the composer (wireframe D, web pins 8 and 9, phone pin 4). Ask answers straight away;
 * Do proposes an action that waits for Confirm. Shared by the Chat tab and the chat pane beside Apps on the web.
 * `compact` is the phone sizing.
 */
export function ChatView({ compact, centered }: { compact?: boolean; centered?: boolean }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const p = useMainPalette();
  const { conversations, currentId, draft, mode, setDraft, setMode, send, decide } = useChat();
  const pending = usePendingCount();
  const chat = conversations.find((x) => x.id === currentId);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [chat?.messages.length, currentId]);

  const submit = () => send(draft, { reply: t('chat.reply'), proposalTitle: t('chat.proposal.title') });
  const body = theme.typeScale.body;
  const width = centered ? ({ width: '100%', maxWidth: 780, alignSelf: 'center' } as const) : null;

  const bubble = (m: ChatMessage, i: number) => {
    if (m.role === 'user')
      return (
        <View
          key={i}
          style={{
            alignSelf: 'flex-end',
            maxWidth: '86%',
            backgroundColor: p.plumSoft,
            paddingVertical: 9,
            paddingHorizontal: 14,
            borderRadius: 18,
            borderBottomRightRadius: 6,
          }}
        >
          <Text style={{ color: p.ink, lineHeight: 22 }}>{m.text}</Text>
        </View>
      );
    return (
      <View key={i} style={{ alignSelf: 'flex-start', maxWidth: '86%', flexDirection: 'row', gap: 10 }}>
        <View style={{ marginTop: 1 }}>
          <LogoMark size={26} />
        </View>
        {m.kind === 'text' ? (
          <Text style={{ flexShrink: 1, color: p.ink, lineHeight: 22 }}>{m.text}</Text>
        ) : (
          <View
            style={{
              flexShrink: 1,
              minWidth: 220,
              gap: 4,
              backgroundColor: p.card,
              borderWidth: 1,
              borderColor: p.line2,
              borderRadius: 16,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
          >
            <Text variant="caption" style={{ color: p.muted }}>
              {t('chat.proposal.label')}
            </Text>
            <Text variant="heading" style={{ color: p.ink }}>
              {m.title}
            </Text>
            <Text style={{ color: p.muted }}>{m.detail}</Text>
            {m.status === 'waiting' ? (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <PillButton
                  label={t('chat.proposal.confirm')}
                  primary
                  onPress={() => chat && decide(chat.id, i, 'done')}
                />
                <PillButton
                  label={t('chat.proposal.cancel')}
                  onPress={() => chat && decide(chat.id, i, 'cancelled')}
                />
              </View>
            ) : (
              <Text
                style={{
                  marginTop: 6,
                  color: m.status === 'done' ? p.good : p.muted,
                  fontWeight: m.status === 'done' ? '600' : '400',
                }}
              >
                {m.status === 'done' ? t('chat.proposal.done') : t('chat.proposal.cancelled')}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={[
          { flexGrow: 1, paddingVertical: 16, paddingHorizontal: compact ? 16 : 20, gap: 14 },
          width,
        ]}
      >
        {chat && chat.messages.length ? (
          chat.messages.map(bubble)
        ) : (
          <View
            style={{
              flex: 1,
              minHeight: 280,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              alignSelf: 'center',
              maxWidth: 320,
            }}
          >
            <Logo height={64} />
            <View accessibilityLiveRegion="polite">
              <DotPill label={t('chat.working', { count: pending })} bordered={false} />
            </View>
            <Text
              variant="bodyLg"
              style={{ color: p.muted, textAlign: 'center', marginTop: 16, marginBottom: 6 }}
            >
              {t('chat.emptyHelp')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {(['walk', 'bhajans'] as const).map((k) => (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  onPress={() => setDraft(t(`chat.suggest.${k}`))}
                  style={({ pressed }) => ({
                    minHeight: theme.minTarget,
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: p.line2,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    backgroundColor: pressed ? p.plumSoft : p.card,
                  })}
                >
                  <Text variant="bodySm" style={{ color: p.ink }}>
                    {t(`chat.suggest.${k}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          { paddingTop: 8, paddingBottom: compact ? 10 : 16, paddingHorizontal: compact ? 12 : 16 },
          width,
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={p.muted}
          accessibilityLabel={t('chat.message')}
          multiline
          blurOnSubmit={false}
          onKeyPress={(e) => {
            // Web: Enter sends, Shift+Enter adds a line.
            const ev = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
            if (ev.key === 'Enter' && !ev.shiftKey && Platform.OS === 'web') {
              (e as unknown as { preventDefault?: () => void }).preventDefault?.();
              submit();
            }
          }}
          style={{
            minHeight: compact ? 46 : 70,
            maxHeight: 160,
            textAlignVertical: 'top',
            backgroundColor: p.card,
            borderWidth: 1,
            borderColor: p.line2,
            borderRadius: compact ? 24 : 20,
            paddingVertical: compact ? 12 : 13,
            paddingHorizontal: 16,
            color: p.ink,
            fontFamily: fontFamily(i18n.language, body),
            fontSize: 15.5 * theme.fontScale,
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Segmented<ChatMode>
              label={t('chat.mode')}
              value={mode}
              onChange={setMode}
              options={[
                { id: 'ask', label: t('chat.ask') },
                { id: 'do', label: t('chat.do') },
              ]}
            />
          </View>
          {/* PENDING FE-14: voice input arrives with the voice relay. */}
          <RoundButton icon="mic" label={t('chat.speak')} disabled size={compact ? 40 : 44} />
          <RoundButton
            icon="send"
            label={t('chat.send')}
            filled={!!draft.trim()}
            disabled={!draft.trim()}
            onPress={submit}
            size={compact ? 40 : 44}
          />
        </View>
        {mode === 'do' ? (
          <Text variant="bodySm" style={{ color: p.muted, marginTop: 8, marginHorizontal: 2 }}>
            {t('chat.doHint')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Confirm (plum) and Cancel (outlined) pills on a proposed action (wireframe `.bp`, `.bs`). */
function PillButton({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  const p = useMainPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        justifyContent: 'center',
        borderRadius: 999,
        paddingHorizontal: 14,
        backgroundColor: primary ? p.plum : 'transparent',
        borderWidth: primary ? 0 : 1.5,
        borderColor: p.line2,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text variant="label" style={{ color: primary ? p.on : p.ink, fontWeight: '600', fontSize: 13.5 }}>
        {label}
      </Text>
    </Pressable>
  );
}
