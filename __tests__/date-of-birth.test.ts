import { ageFromIso, checkDob, formatDobInput, isoToDobInput } from '@/features/wearer/dateOfBirth';

const today = new Date(2026, 10, 7); // 7 November 2026

describe('date of birth', () => {
  it('formats as you type and ignores other characters', () => {
    expect(formatDobInput('05071950')).toBe('05/07/1950');
    expect(formatDobInput('0507')).toBe('05/07');
    expect(formatDobInput('ab05/07-19509999')).toBe('05/07/1950');
  });

  it('accepts a real date and returns it as ISO', () => {
    expect(checkDob('05/07/1950', today)).toEqual({ ok: true, iso: '1950-07-05' });
    expect(isoToDobInput('1950-07-05')).toBe('05/07/1950');
    expect(isoToDobInput(undefined)).toBe('');
  });

  it('rejects incomplete, impossible, future and too old dates', () => {
    expect(checkDob('05/07', today)).toEqual({ ok: false, reason: 'incomplete' });
    expect(checkDob('31/02/2000', today)).toEqual({ ok: false, reason: 'invalid' });
    expect(checkDob('08/11/2026', today)).toEqual({ ok: false, reason: 'future' });
    expect(checkDob('07/11/2026', today).ok).toBe(true);
    expect(checkDob('01/01/1900', today)).toEqual({ ok: false, reason: 'tooOld' });
  });

  it('works out the age, counting the birthday', () => {
    expect(ageFromIso('1950-11-07', today)).toBe(76);
    expect(ageFromIso('1950-11-08', today)).toBe(75);
    expect(ageFromIso('2026-12-01', today)).toBeUndefined();
    expect(ageFromIso(undefined, today)).toBeUndefined();
  });
});
