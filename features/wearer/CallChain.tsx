import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useWearer } from '@/features/wearer/store';
import { useCallChain } from '@/features/wearer/useCallChain';
import { Button, Card, Text, useTheme } from '@/ui';

/** Call the emergency contacts yourself, in order, from this phone. See useCallChain for how it works. */
export function CallChain({ drill }: { drill: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const contacts = useWearer((s) => s.contacts);
  const targets = useMemo(
    () => contacts.map((p) => ({ name: p.name, number: `${p.countryCode}${p.mobile}` })),
    [contacts],
  );
  const chain = useCallChain(targets, { drill });
  if (!targets.length) return null;

  if (chain.phase === 'idle') {
    return (
      <Button label={t('wearer.drill.call.start')} variant="secondary" onPress={chain.start} fullWidth />
    );
  }
  return (
    <Card style={{ gap: theme.space[2] }} accessibilityLiveRegion="polite">
      {chain.phase === 'asking' && chain.current ? (
        <>
          <Text variant="heading" tone="heading">
            {t('wearer.drill.call.calling', { name: chain.current.name })}
          </Text>
          <Text tone="secondary">{t('wearer.drill.call.ask', { name: chain.current.name })}</Text>
          {chain.failed ? (
            <Text tone="safety" accessibilityRole="alert">
              {t('wearer.drill.call.failed', { number: chain.current.number })}
            </Text>
          ) : null}
          <Button label={t('wearer.drill.call.yes')} onPress={chain.answered} fullWidth />
          <Button label={t('wearer.drill.call.no')} variant="secondary" onPress={chain.next} fullWidth />
          <Button label={t('wearer.drill.call.again')} variant="tertiary" onPress={chain.again} fullWidth />
        </>
      ) : null}
      {chain.phase === 'answered' ? (
        <>
          <Text variant="heading" tone="heading">
            {t('wearer.drill.call.answered')}
          </Text>
          <Button label={t('wearer.drill.call.reset')} variant="tertiary" onPress={chain.reset} fullWidth />
        </>
      ) : null}
      {chain.phase === 'emergency' ? (
        <>
          <Text variant="heading" tone="heading">
            {t('wearer.drill.call.nobody')}
          </Text>
          <Text tone="secondary">
            {t(drill ? 'wearer.drill.call.emergencyDrill' : 'wearer.drill.call.emergency')}
          </Text>
          {!drill ? <Button label={t('wearer.drill.call.again112')} onPress={chain.again} fullWidth /> : null}
          <Button label={t('wearer.drill.call.reset')} variant="tertiary" onPress={chain.reset} fullWidth />
        </>
      ) : null}
    </Card>
  );
}
