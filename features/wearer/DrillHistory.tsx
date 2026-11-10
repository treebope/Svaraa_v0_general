import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDrillRecords, type DrillRecord } from '@/features/wearer/drillRecords';
import { Card, Icon, Text, useTheme } from '@/ui';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** The last SOS drills and how each ended. The newest is shown larger at the top. */
export function DrillHistory() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const c = theme.colors;
  const records = useDrillRecords((s) => s.records);

  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  if (!records.length) {
    return (
      <Card style={{ alignItems: 'center', gap: theme.space[2] }}>
        <Text variant="heading" tone="heading">
          {t('wearer.drill.history.emptyTitle')}
        </Text>
        <Text tone="secondary" style={{ textAlign: 'center' }}>
          {t('wearer.drill.history.empty')}
        </Text>
      </Card>
    );
  }

  const row = (r: DrillRecord, big: boolean) => {
    const ok = r.status === 'passed';
    return (
      <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <View
          style={{
            width: big ? 48 : 36,
            height: big ? 48 : 36,
            borderRadius: 24,
            backgroundColor: ok ? c.good : c.attention,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={ok ? 'check' : 'close'} color={c.onAction} size={big ? 24 : 18} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant={big ? 'heading' : 'label'} tone="heading">
            {ok ? t('wearer.drill.history.passed') : t('wearer.drill.history.expired')}
          </Text>
          <Text variant="caption" tone="secondary">
            {[
              when(r.startedAt),
              ok && r.answeredBy ? t('wearer.drill.history.answeredBy', { name: r.answeredBy }) : null,
              ok ? t('wearer.drill.history.took', { time: clock(r.seconds) }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>
    );
  };

  const [last, ...older] = records;
  return (
    <View style={{ gap: theme.space[3] }}>
      <Card
        style={{
          gap: theme.space[2],
          backgroundColor: last.status === 'passed' ? c.goodTint : c.attentionTint,
        }}
      >
        <Text variant="kicker" tone="spirit">
          {t('wearer.drill.history.last')}
        </Text>
        {row(last, true)}
      </Card>
      {older.length ? (
        <Card style={{ gap: theme.space[3] }}>
          <Text variant="kicker" tone="spirit">
            {t('wearer.drill.history.earlier')}
          </Text>
          {older.map((r) => row(r, false))}
        </Card>
      ) : null}
    </View>
  );
}
