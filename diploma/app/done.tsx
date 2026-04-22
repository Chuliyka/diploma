import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveSession } from '../utils/session';
import { updatePresence } from '../utils/presence';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { BASE_URL } from '../constants/api';

export default function DoneScreen() {
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();

  const askToUseLocation = () =>
    new Promise<boolean>((resolve) => {
      Alert.alert(
        'Доступ до геолокації',
        'Дозволь доступ до координат, щоб показувати людей поруч.',
        [
          { text: 'Не зараз', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Дозволити', onPress: () => resolve(true) },
        ],
      );
    });

  const showDeniedHelp = () => {
    Alert.alert('Доступ вимкнено', 'Увімкни доступ до локації в налаштуваннях пристрою.', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Відкрити налаштування',
        onPress: () => {
          Linking.openSettings().catch((error) => {
            console.warn('[Done] Failed to open settings:', error);
          });
        },
      },
    ]);
  };

  const requestAndSaveLocation = async () => {
    if (!phoneNumber) return;

    const Location = await import('expo-location').catch((error) => {
      console.warn('[Done] expo-location module is unavailable in current build:', error);
      return null;
    });

    if (!Location) {
      return;
    }

    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;

      if (status !== 'granted') {
        const shouldAsk = await askToUseLocation();
        if (!shouldAsk) {
          console.log('[Done] User skipped location permission prompt');
          return;
        }

        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }

      if (status !== 'granted') {
        console.log('[Done] Location permission denied by user');
        showDeniedHelp();
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await fetchWithAuth(
        `${BASE_URL}/users/by-phone?phoneNumber=${encodeURIComponent(phoneNumber)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          }),
        },
      );
      console.log('[Done] User coordinates saved');
    } catch (error) {
      console.warn('[Done] Failed to get/save user location:', error);
    }
  };

  const handleGoToProfile = async () => {
    try {
      await requestAndSaveLocation();
      await fetchWithAuth(
        `${BASE_URL}/users/by-phone?phoneNumber=${encodeURIComponent(phoneNumber)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRegistered: true }),
        },
      );
      await saveSession(phoneNumber);
      await updatePresence(phoneNumber, true);
      router.replace({ pathname: '/(tabs)/profile', params: { phoneNumber } });
    } catch (error) {
      console.warn('[Done] Failed to move to profile:', error);
      router.replace({ pathname: '/(tabs)/profile', params: { phoneNumber } });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Готово!</Text>

      <Text style={styles.subtitle}>
        Тепер ти можеш бачити людей поруч і{`\n`}
        знайомитись у реальному житті.
      </Text>

      <View style={styles.bottomArea}>
        <TouchableOpacity
          style={styles.submitButton}
          activeOpacity={0.8}
          onPress={handleGoToProfile}>
          <Text style={styles.submitText}>Мій профіль</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 96,
    alignItems: 'center',
  },
  title: {
    marginTop: 40,
    fontFamily: 'Space Grotesk',
    fontWeight: '700',
    fontSize: 48,
    lineHeight: 54,
    color: '#000000',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 34,
    color: '#1E1E1E',
  },
  bottomArea: {
    marginTop: 'auto',
    marginBottom: 20,
    alignItems: 'center',
    width: '100%',
  },
  submitButton: {
    width: 237,
    height: 40,
    borderRadius: 35,
    backgroundColor: '#CF97EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22,
  },
});
