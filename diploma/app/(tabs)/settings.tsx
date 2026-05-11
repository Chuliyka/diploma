import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotifications } from '@/contexts/notifications';
import { updatePresence } from '@/utils/presence';
import { clearSession } from '@/utils/session';

type SettingsRow = {
  key: string;
  label: string;
  icon: 'ion' | 'mci';
  ionName?: keyof typeof Ionicons.glyphMap;
  mciName?: keyof typeof MaterialCommunityIcons.glyphMap;
};

const SETTINGS_ROWS: SettingsRow[] = [
  { key: 'account', label: 'Акаунт', icon: 'ion', ionName: 'person-outline' },
  { key: 'location', label: 'Локація', icon: 'mci', mciName: 'map-marker-outline' },
  { key: 'notifications', label: 'Сповіщення', icon: 'ion', ionName: 'notifications-outline' },
  { key: 'security', label: 'Безпека', icon: 'ion', ionName: 'lock-closed-outline' },
  { key: 'language', label: 'Мова', icon: 'ion', ionName: 'globe-outline' },
  { key: 'legal', label: 'Правова інформація', icon: 'ion', ionName: 'information-circle-outline' },
];

const ROW_ICON_COLOR = '#9D8DF1';
const ROW_TEXT_COLOR = '#173753';
const ROW_ICON_SIZE = 26;

const TAB_BAR_BOTTOM_OFFSET =36;

export default function SettingsTabScreen() {
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber?: string }>();
  const { unreadCount } = useNotifications();
  const tabBarHeight = useBottomTabBarHeight();
  const footerHeight = tabBarHeight + TAB_BAR_BOTTOM_OFFSET;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (phoneNumber) {
      router.replace({ pathname: '/(tabs)/profile', params: { phoneNumber } });
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  const handleRowPress = (key: string) => {
    if (key === 'location') {
      router.push({
        pathname: '/location-settings',
        ...(phoneNumber ? { params: { phoneNumber } } : {}),
      });
      return;
    }
    if (key === 'notifications') {
      router.push({
        pathname: '/notifications',
        ...(phoneNumber ? { params: { phoneNumber } } : {}),
      });
      return;
    }
    if (key === 'security') {
      router.push({
        pathname: '/security',
        ...(phoneNumber ? { params: { phoneNumber } } : {}),
      });
      return;
    }
    Alert.alert('Незабаром', 'Цей розділ ще в розробці.');
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
          router.replace('/');
        },
      },
    ]);
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
              <Ionicons name="chevron-back" size={28} color="#19395A" />
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>
              Налаштування
            </Text>
          </View>
          <Text style={styles.subtitle}>Керуйте своїм профілем, приватністю та сповіщеннями</Text>

          <View style={styles.list}>
            {SETTINGS_ROWS.map((row) => (
              <View key={row.key}>
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.65}
                  onPress={() => handleRowPress(row.key)}
                >
                  <View style={styles.rowIconWrap}>
                    {row.icon === 'ion' && row.ionName ? (
                      <Ionicons name={row.ionName} size={ROW_ICON_SIZE} color={ROW_ICON_COLOR} />
                    ) : row.mciName ? (
                      <MaterialCommunityIcons name={row.mciName} size={ROW_ICON_SIZE} color={ROW_ICON_COLOR} />
                    ) : null}
                    {row.key === 'notifications' && unreadCount > 0 ? <View style={styles.notificationDot} /> : null}
                  </View>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                </TouchableOpacity>
                <View style={styles.rowDividerInset} />
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.logoutRow} activeOpacity={0.65} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={ROW_ICON_SIZE} color="#6A8298" />
            <Text style={styles.logoutLabel}>Вийти з акаунту</Text>
          </TouchableOpacity>
        </ScrollView>

        <Text style={[styles.version, { marginBottom: footerHeight }]}>Версія {appVersion}</Text>
      </View>
    </SafeAreaView>
  );
}

const ICON_COL = 28;
const ROW_ICON_TEXT_GAP = 20;

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
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  backBtn: {
    marginLeft: -8,
    padding: 8,
    marginRight: 4,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    fontFamily: 'Space Grotesk',
    fontSize: 28,
    fontWeight: '700',
    color: '#19395A',
  },
  subtitle: {
    marginTop: 10,
    fontFamily: 'Inter',
    fontSize: 15,
    lineHeight: 22,
    color: '#25496E',
  },
  list: {
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  rowIconWrap: {
    width: ICON_COL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  rowLabel: {
    flex: 1,
    marginLeft: ROW_ICON_TEXT_GAP,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
    color: ROW_TEXT_COLOR,
  },
  rowDividerInset: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E4E9F0',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 36,
    gap: 12,
    paddingVertical: 8,
  },
  logoutLabel: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
    color: ROW_TEXT_COLOR,
  },
  version: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#9CA8B4',
  },
});
