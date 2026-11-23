import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/i18n';
import { env } from '@/config/env';
import { useHousehold } from '@/features/household/store';
import { DueBanner } from '@/features/reminders/DueBanner';
import { useScheduleSync } from '@/features/reminders/store';
import { useReminderAlerts } from '@/features/reminders/useReminderAlerts';
import { DRAFT_HOUSEHOLD_ID } from '@/services/household/householdApi';
import { restoreDisplayScale } from '@/features/settings/displayScale';
import { restoreLanguage } from '@/features/settings/language';
import { useSettings } from '@/features/settings/store';
import { useWearer } from '@/features/wearer/store';
import { startMocks } from '@/services/mocks';
import { useSession } from '@/services/auth/session';
import { keepPushTokenSaved } from '@/services/notifications/notificationsApi';
import { ThemeProvider, fontAssets, useTheme } from '@/ui';

const queryClient = new QueryClient();

/** Keeps per-person data in step with who is signed in. */
function useSessionEffects() {
  const userId = useSession((s) => s.userId);
  useEffect(() => {
    if (userId) {
      void useHousehold.getState().load(userId);
      void useWearer.getState().load(userId);
    } else {
      useHousehold.getState().unload();
      useWearer.getState().unload();
      queryClient.clear(); // never show one person's data to the next
    }
  }, [userId]);
  // Save this phone for alerts on every app start after sign-in, and when the phone renews its push token.
  useEffect(() => (userId ? keepPushTokenSaved() : undefined), [userId]);
  // Wearers get the large-text theme (same screens, same button sizes).
  const role = useHousehold((s) => s.role);
  useEffect(() => {
    useSettings.getState().setThemeMode(role === 'wearer' ? 'wearer' : 'caregiver');
  }, [role]);
  // The wearer's phone asks for the reminder schedule now, every 5 minutes, and when the app comes back.
  const householdId = useHousehold((s) => s.householdId);
  const active = useHousehold((s) => s.hasActiveDevice);
  // On the web any member of the household reads it too, so the open page can alert (useReminderAlerts).
  const wearerPhone = role === 'wearer' && active;
  const webMember = Platform.OS === 'web' && !!role;
  useScheduleSync(
    userId && (wearerPhone || webMember) && householdId && householdId !== DRAFT_HOUSEHOLD_ID
      ? householdId
      : undefined,
  );
  useReminderAlerts();
}

function Screens() {
  const theme = useTheme();
  const status = useSession((s) => s.status);
  const signedIn = status === 'signedIn';
  const needsPhone = useSession((s) => s.status === 'signedIn' && s.method === 'google' && !s.mobile);
  useSessionEffects();
  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.canvas } }}>
        <Stack.Screen name="index" />
        {/* Auth guard: each group is reachable only in the state it belongs to. */}
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={needsPhone}>
          <Stack.Screen name="add-phone" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !needsPhone}>
          <Stack.Screen name="intro" />
          <Stack.Screen name="home" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="alerts" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="manage-apps" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="role" />
          <Stack.Screen name="caregiver-permissions" />
          <Stack.Screen name="wearer/permissions" />
          <Stack.Screen name="wearer/about" />
          <Stack.Screen name="wearer/claim" />
          <Stack.Screen name="wearer/pair" />
          <Stack.Screen name="wearer/check" />
          <Stack.Screen name="wearer/contacts" />
          <Stack.Screen name="wearer/contact" />
          <Stack.Screen name="wearer/invite" />
          <Stack.Screen name="wearer/drill" />
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Screen name="(dev)/components" />
      </Stack>
      <DueBanner />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      if (env.useMocks) await startMocks();
      await Promise.all([restoreLanguage(), restoreDisplayScale(), useSession.getState().restore()]);
      setReady(true);
    })();
  }, []);

  if (!fontsLoaded || !ready) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Screens />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
