import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { create } from 'zustand';
import { useMainPalette, type Palette } from '@/features/main/palette';
import { Text, useTheme } from '@/ui';

export type GameId = 'lotus' | 'match' | 'petals';
export const GAME_IDS: GameId[] = ['lotus', 'match', 'petals'];

/** The games use the main app's own palette, so light and dark match every other screen. */
export type GamePalette = ReturnType<typeof build>;
function build(p: Palette, dark: boolean) {
  return {
    night: p.tile,
    night2: p.card,
    card: p.card,
    line: p.line2,
    ink: p.ink,
    muted: p.muted,
    gold: p.gold,
    pink: dark ? '#F063AE' : '#C0367F',
    good: p.good,
    bad: dark ? '#FF8A8A' : '#B3261E',
    btn: p.plum,
    onBtn: p.on,
    doneBg: dark ? '#1F4A38' : '#DDF3E6',
    ring: p.ink,
    lotusTop: dark ? '#FFE9A8' : '#FFD98A',
    // Only the Lotus Pulse play area has its own sky (night in dark, blush in light).
    sky0: dark ? '#12020D' : '#FBE3EE',
    sky1: dark ? '#4A0E35' : '#F6D3E3',
    sky2: dark ? '#1E0416' : '#F7EDF2',
    star: dark ? '#FFF1C4' : '#C98AAE',
    floor: dark ? '#12020D' : '#E9C9D9',
    hill0: dark ? '#2C0B25' : '#EFC6DA',
    hill1: dark ? '#3D1030' : '#E4B0CB',
    hill2: dark ? '#521540' : '#D798B7',
    water0: dark ? '#2A0A24' : '#E9C4D8',
    water1: dark ? '#0E0109' : '#F4DCE8',
    moonA: dark ? '#FFF3C8' : '#FFE2A6',
    moonB: dark ? '#FFD98A' : '#FFB86B',
    scrim: dark ? 'rgba(18,2,13,0.72)' : 'rgba(247,237,242,0.84)',
  };
}
export const useG = (): GamePalette => {
  const p = useMainPalette();
  return build(p, useTheme().scheme === 'dark');
};

/** Best scores for this visit. They are not saved: the games are for a few relaxed minutes. */
export const useBest = create<{ best: Record<GameId, number>; record: (g: GameId, n: number) => void }>(
  (set) => ({
    best: { lotus: 0, match: 0, petals: 0 },
    record: (g, n) => set((s) => (n > s.best[g] ? { best: { ...s.best, [g]: n } } : s)),
  }),
);

/** Sound on or off for all the games, for this visit. */
export const useSound = create<{ muted: boolean; toggle: () => void }>((set) => ({
  muted: false,
  toggle: () => set((s) => ({ muted: !s.muted })),
}));

/**
 * Width for a game board and the size of each square in a grid of `cols`. Sizes are whole pixels (not percentages), so
 * the cards line up the same on every phone and in the browser. `max` keeps boards from growing too wide.
 */
export function useBoard(max: number, cols: number, gap: number) {
  const win = useWindowDimensions();
  const [avail, setAvail] = useState<number | undefined>();
  const width = Math.floor(Math.min(max, avail ?? win.width - 28));
  const cell = Math.floor((width - gap * (cols - 1)) / cols);
  return {
    width,
    cell,
    onLayout: (e: { nativeEvent: { layout: { width: number } } }) => setAvail(e.nativeEvent.layout.width),
  };
}

/** Which game is open (if any), so the Apps screen can give it the whole width on wide web. */
export const useOpenGame = create<{ open: GameId | undefined; setOpen: (g: GameId | undefined) => void }>(
  (set) => ({ open: undefined, setOpen: (open) => set({ open }) }),
);

/** Gold pill button, the same size on every game. */
export function GameButton({
  label,
  onPress,
  quiet,
}: {
  label: string;
  onPress: () => void;
  quiet?: boolean;
}) {
  const G = useG();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 54,
        paddingHorizontal: 30,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: quiet ? 'transparent' : G.btn,
        borderWidth: quiet ? 1.5 : 0,
        borderColor: G.btn,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: quiet ? G.btn : G.onBtn, fontWeight: '700', fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}

/** A small number with a label above it (score, pairs, tries). */
export function Stat({ label, value }: { label: string; value: string | number }) {
  const G = useG();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: G.muted, fontSize: 13, letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ color: G.gold, fontSize: 26, fontWeight: '700' }} accessibilityLiveRegion="polite">
        {value}
      </Text>
    </View>
  );
}

/** A numbered "how to play" step. */
export function Step({ n, children }: { n: number; children: ReactNode }) {
  const G = useG();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: G.btn,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: G.onBtn, fontWeight: '700' }}>{n}</Text>
      </View>
      <Text style={{ color: G.ink, fontSize: 16, flex: 1 }}>{children}</Text>
    </View>
  );
}
