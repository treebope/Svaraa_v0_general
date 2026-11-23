import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { openMyProfile } from '@/features/apps/openApp';

/**
 * Deep link / legacy route: My Profile lives in the Apps pane now (same as Music).
 * Navigating here opens Apps with the profile pane selected.
 */
export default function ProfileRedirect() {
  const router = useRouter();
  useEffect(() => {
    openMyProfile(router);
  }, [router]);
  return null;
}
