import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable } from 'react-native';
import { colors, spacing } from '../theme';
import { subscribeToGroupements, getCurrentPeriod } from '../services/groupements';

export default function HistoriqueScreen({ navigation, route }) {
    const { groupId } = route.params;
    const [groupements, setGroupements] = useState([]);

    useEffect(() => {
        const unsubscribe = subscribeToGroupements(groupId, setGroupements);
        return unsubscribe;
    }, [groupId]);

    const sections = groupements
        .map((g) => {
            const period = getCurrentPeriod(g);
            const entries = [];
            if (g.recurring && period && period.periodIndex > 0) {
                for (let i = 0; i < period.periodIndex; i++) {
                    entries.push({ key: `${g.id}_P${i}`, label: `Période #${i + 1}`, groupementId: g.id, periodKey: `P${i}` });
                }
            } else if (!g.recurring && period && period.periodEnd.getTime() < Date.now()) {
                entries.push({ key: `${g.id}_P0`, label: 'Terminé', groupementId: g.id, periodKey: 'P0' });
            }
            return { title: g.name, data: entries };
        })
        .filter((s) => s.data.length > 0);

    return (
        <View style={styles.container}>
            {sections.length === 0 ? (
                <Text style={styles.empty}>Pas encore de challenge terminé dans ce groupe.</Text>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.key}
                    renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
                    renderItem={({ item }) => (
                        <Pressable
                            style={styles.row}
                            onPress={() => navigation.navigate('GroupementHistorique', { groupId, groupementId: item.groupementId, periodKey: item.periodKey, label: item.label })}
                        >
                            <Text style={styles.rowText}>{item.label}</Text>
                            <Text style={styles.chevron}>›</Text>
                        </Pressable>
                    )}
                    contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
    sectionTitle: { color: colors.muted, fontSize: 13, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    rowText: { color: colors.text, flex: 1, fontWeight: '600' },
    chevron: { color: colors.muted, fontSize: 18 },
});