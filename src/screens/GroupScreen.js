import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Share, ActivityIndicator } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { subscribeToGroup, subscribeToMembers } from '../services/groups';
import { subscribeToGroupements, getCurrentPeriod } from '../services/groupements';

export default function GroupScreen({ navigation, route }) {
  const { groupId } = route.params;
  const { uid } = useAuth();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [groupements, setGroupements] = useState([]);

  useEffect(() => {
    const u1 = subscribeToGroup(groupId, setGroup);
    const u2 = subscribeToMembers(groupId, setMembers);
    const u3 = subscribeToGroupements(groupId, setGroupements);
    return () => { u1(); u2(); u3(); };
  }, [groupId]);

  if (!group) {
    return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  const me = members.find((m) => m.id === uid);
  const isAdmin = me?.role === 'creator' || me?.role === 'admin';

  function handleShare() {
    Share.share({ message: `Rejoins mon groupe "${group.name}" sur l'app avec le code ${group.inviteCode} !` });
  }

  return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.groupTitle}>👥 {group.name}</Text>
          <Text style={styles.code}>Code : {group.inviteCode} · {members.length} membres</Text>
        </View>

        <View style={styles.topActions}>
          <Pressable style={[styles.button, styles.buttonSecondary, { flex: 1 }]} onPress={() => navigation.navigate('Members', { groupId })}>
            <Text style={styles.buttonText}>👤 Membres</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonSecondary, { flex: 1 }]} onPress={() => navigation.navigate('Chat', { groupId })}>
            <Text style={styles.buttonText}>💬 Chat</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonSecondary, { flex: 1 }]} onPress={() => navigation.navigate('Historique', { groupId })}>
            <Text style={styles.buttonText}>🕓 Historique</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.button, styles.buttonSecondary, { marginBottom: spacing.md }]} onPress={handleShare}>
          <Text style={styles.buttonText}>📤 Inviter avec le code</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Groupements</Text>
        <FlatList
            data={groupements}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.sm }}
            ListEmptyComponent={<Text style={styles.empty}>Aucun groupement pour l'instant.</Text>}
            renderItem={({ item }) => {
              const period = getCurrentPeriod(item);
              let subtitle;
              if (item.status === 'pending') {
                subtitle = 'En attente de démarrage';
              } else if (period?.notStarted) {
                subtitle = `Débute le ${period.periodEnd.toLocaleDateString('fr-FR')} à ${period.periodEnd.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
              } else if (item.recurring) {
                subtitle = `Récurrent · période #${period.periodIndex + 1}`;
              } else {
                subtitle = 'Ponctuel · en cours';
              }
              return (
                  <Pressable style={styles.card} onPress={() => navigation.navigate('Groupement', { groupId, groupementId: item.id })}>
                    <Text style={styles.cardIcon}>{item.recurring ? '🔁' : '📅'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <Text style={styles.cardSubtitle}>{subtitle}</Text>
                    </View>
                  </Pressable>
              );
            }}
        />

        {isAdmin && (
            <Pressable style={[styles.button, styles.buttonPrimary, { marginTop: spacing.md }]} onPress={() => navigation.navigate('CreateGroupement', { groupId })}>
              <Text style={styles.buttonText}>+ Nouveau groupement</Text>
            </Pressable>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: { marginBottom: spacing.md },
  groupTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  code: { color: colors.muted, fontSize: 12, marginTop: 4 },
  topActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardIcon: { fontSize: 26 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  cardSubtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  button: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 13 },
});