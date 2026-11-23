import { View } from 'react-native';
import { LanguageSwitch, Logo, SchemeSwitch, useTheme } from '@/ui';

/** Top bar for welcome and setup: brand on the left, language then light/dark on the right. */
export function FlowChrome() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space[3],
        width: '100%',
        // Language menu opens under the control; keep it above the page body.
        zIndex: 20,
        overflow: 'visible',
      }}
    >
      <Logo height={32} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <LanguageSwitch />
        <SchemeSwitch />
      </View>
    </View>
  );
}
