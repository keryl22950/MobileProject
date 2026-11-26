import React, { useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { colors, spacing } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getMessageFeed, sendMessage } from '../services/groups';
import { usePagedFeed } from '../hooks/usePagedFeed';
import FeedMore from '../components/FeedMore';

export default function ChatScreen({ route }) {
  const { groupId } = route.params;
  const { uid, displayName } = useAuth();
  const feed = usePagedFeed(useMemo(() => getMessageFeed(groupId), [groupId]));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const insets = useSafeAreaInsets();

  async function handleSend() {
    if (!text.trim() || sendLock.current) return;
    const toSend = text.trim();
    sendLock.current = true;
    setSending(true);
    try {
      await sendMessage({ groupId, uid, userName: displayName, text: toSend });
      setText('');
    } catch {
      Alert.alert('Envoi impossible', 'Ton message est conservé. Tu peux réessayer.');
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={feed.items}
        inverted
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 30 }}
        ListFooterComponent={<FeedMore {...feed} label="Afficher les messages précédents" />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => {
          const isMe = item.userId === uid;
          return (
            <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
              <View style={[styles.bubble, isMe && styles.bubbleMe]}>
                {!isMe && <Text style={styles.author}>{item.userName}</Text>}
                <Text style={styles.text}>{item.text}</Text>
              </View>
            </View>
          );
        }}
      />
      <View style={[styles.inputRow, { paddingBottom: spacing.sm + insets.bottom }]}>
        <TextInput
          style={styles.input}
          placeholder="Écrire un message..."
          placeholderTextColor={colors.muted}
          value={text}
          editable={!sending}
          onChangeText={setText}
        />
        <Pressable
          style={styles.sendButton}
          onPress={handleSend}
          disabled={sending || !text.trim()}
          accessibilityLabel="Envoyer le message"
        >
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
