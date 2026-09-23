import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import Screen from '../components/Screen';
import { subscribeToUserStats, subscribeToUserActivities } from '../services/users';


export default function ProfileScreen({ navigation }) {
    const { displayName, uid } = useAuth();
    const [stats, setStats] = useState([]);
    const [activities, setActivities] = useState([]);
    useEffect(() => {
        const unsubscribe = subscribeToUserActivities(uid, setActivities);
        return unsubscribe;
    }, [uid]);

    return (
        <Screen style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.avatar}>👤</Text>
                <Text style={styles.name}>{displayName}</Text>
            </View>

            <Pressable style={styles.friendsButton} onPress={() => navigation.navigate('Friends')}>
                <Text style={styles.buttonText}>👥 Amis</Text>
            </Pressable>

            <Text style={styles.sectionTitle}>Accomplissements cumulés</Text>
            {stats.length === 0 ? (
                <Text style={styles.empty}>Aucune activité enregistrée encore.</Text>
            ) : (
                <FlatList
                    data={stats}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ gap: spacing.sm }}
                    renderItem={({ item }) => (
                        <View style={styles.row}>
                            <Text style={styles.icon}>{item.icon}</Text>
                            <Text style={styles.label}>{item.label}</Text>
                            <Text style={styles.value}>{(item.total || 0).toFixed(1)} {item.unit}</Text>
                        </View>
                    )}
                />
            )}
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Historique</Text>
            {activities.length === 0 ? (
                <Text style={styles.empty}>Aucune activité enregistrée encore.</Text>
            ) : (
                activities.map((a) => {
                    const date = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                    return (
                        <View key={a.id} style={styles.historyRow}>
                            <Text style={styles.icon}>{a.icon}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>{a.label}</Text>
                                <Text style={styles.historyDate}>{date.toLocaleDateString('fr-FR')} à {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                            </View>
                            <Text style={styles.value}>+{a.value} {a.unit}</Text>
                        </View>
                    );
                })
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    header: { alignItems: 'center', marginBottom: spacing.md },
    avatar: { fontSize: 48 },
    name: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.sm },
    friendsButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.lg },
    sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
    empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    icon: { fontSize: 24 },
    label: { color: colors.text, flex: 1, fontWeight: '600' },
    value: { color: colors.primary, fontWeight: '700' },
    buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 14 },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
    historyDate: { color: colors.muted, fontSize: 11, marginTop: 2 },
});