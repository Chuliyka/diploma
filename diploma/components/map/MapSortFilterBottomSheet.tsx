import { AppColors } from '@/constants/app-colors';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type MapSortFilterKey = 'all' | 'sport' | 'coffee';

const TAB_BAR_OFFSET = 78 + 18;

export type MapSortFilterBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  bottomInset: number;
  selectedKey: MapSortFilterKey;
  onSelectKey: (key: MapSortFilterKey) => void;
};

export function MapSortFilterBottomSheet({
  visible,
  onClose,
  bottomInset,
  selectedKey,
  onSelectKey,
}: MapSortFilterBottomSheetProps) {
  const padBottom = bottomInset + TAB_BAR_OFFSET + 12;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Сортування за статусами/інтересами</Text>

          <View style={[styles.row, { paddingBottom: padBottom }]}>
            <Pressable
              onPress={() => onSelectKey('all')}
              style={({ pressed }) => [
                styles.card,
                selectedKey === 'all' ? styles.cardSelected : styles.cardIdle,
                pressed && styles.cardPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedKey === 'all' }}
              accessibilityLabel="Усі"
            >
              <Ionicons name="people-outline" size={36} color={AppColors.primary} />
              <Text style={styles.cardLabel}>Усі</Text>
            </Pressable>

            <Pressable
              onPress={() => onSelectKey('sport')}
              style={({ pressed }) => [
                styles.card,
                selectedKey === 'sport' ? styles.cardSelected : styles.cardIdle,
                pressed && styles.cardPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedKey === 'sport' }}
              accessibilityLabel="Спорт та активність"
            >
              <MaterialCommunityIcons name="tennis-ball" size={38} color={AppColors.primary} />
              <Text style={styles.cardLabel}>Спорт/активність</Text>
            </Pressable>

            <Pressable
              onPress={() => onSelectKey('coffee')}
              style={({ pressed }) => [
                styles.card,
                selectedKey === 'coffee' ? styles.cardSelected : styles.cardIdle,
                pressed && styles.cardPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedKey === 'coffee' }}
              accessibilityLabel="Кава та перекус"
            >
              <Ionicons name="cafe-outline" size={36} color={AppColors.primary} />
              <Text style={styles.cardLabel}>Кава/перекус</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 64,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E4E9F0',
    marginBottom: 14,
  },
  title: {
    fontFamily: 'Space Grotesk',
    fontSize: 17,
    fontWeight: '700',
    color: '#19395A',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
    lineHeight: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  card: {
    flex: 1,
    minHeight: 108,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    backgroundColor: '#FAFBFF',
  },
  cardIdle: {
    borderColor: '#E4E9F0',
  },
  cardSelected: {
    borderColor: AppColors.primary,
    backgroundColor: '#FFFFFF',
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardLabel: {
    marginTop: 10,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    color: '#25496E',
    textAlign: 'center',
    lineHeight: 16,
  },
});
