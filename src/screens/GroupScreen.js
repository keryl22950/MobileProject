import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Share } from 'react-native';
import { colors, spacing } from '../theme';

// TODO: remplacer par un onSnapshot Firestore sur la collection
// "groups/{groupId}/members", trié par progression décroissante.
const MOCK_MEMBERS = [
  { id: 'a', name: 'Toi', progress: 32, isMe: true },
  { id: 'b', name: 'Léa', progress: 41 },
  { id: 'c', name: 'Nico', progress: 18 },
  { id: 'd', name: 'Sam', progress: 27 },
];

const TARGET = 50;
const UNIT = 'km';
const INVITE_CODE = 'ABC123';

export default function GroupScreen({ navigation, route }) {
  const sortedMembers = [...MOCK_MEMBERS].sort((a, b) => b.progress - a.progress);

  function handleShare() {
    Share.share({
      message: `Rejoins mon challenge "Course à pied" sur l'app avec le code ${INVITE_CODE} !`,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.challengeTitle}>🏃 Course à pied — {TARGET} {UNIT}</Text>
        <Text style={styles.timeLeft}>⏳ 8h restantes</Text>
      </View>

      <Text style={styles.sectionTitle}>Classement du groupe</Text>
      <FlatList
        data={sortedMembers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item, index }) => {
          const pct = Math.min(100, Math.round((item.progress / TARGET) * 100));
          return (
            <View style={[styles.memberRow, item.isMe && styles.memberRowMe]}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{item.name}</Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                </View>
              </View>
              <Text style={styles.memberValue}>
                {item.progress}/{TARGET} {UNIT}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.buttonPrimary]}
          onPress={() => navigation.navigate('LogActivity', { groupId: route.params?.groupId })}
        >
          <Text style={styles.buttonText}>+ Enregistrer une activité</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            style={[styles.button, styles.buttonSecondary, { flex: 1 }]}
            onPress={() => navigation.navigate('Chat', { groupId: route.params?.groupId })}
          >
            <Text style={styles.buttonText}>💬 Chat</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonSecondary, { flex: 1 }]}
            onPress={handleShare}
          >
            <Text style={styles.buttonText}>📤 Inviter</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: { marginBottom: spacing.md },
  challengeTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  timeLeft: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },
  sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberRowMe: { borderColor: colors.primary },
  rank: { color: colors.muted, width: 28, fontWeight: '700' },
  memberName: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  progressBarBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: colors.primary },
  memberValue: { color: colors.muted, fontSize: 12 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  button: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 14 },
});
