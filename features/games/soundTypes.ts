/** What the games can play. The web version makes the sounds itself; the phone version is silent until audio is set up. */
export interface GameSound {
  /** Call from a tap: browsers only allow sound after the person has touched the page. */
  unlock: () => void;
  jump: () => void;
  collect: () => void;
  over: () => void;
  startMusic: () => void;
  stopMusic: () => void;
  /** The music speeds up a little with the game (the run speed). */
  setSpeed: (speed: number) => void;
  setMuted: (muted: boolean) => void;
}
