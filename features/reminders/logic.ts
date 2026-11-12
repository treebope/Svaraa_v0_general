/** Reminder rules with no screen code, so they can be tested on their own. */

export type Repeat = 'once' | 'daily' | 'weekdays' | 'custom' | 'interval';
export type Outcome = { date: string; status: 'confirmed' | 'missed'; at: string; tries?: number };

export type Reminder = {
  id: string;
  text: string;
  hour: number;
  minute: number;
  repeat: Repeat;
  /** Days of the week for `custom`, 0 = Sunday. */
  days: number[];
  /** For `interval`: say it every `every` hours, from the start time until the hour `until`. */
  every?: number;
  until?: number;
  /** The day of a `once` reminder, as YYYY-MM-DD. */
  date?: string;
  speak: boolean;
  /** Ask again until the wearer says it is done: up to 3 times, 5 minutes apart. */
  persist: boolean;
  tellAdmins: boolean;
  paused: boolean;
  /** Who made it: `wearer` or a caregiver's name. */
  by: string;
  history: Outcome[];
};

export type Draft = Omit<Reminder, 'id' | 'paused' | 'history' | 'by'>;

export const WEEKDAYS = [1, 2, 3, 4, 5];

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Is the reminder due on this day? A paused one never is. */
export function occursOn(r: Reminder, day: Date): boolean {
  if (r.paused) return false;
  const dow = day.getDay();
  if (r.repeat === 'once') return r.date === dateKey(day);
  if (r.repeat === 'daily' || r.repeat === 'interval') return true;
  if (r.repeat === 'weekdays') return WEEKDAYS.includes(dow);
  return r.days.includes(dow);
}

export const outcomeOn = (r: Reminder, day: Date) => r.history.find((h) => h.date === dateKey(day));
export const doneOn = (r: Reminder, day: Date) => outcomeOn(r, day)?.status === 'confirmed';

export const minutesOfDay = (r: Pick<Reminder, 'hour' | 'minute'>) => r.hour * 60 + r.minute;

/** The times of day (in minutes) a reminder is said: one, or several for `interval`. */
export function slots(r: Reminder): number[] {
  const first = minutesOfDay(r);
  if (r.repeat !== 'interval' || !r.every) return [first];
  const out: number[] = [];
  for (let m = first; m <= (r.until ?? 24) * 60; m += r.every * 60) out.push(m);
  return out.length ? out : [first];
}

/** The next time today at or after `mins`, else the last one. */
export const slotAfter = (r: Reminder, mins: number) => {
  const all = slots(r);
  return all.find((m) => m >= mins) ?? all[all.length - 1]!;
};

/** The next day after `from` the reminder is due, within a year, or undefined. */
export function nextDay(r: Reminder, from: Date): Date | undefined {
  for (let i = 1; i <= 366; i++) {
    const d = addDays(from, i);
    if (occursOn(r, d)) return d;
  }
  return undefined;
}

export type Tab = 'today' | 'upcoming' | 'done';

/** The reminders for a tab. Today: due today and not yet confirmed. Upcoming: not due today, due later. Done: confirmed today. */
export function forTab(all: Reminder[], tab: Tab, now: Date): Reminder[] {
  const list = all.filter((r) => {
    if (tab === 'done') return doneOn(r, now);
    if (tab === 'today') return occursOn(r, now) && !outcomeOn(r, now);
    return !r.paused && !occursOn(r, now) && nextDay(r, now) !== undefined;
  });
  const mins = now.getHours() * 60 + now.getMinutes();
  return list.sort((a, b) => slotAfter(a, mins) - slotAfter(b, mins));
}

/** The first reminder today that has not yet happened. */
export function nextToday(all: Reminder[], now: Date): Reminder | undefined {
  const mins = now.getHours() * 60 + now.getMinutes();
  return forTab(all, 'today', now).find((r) => slots(r).some((m) => m >= mins));
}

/** A new draft: 7 PM today. */
export const newDraft = (): Draft => ({
  text: '',
  hour: 19,
  minute: 0,
  repeat: 'daily',
  days: [],
  speak: true,
  persist: true,
  tellAdmins: true,
});

export const canSave = (d: Draft) =>
  d.text.trim().length > 0 &&
  (d.repeat !== 'custom' || d.days.length > 0) &&
  (d.repeat !== 'interval' || (!!d.every && (d.until ?? 0) * 60 > d.hour * 60 + d.minute));

/** Where a draft starts: a `once` reminder is for today if its time is still ahead, else tomorrow. */
export function withDate(d: Draft, now: Date): Draft {
  if (d.repeat !== 'once') return { ...d, date: undefined };
  const later = d.hour * 60 + d.minute > now.getHours() * 60 + now.getMinutes();
  return { ...d, date: dateKey(later ? now : addDays(now, 1)) };
}

/** Step the time by whole 5-minute steps and keep it in a day. */
export function stepTime(d: { hour: number; minute: number }, byMinutes: number) {
  const total = (((d.hour * 60 + d.minute + byMinutes) % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

/** PENDING BACKEND: sample reminders and a week of results, until the reminders API exists. */
export function sampleReminders(now: Date): Reminder[] {
  const day = (n: number) => dateKey(addDays(now, -n));
  const base = { days: [], speak: true, persist: true, tellAdmins: true, paused: false };
  return [
    {
      ...base,
      id: 'sample-abc',
      text: 'Take ABC medicines',
      hour: 19,
      minute: 0,
      repeat: 'daily',
      by: 'Meera',
      history: [
        { date: day(1), status: 'confirmed', at: '19:02' },
        { date: day(2), status: 'missed', at: '19:15', tries: 3 },
        { date: day(3), status: 'confirmed', at: '19:04' },
        { date: day(4), status: 'confirmed', at: '19:01' },
        { date: day(5), status: 'confirmed', at: '19:07' },
        { date: day(6), status: 'confirmed', at: '19:03' },
      ],
    },
    {
      ...base,
      id: 'sample-walk',
      text: 'Morning walk',
      hour: 6,
      minute: 30,
      repeat: 'daily',
      by: 'wearer',
      history: [{ date: day(0), status: 'confirmed', at: '06:31' }],
    },
    {
      ...base,
      id: 'sample-water',
      text: 'Drink water',
      hour: 9,
      minute: 0,
      repeat: 'interval',
      every: 2,
      until: 19,
      by: 'wearer',
      history: [],
    },
    {
      ...base,
      id: 'sample-neha',
      text: 'Call Neha',
      hour: 17,
      minute: 0,
      repeat: 'once',
      date: dateKey(addDays(now, (6 - now.getDay() + 7) % 7 || 7)),
      by: 'wearer',
      history: [],
    },
  ];
}
