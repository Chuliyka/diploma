import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { BASE_URL } from '../constants/api';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PhotoScreen() {
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Потрібен доступ до фото', 'Дозволь доступ до фото, щоб завантажити профільне фото.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0]?.uri ?? null);
    }
  };

  const handleSubmit = async () => {
    if (!photoUri) {
      Alert.alert('Помилка', 'Обери фото перед продовженням');
      return;
    }
    try {
      setLoading(true);
      console.log('[Photo] Uploading photo for phone:', phoneNumber);
      const formData = new FormData();
      const filename = photoUri.split('/').pop() ?? 'photo.jpg';
      const match = /\.([a-zA-Z]+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('photo', { uri: photoUri, name: filename, type } as any);

      const response = await fetch(
        `${BASE_URL}/users/by-phone/photo?phoneNumber=${encodeURIComponent(phoneNumber)}`,
        { method: 'POST', body: formData },
      );
      const data = await response.json();
      console.log('[Photo] Response status:', response.status, 'body:', data);
      if (!response.ok) {
        throw new Error(data.message || 'Помилка завантаження фото');
      }
      console.log('[Photo] Photo saved at:', data.photoUrl);
      router.push({ pathname: './interests', params: { phoneNumber } });
    } catch (e: any) {
      console.error('[Photo] Error:', e.message);
      Alert.alert('Помилка', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Додай фото</Text>

      <Text style={styles.subtitle}>
        Завантаж принаймні одне реальне фото.{`\n`}
        Людям легше знайомитись, коли вони{`\n`}
        бачать, з ким говорять.
      </Text>

      <TouchableOpacity style={styles.uploadCard} activeOpacity={0.85} onPress={pickProfilePhoto}>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.previewImage} /> : <Text style={styles.plus}>+</Text>}
      </TouchableOpacity>

      <Text style={styles.hint}>Можливо знадобиться швидке селфі для{`\n`}підтвердження профілю.</Text>

      <View style={styles.bottomArea}>
        <TouchableOpacity style={styles.submitButton} activeOpacity={0.8} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Далі</Text>}
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
    fontSize: 48,
    lineHeight: 54,
    color: '#19395A',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 34,
    color: '#25496E',
  },
  uploadCard: {
    marginTop: 30,
    width: 260,
    height: 260,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: '#A696FF',
    borderStyle: 'dashed',
    backgroundColor: '#F2F2FA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  plus: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 44,
    lineHeight: 48,
    color: '#25496E',
  },
  hint: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 22,
    color: '#6A8298',
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
