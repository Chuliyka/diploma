import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getSession } from '../utils/session';
import { updatePresence } from '../utils/presence';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const syncPresenceFromStorage = async (isOnline: boolean) => {
      const sessionKey = await getSession();
      if (!sessionKey) return;
      await updatePresence(sessionKey, isOnline);
    };

    getSession().then((phone) => {
      if (phone) {
        void syncPresenceFromStorage(true);
        console.log('[Layout] Existing session found, redirecting to profile:', phone);
        router.replace({ pathname: '/(tabs)/profile', params: { phoneNumber: phone } });
      } else {
        console.log('[Layout] No session found, staying on index');
      }
    });

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncPresenceFromStorage(true);
      } else if (state === 'inactive' || state === 'background') {
        void syncPresenceFromStorage(false);
      }
    });

    return () => {
      subscription.remove();
      void syncPresenceFromStorage(false);
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="verify" options={{ headerShown: false }} />
        <Stack.Screen name="about" options={{ headerShown: false }} />
        <Stack.Screen name="photo" options={{ headerShown: false }} />
        <Stack.Screen name="interests" options={{ headerShown: false }} />
        <Stack.Screen name="done" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
