import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G as Group, LinearGradient, Path, Stop } from 'react-native-svg';
import { create } from 'zustand';

export type HeroId = 'ravi' | 'meera' | 'heart' | 'diya' | 'lotus';
export const HERO_IDS: HeroId[] = ['ravi', 'meera', 'heart', 'diya', 'lotus'];

/** Each runner has its own colours; the heartbeat line, thorns, glow and sparks all take them on. */
export const HEROES: Record<
  HeroId,
  { accent: string; light: string; dark: string; top: string; bottom: string }
> = {
  ravi: { accent: '#2FB36D', light: '#BFF0D4', dark: '#12532F', top: '#7BE0A6', bottom: '#1E8F52' },
  meera: { accent: '#B05CFF', light: '#E6CCFF', dark: '#4A1B7A', top: '#D6A8FF', bottom: '#8A3FE0' },
  heart: { accent: '#FF4D6D', light: '#FFC2CE', dark: '#8A1030', top: '#FF9AAE', bottom: '#D90F3B' },
  diya: { accent: '#FF8A2B', light: '#FFE29A', dark: '#8A3A0A', top: '#FFF3B0', bottom: '#FF7A1A' },
  lotus: { accent: '#E0529C', light: '#FFD2EA', dark: '#7A1048', top: '#FFF0C4', bottom: '#F777B6' },
};

export const useHero = create<{ id: HeroId; setId: (id: HeroId) => void }>((set) => ({
  id: 'ravi',
  setId: (id) => set({ id }),
}));

/** The two gradients a runner is painted with. Put these inside the scene's `<Defs>`. */
export function HeroDefs({ id }: { id: HeroId }) {
  const h = HEROES[id];
  return (
    <>
      <LinearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={h.top} />
        <Stop offset="1" stopColor={h.bottom} />
      </LinearGradient>
      <LinearGradient id={`${id}-fill2`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={h.light} />
        <Stop offset="1" stopColor={h.accent} />
      </LinearGradient>
    </>
  );
}

/**
 * The runner drawn on a 40 x 40 grid, standing on y = 24. `flap` is the clock (wings flap, flames flicker, the heart
 * beats); `beat` is 0 to 1 on each heartbeat.
 */
const SKIN = '#FFD3A8';
const OUT = '#3A2A24';

/** A cartoon runner: round head, cap or ponytail, swinging arms and legs. Feet stand on y = 24, facing right. */
function Person({
  id,
  flap,
  moving,
  air,
}: {
  id: 'ravi' | 'meera';
  flap: number;
  moving: boolean;
  air: boolean;
}) {
  const girl = id === 'meera';
  const swing = moving ? Math.sin(flap * 16) : 0;
  const bounce = moving ? Math.abs(Math.sin(flap * 16)) * 0.9 : 0;
  const legA = air ? 38 : swing * 46;
  const legB = air ? -28 : -swing * 46;
  const armA = air ? -150 : -swing * 50;
  const armB = air ? -35 : swing * 50;
  const shirt = girl ? '#B05CFF' : '#FFC83D';
  const pants = girl ? SKIN : '#2B3A8C';
  const shoes = girl ? '#FFC83D' : '#8A4B1F';
  const cap = '#2FB36D';
  const hair = '#3A1E12';
  const sway = moving ? swing * 3 : air ? -3 : 0;
  const leg = (angle: number, x: number) => (
    <Group transform={`rotate(${angle} ${x} 17)`}>
      <Path d={`M${x} 17L${x} 22.4`} stroke={OUT} strokeWidth={4} strokeLinecap="round" />
      <Path d={`M${x} 17L${x} 22.4`} stroke={pants} strokeWidth={2.8} strokeLinecap="round" />
      <Ellipse cx={x + 1.2} cy={23} rx={2.6} ry={1.4} fill={shoes} stroke={OUT} strokeWidth={0.8} />
    </Group>
  );
  const arm = (angle: number, x: number) => (
    <Group transform={`rotate(${angle} ${x} 12.8)`}>
      <Path d={`M${x} 12.8L${x} 17.6`} stroke={OUT} strokeWidth={3.6} strokeLinecap="round" />
      <Path d={`M${x} 12.8L${x} 17.6`} stroke={girl ? SKIN : shirt} strokeWidth={2.4} strokeLinecap="round" />
      <Circle cx={x} cy={18} r={1.5} fill={SKIN} stroke={OUT} strokeWidth={0.7} />
    </Group>
  );
  return (
    <Group transform={`translate(0 ${-bounce})`}>
      {leg(legB, 18.6)}
      {arm(armB, 21.6)}
      {girl ? (
        <Path
          d="M15.4 11.6C15.4 10.6 24.6 10.6 24.6 11.6L26.4 18.2C26.4 19.2 13.6 19.2 13.6 18.2Z"
          fill={shirt}
          stroke={OUT}
          strokeWidth={0.9}
          strokeLinejoin="round"
        />
      ) : (
        <>
          <Path
            d="M15.4 11.4C15.4 10.6 24.6 10.6 24.6 11.4L24.6 17.6C24.6 18.4 15.4 18.4 15.4 17.6Z"
            fill={shirt}
            stroke={OUT}
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
          <Path d="M15.5 15.6L24.5 15.6" stroke={pants} strokeWidth={3} />
        </>
      )}
      {leg(legA, 21.4)}
      {arm(armA, 18.4)}
      {/* hair at the back, then the head, then the front */}
      {girl ? (
        <Path
          d={`M15 4.6C9.5 3.5 ${8 + sway} 10 ${11 + sway} 13.5`}
          stroke={hair}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
      <Circle cx={20} cy={6.6} r={5.6} fill={SKIN} stroke={OUT} strokeWidth={0.9} />
      {girl ? (
        <Path
          d="M14.2 6.4C14 0.6 26 0.6 25.8 6.4C23.2 3.6 17.4 3.8 14.2 6.4Z"
          fill={hair}
          stroke={OUT}
          strokeWidth={0.7}
        />
      ) : (
        <>
          <Path
            d="M14.3 6C14 0 26 0 25.7 6Z"
            fill={cap}
            stroke={OUT}
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
          <Path
            d="M20 5.6L28.4 6.2C29 7.4 28.4 8 27.4 8L20 7.6Z"
            fill={cap}
            stroke={OUT}
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
          <Circle cx={20} cy={2.9} r={1.1} fill="#FFFFFF" />
        </>
      )}
      <Circle cx={22.6} cy={7.4} r={0.95} fill={OUT} />
      <Circle cx={23} cy={7.1} r={0.3} fill="#FFFFFF" />
      <Path
        d="M21.8 10C22.8 10.9 24.2 10.7 24.7 9.8"
        stroke={OUT}
        strokeWidth={0.8}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={18.1} cy={9.2} r={1} fill="#FF9AA8" opacity={0.7} />
    </Group>
  );
}

export function HeroShape({
  id,
  flap,
  beat,
  gold,
  moving = false,
  air = false,
}: {
  id: HeroId;
  flap: number;
  beat: number;
  gold: string;
  /** Running on the line (arms and legs swing). */
  moving?: boolean;
  /** In the air (legs spread, arms up). */
  air?: boolean;
}) {
  const h = HEROES[id];
  const f1 = `url(#${id}-fill)`;
  const f2 = `url(#${id}-fill2)`;
  if (id === 'ravi' || id === 'meera') {
    return <Person id={id} flap={flap} moving={moving} air={air} />;
  }
  if (id === 'heart') {
    const s = 1 + beat * 0.12;
    return (
      <Group transform={`translate(20 14) scale(${s}) translate(-20 -14)`}>
        <Path
          d="M20 25C5 16 7 4 14 4C17 4 19.4 6 20 8.5C20.6 6 23 4 26 4C33 4 35 16 20 25Z"
          fill={f1}
          stroke={h.dark}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        <Path
          d="M11 9C11 7 13 6 14.5 6.5"
          stroke="#FFFFFF"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          opacity={0.8}
        />
        <Circle cx={16} cy={13} r={1.2} fill={h.dark} />
        <Circle cx={24} cy={13} r={1.2} fill={h.dark} />
        <Path
          d="M17 17C19 19 21 19 23 17"
          stroke={h.dark}
          strokeWidth={1}
          fill="none"
          strokeLinecap="round"
        />
      </Group>
    );
  }
  if (id === 'diya') {
    const flick = 1 + Math.sin(flap * 17) * 0.07;
    return (
      <>
        <Group transform={`translate(20 22) scale(${1 / flick} ${flick}) translate(-20 -22)`}>
          <Path d="M20 2C27 10 26 17 20 21C14 17 13 10 20 2Z" fill={f1} stroke={h.dark} strokeWidth={0.8} />
          <Path d="M20 10C23 14 22 17 20 19C18 17 17 14 20 10Z" fill="#FFFFFF" opacity={0.8} />
        </Group>
        <Path
          d="M5 22C5 29 35 29 35 22Z"
          fill="#C8602A"
          stroke={h.dark}
          strokeWidth={1}
          strokeLinejoin="round"
        />
        <Path d="M5 22C12 24 28 24 35 22" stroke={gold} strokeWidth={1.2} fill="none" />
      </>
    );
  }
  return (
    <>
      <Path d="M20 24C12 25 6 22 3 17C10 16 16 19 20 24Z" fill={f2} stroke={gold} strokeWidth={0.9} />
      <Path d="M20 24C28 25 34 22 37 17C30 16 24 19 20 24Z" fill={f2} stroke={gold} strokeWidth={0.9} />
      <Path d="M20 24c-1-7-6-11-12-12c0 7 5 12 12 12z" fill={f1} stroke={gold} strokeWidth={1} />
      <Path d="M20 24c1-7 6-11 12-12c0 7-5 12-12 12z" fill={f1} stroke={gold} strokeWidth={1} />
      <Path d="M20 6c4 5 4 12 0 18c-4-6-4-13 0-18z" fill={h.top} stroke={gold} strokeWidth={1} />
      <Circle cx={20} cy={17} r={2.4} fill="#FFFFFF" opacity={0.85} />
    </>
  );
}

/** A small round button showing a runner, for choosing it. */
export function HeroChip({
  id,
  label,
  selected,
  onPress,
  ring,
  size = 62,
}: {
  id: HeroId;
  label: string;
  selected: boolean;
  onPress: () => void;
  ring: string;
  size?: number;
}) {
  const h = HEROES[id];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: selected ? 3 : 1,
        borderColor: selected ? ring : h.accent,
        backgroundColor: `${h.accent}22`,
        opacity: selected ? 1 : 0.8,
      }}
    >
      <View>
        <Svg width={Math.round(size * 0.68)} height={Math.round(size * 0.68)} viewBox="-2 -2 44 40">
          <Defs>
            <HeroDefs id={id} />
          </Defs>
          <Group transform="translate(0 4)">
            <HeroShape id={id} flap={0} beat={0} gold={h.dark} />
          </Group>
        </Svg>
      </View>
    </Pressable>
  );
}
