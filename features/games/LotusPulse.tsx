/* eslint-disable react-hooks/refs -- the game loop keeps per-frame state in refs and re-renders with a tick counter on purpose */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G as Group,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { newRun, ORB_POINTS, RUN, stepRun, type RunState } from '@/features/games/logic';
import { GameButton, useBest, useG, useSound } from '@/features/games/kit';
import { sound } from '@/features/games/sound';
import { HERO_IDS, HEROES, HeroChip, HeroDefs, HeroShape, useHero } from '@/features/games/hero';
import { useWide } from '@/features/main/useWide';
import { Icon, Text } from '@/ui';

/** Fixed star positions (x as a percentage, y as a fraction of the height), so the sky is the same every frame. */
const STARS = Array.from({ length: 28 }, (_, i) => ({
  x: (i * 37.7) % 100,
  y: ((i * 61.3) % 58) / 100,
  r: 0.22 + ((i * 7) % 5) * 0.1,
}));
const FIREFLIES = Array.from({ length: 12 }, (_, i) => ({
  x: (i * 53.1) % 100,
  y: ((i * 29.7) % 100) / 100,
}));
const TAU = Math.PI * 2;

/** A little burst or trail piece: sparks, falling petals, and "+10" pop-ups. All in game units, y up from the line. */
type Fx = {
  kind: 'spark' | 'petal' | 'pop';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  text?: string;
};

/** Rolling hills as a closed path from the left edge to the right edge, ending on the line. */
function hills(vw: number, ground: number, offset: number, rise: number, amp: number, f: number) {
  const steps = 34;
  let d = `M0 ${ground}`;
  for (let i = 0; i <= steps; i++) {
    const x = (vw / steps) * i;
    const w = 0.62 * Math.sin((x + offset) * f) + 0.38 * Math.sin((x + offset) * f * 2.3 + 1.3);
    d += ` L${x.toFixed(1)} ${(ground - rise - amp * (w + 1)).toFixed(2)}`;
  }
  return `${d} L${vw} ${ground} Z`;
}

/** Lotus Pulse: a lotus runs along a heartbeat at night. Tap to leap the thorns and catch the golden lights. */
export function LotusPulse() {
  const G = useG();
  const { t } = useTranslation();
  const [, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [wasBest, setWasBest] = useState(false);
  const [measured, setMeasured] = useState<number | undefined>();
  const best = useBest((s) => s.best.lotus);
  const wide = useWide();
  const muted = useSound((s) => s.muted);
  const toggleSound = useSound((s) => s.toggle);
  const heroId = useHero((s) => s.id);
  const setHero = useHero((s) => s.setId);
  const hero = HEROES[heroId];
  const win = useWindowDimensions();

  // Everything that changes every frame lives in refs; one counter re-draws the scene.
  const run = useRef<RunState>(newRun());
  const fx = useRef<Fx[]>([]);
  const dist = useRef(0);
  const clock = useRef(0);
  const shake = useRef(0);
  const overAt = useRef(-10);
  const jump = useRef(false);
  const live = useRef(false);
  const trail = useRef(0);
  const world = useRef(RUN.width);

  // The height is known; the width starts as the window's and is corrected once the stage is measured.
  const stageH = Math.round(
    wide ? Math.max(460, win.height - 200) : Math.min(640, Math.max(420, win.height * 0.62)),
  );
  const w = measured ?? Math.max(280, win.width - 32);
  const u = Math.min(w / 70, stageH / 55);
  const vw = w / u;
  const vh = stageH / u;
  const ground = vh * 0.72;
  world.current = vw;

  const start = () => {
    run.current = newRun();
    fx.current = [];
    shake.current = 0;
    setWasBest(false);
    live.current = true;
    sound.unlock();
    sound.startMusic();
    setPlaying(true);
  };
  const leap = useCallback(() => {
    jump.current = true;
  }, []);

  useEffect(() => sound.setMuted(muted), [muted]);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    const scatter = (kind: Fx['kind'], x: number, y: number, n: number, speed: number) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.random();
        fx.current.push({
          kind,
          x,
          y,
          vx: Math.cos(a) * speed * (0.5 + Math.random()),
          vy: Math.sin(a) * speed * (0.5 + Math.random()),
          life: 0.7,
          max: 0.7,
        });
      }
    };
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock.current += dt;
      const cx = RUN.playerX + RUN.playerSize / 2;
      if (live.current) {
        const prev = run.current;
        if (jump.current && prev.y === 0) sound.jump();
        const next = stepRun(prev, dt, jump.current, Math.random, world.current);
        sound.setSpeed(next.speed);
        jump.current = false;
        run.current = next;
        dist.current += next.speed * dt;
        if (next.lights > prev.lights) {
          sound.collect();
          scatter('spark', cx, next.y + RUN.playerSize / 2, 10, 26);
          fx.current.push({
            kind: 'pop',
            x: cx,
            y: next.y + RUN.playerSize + 3,
            vx: 0,
            vy: 14,
            life: 0.9,
            max: 0.9,
            text: `+${ORB_POINTS}`,
          });
        }
        trail.current -= dt;
        if (trail.current <= 0 && !next.over) {
          trail.current = 0.045;
          fx.current.push({
            kind: 'spark',
            x: RUN.playerX + 1,
            y: next.y + 2 + Math.random() * 3,
            vx: -next.speed * 0.5,
            vy: (Math.random() - 0.5) * 6,
            life: 0.5,
            max: 0.5,
          });
        }
        if (next.over) {
          live.current = false;
          sound.over();
          sound.stopMusic();
          overAt.current = clock.current;
          shake.current = 0.5;
          scatter('petal', cx, next.y + RUN.playerSize / 2, 14, 30);
          const score = Math.floor(next.score);
          setWasBest(score > useBest.getState().best.lotus);
          useBest.getState().record('lotus', score);
          setPlaying(false);
        }
      } else {
        dist.current += 12 * dt; // the world drifts gently while waiting
      }
      fx.current = fx.current
        .map((f) => ({
          ...f,
          x: f.x + f.vx * dt,
          y: f.y + f.vy * dt,
          vy: f.kind === 'petal' ? f.vy - 60 * dt : f.vy,
          life: f.life - dt,
        }))
        .filter((f) => f.life > 0 && f.y > -12);
      shake.current = Math.max(0, shake.current - dt);
      setTick((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const key = (e: { code?: string; key?: string; preventDefault?: () => void }) => {
      if (e.code === 'Space' || e.key === 'ArrowUp') {
        e.preventDefault?.();
        leap();
      }
    };
    const win_ = globalThis as unknown as {
      addEventListener?: (n: string, f: typeof key) => void;
      removeEventListener?: (n: string, f: typeof key) => void;
    };
    win_.addEventListener?.('keydown', key);
    return () => {
      cancelAnimationFrame(raf);
      sound.stopMusic();
      win_.removeEventListener?.('keydown', key);
    };
  }, [leap]);

  const r = run.current;
  const c = clock.current;
  const d = dist.current;
  const over = r.over;
  const score = Math.floor(r.score);
  const bpm = Math.round(66 + (r.speed - RUN.startSpeed) * 2.4);
  const beat = Math.max(0, Math.sin(c * (bpm / 60) * TAU)) ** 6;
  const phase = (c * (bpm / 60)) % 1;
  // The start and end card must fit a small phone: smaller picture buttons and text, and it scrolls if still too tall.
  const compact = stageH < 520 || w < 400;
  const chip = Math.max(40, Math.min(58, Math.floor((Math.min(420, w - 24) - 36 - 4 * 8) / 5)));
  const showCard = !playing && (!over || c - overAt.current > 0.7);

  // The lotus: bobs when waiting, tilts a little in the air.
  const k = (RUN.playerSize / 24) * (heroId === 'ravi' || heroId === 'meera' ? 1.5 : 1.15);
  const px = RUN.playerX + RUN.playerSize / 2;
  const bob = playing || over ? 0 : Math.sin(c * 3) * 0.6;
  const lift = r.y + bob;
  const py = ground - lift;
  const tilt = Math.max(-14, Math.min(14, r.vy * 0.12));
  const sx = shake.current > 0 ? Math.sin(c * 90) * shake.current * 4 : 0;
  const sy = shake.current > 0 ? Math.cos(c * 70) * shake.current * 3 : 0;

  const peaks = [...r.spikes].sort((a, b) => a.x - b.x);
  const line =
    `M-2 ${ground}` +
    peaks
      .map(
        (s) =>
          ` L${s.x} ${ground} L${s.x + RUN.spikeWidth * 0.36} ${ground - RUN.spikeHeight} L${s.x + RUN.spikeWidth * 0.62} ${ground + 3} L${s.x + RUN.spikeWidth} ${ground}`,
      )
      .join('') +
    ` L${vw + 2} ${ground}`;

  const lotus = (
    <HeroShape
      id={heroId}
      flap={c}
      beat={beat}
      gold={heroId === 'lotus' ? G.gold : hero.dark}
      moving={playing && r.y === 0}
      air={r.y > 0.4}
    />
  );

  return (
    <View
      style={{ height: stageH, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: G.line }}
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('games.lotus.jump')}
        onPressIn={leap}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMinYMin slice">
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={G.sky0} />
              <Stop offset="0.75" stopColor={G.sky1} />
              <Stop offset="1" stopColor={G.sky2} />
            </LinearGradient>
            <LinearGradient id="water" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={G.water0} />
              <Stop offset="1" stopColor={G.water1} />
            </LinearGradient>
            <RadialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={hero.light} stopOpacity="0.85" />
              <Stop offset="1" stopColor={hero.light} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor={G.moonB} stopOpacity="0.55" />
              <Stop offset="1" stopColor={G.moonB} stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="moon" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={G.moonA} />
              <Stop offset="1" stopColor={G.moonB} />
            </LinearGradient>
            <RadialGradient id="orb" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="0.35" stopColor="#FFE9A8" stopOpacity="0.95" />
              <Stop offset="1" stopColor="#FFC857" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="fly" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#FFF6C8" stopOpacity="1" />
              <Stop offset="1" stopColor="#FFD98A" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="thorn" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={hero.light} />
              <Stop offset="0.4" stopColor={hero.accent} />
              <Stop offset="1" stopColor={hero.dark} />
            </LinearGradient>
            <HeroDefs id={heroId} />
            <RadialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
              <Stop offset="0.55" stopColor={G.sky0} stopOpacity="0" />
              <Stop offset="1" stopColor={hero.accent} stopOpacity="0.45" />
            </RadialGradient>
          </Defs>

          <Group transform={`translate(${sx} ${sy})`}>
            <Rect x={-6} y={-6} width={vw + 12} height={vh + 12} fill="url(#sky)" />

            {/* Moon, stars and drifting hills */}
            <Circle cx={vw * 0.78} cy={vh * 0.2} r={vh * 0.2} fill="url(#moonGlow)" />
            <Circle cx={vw * 0.78} cy={vh * 0.2} r={vh * 0.07} fill="url(#moon)" />
            {STARS.map((s, i) => (
              <Circle
                key={i}
                cx={((((s.x - d * (0.05 + s.r * 0.1)) % 100) + 100) % 100) * (vw / 100)}
                cy={s.y * vh}
                r={s.r}
                fill={G.star}
                opacity={0.4 + 0.5 * Math.abs(Math.sin(c * 1.4 + i))}
              />
            ))}
            <Path d={hills(vw, ground, d * 0.12, 10, 7, 0.045)} fill={G.hill0} />
            <Path d={hills(vw, ground, d * 0.3, 4, 4.5, 0.08)} fill={G.hill1} />
            <Path d={hills(vw, ground, d * 0.6 + 40, 0, 2.4, 0.13)} fill={G.hill2} />

            {/* The pond under the line: ripples and the lotus's reflection */}
            <Rect x={-6} y={ground} width={vw + 12} height={vh - ground + 6} fill="url(#water)" />
            {Array.from({ length: 7 }, (_, i) => {
              const yy = ground + ((vh - ground) / 8) * (i + 1);
              const xx = (((i * 41 - d * (0.7 + i * 0.12)) % vw) + vw) % vw;
              return (
                <Ellipse
                  key={i}
                  cx={xx}
                  cy={yy}
                  rx={5 + i * 1.6}
                  ry={0.5 + i * 0.12}
                  fill="none"
                  stroke={hero.accent}
                  strokeWidth={0.35}
                  opacity={0.35}
                />
              );
            })}
            <Group
              opacity={0.22}
              transform={`translate(${px - 20 * k} ${ground + lift + 24 * k}) scale(${k} ${-k})`}
            >
              {lotus}
            </Group>

            {/* Fireflies */}
            {FIREFLIES.map((f, i) => {
              const fx_ = (((f.x * 1.4 + Math.sin(c * 0.5 + i) * 5 - d * 0.35) % vw) + vw) % vw || 0;
              const fy_ = ground - 6 - f.y * (ground * 0.55) + Math.sin(c * 1.1 + i * 2) * 2;
              return (
                <Circle
                  key={i}
                  cx={fx_}
                  cy={fy_}
                  r={1.6}
                  fill="url(#fly)"
                  opacity={0.35 + 0.65 * Math.abs(Math.sin(c * 1.7 + i * 1.3))}
                />
              );
            })}

            {/* The heartbeat line, glowing, and the thorns on it */}
            <Path
              d={line}
              stroke={hero.accent}
              strokeWidth={4.2}
              fill="none"
              opacity={0.2}
              strokeLinejoin="round"
            />
            <Path
              d={line}
              stroke={hero.accent}
              strokeWidth={2}
              fill="none"
              opacity={0.5}
              strokeLinejoin="round"
            />
            <Path
              d={line}
              stroke={hero.light}
              strokeWidth={0.9}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {peaks.map((s, i) => (
              <Group key={i}>
                <Path
                  d={`M${s.x} ${ground} L${s.x + RUN.spikeWidth * 0.36} ${ground - RUN.spikeHeight} L${s.x + RUN.spikeWidth * 0.72} ${ground} Z`}
                  fill="url(#thorn)"
                  opacity={0.95}
                />
                <Circle
                  cx={s.x + RUN.spikeWidth * 0.36}
                  cy={ground - RUN.spikeHeight}
                  r={3.2}
                  fill="url(#halo)"
                  opacity={0.6 + 0.4 * beat}
                />
              </Group>
            ))}

            {/* Golden lights */}
            {r.orbs.map((o, i) => {
              const oy = ground - o.y + Math.sin(c * 3 + o.x * 0.2) * 0.9;
              return (
                <Group key={i}>
                  <Circle cx={o.x} cy={oy} r={6.5 + beat * 1.2} fill="url(#orb)" opacity={0.85} />
                  <Group transform={`rotate(${(c * 70) % 360} ${o.x} ${oy})`}>
                    <Line
                      x1={o.x - 4.4}
                      y1={oy}
                      x2={o.x + 4.4}
                      y2={oy}
                      stroke="#FFF1C4"
                      strokeWidth={0.5}
                      opacity={0.9}
                    />
                    <Line
                      x1={o.x}
                      y1={oy - 4.4}
                      x2={o.x}
                      y2={oy + 4.4}
                      stroke="#FFF1C4"
                      strokeWidth={0.5}
                      opacity={0.9}
                    />
                  </Group>
                  <Circle cx={o.x} cy={oy} r={1.9} fill="#FFFFFF" />
                </Group>
              );
            })}

            {/* Heartbeat ring on the line under the lotus */}
            <Ellipse
              cx={px}
              cy={ground}
              rx={3 + phase * 14}
              ry={(3 + phase * 14) * 0.22}
              fill="none"
              stroke={hero.light}
              strokeWidth={0.6}
              opacity={(1 - phase) * 0.7}
            />

            {/* The lotus */}
            <Circle cx={px} cy={py - RUN.playerSize * 0.45} r={9 + beat * 2.5} fill="url(#halo)" />
            {over ? null : (
              <Group
                transform={`translate(${px - 20 * k} ${py - 24 * k}) rotate(${tilt} ${20 * k} ${24 * k}) scale(${k})`}
              >
                {lotus}
              </Group>
            )}

            {/* Sparks, falling petals and +10 pop-ups */}
            {fx.current.map((f, i) => {
              const a = Math.max(0, f.life / f.max);
              if (f.kind === 'pop') {
                return (
                  <SvgText
                    key={i}
                    x={f.x}
                    y={ground - f.y}
                    fill="#FFE9A8"
                    fontSize={4.2}
                    fontWeight="bold"
                    textAnchor="middle"
                    opacity={a}
                  >
                    {f.text}
                  </SvgText>
                );
              }
              return f.kind === 'petal' ? (
                <Ellipse
                  key={i}
                  cx={f.x}
                  cy={ground - f.y}
                  rx={1.9}
                  ry={1}
                  fill={hero.accent}
                  opacity={a}
                  transform={`rotate(${f.x * 12} ${f.x} ${ground - f.y})`}
                />
              ) : (
                <Circle key={i} cx={f.x} cy={ground - f.y} r={0.5 + a * 1.1} fill="#FFE9A8" opacity={a} />
              );
            })}

            {/* The screen edge glows with each heartbeat */}
            <Rect x={0} y={0} width={vw} height={vh} fill="url(#vignette)" opacity={0.25 + beat * 0.5} />
          </Group>
        </Svg>
      </Pressable>

      {/* Score, heart rate and lights */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <View
          style={{
            backgroundColor: `${G.card}D9`,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: G.muted, fontSize: 12, letterSpacing: 0.6 }}>{t('games.scoreLabel')}</Text>
          <Text
            style={{ color: G.gold, fontSize: 34, fontWeight: '800', lineHeight: 40 }}
            accessibilityLiveRegion="polite"
          >
            {score}
          </Text>
        </View>
        <View style={{ gap: 6, alignItems: 'flex-end' }}>
          <View
            style={{
              backgroundColor: `${G.card}D9`,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: hero.accent, fontSize: 16, fontWeight: '700' }}>
              ♥ {t('games.lotus.bpm', { count: bpm })}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: `${G.card}D9`,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: G.muted, fontSize: 13 }}>
              ✦ {t('games.lotus.lights', { count: r.lights })} · {t('games.best', { count: best })}
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(muted ? 'games.sound.turnOn' : 'games.sound.turnOff')}
        onPress={toggleSound}
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${G.card}D9`,
          borderWidth: 1,
          borderColor: G.line,
        }}
      >
        <Icon name={muted ? 'soundoff' : 'sound'} size={22} color={G.gold} />
      </Pressable>

      {playing ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center' }}
        >
          <View
            style={{
              backgroundColor: `${G.card}D9`,
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: G.muted, fontSize: 14 }}>{t('games.lotus.tapHint')}</Text>
          </View>
        </View>
      ) : null}

      {showCard ? (
        <ScrollView
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: G.scrim }}
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 12 }}
        >
          <View
            style={{
              maxWidth: 420,
              width: '100%',
              borderRadius: 26,
              borderWidth: 1,
              borderColor: G.line,
              backgroundColor: G.card,
              padding: compact ? 16 : 24,
              gap: compact ? 8 : 12,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 2,
              }}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('games.lotus.choose')}
            >
              {HERO_IDS.map((id) => (
                <HeroChip
                  key={id}
                  id={id}
                  label={t(`games.lotus.hero.${id}`)}
                  selected={id === heroId}
                  onPress={() => setHero(id)}
                  ring={G.ink}
                  size={chip}
                />
              ))}
            </View>
            <Text
              style={{
                color: G.gold,
                fontSize: compact ? 28 : 34,
                lineHeight: compact ? 38 : 46,
                alignSelf: 'stretch',
                textAlign: 'center',
                fontWeight: '800',
                textShadowColor: hero.accent,
                textShadowRadius: 14,
              }}
              accessibilityRole="header"
            >
              {over ? t('games.lotus.overTitle') : t('games.lotus.name')}
            </Text>
            {over ? (
              <>
                <Text
                  style={{
                    color: G.ink,
                    fontSize: compact ? 40 : 48,
                    lineHeight: compact ? 52 : 60,
                    fontWeight: '800',
                  }}
                >
                  {score}
                </Text>
                <Text
                  style={{
                    color: wasBest ? G.gold : G.muted,
                    fontSize: 16,
                    lineHeight: 24,
                    textAlign: 'center',
                    fontWeight: wasBest ? '700' : '400',
                  }}
                >
                  {wasBest ? `★ ${t('games.newBest')}` : t('games.best', { count: best })}
                </Text>
                <Text style={{ color: G.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
                  {t('games.lotus.lights', { count: r.lights })}
                </Text>
              </>
            ) : (
              <Text
                style={{
                  color: G.ink,
                  fontSize: compact ? 15 : 17,
                  textAlign: 'center',
                  lineHeight: compact ? 22 : 26,
                  alignSelf: 'stretch',
                }}
              >
                {t('games.lotus.how')}
              </Text>
            )}
            <GameButton label={over ? t('games.again') : t('games.start')} onPress={start} />
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}
