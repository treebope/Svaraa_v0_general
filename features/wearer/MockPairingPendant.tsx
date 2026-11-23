import { useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { flags } from '@/config/flags';
import { env } from '@/config/env';
import { pendant, SimulatorTransport } from '@/services/pendant';
import { Text, useTheme, shadow } from '@/ui';

/** Gold lotus mark reads clearly on the black pendant face. */
const MARK = require('../../assets/brand/mark-dark.png');
/** Centre disc in mark-dark.png is ~14% of the mark width. */
const MARK_GOLD_RATIO = 0.14;

/** Pairing needs one press; SOS needs three. */
const PRESSES: Record<'pairing' | 'sos', number> = { pairing: 1, sos: 3 };

/**
 * Dev / simulator stand-in for the physical gold button.
 * Only the gold centre is tappable. Pairing emits `pairing_press` after 1 press; SOS emits `sos` after 3.
 */
export function MockPairingPendant({
  intent = 'pairing',
  disabled,
  retry,
  foundLabel,
}: {
  intent?: 'pairing' | 'sos';
  disabled?: boolean;
  retry?: boolean;
  /** e.g. "Svaraa Fold Over · #2041" once nearby. */
  foundLabel?: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const needed = PRESSES[intent];
  /** Ref so rapid presses are not lost when React batches state updates. */
  const pressesRef = useRef(0);
  const [presses, setPresses] = useState(0);
  const show = flags.pendantTransport === 'simulator' || env.showDevOtpHint || env.useMocks;
  if (!show) return null;

  const c = theme.colors;
  /** One inset for card edges and studio edges — top = sides = bottom. */
  const inset = theme.space[3];
  /** SOS drill uses a larger mock so the press target is easier to find. */
  const scale = intent === 'sos' ? 1.5 : 1;
  const face = Math.round(96 * scale);
  const mark = Math.round(78 * scale);
  const dot = Math.max(12, Math.round(mark * MARK_GOLD_RATIO));
  /** Wide card (2× the tight face+padding footprint), studio fills it. */
  const boxWidth = (face + inset * 4) * 2;
  const studio = theme.scheme === 'light' ? '#F6EBE8' : '#2A2226';
  const gold = {
    core: '#E2BD72',
    rich: '#C9A24A',
    highlight: '#FFF1C8',
    rim: '#F5D78A',
  };

  const fire = () => {
    const tport = pendant();
    if (!(tport instanceof SimulatorTransport)) return;
    if (intent === 'sos') tport.simulateSosPress();
    else tport.simulatePairingPress();
  };

  const hint =
    intent === 'sos'
      ? t('wearer.drill.mockHint')
      : retry
        ? t('wearer.pair.retry')
        : t('wearer.pair.mockHint');
  const a11y =
    intent === 'sos'
      ? t('wearer.drill.mockPress')
      : retry
        ? t('wearer.pair.retry')
        : t('wearer.pair.mockPress');

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          width: boxWidth,
          maxWidth: '100%',
          paddingTop: inset,
          paddingBottom: inset,
          paddingLeft: inset,
          paddingRight: inset,
          gap: inset,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          backgroundColor: c.surfaceSolid,
        },
        theme.scheme === 'light' ? shadow.card : null,
      ]}
    >
      <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
        {hint}
      </Text>

      {/* Full-width studio well — same inset as the card edges */}
      <View
        style={{
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: inset,
          paddingBottom: inset,
          paddingLeft: inset,
          paddingRight: inset,
          gap: theme.space[2],
          borderRadius: theme.radius.lg,
          backgroundColor: studio,
        }}
      >
        <View
          pointerEvents="box-none"
          style={{
            width: face,
            height: face,
            borderRadius: face / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.scheme === 'light' ? '#1A1216' : '#0E0A0C',
            borderWidth: 1,
            borderColor: 'rgba(226,189,114,0.35)',
            opacity: disabled ? 0.45 : 1,
            shadowColor: c.accentSpirit,
            shadowOpacity: 0.35,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}
        >
          <Image
            source={MARK}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            resizeMode="contain"
            style={{
              position: 'absolute',
              width: mark,
              height: mark,
              opacity: 0.95,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a11y}
            accessibilityState={{ disabled }}
            accessibilityValue={needed > 1 ? { now: presses, min: 0, max: needed } : undefined}
            disabled={disabled}
            hitSlop={12}
            onPress={() => {
              if (disabled) return;
              const next = pressesRef.current + 1;
              if (next >= needed) {
                pressesRef.current = 0;
                setPresses(0);
                fire();
              } else {
                pressesRef.current = next;
                setPresses(next);
              }
            }}
            style={({ pressed }) => ({
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: gold.rich,
              borderWidth: 1,
              borderColor: gold.rim,
              opacity: pressed && !disabled ? 0.88 : 1,
              transform: [{ scale: pressed && !disabled ? 0.94 : 1 }],
              shadowColor: gold.core,
              shadowOpacity: 0.9,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 1 },
              elevation: 3,
              zIndex: 2,
            })}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 1,
                left: 2,
                width: Math.max(3, dot * 0.4),
                height: Math.max(2, dot * 0.28),
                borderRadius: 4,
                backgroundColor: gold.highlight,
                opacity: 0.8,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                width: Math.max(4, dot - 3),
                height: Math.max(4, dot - 3),
                borderRadius: Math.max(2, (dot - 3) / 2),
                backgroundColor: gold.core,
              }}
            />
          </Pressable>
        </View>
        <Text variant="label" tone="spirit">
          {needed > 1 && presses > 0
            ? t('wearer.drill.pressProgress', { current: presses, total: needed })
            : t('wearer.pair.button')}
        </Text>
      </View>

      {foundLabel ? (
        <Text variant="bodySm" tone="secondary" style={{ textAlign: 'center' }}>
          {foundLabel}
        </Text>
      ) : null}
    </View>
  );
}
