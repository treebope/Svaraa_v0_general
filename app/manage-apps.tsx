import { useRouter } from 'expo-router';
import { ManageApps } from '@/features/manage/ManageApps';
import { safeBack } from '@/features/nav/safeBack';
import { Screen } from '@/ui';

/** Manage apps (F7), opened from My Profile. */
export default function ManageAppsScreen() {
  const router = useRouter();
  return (
    <Screen maxWidth={640}>
      <ManageApps back={() => safeBack(router)} />
    </Screen>
  );
}
