/**
 * SOS history: every time SOS was pressed (or a drill was run), who was called, who acknowledged, who reached the
 * person and how it ended. PENDING BACKEND: no endpoint yet, so the real SOS events below are sample data and the
 * drills come from the ones run on this device (features/wearer/drillRecords.ts).
 */
export type SosOutcome =
  | 'resolved' // help reached the person and the SOS was closed
  | 'false_alarm' // pressed by mistake, a contact confirmed they are fine
  | 'unanswered' // no contact answered, so 112 was called
  | 'drill_passed' // a test: a contact answered
  | 'drill_unanswered'; // a test: nobody answered in time

export type SosEvent = {
  id: string;
  startedAt: string;
  outcome: SosOutcome;
  /** The contacts called, in order. The last one with `answered` is who acknowledged. */
  calls: { name: string; answered: boolean }[];
  acknowledgedAt?: string;
  reachedBy?: string;
  reachedAt?: string;
  place?: string;
  closedAt?: string;
};

export const isDrill = (e: SosEvent) => e.outcome === 'drill_passed' || e.outcome === 'drill_unanswered';
export const acknowledgedBy = (e: SosEvent) => e.calls.find((c) => c.answered)?.name;

const ago = (days: number, minutes = 0) =>
  new Date(Date.now() - days * 86_400_000 + minutes * 60_000).toISOString();

/** PENDING BACKEND: sample real SOS events so the history screen has something to show. */
export function sampleSosEvents(): SosEvent[] {
  return [
    {
      id: 'sample-resolved',
      startedAt: ago(3),
      outcome: 'resolved',
      calls: [
        { name: 'Meera', answered: false },
        { name: 'Ravi', answered: true },
      ],
      acknowledgedAt: ago(3, 1),
      reachedBy: 'Ravi',
      reachedAt: ago(3, 14),
      place: 'Home',
      closedAt: ago(3, 35),
    },
    {
      id: 'sample-false-alarm',
      startedAt: ago(9),
      outcome: 'false_alarm',
      calls: [{ name: 'Meera', answered: true }],
      acknowledgedAt: ago(9, 1),
      closedAt: ago(9, 4),
    },
  ];
}
