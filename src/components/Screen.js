import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Ajoute l'espace nécessaire en bas pour ne pas passer derrière la barre
// de navigation du téléphone (boutons Android, home bar iOS).
export default function Screen({ style, children }) {
    const insets = useSafeAreaInsets();
    return <View style={[style, { paddingBottom: insets.bottom }]}>{children}</View>;
}