import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';

export default function NamePromptScreen() {
    const { setDisplayName } = useAuth();
    const [name, setName] = useState('');

    function handleConfirm() {
        if (!name.trim()) return;
        setDisplayName(name.trim());
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <Text style={styles.emoji}>👋</Text>
            <Text style={styles.title}>Comment tu t'appelles ?</Text>
            <Text style={styles.subtitle}>
                C'est ce nom qui sera affiché aux autres membres de tes groupes.
            </Text>
            <TextInput
                style={styles.input}
                placeholder="Ton prénom"
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={setName}
                autoFocus
            />
            <Pressable style={styles.button} onPress={handleConfirm}>
                <Text style={styles.buttonText}>C'est parti</Text>
            </Pressable>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        justifyContent: 'center',
        gap: spacing.sm,
    },
    emoji: { fontSize: 48, textAlign: 'center', marginBottom: spacing.sm },
    title: { color: colors.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
    subtitle: { color: colors.muted, fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
    input: {
        backgroundColor: colors.card,
        borderRadius: 10,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    button: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: spacing.md,
    },
    buttonText: { color: colors.primaryText, fontWeight: '700', fontSize: 15 },
});