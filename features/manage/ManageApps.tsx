import { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { InfoRow, useMainPalette } from '@/features/main/palette';
import { Stepper } from '@/features/reminders/RemindersView';
import { stepTime } from '@/features/reminders/logic';
import { useWearer } from '@/features/wearer/store';
import { Icon, Text, useTheme } from '@/ui';
import { MANAGED, useManageApps } from './store';

/** Manage apps (F7): what shows on Explore, quiet hours, and a note that SOS always comes first. */
export function ManageApps({ back }: { back: () => void }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const p = useMainPalette();
  const m = useManageApps();
  const [editing, setEditing] = useState(false);
  const first = useWearer((s) => s.profile?.name)?.split(' ')[0];
  useEffect(() => void useManageApps.getState().load(), []);

  const clock = (mins: number) =>
    new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60),
    );
  const move = (key: 'quietStart' | 'quietEnd', by: number) => {
    const next = stepTime({ hour: Math.floor(m[key] / 60), minute: m[key] % 60 }, by);
    m.setQuiet({ [key]: next.hour * 60 + next.minute });
  };
  const switchFor = (title: string, value: boolean, onChange: (v: boolean) => void) => (
    <Switch
      value={value}
      onValueChange={onChange}
      accessibilityLabel={title}
      trackColor={{ true: p.good, false: p.line2 }}
    />
  );

  return (
    <View style={{ gap: theme.space[3] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={back}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48 }}
      >
        <Icon name="back" size={20} color={p.muted} />
        <Text style={{ color: p.ink, fontWeight: '700', fontSize: 20 }} accessibilityRole="header">
          {t('manage.title')}
        </Text>
      </Pressable>
      <Text style={{ color: p.muted }}>
        {first ? t('manage.intro', { name: first }) : t('manage.introNoName')}
      </Text>

      {MANAGED.map((id) => (
        <InfoRow
          key={id}
          title={t(`manage.app.${id}`)}
          detail={t(`manage.detail.${id}`)}
          right={switchFor(t(`manage.app.${id}`), m.enabled[id], (on) => m.setEnabled(id, on))}
        />
      ))}

      <Text variant="kicker" style={{ color: p.gold }}>
        {t('manage.quiet')}
      </Text>
      <InfoRow
        title={t('manage.quietTitle')}
        detail={t('manage.quietRange', { from: clock(m.quietStart), to: clock(m.quietEnd) })}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? t('manage.done') : t('manage.edit')}
            onPress={() => setEditing((e) => !e)}
            style={{
              minHeight: 40,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: p.seg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="label" style={{ color: p.ink, fontWeight: '600' }}>
              {editing ? t('manage.done') : t('manage.edit')}
            </Text>
          </Pressable>
        }
      />
      {editing ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text variant="bodySm" style={{ color: p.muted }}>
              {t('manage.from')}
            </Text>
            <Stepper
              label={t('manage.from')}
              value={clock(m.quietStart)}
              less={() => move('quietStart', -30)}
              more={() => move('quietStart', 30)}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text variant="bodySm" style={{ color: p.muted }}>
              {t('manage.to')}
            </Text>
            <Stepper
              label={t('manage.to')}
              value={clock(m.quietEnd)}
              less={() => move('quietEnd', -30)}
              more={() => move('quietEnd', 30)}
            />
          </View>
        </View>
      ) : null}
      <InfoRow
        title={t('manage.stillRemind')}
        detail={t('manage.stillRemindDetail')}
        right={switchFor(t('manage.stillRemind'), m.quietReminders, (on) =>
          m.setQuiet({ quietReminders: on }),
        )}
      />

      <View
        style={{
          backgroundColor: p.seg,
          borderWidth: 1.5,
          borderColor: p.line2,
          borderRadius: 15,
          padding: 14,
          gap: 4,
        }}
      >
        <Text style={{ color: p.ink, fontWeight: '700' }}>{t('manage.sosTitle')}</Text>
        <Text style={{ color: p.muted }}>{t('manage.sosBody')}</Text>
      </View>
      <Text style={{ color: p.muted }}>{t('manage.pending')}</Text>
    </View>
  );
}
