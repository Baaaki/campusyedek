import { StyleSheet, ScrollView, Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Text as RNText, View as RNView } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const quickActions = [
  { icon: 'qrcode' as const, label: 'QR Yoklama', color: '#6366f1', route: '/screens/qr-attendance' as const },
  { icon: 'calendar' as const, label: 'Ders Programi', color: '#8b5cf6', route: '/(tabs)/two' as const },
  { icon: 'bar-chart' as const, label: 'Notlarim', color: '#ec4899', route: '/screens/my-grades' as const },
  { icon: 'cutlery' as const, label: 'Yemekhane', color: '#f59e0b', route: '/screens/cafeteria' as const },
];

const todaySchedule = [
  { time: '09:00', course: 'Veri Yapilari', room: 'D-201', type: 'Teori' },
  { time: '11:00', course: 'Isletim Sistemleri', room: 'Lab-3', type: 'Lab' },
  { time: '14:00', course: 'Yazilim Muhendisligi', room: 'A-105', type: 'Teori' },
];

export default function HomeScreen() {
  const theme = useColorScheme() ?? 'light';
  const c = Colors[theme];
  const router = useRouter();

  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: c.background }]}>
      <RNView style={[styles.container, { backgroundColor: c.background }]}>
        {/* Header */}
        <RNView style={styles.header}>
          <RNText style={[styles.greeting, { color: c.textSecondary }]}>Merhaba,</RNText>
          <RNText style={[styles.name, { color: c.text }]}>Burak Aktas</RNText>
          <RNText style={[styles.subtitle, { color: c.textMuted }]}>Bilgisayar Muhendisligi - 3. Sinif</RNText>
        </RNView>

        {/* Quick Actions */}
        <RNView style={styles.section}>
          <RNText style={[styles.sectionTitle, { color: c.text }]}>Hizli Erisim</RNText>
          <RNView style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <Pressable
                key={action.label}
                style={[styles.actionCard, { backgroundColor: c.card }]}
                onPress={() => router.push(action.route)}
              >
                <RNView style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                  <FontAwesome name={action.icon} size={24} color={action.color} />
                </RNView>
                <RNText style={[styles.actionLabel, { color: c.text }]}>{action.label}</RNText>
              </Pressable>
            ))}
          </RNView>
        </RNView>

        {/* Today's Schedule */}
        <RNView style={styles.section}>
          <RNText style={[styles.sectionTitle, { color: c.text }]}>Bugunun Dersleri</RNText>
          {todaySchedule.map((item) => (
            <RNView key={item.time} style={[styles.scheduleCard, { backgroundColor: c.card }]}>
              <RNView style={styles.scheduleTime}>
                <RNText style={[styles.timeText, { color: c.tint }]}>{item.time}</RNText>
                <RNView style={[styles.typeBadge, item.type === 'Lab' && styles.labBadge]}>
                  <RNText style={[styles.typeText, { color: c.tint }, item.type === 'Lab' && styles.labText]}>
                    {item.type}
                  </RNText>
                </RNView>
              </RNView>
              <RNView style={styles.scheduleInfo}>
                <RNText style={[styles.courseName, { color: c.text }]}>{item.course}</RNText>
                <RNText style={[styles.roomText, { color: c.textMuted }]}>{item.room}</RNText>
              </RNView>
              <FontAwesome name="chevron-right" size={14} color={c.textMuted} />
            </RNView>
          ))}
        </RNView>

        {/* Stats */}
        <RNView style={styles.section}>
          <RNText style={[styles.sectionTitle, { color: c.text }]}>Donem Ozeti</RNText>
          <RNView style={styles.statsRow}>
            {[
              { value: '3.42', label: 'GPA' },
              { value: '6', label: 'Ders' },
              { value: '%92', label: 'Devam' },
            ].map((stat) => (
              <RNView key={stat.label} style={[styles.statCard, { backgroundColor: c.card }]}>
                <RNText style={[styles.statValue, { color: c.tint }]}>{stat.value}</RNText>
                <RNText style={[styles.statLabel, { color: c.textMuted }]}>{stat.label}</RNText>
              </RNView>
            ))}
          </RNView>
        </RNView>
      </RNView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 24 },
  greeting: { fontSize: 16 },
  name: { fontSize: 28, fontWeight: 'bold', marginTop: 2 },
  subtitle: { fontSize: 14, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: { fontSize: 13, fontWeight: '500' },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  scheduleTime: { alignItems: 'center', marginRight: 14, minWidth: 50 },
  timeText: { fontSize: 15, fontWeight: '600' },
  typeBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  labBadge: { backgroundColor: '#fef3c7' },
  typeText: { fontSize: 10, fontWeight: '600' },
  labText: { color: '#d97706' },
  scheduleInfo: { flex: 1 },
  courseName: { fontSize: 15, fontWeight: '500' },
  roomText: { fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 4 },
});
