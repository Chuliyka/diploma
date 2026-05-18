import { AppButton } from '@/components/ui/app-button';
import { AppTextField } from '@/components/ui/app-text-field';
import { UserStatusSelector } from '@/components/profile/status-selector';
import { SelectField } from '@/components/ui/select-field';
import { useLocalSearchParams } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { BASE_URL } from '@/constants/api';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { getSession } from '@/utils/session';
import { uploadProfilePhoto } from '@/utils/uploadProfilePhoto';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
  status: string | null;
  photoUrl: string | null;
  phoneNumber: string | null;
  interests: { interest: { id: number; name: string } }[];
  meetsCount?: number;
  friendsCount?: number;
  statusEmoji?: string | null;
};

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

type ProfileScreenProps = {
  scrollBottomInset?: number;
};

const DEFAULT_SCROLL_BOTTOM_INSET = 40;

export default function ProfileScreen({ scrollBottomInset }: ProfileScreenProps) {
  const { phoneNumber: phoneNumberParam } = useLocalSearchParams<{ phoneNumber?: string }>();
  const [sessionKey, setSessionKey] = useState<string | null>(phoneNumberParam ?? null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoCacheKey, setPhotoCacheKey] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [editGender, setEditGender] = useState<(typeof GENDER_OPTIONS)[number] | ''>('');
  const [editBirthDate, setEditBirthDate] = useState<Date | null>(null);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);

  const profileKey = sessionKey ?? user?.phoneNumber ?? phoneNumberParam ?? null;

  useEffect(() => {
    if (phoneNumberParam) {
      setSessionKey(phoneNumberParam);
      return;
    }

    getSession()
      .then((stored) => setSessionKey(stored))
      .catch(() => setSessionKey(null));
  }, [phoneNumberParam]);

  const fetchUser = useCallback(async (silent = false) => {
    if (!profileKey) return;
    if (!silent) setLoading(true);
    try {
      const r = await fetchWithAuth(`${BASE_URL}/users/by-phone?phoneNumber=${encodeURIComponent(profileKey)}`);
      const data = await r.json();
      console.log('[Profile] User data:', JSON.stringify(data, null, 2));
      setUser({ ...data, interests: data.interests ?? [] });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileKey]);

  const onRefresh = () => {
    console.log('[Profile] Pull-to-refresh triggered — reloading user:', profileKey);
    setRefreshing(true);
    fetchUser(true);
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
      if (!profileKey) {
        Alert.alert('Помилка', 'Не вдалося визначити користувача для завантаження фото');
        return;
      }

      setPhotoUploading(true);
      const updated = await uploadProfilePhoto({
        phoneNumber: profileKey,
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
      });
      console.log('[Profile] Photo uploaded — path:', updated.photoUrl, '| url:', `${BASE_URL}${updated.photoUrl}`);
      setPhotoCacheKey(Date.now());
      setUser((prev) => (prev ? { ...prev, photoUrl: updated.photoUrl } : prev));
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
    if (!profileKey) return;

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
        `${BASE_URL}/users/by-phone?phoneNumber=${encodeURIComponent(profileKey)}`,
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

  const handleSelectStatus = async (status: string) => {
    if (!profileKey) return;

    try {
      setSavingStatus(true);
      const response = await fetchWithAuth(
        `${BASE_URL}/users/by-phone?phoneNumber=${encodeURIComponent(profileKey)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? 'Не вдалося змінити статус');
      }

      setUser((prev) => (prev ? { ...prev, ...data } : prev));
      setStatusModalVisible(false);
    } catch (e: any) {
      Alert.alert('Помилка', e?.message ?? 'Не вдалося змінити статус');
    } finally {
      setSavingStatus(false);
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
  const photoUri = user.photoUrl
    ? `${BASE_URL}${user.photoUrl}${user.photoUrl.includes('?') ? '&' : '?'}v=${photoCacheKey}`
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollBottomInset ?? DEFAULT_SCROLL_BOTTOM_INSET },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9D8DF1" colors={['#9D8DF1']} />
        }
      >
        <Text style={styles.title}>Твій профіль</Text>

        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarRingPurple}>
            <View style={styles.avatarRingWhite}>
              <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.8} disabled={photoUploading}>
                {photoUploading ? (
                  <View style={[styles.avatarInner, styles.avatarPlaceholder]}>
                    <ActivityIndicator color="#9D8DF1" />
                  </View>
                ) : photoUri ? (
                  <Image key={photoUri} source={{ uri: photoUri }} style={styles.avatarInner} />
                ) : (
                  <View style={[styles.avatarInner, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarPlaceholderText}>
                      {user.name ? user.name[0].toUpperCase() : '?'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.editBadge} activeOpacity={0.8} onPress={handleChangePhoto} disabled={photoUploading}>
            <Text style={styles.editBadgeIcon}>✎</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.nameAge}>
          {user.name ?? 'Без імені'}{age !== null ? `, ${age}` : ''}
        </Text>

        <UserStatusSelector
          value={user.status}
          visible={statusModalVisible}
          saving={savingStatus}
          onOpen={() => setStatusModalVisible(true)}
          onClose={() => setStatusModalVisible(false)}
          onSelect={handleSelectStatus}
        />

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.meetsCount ?? 0}</Text>
            <Text style={styles.statLabel}>зустрічі</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.friendsCount ?? 0}</Text>
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
          <AppButton variant="outline" title="Редагувати" shape="pill" onPress={openEditModal} style={{ flex: 1 }} />
          <AppButton variant="primary" title="Поділитись профілем" shape="pill" onPress={() => {}} style={{ flex: 1 }} />
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Про себе</Text>
          <Text style={styles.sectionBody}>{user.about ?? '—'}</Text>
        </View>

        <View style={styles.divider} />

        {/* Interests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Мої інтереси</Text>
          {(user.interests?.length ?? 0) > 0 ? (
            <View style={styles.tagsRow}>
              {user.interests.map(({ interest }) => (
                <View key={interest.id} style={styles.tag}>
                  <Text
                    style={styles.tagText}
                    {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
                  >
                    {interest.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.interestsEmpty}>Ще немає обраних інтересів</Text>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            Keyboard.dismiss();
            setEditModalVisible(false);
          }}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(event) => {
              event.stopPropagation();
              Keyboard.dismiss();
            }}
          >
            <Text style={styles.modalTitle}>Редагувати профіль</Text>

            <AppTextField
              label={"Ім'я"}
              value={editName}
              onChangeText={setEditName}
              placeholder="Введіть ім'я"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <AppTextField
              label="Про себе"
              value={editAbout}
              onChangeText={setEditAbout}
              placeholder="Коротко про себе"
              multiline
            />

            <SelectField
              label="Стать"
              value={editGender}
              placeholder="Оберіть стать"
              onPress={openGenderPicker}
            />

            <SelectField
              label="Дата народження"
              value={editBirthDate ? formatDate(editBirthDate) : ''}
              placeholder="Оберіть дату"
              onPress={() => setShowBirthDatePicker(true)}
            />

            {showBirthDatePicker && (
              <View style={styles.datePickerWrap}>
                <View style={styles.datePickerWheelSlot}>
                  <DateTimePicker
                    value={editBirthDate ?? new Date(2000, 0, 1)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    onChange={handleBirthDateChange}
                    {...(Platform.OS === 'ios'
                      ? {
                          themeVariant: 'light' as const,
                          textColor: '#19395A',
                          style: styles.iosWheelPicker,
                        }
                      : {})}
                  />
                </View>
                {Platform.OS === 'ios' && (
                  <View style={styles.datePickerDoneRow}>
                    <TouchableOpacity
                      style={styles.datePickerDoneButton}
                      onPress={() => setShowBirthDatePicker(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.datePickerDoneText}>Готово</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <View style={styles.modalActions}>
              <AppButton
                variant="outline"
                title="Скасувати"
                onPress={() => setEditModalVisible(false)}
                disabled={savingProfile}
                style={{ flex: 1 }}
              />
              <AppButton
                variant="primary"
                title="Зберегти"
                onPress={handleSaveProfile}
                loading={savingProfile}
                style={{ flex: 1 }}
              />
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
  },
  title: {
    fontFamily: 'Space Grotesk',
    fontWeight: '700',
    fontSize: 28,
    color: '#19395A',
    marginBottom: 24,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
    alignSelf: 'center',
    width: 132,
    height: 132,
  },
  avatarRingPurple: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#9D8DF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingWhite: {
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#9D8DF1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  editBadgeIcon: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '600',
    transform: [{ rotate: '100deg' }],
  },
  nameAge: {
    fontFamily: 'Space Grotesk',
    fontWeight: '600',
    fontSize: 22,
    color: '#19395A',
    marginBottom: 12,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  statusLabel: {
    fontFamily: 'Inter',
    fontSize: 15,
    color: '#25496E',
  },
  statusBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusEmoji: {
    fontSize: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
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
    height: 36,
    backgroundColor: '#E8E8E8',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    width: '100%',
    alignSelf: 'stretch',
  },
  section: {
    width: '100%',
    marginVertical: 5,
  },
  sectionTitle: {
    fontFamily: 'Space Grotesk',
    fontWeight: '700',
    fontSize: 18,
    color: '#19395A',
    marginBottom: 10,
    textAlign: 'left',
  },
  sectionBody: {
    fontFamily: 'Inter',
    fontSize: 15,
    color: '#25496E',
    lineHeight: 24,
    textAlign: 'left',
  },
  interestsEmpty: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#6A8298',
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
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: 18,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
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
  datePickerWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E4E9F0',
    borderRadius: 10,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    overflow: 'visible',
    alignItems: 'center',
  },
  datePickerWheelSlot: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosWheelPicker: {
    height: 216,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
  },
  datePickerDoneRow: {
    width: '100%',
    alignItems: 'flex-end',
    paddingRight: 4,
    paddingTop: 4,
    paddingBottom: 4,
  },
  datePickerDoneButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
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
});
