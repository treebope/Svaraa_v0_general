/** Date of birth is typed as DD/MM/YYYY and saved as an ISO date (YYYY-MM-DD). */

/** Keeps digits only and puts the slashes in as you type: 05071950 becomes 05/07/1950. */
export function formatDobInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export type DobCheck =
  { ok: true; iso: string } | { ok: false; reason: 'incomplete' | 'invalid' | 'future' | 'tooOld' };

const OLDEST = 120;

/** Checks a DD/MM/YYYY text: a real calendar date, not in the future, not more than 120 years ago. */
export function checkDob(text: string, today = new Date()): DobCheck {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return { ok: false, reason: 'incomplete' };
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return { ok: false, reason: 'invalid' };
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date > start) return { ok: false, reason: 'future' };
  if (year < today.getFullYear() - OLDEST) return { ok: false, reason: 'tooOld' };
  return { ok: true, iso: `${m[3]}-${m[2]}-${m[1]}` };
}

/** ISO date back to DD/MM/YYYY, for showing a saved value. */
export function isoToDobInput(iso: string | null | undefined): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Age in whole years today, from an ISO date of birth. undefined if the date is missing or unreadable. */
export function ageFromIso(iso: string | null | undefined, today = new Date()): number | undefined {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1;
  return age >= 0 ? age : undefined;
}
