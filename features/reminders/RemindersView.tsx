import { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { IconButton, InfoRow, Pill, useMainPalette } from '@/features/main/palette';
import { useWearer } from '@/features/wearer/store';
import { Button, Choice, Icon, Input, Text, useTheme } from '@/ui';
import {
  addDays,
  canSave,
  dateKey,
  doneOn,
  forTab,
  newDraft,
  nextDay,
  nextToday,
  occursOn,
  outcomeOn,
  slotAfter,
  stepTime,
  withDate,
  type Draft,
  type Reminder,
  type Repeat,
  type Tab,
} from './logic';
import { useReminders } from './store';

type Screen = { kind: 'list' } | { kind: 'form'; id?: string } | { kind: 'detail'; id: string };

const REPEATS: Repeat[] = ['once', 'daily', 'weekdays', 'custom'];
const TABS: Tab[] = ['today', 'upcoming', 'done'];

/** Reminders app: the list (today, upcoming, done), a form for a new one, and the history of one. */
export function RemindersView() {
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  useEffect(() => void useReminders.getState().load(), []);
  if (screen.kind === 'form') {
    return <Form id={screen.id} back={(id) => setScreen(id ? { kind: 'detail', id } : { kind: 'list' })} />;
  }
  if (screen.kind === 'detail') {
    return (
      <Detail
        id={screen.id}
        back={() => setScreen({ kind: 'list' })}
        edit={() => setScreen({ kind: 'form', id: screen.id })}
      />
    );
  }
  return <List open={(id) => setScreen({ kind: 'detail', id })} add={() => setScreen({ kind: 'form' })} />;
}

function useFormat() {
  const { i18n, t } = useTranslation();
  const time = (h: number, m: number) =>
    new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(2000, 0, 1, h, m),
    );
  const short = (h: number, m: number) =>
    new Intl.DateTimeFormat(
      i18n.language,
      m ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' },
    ).format(new Date(2000, 0, 1, h, m));
  const weekday = (d: Date, style: 'short' | 'long' = 'short') =>
    new Intl.DateTimeFormat(i18n.language, { weekday: style }).format(d);
  const dayName = (dow: number) => weekday(new Date(2000, 0, 2 + dow));
  const repeatName = (r: Reminder | Draft) =>
    r.repeat === 'custom'
      ? [...r.days]
          .sort((a, b) => a - b)
          .map(dayName)
          .join(', ')
      : t(`reminders.repeat.${r.repeat}`);
  const clock = (mins: number) => time(Math.floor(mins / 60), mins % 60);
  /** How often, in words: "Daily", "Mon, Wed" or "Every 2 h · 9 AM to 7 PM". */
  const when = (r: Reminder) =>
    r.repeat === 'interval'
      ? t('reminders.every', {
          hours: r.every ?? 1,
          from: short(r.hour, r.minute),
          to: short(r.until ?? 24, 0),
        })
      : repeatName(r);
  const by = (r: Reminder) => (r.by === 'wearer' ? '' : t('reminders.by', { name: r.by }));
  const created = (r: Reminder) => (r.by === 'wearer' ? '' : t('reminders.createdBy', { name: r.by }));
  return { time, short, weekday, dayName, repeatName, when, by, created, clock };
}

function useWearerName() {
  const { t } = useTranslation();
  return useWearer((s) => s.profile?.name)?.split(' ')[0] ?? t('reminders.wearerFallback');
}

function List({ open, add }: { open: (id: string) => void; add: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const f = useFormat();
  const name = useWearerName();
  const items = useReminders((s) => s.items);
  const [tab, setTab] = useState<Tab>('today');
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const shown = forTab(items, tab, now);
  const next = tab === 'today' ? nextToday(items, now) : undefined;
  const doneToday = tab === 'today' ? forTab(items, 'done', now) : [];

  const detail = (r: Reminder) => {
    const later = r.repeat === 'once' && !occursOn(r, now);
    const day = later && r.date ? `${f.weekday(new Date(`${r.date}T00:00`))} ` : '';
    const start = r.repeat === 'interval' ? '' : `${day}${f.time(r.hour, r.minute)} · `;
    return `${start}${f.when(r)}${f.by(r) ? ` · ${f.by(r)}` : ''}`;
  };
  const row = (r: Reminder) => {
    const right =
      tab === 'done' ? (
        <Pill label={t('reminders.confirmed')} tone="good" />
      ) : tab === 'upcoming' ? (
        <Pill label={f.weekday(nextDay(r, now) ?? now)} />
      ) : r.id === next?.id ? (
        <Pill label={t('reminders.next')} tone="plum" />
      ) : (
        <Pill label={f.short(Math.floor(slotAfter(r, mins) / 60), slotAfter(r, mins) % 60)} />
      );
    return <InfoRow key={r.id} title={r.text} detail={detail(r)} right={right} onPress={() => open(r.id)} />;
  };

  return (
    <View style={{ gap: theme.space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: p.muted }} accessibilityRole="header">
          {t('reminders.forName', { name })}
        </Text>
        <IconButton icon="plus" label={t('reminders.new')} onPress={add} />
      </View>
      <Choice<Tab>
        label={t('reminders.tabs')}
        value={tab}
        onChange={setTab}
        options={TABS.map((id) => ({ id, label: t(`reminders.tab.${id}`) }))}
      />
      {shown.length ? shown.map(row) : <Text style={{ color: p.muted }}>{t(`reminders.empty.${tab}`)}</Text>}
      {doneToday.length ? (
        <>
          <Text variant="kicker" style={{ color: p.gold }}>
            {t('reminders.doneToday')}
          </Text>
          {doneToday.map((r) => (
            <InfoRow
              key={r.id}
              title={r.text}
              detail={t('reminders.confirmedAt', { time: f.time(r.hour, r.minute) })}
              right={<Pill label={t('reminders.confirmed')} tone="good" />}
              onPress={() => open(r.id)}
            />
          ))}
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('reminders.new')}
        onPress={add}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 56,
          borderRadius: 15,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: p.line2,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Icon name="plus" size={18} color={p.plum} />
        <Text style={{ color: p.plum, fontWeight: '600' }}>{t('reminders.new')}</Text>
      </Pressable>
      <Text style={{ color: p.muted }}>{t('reminders.hint')}</Text>
    </View>
  );
}

function BackHeader({ title, right, back }: { title: string; right?: string; back: () => void }) {
  const { t } = useTranslation();
  const p = useMainPalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('reminders.back')}
        onPress={back}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, flex: 1 }}
      >
        <Icon name="back" size={20} color={p.muted} />
        <Text
          style={{ color: p.ink, fontWeight: '700', fontSize: 20, flexShrink: 1 }}
          accessibilityRole="header"
        >
          {title}
        </Text>
      </Pressable>
      {right ? <Text style={{ color: p.muted }}>{right}</Text> : null}
    </View>
  );
}

/** An underlined text button (Pause, Delete). */
function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const p = useMainPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: p.ink, fontWeight: '700', textDecorationLine: 'underline' }}>{label}</Text>
    </Pressable>
  );
}

function Toggle({
  title,
  detail,
  value,
  onChange,
}: {
  title: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const p = useMainPalette();
  return (
    <InfoRow
      title={title}
      detail={detail}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          accessibilityLabel={title}
          trackColor={{ true: p.good, false: p.line2 }}
        />
      }
    />
  );
}

function Stepper({
  label,
  value,
  less,
  more,
}: {
  label: string;
  value: string;
  less: () => void;
  more: () => void;
}) {
  const { t } = useTranslation();
  const p = useMainPalette();
  const btn = (text: string, onPress: () => void, name: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${name}`}
      onPress={onPress}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: p.line2,
        backgroundColor: p.card,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: p.plum, fontSize: 22, fontWeight: '600' }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {btn('−', less, t('reminders.earlier'))}
      <Text style={{ color: p.ink, fontSize: 18, fontWeight: '600', minWidth: 74, textAlign: 'center' }}>
        {value}
      </Text>
      {btn('+', more, t('reminders.later'))}
    </View>
  );
}

function Form({ id, back }: { id?: string; back: (id?: string) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const f = useFormat();
  const name = useWearerName();
  const existing = useReminders((s) => s.items.find((r) => r.id === id));
  const [d, setD] = useState<Draft>(existing ?? newDraft());
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const toggleDay = (n: number) =>
    set({ days: d.days.includes(n) ? d.days.filter((x) => x !== n) : [...d.days, n] });

  const save = () => {
    const draft = withDate({ ...d, text: d.text.trim() }, new Date());
    if (id) {
      useReminders.getState().update(id, draft);
      back(id);
    } else {
      useReminders.getState().add(draft, 'wearer');
      back();
    }
  };

  return (
    <View style={{ gap: theme.space[3] }}>
      <BackHeader
        title={id ? t('reminders.edit') : t('reminders.new')}
        right={t('reminders.forShort', { name })}
        back={() => back(id)}
      />
      <Input
        label={t('reminders.say')}
        hint={t('reminders.sayHint')}
        value={d.text}
        onChangeText={(text) => set({ text })}
        placeholder={t('reminders.sayExample')}
        maxLength={80}
      />
      <View
        style={{
          backgroundColor: p.tile,
          borderWidth: 1.5,
          borderColor: p.line2,
          borderRadius: 15,
          padding: 14,
          gap: 10,
        }}
      >
        <Text variant="bodySm" style={{ color: p.muted }}>
          {t('reminders.time')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <Stepper
            label={t('reminders.hours')}
            value={f.time(d.hour, d.minute)}
            less={() => set(stepTime(d, -60))}
            more={() => set(stepTime(d, 60))}
          />
          <Stepper
            label={t('reminders.minutes')}
            value={`:${String(d.minute).padStart(2, '0')}`}
            less={() => set(stepTime(d, -5))}
            more={() => set(stepTime(d, 5))}
          />
        </View>
      </View>
      <Text style={{ color: p.muted }}>{t('reminders.timeZone', { name })}</Text>
      <Choice<Repeat>
        label={t('reminders.repeatLabel')}
        value={d.repeat === 'interval' ? 'custom' : d.repeat}
        onChange={(repeat) =>
          set({ repeat: repeat === 'custom' && d.repeat === 'interval' ? 'interval' : repeat })
        }
        options={REPEATS.map((r) => ({ id: r, label: t(`reminders.repeat.${r}`) }))}
      />
      {d.repeat === 'custom' || d.repeat === 'interval' ? (
        <Choice<'days' | 'hours'>
          label={t('reminders.customKind')}
          value={d.repeat === 'interval' ? 'hours' : 'days'}
          onChange={(k) =>
            set(
              k === 'hours'
                ? { repeat: 'interval', every: d.every ?? 2, until: d.until ?? 19 }
                : { repeat: 'custom' },
            )
          }
          options={[
            { id: 'days', label: t('reminders.kindDays') },
            { id: 'hours', label: t('reminders.kindHours') },
          ]}
        />
      ) : null}
      {d.repeat === 'interval' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          <Stepper
            label={t('reminders.everyLabel')}
            value={t('reminders.everyShort', { hours: d.every ?? 2 })}
            less={() => set({ every: Math.max(1, (d.every ?? 2) - 1) })}
            more={() => set({ every: Math.min(12, (d.every ?? 2) + 1) })}
          />
          <Stepper
            label={t('reminders.untilLabel')}
            value={f.short(d.until ?? 19, 0)}
            less={() => set({ until: Math.max(d.hour + 1, (d.until ?? 19) - 1) })}
            more={() => set({ until: Math.min(23, (d.until ?? 19) + 1) })}
          />
        </View>
      ) : null}
      {d.repeat === 'custom' ? (
        <View
          accessibilityRole="menu"
          accessibilityLabel={t('reminders.days')}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
        >
          {[1, 2, 3, 4, 5, 6, 0].map((n) => {
            const on = d.days.includes(n);
            return (
              <Pressable
                key={n}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggleDay(n)}
                style={{
                  minWidth: 56,
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: on ? p.plum : p.line2,
                  backgroundColor: on ? p.plumSoft : 'transparent',
                }}
              >
                <Text style={{ color: on ? p.plum : p.ink, fontWeight: '600' }}>{f.dayName(n)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Text variant="kicker" style={{ color: p.gold }}>
        {t('reminders.onPendant')}
      </Text>
      <Toggle title={t('reminders.speak')} value={d.speak} onChange={(speak) => set({ speak })} />
      <Toggle
        title={t('reminders.persist')}
        detail={t('reminders.persistDetail')}
        value={d.persist}
        onChange={(persist) => set({ persist })}
      />
      <Toggle
        title={t('reminders.tellAdmins')}
        value={d.tellAdmins}
        onChange={(tellAdmins) => set({ tellAdmins })}
      />
      <View
        style={{
          backgroundColor: p.card,
          borderWidth: 1,
          borderColor: p.line,
          borderRadius: 15,
          padding: 14,
          gap: 4,
        }}
      >
        <Text style={{ color: p.ink, fontWeight: '700' }}>{t('reminders.preview')}</Text>
        <Text style={{ color: p.muted, fontStyle: 'italic' }}>
          {t('reminders.previewText', { name, text: d.text.trim() || t('reminders.sayExample') })}
        </Text>
      </View>
      <Button label={t('reminders.save')} onPress={save} disabled={!canSave(d)} fullWidth />
      <Button label={t('reminders.cancel')} variant="tertiary" onPress={() => back(id)} fullWidth />
    </View>
  );
}

function Detail({ id, back, edit }: { id: string; back: () => void; edit: () => void }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const f = useFormat();
  const r = useReminders((s) => s.items.find((x) => x.id === id));
  const [sure, setSure] = useState(false);
  if (!r) {
    return (
      <View style={{ gap: theme.space[3] }}>
        <Button label={t('reminders.all')} variant="secondary" size="sm" onPress={back} />
      </View>
    );
  }
  const now = new Date();
  const dueText = (rem: Reminder, at: Date) => {
    const mins = at.getHours() * 60 + at.getMinutes();
    const diff = slotAfter(rem, mins) - mins;
    if (diff <= 0) return t('reminders.dueNow');
    const unit = diff < 60 ? 'minute' : 'hour';
    const n = diff < 60 ? diff : Math.round(diff / 60);
    const how = new Intl.NumberFormat(i18n.language, { style: 'unit', unit, unitDisplay: 'short' }).format(n);
    return t('reminders.dueIn', { when: how });
  };
  const week = [6, 5, 4, 3, 2, 1, 0].map((n) => addDays(now, -n));
  const past = r.history.filter((h) => h.date !== dateKey(now)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const todayStatus = outcomeOn(r, now);
  const dayOf = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
  };
  const clock = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return f.time(h!, m!);
  };

  return (
    <View style={{ gap: theme.space[3] }}>
      <BackHeader title={r.text} back={back} />
      <Text style={{ color: p.ink }}>
        {[f.when(r), r.repeat === 'interval' ? '' : f.time(r.hour, r.minute), f.created(r)]
          .filter(Boolean)
          .join(' · ')}
        {r.paused ? ` · ${t('reminders.paused')}` : ''}
      </Text>
      <Text variant="kicker" style={{ color: p.gold }}>
        {t('reminders.last7')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {week.map((day) => {
          const done = doneOn(r, day);
          return (
            <View
              key={dateKey(day)}
              accessible
              accessibilityLabel={`${f.weekday(day, 'long')}: ${t(done ? 'reminders.confirmed' : 'reminders.notConfirmed')}`}
              style={{
                minWidth: 56,
                minHeight: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: done ? p.plum : p.line2,
                backgroundColor: done ? p.plumSoft : 'transparent',
              }}
            >
              <Text style={{ color: done ? p.plum : p.muted, fontWeight: '600' }}>{f.weekday(day)}</Text>
            </View>
          );
        })}
      </View>
      {occursOn(r, now) && !todayStatus ? (
        <InfoRow
          title={`${t('reminders.today')} · ${f.time(r.hour, r.minute)}`}
          detail={dueText(r, now)}
          right={<Pill label={t('reminders.pending')} tone="warn" />}
        />
      ) : null}
      {todayStatus ? (
        <InfoRow
          title={`${t('reminders.today')} · ${clock(todayStatus.at)}`}
          detail={t('reminders.byVoice')}
          right={<Pill label={t('reminders.confirmed')} tone="good" />}
        />
      ) : null}
      {past.map((h) => (
        <InfoRow
          key={h.date}
          title={`${f.weekday(dayOf(h.date))} · ${clock(h.at)}`}
          detail={
            h.status === 'confirmed'
              ? t('reminders.byVoice')
              : t('reminders.noReply', { count: h.tries ?? 3 })
          }
          right={
            <Pill
              label={t(h.status === 'confirmed' ? 'reminders.confirmed' : 'reminders.missed')}
              tone={h.status === 'confirmed' ? 'good' : 'bad'}
            />
          }
        />
      ))}
      {!past.length && !todayStatus ? (
        <Text style={{ color: p.muted }}>{t('reminders.noHistory')}</Text>
      ) : null}
      <Button label={t('reminders.editButton')} variant="secondary" onPress={edit} fullWidth />
      <LinkButton
        label={r.paused ? t('reminders.resume') : t('reminders.pause')}
        onPress={() => useReminders.getState().togglePause(r.id)}
      />
      <LinkButton
        label={sure ? t('reminders.deleteSure') : t('reminders.delete')}
        onPress={() => {
          if (!sure) return setSure(true);
          useReminders.getState().remove(r.id);
          back();
        }}
      />
    </View>
  );
}
