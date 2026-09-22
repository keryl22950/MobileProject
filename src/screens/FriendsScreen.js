import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, Alert } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { searchUsersByName, addFriend, subscribeToFriends } from '../services/users';

export default function FriendsScreen({ navigation }) {
    const { uid } = useAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [friends, setFriends] = useState([]);

    useEffect(() => {
        const unsubscribe = subscribeToFriends(uid, setFriends);
        return unsubscribe;
    }, [uid]);

    async function handleSearch() {
        if (!query.trim()) { setResults([]); return; }
        try {
            const found = await searchUsersByName(query);
            setResults(found.filter((u) => u.id !== uid));
        } catch (err) {
            Alert.alert('Erreur', err.message);
        }
    }

    async function handleAdd(friendUid) {
        try {
            await addFriend({ uid, friendUid });
        } catch (err) {
            Alert.alert('Erreur', err.message);
        }
    }

    const friendIds = friends.map((f) => f.id);

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Rechercher un pseudo</Text>
            <View style={styles.searchRow}>
                <TextInput style={styles.input} placeholder="Pseudo..." placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} onSubmitEditing={handleSearch} />
                <Pressable style={styles.searchButton} onPress={handleSearch}><Text style={styles.buttonText}>🔍</Text></Pressable>
            </View>

            {results.length > 0 && (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.sm }}
                    renderItem={({ item }) => (
                        <View style={styles.row}>
                            <Text style={styles.name}>{item.displayName}</Text>
                            {friendIds.includes(item.id) ? (
                                <Text style={styles.already}>Déjà ami</Text>
                            ) : (
                                <Pressable style={styles.smallButton} onPress={() => handleAdd(item.id)}>
                                    <Text style={styles.buttonText}>+ Ajouter</Text>
                                </Pressable>
                            )}
                        </View>
                    )}
                />
            )}

            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Mes amis</Text>
            <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: spacing.sm }}
                ListEmptyComponent={<Text style={styles.empty}>Pas encore d'amis ajoutés.</Text>}
                renderItem={({ item }) => (
                    <Pressable style={styles.row} onPress={() => navigation.navigate('FriendProfile', { friendUid: item.id, friendName: item.displayName })}>
                        <Text style={styles.name}>{item.displayName}</Text>
                        <Text style={styles.chevron}>›</Text>
                    </Pressable>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
    sectionTitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.sm, textTransform: 'uppercase' },
    searchRow: { flexDirection: 'row', gap: spacing.sm },
    input: { flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
    searchButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: spacing.md, justifyContent: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 10, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
    name: { color: colors.text, fontWeight: '600' },
    already: { color: colors.muted, fontSize: 12 },
    chevron: { color: colors.muted, fontSize: 18 },
    smallButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: spacing.sm },
    buttonText: { color: colors.primaryText, fontWeight: '600', fontSize: 13 },
    empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.md },
});