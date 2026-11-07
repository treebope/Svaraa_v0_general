import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, ScrollView, View } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { pageBackground, RoundButton, useMainPalette } from '@/features/main/palette';
import { useWide } from '@/features/main/useWide';
import {
  startVoiceSession,
  type VoiceSession,
  type VoiceState,
  type VoiceTurn,
} from '@/services/voice/voiceSession';
import { Icon, Text, useTheme } from '@/ui';
import { useChat } from './store';

const ORB = 150;
/** How the orb moves in each state: how far the rings spread and how long one pulse takes. */
const MOTION: Record<VoiceState, { spread: number; ms: number }> = {
  listening: { spread: 0.35, ms: 2000 },
  hearing: { spread: 0.7, ms: 700 },
  thinking: { spread: 0.18, ms: 900 },
  speaking: { spread: 0.55, ms: 1200 },
  muted: { spread: 0, ms: 1000 },
};

/** The big blinking circle: one core with two rings that grow and fade, faster while you are heard. */
function Orb({ state }: { state: VoiceState }) {
  const p = useMainPalette();
  const [pulse] = useState(() => new Animated.Value(0));
  const [still, setStill] = useState(false);
  const native = Platform.OS !== 'web';

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setStill);
  }, []);

  useEffect(() => {
    pulse.setValue(0);
    if (still || state === 'muted') return;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: MOTION[state].ms,
        easing: Easing.out(Easing.quad),
        useNativeDriver: native,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [state, still, pulse, native]);

  const { spread } = MOTION[state];
  const ring = (delay: number) => {
    const shifted = Animated.modulo(Animated.add(pulse, delay), 1);
    return {
      transform: [{ scale: shifted.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + spread] }) }],
      opacity: shifted.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
    };
  };
  const core = {
    transform: [
      { scale: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1 + spread / 6, 1] }) },
    ],
    opacity: state === 'muted' ? 0.45 : 1,
  };
  const disc = { position: 'absolute', width: ORB, height: ORB, borderRadius: ORB / 2 } as const;
  return (
    <View
      style={{ width: ORB * 2, height: ORB * 2, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[disc, { backgroundColor: p.plum }, ring(0)]} />
      <Animated.View style={[disc, { backgroundColor: p.gold }, ring(0.5)]} />
      <Animated.View
        style={[
          disc,
          { backgroundColor: p.plum, alignItems: 'center', justifyContent: 'center' },
          core,
          Platform.OS === 'web'
            ? ({ backgroundImage: `radial-gradient(circle at 35% 30%, ${p.gold}, ${p.plum} 70%)` } as object)
            : null,
        ]}
      >
        <Icon name={state === 'muted' ? 'micoff' : 'mic'} size={44} color={p.on} />
      </Animated.View>
    </View>
  );
}

/**
 * The voice conversation (the call button beside the mic). A big blinking circle in the middle, what was said below,
 * and three buttons: mute, switch to chat, end. Ending or switching keeps what was said in the chat history.
 * Full screen on the phone; fills the chat pane on a wide web window.
 */
function VoiceView({ active = true }: { active?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const wide = useWide();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<VoiceState>('listening');
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const turnsRef = useRef<VoiceTurn[]>([]);
  const session = useRef<VoiceSession | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const started = useRef(false);
  const muted = state === 'muted';

  useEffect(() => {
    if (!active) return;
    started.current = true;
    const call = startVoiceSession(
      [
        { ask: t('voice.demo.ask1'), answer: t('voice.demo.answer1') },
        { ask: t('voice.demo.ask2'), answer: t('voice.demo.answer2') },
      ],
      {
        onState: setState,
        onTurn: (turn) => {
          turnsRef.current = [...turnsRef.current, turn];
          setTurns(turnsRef.current);
        },
      },
    );
    session.current = call;
    return () => call.stop();
    // The script is fixed when the call starts, even if the language changes during it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [turns.length]);

  const finish = (toChat: boolean) => {
    session.current?.stop();
    useChat.getState().addTranscript(turnsRef.current);
    useChat.getState().setVoiceOpen(false);
    if (toChat && !wide) router.navigate('/chat');
  };

  // Leaving the tab during a call ends it and keeps what was said, like End.
  useEffect(() => {
    if (!active && started.current) finish(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Web: Escape ends the call.
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const win = globalThis as unknown as {
      addEventListener: (n: string, f: (e: { key: string }) => void) => void;
      removeEventListener: (n: string, f: (e: { key: string }) => void) => void;
    };
    const onKey = (e: { key: string }) => e.key === 'Escape' && finish(false);
    win.addEventListener('keydown', onKey);
    return () => win.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  const pill = {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
  } as const;

  return (
    <View
      accessibilityViewIsModal
      style={[
        {
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 50,
          paddingTop: wide ? 16 : insets.top + 12,
          paddingBottom: wide ? 20 : insets.bottom + 16,
          paddingHorizontal: 20,
          alignItems: 'center',
        },
        wide ? { backgroundColor: p.card, borderRadius: 24 } : pageBackground(p),
      ]}
    >
      <Text variant="kicker" style={{ color: p.gold }} accessibilityRole="header">
        {t('voice.title')}
      </Text>

      <View style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: 560, alignItems: 'center' }}>
        <View style={{ flexShrink: 0, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
          <Orb state={state} />
        </View>
        <View accessibilityLiveRegion="polite" style={{ marginTop: -8 }}>
          <Text variant="heading" style={{ color: p.ink, textAlign: 'center' }}>
            {t(`voice.state.${state}`)}
          </Text>
        </View>
        <ScrollView
          ref={scroll}
          style={{ flex: 1, width: '100%', marginTop: theme.space[4] }}
          contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
        >
          {turns.length ? (
            turns.map((turn, i) => (
              <View
                key={i}
                style={{
                  alignSelf: turn.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  backgroundColor: turn.role === 'user' ? p.plumSoft : p.card,
                  borderWidth: turn.role === 'user' ? 0 : 1,
                  borderColor: p.line2,
                  paddingVertical: 9,
                  paddingHorizontal: 14,
                  borderRadius: 18,
                }}
              >
                <Text variant="caption" style={{ color: p.muted }}>
                  {t(turn.role === 'user' ? 'voice.you' : 'voice.svaraa')}
                </Text>
                <Text style={{ color: p.ink, lineHeight: 22 }}>{turn.text}</Text>
              </View>
            ))
          ) : (
            <Text style={{ color: p.muted, textAlign: 'center' }}>{t('voice.hint')}</Text>
          )}
        </ScrollView>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <RoundButton
          icon={muted ? 'micoff' : 'mic'}
          label={t(muted ? 'voice.unmute' : 'voice.mute')}
          filled={muted}
          onPress={() => session.current?.setMuted(!muted)}
          size={52}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('voice.toChat')}
          onPress={() => finish(true)}
          style={({ pressed }) => [
            pill,
            { borderWidth: 1.5, borderColor: p.line2, backgroundColor: p.card, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Icon name="chat" size={20} color={p.plum} />
          <Text style={{ color: p.ink, fontWeight: '600' }}>{t('voice.toChat')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('voice.end')}
          onPress={() => finish(false)}
          style={({ pressed }) => [
            pill,
            { backgroundColor: theme.colors.safety, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Icon name="close" size={20} color={p.on} />
          <Text style={{ color: p.on, fontWeight: '600' }}>{t('voice.end')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Shows the voice view in the right place: over the chat pane on a wide web window (`where="pane"`, drawn by
 * ChatView), or over the whole screen on the phone (`where="screen"`, drawn by the tabs layout).
 */
export function VoiceOverlay({ where }: { where: 'pane' | 'screen' }) {
  return where === 'pane' ? <PaneVoice /> : <ScreenVoice />;
}

function ScreenVoice() {
  const open = useChat((s) => s.voiceOpen);
  const wide = useWide();
  return open && !wide ? <VoiceView /> : null;
}

/** The Chat and Apps tabs both hold a chat on a wide window and both stay mounted, so only the open tab shows the call. */
function PaneVoice() {
  const open = useChat((s) => s.voiceOpen);
  const wide = useWide();
  const focused = useIsFocused();
  return open && wide ? <VoiceView active={focused} /> : null;
}
