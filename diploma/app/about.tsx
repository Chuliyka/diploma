import { router, useLocalSearchParams } from 'expo-router';
import { BASE_URL } from '../constants/api';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import Slider from '@react-native-community/slider';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AboutScreen() {
  const { phoneNumber, skipPhoto } = useLocalSearchParams<{ phoneNumber: string; skipPhoto?: string }>();
  const MIN_YEAR = 1900;
  const TODAY = new Date();

  const [name, setName] = useState('');
  const [gender, setGender] = useState<'Чоловік' | 'Жінка' | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [draftDate, setDraftDate] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const birthDateLabel = useMemo(() => {
    if (!birthDate) {
      return 'Вибери дату народження';
    }

    return birthDate.toLocaleDateString('uk-UA');
  }, [birthDate]);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const clamp = (value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value));
  };

  const normalizeDate = (year: number, month: number, day: number) => {
    let safeYear = clamp(year, MIN_YEAR, TODAY.getFullYear());
    let safeMonth = clamp(month, 0, 11);

    if (safeYear === TODAY.getFullYear()) {
      safeMonth = Math.min(safeMonth, TODAY.getMonth());
    }

    const maxDayByMonth = getDaysInMonth(safeYear, safeMonth);
    const maxDayByToday =
      safeYear === TODAY.getFullYear() && safeMonth === TODAY.getMonth() ? TODAY.getDate() : maxDayByMonth;
    const safeDay = clamp(day, 1, Math.min(maxDayByMonth, maxDayByToday));

    return new Date(safeYear, safeMonth, safeDay);
  };

  const openDatePicker = () => {
    setDraftDate(birthDate ?? new Date(2000, 0, 1));
    setShowDatePicker(true);
  };

  const changeDraftDay = (nextDay: number) => {
    setDraftDate(normalizeDate(draftDate.getFullYear(), draftDate.getMonth(), Math.round(nextDay)));
  };

  const changeDraftMonth = (nextMonth: number) => {
    setDraftDate(normalizeDate(draftDate.getFullYear(), Math.round(nextMonth), draftDate.getDate()));
  };

  const changeDraftYear = (nextYear: number) => {
    setDraftDate(normalizeDate(Math.round(nextYear), draftDate.getMonth(), draftDate.getDate()));
  };

  const confirmDate = () => {
    setBirthDate(draftDate);
    setShowDatePicker(false);
  };

  const formatTwoDigits = (value: number) => {
    return String(value).padStart(2, '0');
  };

  const openGenderSelect = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Скасувати', 'Чоловік', 'Жінка'],
          cancelButtonIndex: 0,
          userInterfaceStyle: 'light',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            setGender('Чоловік');
          }

          if (buttonIndex === 2) {
            setGender('Жінка');
          }
        }
      );
      return;
    }

    Alert.alert('Вибери стать', undefined, [
      {
        text: 'Чоловік',
        onPress: () => setGender('Чоловік'),
      },
      {
        text: 'Жінка',
        onPress: () => setGender('Жінка'),
      },
      {
        text: 'Скасувати',
        style: 'cancel',
      },
    ]);
  };

  const currentMaxMonth = draftDate.getFullYear() === TODAY.getFullYear() ? TODAY.getMonth() : 11;
  const currentMaxDay =
    draftDate.getFullYear() === TODAY.getFullYear() && draftDate.getMonth() === TODAY.getMonth()
      ? TODAY.getDate()
      : getDaysInMonth(draftDate.getFullYear(), draftDate.getMonth());

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Помилка', 'Введіть своє ім\'я');
      return;
    }
    if (!birthDate) {
      Alert.alert('Помилка', 'Оберіть дату народження');
      return;
    }
    if (!gender) {
      Alert.alert('Помилка', 'Оберіть стать');
      return;
    }
    try {
      setLoading(true);
      console.log('[About] Saving profile for phone:', phoneNumber, { name, birthDate, gender });
      const response = await fetchWithAuth(
        `${BASE_URL}/users/by-phone?phoneNumber=${encodeURIComponent(phoneNumber)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            birthDate: birthDate.toISOString().split('T')[0],
            gender,
          }),
        }
      );
      const data = await response.json();
      console.log('[About] Response status:', response.status, 'body:', data);
      if (!response.ok) {
        throw new Error(data.message || 'Помилка збереження');
      }
      if (skipPhoto === '1') {
        console.log('[About] Profile saved, skipPhoto=1 — navigating to /interests');
        router.push({ pathname: './interests', params: { phoneNumber } });
      } else {
        console.log('[About] Profile saved, navigating to /photo');
        router.push({ pathname: './photo', params: { phoneNumber } });
      }
    } catch (e: any) {
      console.error('[About] Error:', e.message);
      Alert.alert('Помилка', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <Text style={styles.title}>Розкажи трохи про{`\n`}себе</Text>

        <Text style={styles.subtitle}>Це допоможе людям поруч{`\n`}зрозуміти, хто ти.</Text>

        <View style={styles.fields}>
          <TextInput
            style={styles.input}
            placeholder="Введи своє ім’я"
            placeholderTextColor="#6F8599"
            autoCorrect={false}
            value={name}
            onChangeText={setName}
          />

          <TouchableOpacity style={styles.input} activeOpacity={0.8} onPress={openDatePicker}>
            <Text style={[styles.inputText, !birthDate && styles.placeholderText]}>{birthDateLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.input} activeOpacity={0.8} onPress={openGenderSelect}>
            <View style={styles.inputRow}>
              <Text style={[styles.inputText, !gender && styles.placeholderText]}>{gender ?? 'Вибери стать'}</Text>
              <Text style={styles.selectArrow}>▼</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomArea}>
          <TouchableOpacity style={styles.submitButton} activeOpacity={0.8} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Продовжити</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Дата народження</Text>

            <View style={styles.sliderBlock}>
              <View style={styles.sliderHeader}>
                <Text style={styles.dateLabel}>День</Text>
                <Text style={styles.dateValue}>{formatTwoDigits(draftDate.getDate())}</Text>
              </View>
              <Slider
                value={draftDate.getDate()}
                minimumValue={1}
                maximumValue={currentMaxDay}
                step={1}
                minimumTrackTintColor="#9D8DF1"
                maximumTrackTintColor="#E3DAFF"
                thumbTintColor="#9D8DF1"
                onValueChange={changeDraftDay}
              />
            </View>

            <View style={styles.sliderBlock}>
              <View style={styles.sliderHeader}>
                <Text style={styles.dateLabel}>Місяць</Text>
                <Text style={styles.dateValue}>{formatTwoDigits(draftDate.getMonth() + 1)}</Text>
              </View>
              <Slider
                value={draftDate.getMonth()}
                minimumValue={0}
                maximumValue={currentMaxMonth}
                step={1}
                minimumTrackTintColor="#9D8DF1"
                maximumTrackTintColor="#E3DAFF"
                thumbTintColor="#9D8DF1"
                onValueChange={changeDraftMonth}
              />
            </View>

            <View style={styles.sliderBlock}>
              <View style={styles.sliderHeader}>
                <Text style={styles.dateLabel}>Рік</Text>
                <Text style={styles.dateValue}>{draftDate.getFullYear()}</Text>
              </View>
              <Slider
                value={draftDate.getFullYear()}
                minimumValue={MIN_YEAR}
                maximumValue={TODAY.getFullYear()}
                step={1}
                minimumTrackTintColor="#9D8DF1"
                maximumTrackTintColor="#E3DAFF"
                thumbTintColor="#9D8DF1"
                onValueChange={changeDraftYear}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalAction} activeOpacity={0.8} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalActionText}>Скасувати</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary]} activeOpacity={0.8} onPress={confirmDate}>
                <Text style={[styles.modalActionText, styles.modalActionTextPrimary]}>Готово</Text>
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
    paddingHorizontal: 24,
    paddingTop: 96,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  title: {
    textAlign: 'center',
    fontFamily: 'Space Grotesk',
    fontWeight: '700',
    fontSize: 32,
    lineHeight: 40,
    color: '#19395A',
  },
  subtitle: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: '#25496E',
  },
  fields: {
    marginTop: 36,
    gap: 14,
  },
  input: {
    width: 343,
    height: 40,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: '#9D8DF1',
    paddingHorizontal: 14,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    color: '#244768',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  inputText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    color: '#244768',
  },
  placeholderText: {
    color: '#6F8599',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectArrow: {
    fontFamily: 'Inter',
    fontSize: 11,
    color: '#6F8599',
  },
  bottomArea: {
    marginTop: 'auto',
    marginBottom: 20,
    alignItems: 'center',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 343,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
  },
  modalTitle: {
    fontFamily: 'Inter',
    fontWeight: '600',
    fontSize: 18,
    color: '#1E1E1E',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  sliderBlock: {
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 12,
    color: '#6F8599',
    marginBottom: 4,
  },
  dateValue: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 16,
    color: '#1E1E1E',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  modalAction: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6D6D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionPrimary: {
    borderColor: '#9D8DF1',
    backgroundColor: '#F4EEFF',
  },
  modalActionText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    color: '#4A4A4A',
  },
  modalActionTextPrimary: {
    color: '#5A46C4',
  },
});
