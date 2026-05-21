import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type StatusOption = {
  emoji: string;
  label: string;
};

type StatusGroup = {
  title: string;
  options: StatusOption[];
};

const STATUS_GROUPS: StatusGroup[] = [
  {
    title: '☕️ Відпочинок та напої',
    options: [
      { emoji: '☕️', label: 'П’ю каву' },
      { emoji: '☕️', label: 'По каві?' },
      { emoji: '💨', label: 'На перекур' },
      { emoji: '🍷', label: 'Келих вина' },
      { emoji: '🍹', label: 'На терасі' },
    ],
  },
  {
    title: '🍕 Їжа та смаколики',
    options: [
      { emoji: '🍔', label: 'Хочу смачно поїсти' },
      { emoji: '🍦', label: 'Йду за морозивом' },
    ],
  },
  {
    title: '🎾 Спорт та активність',
    options: [
      { emoji: '🎾', label: 'Хто на теніс?' },
      { emoji: '🏃‍♂️', label: 'На пробіжці' },
      { emoji: '🚲', label: 'Велопрогулянка' },
      { emoji: '🧘‍♂️', label: 'Йога на свіжому повітрі' },
      { emoji: '🛹', label: 'Катаюсь на скейті/роликах' },
      { emoji: '🛼', label: 'На роликах' },
      { emoji: '🎱', label: 'Більярд' },
    ],
  },
  {
    title: '🚶‍♂️ Дозвілля та Lifestyle',
    options: [
      { emoji: '🚶‍♂️', label: 'Прогулянка в парку' },
      { emoji: '🌳', label: 'Прогулянка в парку' },
      { emoji: '🐕', label: 'Вигулюю собаку' },
      { emoji: '🛍️', label: 'Шопінг' },
      { emoji: '📸', label: 'Шукаю модель для фото' },
    ],
  },
  {
    title: '🎮 Розваги та хобі',
    options: [
      { emoji: '🎮', label: 'Шукаю тімейта (PS/PC)' },
      { emoji: '🎬', label: 'Хочу в кіно' },
      { emoji: '🎭', label: 'Хочу в театр' },
      { emoji: '🎲', label: 'Настільні ігри' },
    ],
  },
  {
    title: '💻 Робота',
    options: [
      { emoji: '👨‍💻', label: 'Працюю в коворкінгу' },
    ],
  },
];

const DEFAULT_STATUS: StatusOption = { emoji: '🛍️', label: 'Шопінг' };

export function formatStatusValue(option: StatusOption) {
  return `${option.emoji} ${option.label}`;
}

function parseStatus(value?: string | null): StatusOption {
  const normalized = value?.trim();
  if (!normalized) return DEFAULT_STATUS;

  const matched = STATUS_GROUPS.flatMap((group) => group.options).find(
    (option) => formatStatusValue(option) === normalized,
  );

  if (matched) return matched;

  const [emoji = DEFAULT_STATUS.emoji, ...labelParts] = normalized.split(' ');
  const label = labelParts.join(' ').trim() || normalized;
  return { emoji, label };
}

export function UserStatusSelector({
  value,
  visible,
  saving,
  onOpen,
  onClose,
  onSelect,
}: {
  value?: string | null;
  visible: boolean;
  saving?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (status: string) => void;
}) {
  const current = parseStatus(value);

  return (
    <>
      <Pressable
        style={styles.statusRow}
        onPress={onOpen}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel="Обрати поточний статус"
      >
        <Text style={styles.statusLabel}>Твій поточний статус:</Text>
        <View style={styles.statusBubble}>
          <Text style={styles.statusEmoji}>{current.emoji}</Text>
        </View>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Статуси</Text>
              <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
                <Ionicons name="close" size={22} color="#19395A" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.optionsContent}>
              {STATUS_GROUPS.map((group) => (
                <View key={group.title} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <View style={styles.optionGrid}>
                    {group.options.map((option) => {
                      const status = formatStatusValue(option);
                      const selected = status === value?.trim();
                      return (
                        <Pressable
                          key={status}
                          style={[styles.option, selected && styles.optionSelected]}
                          onPress={() => onSelect(status)}
                          disabled={saving}
                        >
                          <Text style={styles.optionEmoji}>{option.emoji}</Text>
                          <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: 'Space Grotesk',
    fontSize: 22,
    fontWeight: '700',
    color: '#19395A',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F0FA',
  },
  optionsContent: {
    paddingBottom: 16,
  },
  group: {
    paddingTop: 14,
  },
  groupTitle: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '700',
    color: '#6A8298',
    marginBottom: 10,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    minHeight: 42,
    maxWidth: '100%',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#E4E9F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  optionSelected: {
    borderColor: '#9D8DF1',
    backgroundColor: '#F0E8FA',
  },
  optionEmoji: {
    fontSize: 17,
  },
  optionText: {
    flexShrink: 1,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '500',
    color: '#19395A',
    lineHeight: 18,
  },
  optionTextSelected: {
    color: '#6C55D8',
  },
});
