import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { colors, spacing } from '../theme';
import { subscribeToChallenges } from '../services/challenges';

export default function GroupementHistoriqueScreen({ navigation, route }) {
    const { groupId, groupementId, periodKey, label } = route.params;
    const [challenges, setChallenges] = useState([]);

    useEffect(() => {
        const unsubscribe = subscribeToChallenges(groupId, groupementId, setChallenges);
        return unsubscribe;
    }, [groupId, groupementId]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{label}</Text>
            <FlatList
                data={challenges}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: spacing.sm }}
                ListEmptyComponent={<Text style={styles.empty}>Aucun challenge.</Text>}
                renderItem={({ item }) => (
                    <Pressable
                        style={styles.card}
                        onPress={() => navigation.navigate('Challenge', { groupId, groupementId, challengeId: item.id, periodKey, readOnly: true })}
                    >
                        <Text style={styles.icon}>{item.icon}</Text>
                        <Text style={styles.label}>{item.label}</Text>
                    </Pressable>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md },
    empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.lg },
    card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    icon: { fontSize: 24 },
    label: { color: colors.text, fontWeight: '600' },
});