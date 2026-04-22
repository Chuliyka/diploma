import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text } from 'react-native';

export default function SettingsTabScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Налаштування</Text>
      <Text style={styles.subtitle}>Тут будуть налаштування акаунта та приватності.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontFamily: 'Space Grotesk',
    fontSize: 28,
    fontWeight: '700',
    color: '#19395A',
  },
  subtitle: {
    marginTop: 12,
    fontFamily: 'Inter',
    fontSize: 15,
    color: '#5B7287',
  },
});
