import { Platform } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Shape = ['p', string] | ['c', number, number, number] | ['r', number, number, number, number, number];

/** Line icons, drawn on a 24 x 24 grid. Same shapes as the wireframes (D · Main app). */
const SHAPES = {
  pendant: [
    ['p', 'M12 3v7'],
    ['c', 12, 15, 4.2],
  ],
  settings: [
    ['c', 12, 12, 3.2],
    [
      'p',
      'M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6',
    ],
  ],
  user: [
    ['c', 12, 8, 3.6],
    ['p', 'M5 20c1.2-3.7 4-5.6 7-5.6s5.8 1.9 7 5.6'],
  ],
  music: [
    ['p', 'M9 17.5V6l10-2v11.5'],
    ['c', 6.5, 17.5, 2.5],
    ['c', 16.5, 15.5, 2.5],
  ],
  remind: [
    ['c', 12, 13, 7],
    ['p', 'M12 9.5V13l2.6 1.8M4.5 5.5 7.5 3M19.5 5.5 16.5 3'],
  ],
  resp: [
    ['p', 'M4 4.5h10.5a2 2 0 0 1 2 2V12a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z'],
    ['p', 'M19.5 8.5h.5a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v2.5L16 17.5h-3.5'],
  ],
  contacts: [
    ['c', 9, 8, 3.2],
    ['p', 'M3 19.5c.8-3.2 3.2-4.8 6-4.8s5.2 1.6 6 4.8'],
    ['c', 17.2, 9, 2.5],
    ['p', 'M16.8 14.7c2.3.2 3.9 1.7 4.4 4.6'],
  ],
  search: [
    ['c', 11, 11, 6.5],
    ['p', 'm20 20-4.3-4.3'],
  ],
  bell: [
    ['p', 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z'],
    ['p', 'M10 20.5a2 2 0 0 0 4 0'],
  ],
  mic: [
    ['r', 9, 3, 6, 11.5, 3],
    ['p', 'M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21'],
  ],
  micoff: [
    ['r', 9, 3, 6, 11.5, 3],
    ['p', 'M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M3 3l18 18'],
  ],
  call: [
    [
      'p',
      'M21 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.1 4.2 2 2 0 0 1 3.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
    ],
  ],
  close: [['p', 'M6 6l12 12M18 6 6 18']],
  news: [
    ['r', 4, 4, 16, 16, 2],
    ['p', 'M8 9h8M8 13h8M8 17h5'],
  ],
  check: [['p', 'M5 12.5l4.5 4.5L19 7.5']],
  send: [['p', 'M12 19V5.5M6 11l6-6 6 6']],
  sidebar: [
    ['r', 3, 4, 18, 16, 3],
    ['p', 'M9 4v16'],
  ],
  menu: [['p', 'M4 7h16M4 12h16M4 17h10']],
  compose: [
    ['p', 'M12 20h8'],
    ['p', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z'],
  ],
  plus: [['p', 'M12 5v14M5 12h14']],
  widen: [['p', 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4']],
  narrow: [['p', 'M2 12h7M15 12h7M6 8l4 4-4 4M18 8l-4 4 4 4']],
  full: [['p', 'M14 4h6v6M20 4l-8 8M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4']],
  back: [['p', 'm15 5-7 7 7 7']],
  chat: [['p', 'M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z']],
  apps: [
    ['r', 4, 4, 7, 7, 2],
    ['r', 13, 4, 7, 7, 2],
    ['r', 4, 13, 7, 7, 2],
    ['r', 13, 13, 7, 7, 2],
  ],
  chev: [['p', 'm9 5 7 7-7 7']],
  game: [
    ['r', 2.5, 7, 19, 11, 5],
    ['p', 'M7.5 10v4M5.5 12h4M16 11h.01M18.5 13.5h.01'],
  ],
  sound: [
    ['p', 'M4 9.5h3.5L12 6v12l-4.5-3.5H4z'],
    ['p', 'M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11'],
  ],
  soundoff: [
    ['p', 'M4 9.5h3.5L12 6v12l-4.5-3.5H4z'],
    ['p', 'M16 9.5l5 5M21 9.5l-5 5'],
  ],
  play: [['p', 'M8 5.5v13l10-6.5z']],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof SHAPES;

/** Icons only decorate: hide them from screen readers (the web and the phone use different props for this). */
const hidden =
  Platform.OS === 'web'
    ? ({ 'aria-hidden': true } as object)
    : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as object);

/** A line icon in the current text colour. `color` is required: pass the colour the icon should have. */
export function Icon({ name, color, size = 22 }: { name: IconName; color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...hidden}
    >
      {(SHAPES[name] as Shape[]).map((s, i) =>
        s[0] === 'p' ? (
          <Path key={i} d={s[1]} />
        ) : s[0] === 'c' ? (
          <Circle key={i} cx={s[1]} cy={s[2]} r={s[3]} />
        ) : (
          <Rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} />
        ),
      )}
    </Svg>
  );
}
