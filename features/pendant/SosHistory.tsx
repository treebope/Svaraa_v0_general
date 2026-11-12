import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMainPalette } from '@/features/main/palette';
import { useDrillRecords } from '@/features/wearer/drillRecords';
import {
  acknowledgedBy,
  isDrill,
  sampleSosEvents,
  type SosEvent,
  type SosOutcome,
} from '@/services/sos/sosHistory';
import { Choice, Icon, Text, useTheme } from '@/ui';

type Filter = 'all' | 'sos' | 'drill';

/** Real SOS events (sample data for now) and the drills run on this device, newest first. */
export function useSosEvents(): SosEvent[] {
  const records = useDrillRecords((s) => s.records);
  useEffect(() => void useDrillRecords.getState().load(), []);
  return useMemo(() => {
    const drills: SosEvent[] = records.map((r) => ({
      id: `drill-${r.id}`,
      startedAt: r.startedAt,
      outcome: r.status === 'passed' ? 'drill_passed' : 'drill_unanswered',
      calls: r.answeredBy ? [{ name: r.answeredBy, answered: true }] : [],
      acknowledgedAt: r.answeredBy
        ? new Date(Date.parse(r.startedAt) + r.seconds * 1000).toISOString()
        : undefined,
      closedAt: new Date(Date.parse(r.startedAt) + r.seconds * 1000).toISOString(),
    }));
    return [...sampleSosEvents(), ...drills].sort(
      (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
    );
  }, [records]);
}

/** SOS history in the Pendant app: one row per event with its outcome; tap a row to see the steps. */
export function SosHistory() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const events = useSosEvents();
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);

  const shown = events.filter((e) => filter === 'all' || (filter === 'drill') === isDrill(e));
  const day = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' });

  const look = (o: SosOutcome) => {
    switch (o) {
      case 'resolved':
        return { color: p.good, icon: 'check' as const, label: t('sos.outcome.resolved') };
      case 'false_alarm':
        return { color: p.gold, icon: 'close' as const, label: t('sos.outcome.falseAlarm') };
      case 'unanswered':
        return { color: theme.colors.attention, icon: 'call' as const, label: t('sos.outcome.unanswered') };
      case 'drill_passed':
        return { color: p.plum, icon: 'check' as const, label: t('sos.outcome.drillPassed') };
      default:
        return { color: p.muted, icon: 'close' as const, label: t('sos.outcome.drillUnanswered') };
    }
  };

  const steps = (e: SosEvent) => {
    const list: { key: string; title: string; at?: string; color: string }[] = [
      {
        key: 'start',
        title: t(isDrill(e) ? 'sos.step.drillStart' : 'sos.step.triggered'),
        at: e.startedAt,
        color: p.plum,
      },
    ];
    e.calls.forEach((c, i) =>
      list.push({
        key: `call${i}`,
        title: t(c.answered ? 'sos.step.acknowledged' : 'sos.step.noAnswer', { name: c.name }),
        at: c.answered ? e.acknowledgedAt : undefined,
        color: c.answered ? p.good : p.muted,
      }),
    );
    if (e.outcome === 'unanswered' || e.outcome === 'drill_unanswered') {
      list.push({
        key: '112',
        title: t(e.outcome === 'unanswered' ? 'sos.step.called112' : 'sos.step.drillNo112'),
        color: theme.colors.attention,
      });
    }
    if (e.reachedAt) {
      list.push({
        key: 'reached',
        title:
          t('sos.step.reached', { name: e.reachedBy ?? t('sos.step.someone') }) +
          (e.place ? ` · ${e.place}` : ''),
        at: e.reachedAt,
        color: p.good,
      });
    }
    if (e.closedAt) {
      list.push({
        key: 'closed',
        title: look(e.outcome).label,
        at: e.closedAt,
        color: look(e.outcome).color,
      });
    }
    return list;
  };

  return (
    <View style={{ gap: theme.space[3] }}>
      <Text variant="kicker" style={{ color: p.gold }}>
        {t('sos.title')}
      </Text>
      <Choice<Filter>
        label={t('sos.title')}
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: t('sos.filter.all') },
          { id: 'sos', label: t('sos.filter.sos') },
          { id: 'drill', label: t('sos.filter.drill') },
        ]}
      />
      {shown.length === 0 ? <Text style={{ color: p.muted }}>{t('sos.empty')}</Text> : null}
      {shown.map((e) => {
        const l = look(e.outcome);
        const expanded = open === e.id;
        const who = acknowledgedBy(e);
        return (
          <View
            key={e.id}
            style={{
              backgroundColor: p.card,
              borderWidth: 1,
              borderColor: p.line,
              borderRadius: 15,
              overflow: 'hidden',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${l.label}, ${day(e.startedAt)}`}
              onPress={() => setOpen(expanded ? null : e.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[3],
                padding: 14,
                minHeight: theme.minTarget,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: l.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={l.icon} size={18} color={p.on} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.ink, fontWeight: '600' }}>{l.label}</Text>
                <Text variant="bodySm" style={{ color: p.muted }}>
                  {[
                    `${day(e.startedAt)}, ${time(e.startedAt)}`,
                    who ? t('sos.step.acknowledged', { name: who }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text style={{ color: p.muted }}>{expanded ? '⌃' : '⌄'}</Text>
            </Pressable>
            {expanded ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                {steps(e).map((s, i, all) => (
                  <View key={s.key} style={{ flexDirection: 'row', gap: theme.space[3] }}>
                    <View style={{ alignItems: 'center', width: 14 }}>
                      <View
                        style={{ width: 2, height: 6, backgroundColor: i === 0 ? 'transparent' : p.line2 }}
                      />
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: s.color }} />
                      <View
                        style={{
                          width: 2,
                          flexGrow: 1,
                          minHeight: 10,
                          backgroundColor: i === all.length - 1 ? 'transparent' : p.line2,
                        }}
                      />
                    </View>
                    <View style={{ flex: 1, paddingVertical: 4 }}>
                      <Text style={{ color: p.ink }}>{s.title}</Text>
                      {s.at ? (
                        <Text variant="caption" style={{ color: p.muted }}>
                          {time(s.at)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
