import { View } from 'react-native';
import { Text } from '@/ui';

/** A label with its value beneath, for the details on My Profile. */
export function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text>{value}</Text>
    </View>
  );
}
