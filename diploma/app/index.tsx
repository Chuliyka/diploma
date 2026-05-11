import { router } from 'expo-router';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { BASE_URL } from '../constants/api';
import { updatePresence } from '../utils/presence';
import { saveSession, saveTokens } from '../utils/session';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export default function SignupScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const isExpoGo = Constants.appOwnership === 'expo';
  const googleNativeRedirectUri = makeRedirectUri({ scheme: 'diploma', path: 'oauthredirect' });

  const [googleNativeRequest, googleNativeResponse, googleNativePromptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    redirectUri: googleNativeRedirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  const googleResponse = googleNativeResponse;
  const googleRequest = googleNativeRequest;

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.authentication?.idToken;
    if (!idToken) { Alert.alert('Помилка', 'Google не повернув токен'); return; }
    console.log('[Google] Got id_token, sending to backend...');
    (async () => {
      try {
        setLoading(true);
        const response = await fetch(`${BASE_URL}/users/google-auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          console.log('[Google] Auth failed:', response.status, payload);
          throw new Error(payload?.message || 'Google auth failed');
        }

        if (
          typeof payload?.id !== 'number'
          || typeof payload?.accessToken !== 'string'
          || typeof payload?.refreshToken !== 'string'
        ) {
          console.log('[Google] Invalid success payload:', payload);
          throw new Error('Некоректна відповідь сервера');
        }

        console.log('[Google] Auth success, user:', payload);
        console.log(
          `[Google] isRegistered=${payload.isRegistered} | isNewUser=${payload.isNewUser} | needsOnboarding=${payload.needsOnboarding}`
        );
        const sessionKey = payload.phoneNumber ?? `google:${payload.id}`;
        await saveTokens(payload.accessToken, payload.refreshToken);
        if (payload.isRegistered === false || payload.needsOnboarding) {
          console.log('[Google] Redirecting to onboarding (about screen)');
          // Don't saveSession yet — save it only after onboarding completes in done.tsx
          router.replace({ pathname: '/about', params: { phoneNumber: sessionKey, skipPhoto: '1' } });
        } else {
          console.log('[Google] Existing user with complete profile — redirecting to profile');
          await saveSession(sessionKey);
          await updatePresence(sessionKey, true);
          router.replace({ pathname: '/(tabs)/profile', params: { phoneNumber: sessionKey } });
        }
      } catch (e: any) {
        Alert.alert('Помилка', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [googleResponse]);

  const handleSubmit = async () => {
    const phoneNumber = '+380' + phone.replace(/\D/g, '');
    console.log('[SendCode] Attempting with phone:', phoneNumber);
    if (phone.replace(/\D/g, '').length < 9) {
      console.warn('[SendCode] Validation failed: phone too short');
      Alert.alert('Помилка', 'Введіть коректний номер телефону');
      return;
    }
    try {
      setLoading(true);

      // Check if user already exists
      console.log('[SendCode] Checking if user exists...');
      const checkRes = await fetch(
        `${BASE_URL}/users/by-phone?phoneNumber=${encodeURIComponent(phoneNumber)}`,
      );
      if (checkRes.ok) {
        const existing = await checkRes.json();
        console.log('[SendCode] Existing user found:', existing);
        if (existing?.isRegistered === false) {
          console.log('[SendCode] User has unfinished onboarding — redirecting to /about');
          router.replace({ pathname: '/about', params: { phoneNumber } });
          return;
        }
        console.log('[SendCode] Existing user found — logging in without SMS verification...');
        const response = await fetch(`${BASE_URL}/users/phone/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber }),
        });
        const data = await response.json().catch(() => ({}));
        console.log('[SendCode] Existing user login response:', response.status, data);
        if (!response.ok) {
          throw new Error(data.message || 'Помилка авторизації');
        }
        if (typeof data?.accessToken !== 'string' || typeof data?.refreshToken !== 'string') {
          throw new Error('Сервер не повернув токени авторизації');
        }

        await saveTokens(data.accessToken, data.refreshToken);
        await saveSession(phoneNumber);
        await updatePresence(phoneNumber, true);
        router.replace({ pathname: '/(tabs)/profile', params: { phoneNumber } });
        return;
      }

      // New user — send SMS code
      console.log('[SendCode] User not found, sending POST /users/phone/send-code...');
      const response = await fetch(`${BASE_URL}/users/phone/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await response.json();
      console.log('[SendCode] Response status:', response.status, 'body:', data);
      if (!response.ok) {
        throw new Error(data.message || 'Помилка відправки коду');
      }
      console.log('[SendCode] Success — navigating to verify screen');
      router.push({ pathname: '/verify', params: { phoneNumber } });
    } catch (e: any) {
      console.error('[SendCode] Error:', e.message);
      Alert.alert('Помилка', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Почнемо{`\n`}знайомитись</Text>

      <Text style={styles.subtitle}>
        Створи акаунт за хвилину і знаходь{`\n`}людей поруч для кави, прогулянок або{`\n`}спонтанних зустрічей.
      </Text>

      <View style={styles.inputRow}>
        <Text style={styles.flag}>🇺🇦</Text>
        <TextInput
          placeholder="Введіть номер телефону"
          style={styles.input}
          placeholderTextColor="#9C9C9C"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={13}
        />
      </View>

      <View style={styles.separatorRow}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>або</Text>
        <View style={styles.separatorLine} />
      </View>

      <TouchableOpacity
        style={styles.socialButton}
        activeOpacity={0.8}
        onPress={async () => {
          try {
            if (isExpoGo) {
              Alert.alert(
                'Google вхід у Expo Go',
                'Для Expo SDK 54 Google OAuth через proxy нестабільний у Expo Go. Використай Development Build через npx expo run:ios або EAS Dev Client.'
              );
              return;
            }
            console.log('[Google][DevBuild] redirectUri:', googleNativeRedirectUri);
            await googleNativePromptAsync();
          } catch (e: any) {
            Alert.alert('Помилка Google входу', e?.message ?? 'Не вдалося відкрити Google авторизацію');
          }
        }}
        disabled={!googleRequest || loading}
      >
        <Text style={styles.socialIcon}>G</Text>
        <Text style={styles.socialText}>Продовжити з Google</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
        <Text style={styles.socialIcon}></Text>
        <Text style={styles.socialText}>Продовжити з Apple</Text>
      </TouchableOpacity>

      <View style={styles.bottomArea}>

        <Text style={styles.terms}>
          Продовжуючи, ви погоджуєтесь з нашими Terms of{`\n`}Service та Privacy Policy
        </Text>

        <TouchableOpacity style={styles.submitButton} activeOpacity={0.8} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Ввести</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 36,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'Space Grotesk',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    marginTop: 30,
    color: '#000000',
  },
  subtitle: {
    textAlign: 'center',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 30,
    color: '#1E1E1E',
    marginTop: 22,
    marginBottom: 30,
  },
  inputRow: {
    width: 327,
    height: 40,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 35,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    alignSelf: 'center',
  },
  flag: {
    fontSize: 22,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    color: '#161616',
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E2E2',
  },
  separatorText: {
    marginHorizontal: 14,
    color: '#8A8A8A',
    fontSize: 18,
  },
  socialButton: {
    width: 327,
    height: 40,
    borderRadius: 35,
    backgroundColor: '#EEEEEE',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 10,
  },
  socialIcon: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000000',
    width: 26,
    textAlign: 'center',
  },
  socialText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#101010',
    fontWeight: '500',
  },
  bottomArea: {
    marginTop: 'auto',
    marginBottom: 20,
    alignItems: 'center',
  },
  logo: {
    width: 180,
    height: 60,
    marginBottom: 14,
  },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    color: '#7A7A7A',
    marginBottom: 12,
    lineHeight: 17,
  },
  submitButton: {
    width: 237,
    height: 40,
    borderRadius: 26,
    backgroundColor: '#0E3766',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
  },
});
