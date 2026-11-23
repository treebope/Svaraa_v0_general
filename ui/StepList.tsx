import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export type StepListItem = { label: string; detail?: string; state: 'done' | 'now' | 'todo' };

/** Numbered instructions or progress that cannot be tapped (pairing steps, setup status). */
export function StepList({ items }: { items: StepListItem[] }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const c = theme.colors;
  return (
    <View style={{ gap: theme.space[4] }}>
      {items.map((s, i) => {
        const state = s.state === 'done' ? t('steps.done') : s.state === 'now' ? t('steps.current') : '';
        return (
          <View
            key={`${i}-${s.label}`}
            accessible
            accessibilityLabel={[s.label, s.detail, state].filter(Boolean).join(', ')}
            style={{ flexDirection: 'row', gap: theme.space[3], alignItems: 'flex-start' }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                borderWidth: 2,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: s.state === 'done' ? c.good : s.state === 'now' ? c.action : c.border,
                backgroundColor: s.state === 'done' ? c.good : s.state === 'now' ? c.sunken : 'transparent',
              }}
            >
              <Text
                variant="caption"
                style={{
                  color: s.state === 'done' ? c.onAction : s.state === 'now' ? c.action : c.textSecondary,
                }}
              >
                {s.state === 'done' ? '✓' : String(i + 1)}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 2, paddingTop: 2 }}>
              <Text
                tone={s.state === 'todo' ? 'secondary' : 'primary'}
                style={s.state === 'now' ? { fontWeight: '600' } : undefined}
              >
                {s.label}
              </Text>
              {s.detail ? (
                <Text variant="bodySm" tone="secondary">
                  {s.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
