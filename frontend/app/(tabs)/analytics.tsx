import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/typography';
import { screenPadding } from '../../constants/spacing';

export default function AnalyticsScreen() {
  return (
    <LinearGradient colors={['#0A0B0F', '#0D1018', '#0A0B0F']} style={styles.bg}>
      <View style={styles.container}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.placeholder}>Performance trends will appear here — Sprint 6</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg:          { flex: 1 },
  container:   { flex: 1, paddingHorizontal: screenPadding, paddingTop: 60 },
  title:       { fontSize: typography.scale.xl, fontWeight: typography.weights.bold, color: colors.text.primary, marginBottom: 8 },
  placeholder: { color: colors.text.muted, fontSize: typography.scale.sm },
});
