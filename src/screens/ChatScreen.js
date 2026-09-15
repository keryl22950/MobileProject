import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing } from '../theme';

// TODO: remplacer par un onSnapshot Firestore sur
// "groups/{groupId}/messages", trié par createdAt croissant.
const MOCK_MESSAGES = [
  { id: '1', author: 'Léa', text: 'Allez on tient le rythme ! 💪', isMe: false },
  { id: '2', author: 'Toi', text: "J'ai fait 5km ce matin, ça avance", isMe: true },
  { id: '3', author: 'Nico', text: 'Je vous rejoins ce soir pour le sprint final', isMe: false },
];

export default function ChatScreen({ route }) {
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [text, setText] = useState('');

  function handleSend() {
    if (!text.trim()) return;
    // TODO: ajouter un document dans Firestore "groups/{groupId}/messages"
    setMessages((prev) => [
      ...prev,
      { id: String(prev.length + 1), author: 'Toi', text, isMe: true },
    ]);
    setText('');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View style={[styles.bubbleRow, item.isMe && styles.bubbleRowMe]}>
            <View style={[styles.bubble, item.isMe && styles.bubbleMe]}>
              {!item.isMe && <Text style={styles.author}>{item.author}</Text>}
              <Text style={styles.text}>{item.text}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Écrire un message..."
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendText}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleMe: { backgroundColor: colors.primary, borderColor: colors.primary },
  author: { color: colors.muted, fontSize: 11, marginBottom: 2, fontWeight: '600' },
  text: { color: colors.text, fontSize: 14 },
  inputRow: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: colors.primaryText, fontSize: 16 },
});
