import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { DrillOut } from '@/services/api';
import { Card, Icon, Text, useTheme } from '@/ui';

type StepState = 'done' | 'active' | 'todo' | 'failed' | 'skipped';

/** PENDING BACKEND: how long each contact is rung before Svaraa moves to the next one (a guess). */
export const RING_SECONDS = 30;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** A soft ring that grows and fades behind the icon while something is happening. */
function Pulse({ color, on }: { color: string; on: boolean }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!on) return;
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [on, v]);
  if (!on) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
      }}
    />
  );
}

/**
 * C8 · What happens in an SOS, in order. A status card on top (who is being called and the time left), then a
 * timeline: SOS triggered, each emergency contact (ringing, answered, or no answer so the next is tried), and 112
 * emergency services as the last option. In a drill 112 is never dialled. PENDING BACKEND: the backend only reports
 * waiting / passed / expired, so which contact is ringing is worked out here from the time elapsed and RING_SECONDS.
 */
export function DrillSteps({
  drill,
  contacts,
  secondsLeft,
}: {
  drill: DrillOut;
  contacts: { name: string; countryCode?: string; mobile?: string }[];
  secondsLeft: number;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const c = theme.colors;
  const { status } = drill;

  const total = Math.max(1, Math.round((Date.parse(drill.expires_at) - Date.parse(drill.started_at)) / 1000));
  const elapsed = Math.min(total, Math.max(0, total - secondsLeft));
  const ringing = Math.floor(elapsed / RING_SECONDS); // contact being rung; >= length means 112
  const named = contacts.findIndex((p) => p.name === drill.acknowledged_by);
  const answeredAt = status === 'passed' ? (named >= 0 ? named : Math.min(ringing, contacts.length - 1)) : -1;
  const emergencyNow = status === 'waiting' && ringing >= contacts.length;
  const nextIn = RING_SECONDS - (elapsed % RING_SECONDS);

  type Row = { key: string; title: string; sub?: string; chip: string; state: StepState; glyph: string };
  const rows: Row[] = contacts.map((p, i) => {
    let state: StepState;
    let chip: string;
    if (status === 'passed') {
      state = i === answeredAt ? 'done' : i < answeredAt ? 'failed' : 'skipped';
      chip = t(
        i === answeredAt
          ? 'wearer.drill.steps.answered'
          : i < answeredAt
            ? 'wearer.drill.steps.noAnswer'
            : 'wearer.drill.steps.notNeeded',
      );
    } else if (status === 'expired' || i < ringing) {
      state = 'failed';
      chip = t('wearer.drill.steps.noAnswer');
    } else if (i === ringing) {
      state = 'active';
      chip = t('wearer.drill.steps.ringing');
    } else {
      state = 'todo';
      chip = t('wearer.drill.steps.next');
    }
    return {
      key: `c${i}`,
      title: p.name,
      sub: p.mobile ? `${p.countryCode ?? ''} ${p.mobile}`.trim() : undefined,
      chip,
      state,
      glyph: (p.name.trim()[0] ?? String(i + 1)).toUpperCase(),
    };
  });
  rows.push({
    key: '112',
    title: t('wearer.drill.steps.emergency'),
    sub: t(
      emergencyNow || status === 'expired'
        ? 'wearer.drill.steps.emergencyDrill'
        : 'wearer.drill.steps.emergencyLast',
    ),
    chip: t(
      status === 'passed'
        ? 'wearer.drill.steps.notNeeded'
        : emergencyNow || status === 'expired'
          ? 'wearer.drill.steps.skippedDrill'
          : 'wearer.drill.steps.next',
    ),
    state: status === 'passed' ? 'skipped' : emergencyNow || status === 'expired' ? 'active' : 'todo',
    glyph: '112',
  });

  const toneOf = (s: StepState) =>
    s === 'done' ? c.good : s === 'failed' ? c.attention : s === 'active' ? c.action : c.border;
  const tintOf = (s: StepState) =>
    s === 'done' ? c.goodTint : s === 'failed' ? c.attentionTint : s === 'active' ? c.infoTint : c.sunken;

  // The status card
  const who = contacts[Math.min(ringing, contacts.length - 1)]?.name ?? '';
  const heroState: StepState = status === 'passed' ? 'done' : status === 'expired' ? 'failed' : 'active';
  const heroTitle =
    status === 'passed'
      ? t('wearer.drill.passed')
      : status === 'expired'
        ? t('wearer.drill.expired')
        : emergencyNow
          ? t('wearer.drill.hero.emergency')
          : t('wearer.drill.hero.calling', { name: who });
  const heroSub =
    status === 'waiting'
      ? emergencyNow
        ? t('wearer.drill.hero.drillNote')
        : t('wearer.drill.hero.nextIn', { time: clock(nextIn) })
      : status === 'passed'
        ? drill.acknowledged_by
          ? t('wearer.drill.answeredBy', { name: drill.acknowledged_by })
          : t('wearer.drill.answered')
        : t('wearer.drill.expiredBody');

  return (
    <View style={{ gap: theme.space[3] }}>
      <Card
        style={{ alignItems: 'center', gap: theme.space[2], backgroundColor: tintOf(heroState) }}
        accessibilityLiveRegion="polite"
      >
        <View
          style={{
            width: 72,
            height: 72,
            alignItems: 'center',
            justifyContent: 'center',
            marginVertical: theme.space[2],
          }}
        >
          <Pulse color={toneOf(heroState)} on={status === 'waiting'} />
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: toneOf(heroState),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={status === 'passed' ? 'check' : status === 'expired' ? 'close' : 'call'}
              color={c.onAction}
              size={28}
            />
          </View>
        </View>
        <Text variant="heading" tone="heading" style={{ textAlign: 'center' }}>
          {heroTitle}
        </Text>
        <Text tone="secondary" style={{ textAlign: 'center' }}>
          {heroSub}
        </Text>
        {status === 'waiting' ? (
          <Text variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
            {t('wearer.drill.waiting', { time: clock(secondsLeft) })}
          </Text>
        ) : null}
        {status === 'waiting' ? (
          <View
            style={{
              alignSelf: 'stretch',
              height: 6,
              borderRadius: 3,
              backgroundColor: c.border,
              overflow: 'hidden',
              marginTop: theme.space[1],
            }}
          >
            <View
              style={{
                width: `${Math.round((elapsed / total) * 100)}%`,
                height: 6,
                backgroundColor: c.action,
              }}
            />
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: 0, paddingVertical: theme.space[3] }}>
        <Row2
          glyph="!"
          title={t('wearer.drill.steps.sent')}
          chip={t('wearer.drill.steps.sentChip')}
          state="done"
          first
          tone={toneOf('done')}
          tint={tintOf('done')}
        />
        {rows.map((r, i) => (
          <Row2
            key={r.key}
            glyph={r.glyph}
            title={r.title}
            sub={r.sub}
            chip={r.chip}
            state={r.state}
            last={i === rows.length - 1}
            tone={toneOf(r.state)}
            tint={tintOf(r.state)}
          />
        ))}
      </Card>
    </View>
  );
}

function Row2({
  glyph,
  title,
  sub,
  chip,
  state,
  tone,
  tint,
  first,
  last,
}: {
  glyph: string;
  title: string;
  sub?: string;
  chip: string;
  state: StepState;
  tone: string;
  tint: string;
  first?: boolean;
  last?: boolean;
}) {
  const theme = useTheme();
  const c = theme.colors;
  const muted = state === 'todo' || state === 'skipped';
  return (
    <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
      <View style={{ alignItems: 'center', width: 36 }}>
        <View
          style={{
            width: 2,
            height: 8,
            backgroundColor: first
              ? 'transparent'
              : state === 'todo' || state === 'skipped'
                ? c.border
                : tone,
          }}
        />
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: muted ? 'transparent' : tone,
            borderWidth: 2,
            borderColor: tone,
          }}
        >
          <Text
            variant="label"
            style={{
              color: muted ? c.textSecondary : c.onAction,
              fontSize: glyph.length > 2 ? 11 : undefined,
            }}
          >
            {glyph}
          </Text>
        </View>
        <View
          style={{ width: 2, flexGrow: 1, minHeight: 8, backgroundColor: last ? 'transparent' : c.border }}
        />
      </View>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          paddingVertical: theme.space[2],
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="label" tone={muted ? 'secondary' : 'heading'}>
            {title}
          </Text>
          {sub ? (
            <Text variant="caption" tone="secondary">
              {sub}
            </Text>
          ) : null}
        </View>
        <View style={{ backgroundColor: tint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text
            variant="caption"
            style={{ color: muted ? c.textSecondary : c.textPrimary, fontWeight: '600' }}
          >
            {chip}
          </Text>
        </View>
      </View>
    </View>
  );
}
