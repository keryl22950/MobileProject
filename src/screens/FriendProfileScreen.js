import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { colors, spacing } from '../theme';
import { subscribeToUserStats } from '../services/users';

export default function FriendProfileScreen({ route }) {
    const { friendUid, friendName } = route.params;
    const [stats, setStats] = useState([]);

    useEffect(() => {
        const unsubscribe = subscribeToUserStats(friendUid, setStats);
        return unsubscribe;
    }, [friendUid]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.avatar}>👤</Text>
                <Text style={styles.name}>{friendName}</Text>
            </View>
            <Text style={styles.sectionTitle}>Accomplissements</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    header: { alignItems: 'center', marginBottom: spacing.lg },
    avatar: { fontSize: 48 },
    name: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.sm },
    sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
    empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    icon: { fontSize: 24 },
    label: { color: colors.text, flex: 1, fontWeight: '600' },
    value: { color: colors.primary, fontWeight: '700' },
});