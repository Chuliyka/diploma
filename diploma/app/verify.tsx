import { router, useLocalSearchParams } from 'expo-router';
import { BASE_URL } from '../constants/api';
import { updatePresence } from '../utils/presence';
import { saveSession, saveTokens } from '../utils/session';
import { useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleVerify = async () => {
    const codeStr = code.join('');
    console.log('[VerifyCode] Attempting to verify code for phone:', phoneNumber, '| code:', codeStr);
    if (codeStr.length < CODE_LENGTH) {
      console.warn('[VerifyCode] Validation failed: code too short');
      Alert.alert('Помилка', 'Введіть 6-значний код');
      return;
    }
    try {
      setLoading(true);
      console.log('[VerifyCode] Sending POST /users/phone/verify-code...');
      const response = await fetch(`${BASE_URL}/users/phone/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code: codeStr }),
      });
      const data = await response.json();
      console.log('[VerifyCode] Response status:', response.status, 'body:', data);
      if (!response.ok) {
        throw new Error(data.message || 'Невірний код');
      }
      console.log('[VerifyCode] Success — phone verified, navigating to /about');
      await saveSession(phoneNumber);
      await updatePresence(phoneNumber, true);
      await saveTokens(data.accessToken, data.refreshToken);
      router.replace({ pathname: '/about', params: { phoneNumber } });
    } catch (e: any) {
      console.error('[VerifyCode] Error:', e.message);
      Alert.alert('Помилка', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    console.log('[Resend] Resending code to:', phoneNumber);
    try {
      const response = await fetch(`${BASE_URL}/users/phone/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      console.log('[Resend] Response status:', response.status);
      Alert.alert('Код надіслано', 'Перевірте SMS');
    } catch (e: any) {
      console.error('[Resend] Error:', e.message);
      Alert.alert('Помилка', 'Не вдалося надіслати код');
    }
  };

  const handleChange = (value: string, index: number) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextCode = [...code];
    nextCode[index] = digit;
    setCode(nextCode);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <Text style={styles.title}>Введи код</Text>
        <Text style={styles.subtitle}>Ми надіслали SMS з кодом{`\n`}підтвердження на {phoneNumber}.</Text>

        <View style={styles.codeRow}>
          {Array.from({ length: CODE_LENGTH }).map((_, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={styles.codeCell}
              value={code[index]}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={1}
              autoCorrect={false}
              autoCapitalize="none"
              textAlign="center"
            />
          ))}
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={handleResend}>
          <Text style={styles.resend}>Надіслати ще раз?</Text>
        </TouchableOpacity>

        <View style={styles.bottomArea}>
            <TouchableOpacity style={styles.submitButton} activeOpacity={0.8} onPress={handleVerify} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Далі</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 120,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'Space Grotesk',
    fontWeight: '700',
    fontSize: 32,
    color: '#000000',
    marginBottom: 16,
  },
  subtitle: {
    textAlign: 'center',
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 16,
    color: '#1E1E1E',
    lineHeight: 28,
  },
  codeRow: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  codeCell: {
    width: 40,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 24,
    color: '#111111',
  },
  resend: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 16,
    color: '#151515',
  },
  bottomArea: {
    marginTop: 'auto',
    marginBottom: 20,
    alignItems: 'center',
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
    fontWeight: '500',
    fontSize: 16,
  },
});
