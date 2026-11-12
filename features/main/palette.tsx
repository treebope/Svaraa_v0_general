import type { ReactNode } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { Icon, Text, useTheme, type IconName } from '@/ui';

/**
 * Colours of the main app (wireframe D, "styled after the current build"): a soft pink-to-cream page, warm cards,
 * deep plum for actions. Light and dark follow the app's scheme.
 */
const LIGHT = {
  bg1: '#F3E4EB',
  bg2: '#F7EFE5',
  card: '#FFFAF8',
  tile: '#F8F3EC',
  tile2: '#EBE2D6',
  ink: '#3A2D33',
  muted: '#7A6B72',
  line: '#ECDFE4',
  line2: '#DCCBD2',
  plum: '#5E1A3D',
  plumSoft: '#F1E3EA',
  on: '#FFFFFF',
  seg: '#ECE4E1',
  good: '#2F7D4A',
  gold: '#B98A2E',
  goldSoft: '#F7EBD3',
  bad: '#B3261E',
  badSoft: '#F8E3E0',
};
const DARK: typeof LIGHT = {
  bg1: '#251C21',
  bg2: '#1D1A1C',
  card: '#2B2428',
  tile: '#352D32',
  tile2: '#2A2327',
  ink: '#F2E8EC',
  muted: '#B8A8B0',
  line: '#3C3338',
  line2: '#54484E',
  plum: '#E8AFC9',
  plumSoft: '#43293A',
  on: '#22181D',
  seg: '#3A3136',
  good: '#74D39C',
  gold: '#E3B45A',
  goldSoft: '#47381C',
  bad: '#F2A29B',
  badSoft: '#4A2A28',
};

export type Palette = typeof LIGHT;
export const useMainPalette = (): Palette => (useTheme().scheme === 'dark' ? DARK : LIGHT);

/** The page background: a soft gradient on the web, the middle colour on the phone. */
export function pageBackground(p: Palette): ViewStyle {
  return Platform.OS === 'web'
    ? ({ backgroundImage: `linear-gradient(172deg, ${p.bg1}, ${p.bg2} 72%)` } as ViewStyle)
    : { backgroundColor: p.bg2 };
}

/** Round button with an icon and a border (wireframe `.round`): the mic and send buttons. */
export function RoundButton({
  icon,
  label,
  onPress,
  filled,
  disabled,
  size,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  /** Plum and ready, like Send once there is text. */
  filled?: boolean;
  disabled?: boolean;
  size?: number;
}) {
  const theme = useTheme();
  const p = useMainPalette();
  const d = size ?? theme.minTarget;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: d,
        height: d,
        borderRadius: d / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: filled ? p.plum : p.line2,
        backgroundColor: filled ? p.plum : disabled ? p.seg : p.card,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon name={icon} size={22} color={filled ? p.on : disabled ? p.muted : p.plum} />
    </Pressable>
  );
}

/** Bare round icon button (wireframe `.a-ib`): menu, search, bell, sidebar, widen, open full. `dot` marks something new. */
export function IconButton({
  icon,
  label,
  onPress,
  dot,
  size = 38,
  iconSize = 22,
  active,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  dot?: boolean;
  size?: number;
  iconSize?: number;
  active?: boolean;
}) {
  const theme = useTheme();
  const p = useMainPalette();
  const d = Math.max(size, theme.minTarget);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: d,
        height: d,
        borderRadius: d / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed || active ? p.seg : 'transparent',
      })}
    >
      <Icon name={icon} size={iconSize} color={p.ink} />
      {dot ? (
        <View
          style={{
            position: 'absolute',
            top: d / 2 - 15,
            right: d / 2 - 14,
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: p.plum,
            borderWidth: 1.5,
            borderColor: p.card,
          }}
        />
      ) : null}
    </Pressable>
  );
}

/** The plum "New chat" pill with a plus (wireframe `.a-new`). */
export function NewChatButton({ label, onPress }: { label: string; onPress: () => void }) {
  const p = useMainPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        backgroundColor: p.plum,
        borderRadius: 999,
        paddingHorizontal: 15,
        marginRight: 6,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Icon name="plus" size={16} color={p.on} />
      <Text variant="label" style={{ color: p.on }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Round avatar with an initial (wireframe `.a-av`). */
export function Avatar({
  initial,
  label,
  onPress,
  size = 34,
}: {
  initial: string;
  label: string;
  onPress?: () => void;
  size?: number;
}) {
  const p = useMainPalette();
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: p.card,
    borderWidth: 1,
    borderColor: p.line,
  };
  const letter = (
    <Text variant="label" style={{ color: p.plum, fontWeight: '600' }}>
      {initial}
    </Text>
  );
  // Without onPress it is only a picture, so it can sit inside another button (a button cannot hold a button on the web).
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {letter}
    </Pressable>
  ) : (
    <View accessible={false} style={style}>
      {letter}
    </View>
  );
}

/** Pill with a green dot (wireframe `.a-pill`, `.c-status`): "Connected · 78%". */
export function DotPill({
  label,
  short,
  good = true,
  bordered = true,
}: {
  label: string;
  /** A shorter text for narrow screens. Screen readers still hear `label`. */
  short?: string;
  good?: boolean;
  bordered?: boolean;
}) {
  const p = useMainPalette();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        marginHorizontal: bordered ? 4 : 0,
        paddingHorizontal: bordered ? 12 : 0,
        paddingVertical: bordered ? 5 : 0,
        borderRadius: 999,
        borderWidth: bordered ? 1 : 0,
        borderColor: p.line2,
        backgroundColor: bordered ? p.card : 'transparent',
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: good ? p.good : p.muted }} />
      <Text
        variant="bodySm"
        style={{ color: bordered ? p.ink : p.muted, fontWeight: bordered ? '500' : '400' }}
      >
        {short ?? label}
      </Text>
    </View>
  );
}

/** Small status label (wireframe `.chipx`). */
export function Pill({
  label,
  tone = 'plain',
}: {
  label: string;
  tone?: 'plain' | 'plum' | 'good' | 'warn' | 'bad';
}) {
  const p = useMainPalette();
  const color = { good: p.good, plum: p.plum, warn: p.gold, bad: p.bad, plain: p.muted }[tone];
  const bg = { warn: p.goldSoft, bad: p.badSoft, plain: p.seg, good: p.plumSoft, plum: p.plumSoft }[tone];
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        backgroundColor: bg,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Text variant="caption" style={{ color, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

/** A row on a warm card (wireframe `.arow`): title, optional detail, optional right-hand part. */
export function InfoRow({
  title,
  detail,
  right,
  onPress,
}: {
  title: string;
  detail?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const p = useMainPalette();
  const body = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: p.ink }}>{title}</Text>
        {detail ? (
          <Text variant="bodySm" style={{ color: p.muted }}>
            {detail}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && !right ? <Text style={{ color: p.muted }}>›</Text> : null}
    </>
  );
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.space[3],
    minHeight: theme.minTarget,
    backgroundColor: p.card,
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
  };
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={style}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

/** Ask / Do switch (wireframe `.seg`). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
  label: string;
}) {
  const p = useMainPalette();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        backgroundColor: p.seg,
        borderRadius: 15,
        padding: 4,
        alignSelf: 'flex-start',
      }}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.id)}
            style={{
              minHeight: 40,
              minWidth: 64,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              paddingHorizontal: 16,
              backgroundColor: on ? p.card : 'transparent',
            }}
          >
            <Text variant="bodyLg" style={{ color: on ? p.ink : p.muted, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
