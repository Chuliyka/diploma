import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { BASE_URL } from '../constants/api';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { updatePresence } from '../utils/presence';
import { clearSession } from '../utils/session';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const GENDER_OPTIONS = ['Чоловік', 'Жінка'] as const;

type UserProfile = {
  id: number;
  name: string | null;
  birthDate: string | null;
  gender: string | null;
  about: string | null;
  photoUrl: string | null;
  phoneNumber: string | null;
  interests: { interest: { id: number; name: string } }[];
};

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export default function ProfileScreen() {
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [editGender, setEditGender] = useState<(typeof GENDER_OPTIONS)[number] | ''>('');
  const [editBirthDate, setEditBirthDate] = useState<Date | null>(null);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);

  const fetchUser = useCallback(async (silent = false) => {
    if (!phoneNumber) return;
    if (!silent) setLoading(true);
    try {
      const r = await fetchWithAuth(`${BASE_URL}/users/by-phone?phoneNumber=${encodeURIComponent(phoneNumber)}`);
      const data = await r.json();
      console.log('[Profile] User data:', JSON.stringify(data, null, 2));
      setUser({ ...data, interests: data.interests ?? [] });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [phoneNumber]);

  const onRefresh = () => {
    console.log('[Profile] Pull-to-refresh triggered — reloading user:', phoneNumber);
    setRefreshing(true);
    fetchUser(true);
  };

  const handleLogout = () => {
    Alert.alert('Вийти', 'Ти впевнений, що хочеш вийти?', [
      { text: 'Скасувати', style: 'cancel' },
      {
        text: 'Вийти',
        style: 'destructive',
        onPress: async () => {
          if (phoneNumber) {
            await updatePresence(phoneNumber, false);
          }
          await clearSession();
          console.log('[Profile] Logged out');
          router.replace('/');
        },
      },
    ]);
  };

  const handleChangePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Потрібен доступ', 'Дозвольте доступ до галереї у налаштуваннях');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    console.log('[Profile] Selected photo — URI:', asset.uri, '| name:', asset.fileName, '| size:', asset.fileSize, 'bytes | type:', asset.mimeType);
    try {
      setPhotoUploading(true);
      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? 'photo.jpg',
      } as any);
      const res = await fetchWithAuth(
        `${BASE_URL}/users/by-phone/photo?phoneNumber=${encodeURIComponent(phoneNumber ?? '')}`,
        { method: 'POST', body: formData },
      );
      if (!res.ok) throw new Error('Помилка завантаження');
      const updated = await res.json();
      console.log('[Profile] Photo uploaded successfully — server path:', updated.photoUrl, '| full URL:', `${BASE_URL}${updated.photoUrl}`);
      setUser((prev) => prev ? { ...prev, photoUrl: updated.photoUrl } : prev);
    } catch (e: any) {
      Alert.alert('Помилка', e.message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const openEditModal = () => {
    if (!user) return;
    setEditName(user.name ?? '');
    setEditAbout(user.about ?? '');
    setEditGender((GENDER_OPTIONS.find((option) => option === user.gender) ?? '') as (typeof GENDER_OPTIONS)[number] | '');
    setEditBirthDate(user.birthDate ? new Date(user.birthDate) : null);
    setShowBirthDatePicker(false);
    setEditModalVisible(true);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const openGenderPicker = () => {
    Alert.alert('Оберіть стать', '', [
      ...GENDER_OPTIONS.map((option) => ({ text: option, onPress: () => setEditGender(option) })),
      { text: 'Скасувати', style: 'cancel' },
    ]);
  };

  const handleBirthDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowBirthDatePicker(false);
    }
    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }
    setEditBirthDate(selectedDate);
  };

  const handleSaveProfile = async () => {
    if (!phoneNumber) return;

    try {
      setSavingProfile(true);
      const payload: Record<string, string> = {
        name: editName.trim(),
        about: editAbout.trim(),
        gender: editGender,
      };

      if (editBirthDate) {
        payload.birthDate = formatDate(editBirthDate);
      }

      const response = await fetchWithAuth(
        `${BASE_URL}/users/by-phone?phoneNumber=${encodeURIComponent(phoneNumber)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? 'Не вдалося зберегти зміни');
      }

      setUser((prev) => (prev ? { ...prev, ...data } : prev));
      setEditModalVisible(false);
    } catch (e: any) {
      Alert.alert('Помилка', e?.message ?? 'Не вдалося зберегти зміни');
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#9D8DF1" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Не вдалося завантажити профіль</Text>
      </SafeAreaView>
    );
  }

  const age = calcAge(user.birthDate);
  const photoUri = user.photoUrl ? `${BASE_URL}${user.photoUrl}` : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9D8DF1" colors={['#9D8DF1']} />
        }
      >
        <Text style={styles.title}>Твій профіль</Text>

        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.8} disabled={photoUploading}>
            {photoUploading ? (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <ActivityIndicator color="#9D8DF1" />
              </View>
            ) : photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarPlaceholderText}>
                  {user.name ? user.name[0].toUpperCase() : '?'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBadge} activeOpacity={0.8} onPress={handleChangePhoto} disabled={photoUploading}>
            <Text style={styles.editBadgeIcon}>✎</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.nameAge}>
          {user.name ?? 'Без імені'}{age !== null ? `, ${age}` : ''}
        </Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>зустрічі</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>друга</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.interests?.length ?? 0}</Text>
            <Text style={styles.statLabel}>інтересів</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButtonOutline} activeOpacity={0.8} onPress={openEditModal}>
            <Text style={styles.actionButtonOutlineText}>Редагувати</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonFilled} activeOpacity={0.8}>
            <Text style={styles.actionButtonFilledText}>Поділитись профілем</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Вийти з акаунту</Text>
        </TouchableOpacity>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Про себе</Text>
          <Text style={styles.sectionBody}>
            {user.about ?? '—'}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Interests */}
        {(user.interests?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Мої інтереси</Text>
            <View style={styles.tagsRow}>
              {user.interests.map(({ interest }) => (
                <View key={interest.id} style={styles.tag}>
                  <Text style={styles.tagText}>{interest.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setEditModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Редагувати профіль</Text>

            <Text style={styles.modalLabel}>{"Ім'я"}</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={styles.modalInput}
              placeholder="Введіть ім'я"
              placeholderTextColor="#6F8599"
            />

            <Text style={styles.modalLabel}>Про себе</Text>
            <TextInput
              value={editAbout}
              onChangeText={setEditAbout}
              style={[styles.modalInput, styles.modalInputMultiline]}
              placeholder="Коротко про себе"
              placeholderTextColor="#6F8599"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.modalLabel}>Стать</Text>
            <TouchableOpacity style={styles.modalSelect} activeOpacity={0.8} onPress={openGenderPicker}>
              <Text style={[styles.modalSelectText, !editGender && styles.modalSelectPlaceholder]}>
                {editGender || 'Оберіть стать'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Дата народження</Text>
            <TouchableOpacity
              style={styles.modalSelect}
              activeOpacity={0.8}
              onPress={() => setShowBirthDatePicker(true)}
            >
              <Text style={[styles.modalSelectText, !editBirthDate && styles.modalSelectPlaceholder]}>
                {editBirthDate ? formatDate(editBirthDate) : 'Оберіть дату'}
              </Text>
            </TouchableOpacity>

            {showBirthDatePicker && (
              <View style={styles.datePickerWrap}>
                <DateTimePicker
                  value={editBirthDate ?? new Date(2000, 0, 1)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={handleBirthDateChange}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.datePickerDoneButton}
                    onPress={() => setShowBirthDatePicker(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.datePickerDoneText}>Готово</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                activeOpacity={0.8}
                onPress={() => setEditModalVisible(false)}
                disabled={savingProfile}
              >
                <Text style={styles.modalCancelButtonText}>Скасувати</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                activeOpacity={0.8}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveButtonText}>Зберегти</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontFamily: 'Inter',
    fontSize: 16,
    color: '#6A8298',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  title: {
    fontFamily: 'Space Grotesk',
    fontWeight: '700',
    fontSize: 28,
    color: '#19395A',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#CF97EF',
  },
  avatarPlaceholder: {
    backgroundColor: '#EDE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#9D8DF1',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CF97EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadgeIcon: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  nameAge: {
    fontFamily: 'Space Grotesk',
    fontWeight: '600',
    fontSize: 22,
    color: '#19395A',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'Space Grotesk',
    fontWeight: '700',
    fontSize: 22,
    color: '#19395A',
  },
  statLabel: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#6A8298',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E2E2',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  actionButtonOutline: {
    flex: 1,
    height: 40,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: '#9D8DF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonOutlineText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '500',
    color: '#9D8DF1',
  },
  actionButtonFilled: {
    flex: 1,
    height: 40,
    borderRadius: 35,
    backgroundColor: '#CF97EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonFilledText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  section: {
    width: '100%',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Space Grotesk',
    fontWeight: '700',
    fontSize: 18,
    color: '#19395A',
    marginBottom: 8,
  },
  sectionBody: {
    fontFamily: 'Inter',
    fontSize: 15,
    color: '#3A3A3A',
    lineHeight: 22,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#9D8DF1',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tagText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF4D4F',
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FF4D4F',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontFamily: 'Space Grotesk',
    fontSize: 20,
    fontWeight: '700',
    color: '#19395A',
    marginBottom: 12,
  },
  modalLabel: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
    color: '#19395A',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D6DCE3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Inter',
    fontSize: 15,
    color: '#19395A',
    backgroundColor: '#F9FBFF',
  },
  modalInputMultiline: {
    minHeight: 86,
  },
  modalSelect: {
    borderWidth: 1,
    borderColor: '#D6DCE3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F9FBFF',
  },
  modalSelectText: {
    fontFamily: 'Inter',
    fontSize: 15,
    color: '#19395A',
  },
  modalSelectPlaceholder: {
    color: '#6F8599',
  },
  datePickerWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E4E9F0',
    borderRadius: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  datePickerDoneButton: {
    alignSelf: 'flex-end',
    marginRight: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  datePickerDoneText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    color: '#9D8DF1',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
    borderColor: '#9D8DF1',
  },
  modalCancelButtonText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    color: '#9D8DF1',
  },
  modalSaveButton: {
    backgroundColor: '#9D8DF1',
  },
  modalSaveButtonText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
