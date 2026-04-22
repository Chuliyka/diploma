import { router, useLocalSearchParams } from 'expo-router';
import { BASE_URL } from '../constants/api';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MAX_SELECTED = 5;

const INTERESTS = [
  'Спорт',
  '🎾 Теніс / Бадмінтон',
  '🏃 Біг',
  '🚲 Велопрогулянки',
  '🧘 Йога / Пілатес',
  '🛹 Скейтбординг / Ролики',
  '🏐 Волейбол / Футбол',
  '🏋️ Фітнес / Зал',
];

export default function InterestsScreen() {
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleToggleInterest = (interest: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((item) => item !== interest);
      }

      if (prev.length >= MAX_SELECTED) {
        return prev;
      }

      return [...prev, interest];
    });
  };

  const handleSubmit = async () => {
    if (selectedInterests.length === 0) {
      Alert.alert('Помилка', 'Обери хоча б один інтерес');
      return;
    }
    try {
      setLoading(true);
      console.log('[Interests] Saving interests for phone:', phoneNumber, selectedInterests);
      const response = await fetch(
        `${BASE_URL}/users/by-phone/interests?phoneNumber=${encodeURIComponent(phoneNumber)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interests: selectedInterests }),
        },
      );
      const data = await response.json();
      console.log('[Interests] Response status:', response.status, 'body:', data);
      if (!response.ok) {
        throw new Error(data.message || 'Помилка збереження інтересів');
      }
      router.push({ pathname: './done', params: { phoneNumber } });
    } catch (e: any) {
      console.error('[Interests] Error:', e.message);
      Alert.alert('Помилка', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Що тобі цікаво?</Text>

      <Text style={styles.subtitle}>
        Обери до 5 інтересів. Так ми{`\n`}
        зможемо знаходити людей поруч, з{`\n`}
        якими буде про що поговорити.
      </Text>

      <View style={styles.list}>
        {INTERESTS.map((interest) => (
          <TouchableOpacity
            key={interest}
            style={[styles.item, selectedInterests.includes(interest) && styles.itemActive]}
            activeOpacity={0.8}
            onPress={() => handleToggleInterest(interest)}>
            <Text style={[styles.itemText, selectedInterests.includes(interest) && styles.itemTextActive]}>{interest}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.bottomArea}>
        <TouchableOpacity style={styles.submitButton} activeOpacity={0.8} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Продовжити</Text>}
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
    fontFamily: 'Space Grotesk',
    fontWeight: '700',
    fontSize: 32,
    lineHeight: 40,
    color: '#19395A',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: '#25496E',
  },
  list: {
    marginTop: 18,
    width: '100%',
    gap: 10,
  },
  item: {
    width: 327,
    height: 40,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: '#9D8DF1',
    justifyContent: 'center',
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  itemActive: {
    backgroundColor: '#9487E8',
    borderColor: '#9487E8',
  },
  itemText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 18,
    color: '#25496E',
  },
  itemTextActive: {
    color: '#FFFFFF',
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
