import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, ActivityIndicator, Switch, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing } from '../theme';
import { DURATION_PRESETS, RECURRENCE_PRESETS } from '../data/presets';
import { useAuth } from '../context/AuthContext';
import { createGroupement, updateGroupement, subscribeToGroupement } from '../services/groupements';

export default function CreateGroupementScreen({ navigation, route }) {
    const { groupId, groupementId } = route.params;
    const isEditing = !!groupementId;
    const { uid } = useAuth();

    const [name, setName] = useState('');
    const [recurring, setRecurring] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState(DURATION_PRESETS[1]);
    const [selectedRecurrence, setSelectedRecurrence] = useState(RECURRENCE_PRESETS[1]);
    const [customHours, setCustomHours] = useState('');
    const [startDate, setStartDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(!isEditing);

    useEffect(() => {
        if (!isEditing) return;
        const unsubscribe = subscribeToGroupement(groupId, groupementId, (g) => {
            setName(g.name);
            setRecurring(g.recurring);
            if (g.recurring) {
                const preset = RECURRENCE_PRESETS.find((p) => p.hours === g.recurrenceHours);
                if (preset) setSelectedRecurrence(preset);
                else { setSelectedRecurrence(RECURRENCE_PRESETS[RECURRENCE_PRESETS.length - 1]); setCustomHours(String(g.recurrenceHours)); }
            } else {
                const preset = DURATION_PRESETS.find((p) => p.hours === g.durationHours);
                if (preset) setSelectedDuration(preset);
                else { setSelectedDuration(DURATION_PRESETS[DURATION_PRESETS.length - 1]); setCustomHours(String(g.durationHours)); }
            }
            setLoaded(true);
        });
        return unsubscribe;
    }, [isEditing, groupId, groupementId]);

    function resolveHours(preset) {
        return preset.hours ?? Number(customHours);
    }

    function handleDateChange(event, selected) {
        setShowDatePicker(false);
        if (selected) {
            const merged = new Date(startDate);
            merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
            setStartDate(merged);
        }
    }

    function handleTimeChange(event, selected) {
        setShowTimePicker(false);
        if (selected) {
            const merged = new Date(startDate);
            merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            setStartDate(merged);
        }
    }

    async function handleSave() {
        if (!name.trim()) { Alert.alert('Nom manquant', 'Donne un nom à cet événement.'); return; }
        const hours = recurring ? resolveHours(selectedRecurrence) : resolveHours(selectedDuration);
        if (!hours || hours <= 0) { Alert.alert('Durée invalide', 'Indique une durée en heures supérieure à 0.'); return; }

        setSaving(true);
        try {
            if (isEditing) {
                await updateGroupement({
                    groupId, groupementId,
                    changes: recurring ? { name: name.trim(), recurrenceHours: hours } : { name: name.trim(), durationHours: hours },
                });
                navigation.goBack();
            } else {
                const newId = await createGroupement({
                    groupId, createdBy: uid, name: name.trim(), recurring,
                    recurrenceHours: recurring ? hours : null,
                    durationHours: recurring ? null : hours,
                    startedAt: recurring ? startDate : null,
                });
                navigation.replace('Groupement', { groupId, groupementId: newId });
            }
        } catch (err) {
            Alert.alert('Erreur', err.message);
        } finally {
            setSaving(false);
        }
    }

    if (!loaded) {
        return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
    }

    const presets = recurring ? RECURRENCE_PRESETS : DURATION_PRESETS;
    const selected = recurring ? selectedRecurrence : selectedDuration;
    const setSelected = recurring ? setSelectedRecurrence : setSelectedDuration;

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
            <View>
                <Text style={styles.sectionTitle}>Nom de l'événement</Text>
                <TextInput style={styles.input} placeholder="Ex : Vacances août 2026" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />
            </View>

            <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Récurrent</Text>
                    <Text style={styles.hint}>
                        {recurring ? 'Se répète automatiquement (ex : chaque semaine).' : 'Une seule session, avec un démarrage manuel.'}
                    </Text>
                </View>
                <Switch value={recurring} onValueChange={setRecurring} disabled={isEditing} trackColor={{ false: colors.border, true: colors.primary }} />
            </View>
            {isEditing && <Text style={styles.hint}>Le type (récurrent ou non) ne peut pas être changé après création.</Text>}

            <View>
                <Text style={styles.sectionTitle}>{recurring ? 'Fréquence' : 'Durée'}</Text>
                <View style={styles.row}>
                    {presets.map((p) => (
                        <Pressable key={p.label} onPress={() => setSelected(p)} style={[styles.chip, selected.label === p.label && styles.chipSelected]}>
                            <Text style={styles.chipText}>{p.label}</Text>
                        </Pressable>
                    ))}
                </View>
                {selected.hours === null && (
                    <TextInput
                        style={[styles.input, { marginTop: spacing.sm }]}
                        keyboardType="numeric"
                        placeholder="Nombre d'heures"
                        placeholderTextColor={colors.muted}
                        value={customHours}
                        onChangeText={setCustomHours}
                    />
                )}
            </View>

            {recurring && !isEditing && (
                <View>
                    <Text style={styles.sectionTitle}>Départ de la première période</Text>
                    <Text style={styles.hint}>
                        Ex : pour un hebdo qui tombe chaque dimanche à minuit, choisis le prochain dimanche à 00:00.
                    </Text>
                    <View style={styles.row}>
                        <Pressable style={[styles.input, { flex: 1 }]} onPress={() => setShowDatePicker(true)}>
                            <Text style={styles.dateText}>{startDate.toLocaleDateString('fr-FR')}</Text>
                        </Pressable>
                        <Pressable style={[styles.input, { flex: 1 }]} onPress={() => setShowTimePicker(true)}>
                            <Text style={styles.dateText}>{startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                        </Pressable>
                    </View>
                    {showDatePicker && (
                        <DateTimePicker value={startDate} mode="date" display="default" onChange={handleDateChange} />
                    )}
                    {showTimePicker && (
                        <DateTimePicker value={startDate} mode="time" display="default" is24Hour onChange={handleTimeChange} />
                    )}
                </View>
            )}

            <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>{isEditing ? 'Enregistrer' : 'Créer le groupement'}</Text>}
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: spacing.sm },
    hint: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: spacing.sm },
    input: { backgroundColor: colors.card, borderRadius: 10, padding: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
    dateText: { color: colors.text, fontSize: 14 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: { paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    chipSelected: { borderColor: colors.primary, backgroundColor: '#1c1f3a' },
    chipText: { color: colors.text, fontSize: 13 },
    button: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
    buttonText: { color: colors.primaryText, fontWeight: '700', fontSize: 15 },
});