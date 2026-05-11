import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PURPLE = '#9D8DF1';
const PURPLE_TRACK = '#D4C4F5';
const NAVY = '#19395A';
const BODY = '#25496E';
const ROW_TITLE = '#173753';
const BORDER = '#E4E9F0';
const DANGER = '#FF1F3D';

export default function SecurityScreen() {
  const [incognitoEnabled, setIncognitoEnabled] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/settings');
  };

  const handleBlacklistPress = () => {
    Alert.alert('Незабаром', 'Чорний список ще в розробці.');
  };

  const handleDeleteAccount = () => {
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = () => {
    setDeleteModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerWrap}>
            <Pressable onPress={handleBack} style={styles.backAbs} hitSlop={12}>
              <Ionicons name="chevron-back" size={28} color={NAVY} />
            </Pressable>
            <Text style={styles.pageTitle}>Безпека</Text>
          </View>

          <Text style={styles.subtitle}>Керуйте доступом, сесіями та приватністю</Text>
          <View style={styles.headerDivider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Режим інкогніто</Text>
            <Text style={styles.sectionHint}>Приховайте профіль і активність на карті</Text>

            <View style={styles.incognitoRow}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="eye-off-outline" size={25} color={PURPLE} />
              </View>

              <View style={styles.incognitoTextWrap}>
                <Text style={styles.incognitoTitle}>Інкогніто</Text>
                <Text style={styles.incognitoText}>
                  У цьому режимі ваш профіль та активний статус приховані на карті. Ви також не зможете бачити людей поблизу
                </Text>
              </View>

              <Switch
                value={incognitoEnabled}
                onValueChange={setIncognitoEnabled}
                trackColor={{ false: '#E0E0E0', true: PURPLE_TRACK }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E0E0E0"
              />
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.blacklistRow} activeOpacity={0.65} onPress={handleBlacklistPress}>
            <Text style={styles.blacklistTitle}>Чорний список</Text>
            <Ionicons name="chevron-forward" size={28} color={NAVY} />
          </TouchableOpacity>

          <View style={styles.divider} />
        </ScrollView>

        <TouchableOpacity style={styles.deleteButton} activeOpacity={0.65} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Видалити акаунт</Text>
        </TouchableOpacity>

        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setDeleteModalVisible(false)}>
            <Pressable style={styles.deleteModal} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.modalTitle}>Ви впевнені, що хочете видалити акаунт?</Text>
              <Text style={styles.modalDescription}>
                Ця дія є незворотною. Усі ваші дані будуть назавжди видалені з системи StepIn протягом 30 днів
              </Text>

              <TouchableOpacity style={styles.confirmDeleteButton} activeOpacity={0.65} onPress={handleConfirmDelete}>
                <Text style={styles.confirmDeleteText}>Видалити назавжди</Text>
              </TouchableOpacity>

              <View style={styles.modalDivider} />

              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.65}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelText}>Скасувати</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  body: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 32,
  },
  headerWrap: {
    minHeight: 44,
    justifyContent: 'center',
  },
  backAbs: {
    position: 'absolute',
    left: -8,
    top: 2,
    zIndex: 1,
    padding: 8,
  },
  pageTitle: {
    paddingHorizontal: 42,
    fontFamily: 'Space Grotesk',
    fontSize: 30,
    fontWeight: '700',
    color: NAVY,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 22,
    color: BODY,
  },
  headerDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginTop: 18,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontFamily: 'Space Grotesk',
    fontSize: 24,
    fontWeight: '700',
    color: NAVY,
  },
  sectionHint: {
    marginTop: 10,
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 22,
    color: BODY,
  },
  incognitoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 28,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: '#E5DEFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  incognitoTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  incognitoTitle: {
    fontFamily: 'Inter',
    fontSize: 17,
    fontWeight: '700',
    color: ROW_TITLE,
  },
  incognitoText: {
    marginTop: 6,
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 22,
    color: BODY,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginTop: 26,
  },
  blacklistRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  blacklistTitle: {
    flex: 1,
    fontFamily: 'Space Grotesk',
    fontSize: 24,
    fontWeight: '700',
    color: NAVY,
  },
  deleteButton: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 12,
  },
  deleteText: {
    fontFamily: 'Inter',
    fontSize: 17,
    fontWeight: '500',
    color: DANGER,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  deleteModal: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 36,
    paddingTop: 36,
    paddingBottom: 28,
  },
  modalTitle: {
    alignSelf: 'center',
    maxWidth: 300,
    textAlign: 'center',
    fontFamily: 'Space Grotesk',
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '700',
    color: NAVY,
  },
  modalDescription: {
    alignSelf: 'center',
    maxWidth: 320,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Inter',
    fontSize: 14,
    lineHeight: 18,
    color: BODY,
  },
  confirmDeleteButton: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 16,
  },
  confirmDeleteText: {
    textAlign: 'center',
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '500',
    color: DANGER,
  },
  modalDivider: {
    height: 1,
    backgroundColor: BORDER,
  },
  cancelButton: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 12,
  },
  cancelText: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '500',
    color: NAVY,
  },
});