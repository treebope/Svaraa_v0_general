import { fireEvent, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { RemindersView } from '@/features/reminders/RemindersView';
import { useReminders } from '@/features/reminders/store';
import {
  canSave,
  forTab,
  newDraft,
  occursOn,
  sampleReminders,
  slotAfter,
  slots,
  stepTime,
  withDate,
} from '@/features/reminders/logic';
import { renderApp } from '@/test-utils/render';

const now = new Date(2026, 10, 12, 10, 0); // a Thursday

describe('reminder rules', () => {
  it('knows which reminders are due, upcoming and done', () => {
    const all = sampleReminders(now);
    expect(forTab(all, 'today', now).map((r) => r.id)).toEqual(['sample-water', 'sample-abc']);
    expect(forTab(all, 'done', now).map((r) => r.id)).toEqual(['sample-walk']);
    expect(forTab(all, 'upcoming', now).map((r) => r.id)).toEqual(['sample-neha']);
  });
  it('handles weekdays, custom days, pause and once', () => {
    const r = { ...sampleReminders(now)[0]!, repeat: 'weekdays' as const };
    expect(occursOn(r, new Date(2026, 10, 14))).toBe(false);
    expect(occursOn({ ...r, repeat: 'custom', days: [6] }, new Date(2026, 10, 14))).toBe(true);
    expect(occursOn({ ...r, paused: true }, now)).toBe(false);
  });
  it('says an every-few-hours reminder at each time in its window', () => {
    const water = sampleReminders(now).find((r) => r.id === 'sample-water')!;
    expect(slots(water).map((m) => m / 60)).toEqual([9, 11, 13, 15, 17, 19]);
    expect(slotAfter(water, 12 * 60)).toBe(13 * 60);
    expect(slotAfter(water, 20 * 60)).toBe(19 * 60);
  });
  it('needs words, and days for custom', () => {
    expect(canSave({ ...newDraft(), text: ' ' })).toBe(false);
    expect(canSave({ ...newDraft(), text: 'x', repeat: 'custom' })).toBe(false);
    expect(canSave({ ...newDraft(), text: 'x', repeat: 'custom', days: [1] })).toBe(true);
  });
  it('sets a once reminder for today or tomorrow, and steps the time round the clock', () => {
    expect(withDate({ ...newDraft(), repeat: 'once' }, now).date).toBe('2026-11-12');
    expect(withDate({ ...newDraft(), repeat: 'once', hour: 8 }, now).date).toBe('2026-11-13');
    expect(stepTime({ hour: 23, minute: 55 }, 5)).toEqual({ hour: 0, minute: 0 });
    expect(stepTime({ hour: 0, minute: 0 }, -5)).toEqual({ hour: 23, minute: 55 });
  });
});

describe('Reminders app', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useReminders.setState({ items: sampleReminders(new Date()), loaded: true });
  });
  it('lists, adds, opens and deletes a reminder', async () => {
    await renderApp(<RemindersView />);
    expect(screen.getByText('Take ABC medicines')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'New reminder' })[0]!);
    await fireEvent.changeText(screen.getByLabelText('What should Svaraa say?'), 'Water the plants');
    await fireEvent.press(screen.getByRole('button', { name: 'Save reminder' }));
    expect(useReminders.getState().items.some((r) => r.text === 'Water the plants')).toBe(true);
    await fireEvent.press(screen.getByText('Take ABC medicines'));
    expect(screen.getByText('Last 7 days')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Tap again to delete' }));
    expect(useReminders.getState().items.some((r) => r.id === 'sample-abc')).toBe(false);
  });
});
